


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_reports_analytics"("p_branch_ids" "uuid"[], "p_from" "date", "p_to" "date", "p_grouping" "text", "p_as_of" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_as_of IS NULL
     OR p_grouping IS NULL OR p_grouping NOT IN ('day', 'week', 'month') THEN
    RAISE EXCEPTION 'Invalid reporting range, reference date or grouping.';
  END IF;

  RETURN (
    WITH
    scoped_branches AS (
      SELECT id FROM public.church_branches
      WHERE id = ANY(coalesce(p_branch_ids, ARRAY[]::uuid[]))
    ),
    scoped_members AS (
      SELECT m.church_branch_id, m.is_archived, m.member_status, m.first_attendance_date,
        (m.created_at AT TIME ZONE 'Asia/Manila')::date AS record_date
      FROM public.members m JOIN scoped_branches b ON b.id = m.church_branch_id
    ),
    membership AS (
      SELECT church_branch_id AS "branchId",
        count(*) FILTER (WHERE is_archived IS FALSE) AS "nonArchivedMembers",
        count(*) FILTER (WHERE is_archived IS FALSE AND member_status = 'active') AS "storedActiveMembers",
        count(*) FILTER (WHERE is_archived IS TRUE) AS "archivedMembers",
        count(*) FILTER (WHERE record_date BETWEEN p_from AND p_to) AS "recordsAddedInRange",
        count(*) FILTER (WHERE first_attendance_date BETWEEN p_from AND p_to) AS "firstAttendancesInRange",
        count(*) FILTER (WHERE is_archived IS FALSE AND first_attendance_date IS NULL) AS "missingFirstAttendanceDate"
      FROM scoped_members GROUP BY GROUPING SETS ((church_branch_id), ())
    ),
    membership_events AS (
      SELECT church_branch_id, date_trunc(p_grouping, record_date::timestamp)::date AS period, 'record' AS kind
      FROM scoped_members WHERE record_date BETWEEN p_from AND p_to
      UNION ALL
      SELECT church_branch_id, date_trunc(p_grouping, first_attendance_date::timestamp)::date, 'attendance'
      FROM scoped_members WHERE first_attendance_date BETWEEN p_from AND p_to
    ),
    membership_trend AS (
      SELECT church_branch_id AS "branchId", period AS "periodStart",
        count(*) FILTER (WHERE kind = 'record') AS "recordsAdded",
        count(*) FILTER (WHERE kind = 'attendance') AS "firstAttendances"
      FROM membership_events GROUP BY GROUPING SETS ((church_branch_id, period), (period))
    ),
    completed_services AS (
      SELECT s.id, s.church_branch_id, s.service_date, s.service_type
      FROM public.services s JOIN scoped_branches b ON b.id = s.church_branch_id
      WHERE s.status = 'completed' AND s.service_date BETWEEN p_from AND p_to
    ),
    -- Deduplicate physical participation at the (service, member) boundary.
    physical_pairs AS (
      SELECT DISTINCT a.service_id, a.member_id
      FROM public.attendance_records a JOIN completed_services s ON s.id = a.service_id
      WHERE a.attendance_status IN ('present', 'late') AND a.member_id IS NOT NULL
    ),
    attendance_source AS (
      SELECT s.*, a.member_id,
        date_trunc(p_grouping, s.service_date::timestamp)::date AS period,
        date_trunc('week', s.service_date::timestamp)::date AS week
      FROM completed_services s LEFT JOIN physical_pairs a ON a.service_id = s.id
    ),
    attendance AS (
      SELECT church_branch_id AS "branchId", count(DISTINCT id) AS "completedServices",
        count(member_id) AS "physicalCheckIns", count(DISTINCT member_id) AS "uniqueMembers",
        round(count(member_id)::numeric / nullif(count(DISTINCT id), 0), 2) AS "averagePerService"
      FROM attendance_source GROUP BY GROUPING SETS ((church_branch_id), ())
    ),
    attendance_by_type AS (
      SELECT church_branch_id AS "branchId", service_type AS "serviceType",
        count(DISTINCT id) AS "completedServices", count(member_id) AS "physicalCheckIns",
        count(DISTINCT member_id) AS "uniqueMembers",
        round(count(member_id)::numeric / nullif(count(DISTINCT id), 0), 2) AS "averagePerService"
      FROM attendance_source GROUP BY GROUPING SETS ((church_branch_id, service_type), (service_type))
    ),
    attendance_trend AS (
      SELECT church_branch_id AS "branchId", period AS "periodStart",
        count(DISTINCT id) AS "completedServices", count(member_id) AS "physicalCheckIns",
        count(DISTINCT member_id) AS "uniqueMembers",
        round(count(member_id)::numeric / nullif(count(DISTINCT id), 0), 2) AS "averagePerService"
      FROM attendance_source GROUP BY GROUPING SETS ((church_branch_id, period), (period))
    ),
    weekly_attendance AS (
      SELECT church_branch_id AS "branchId", week AS "weekStart",
        count(DISTINCT id) AS "completedServices", count(member_id) AS "physicalCheckIns",
        count(DISTINCT member_id) AS "uniqueMembers",
        round(count(member_id)::numeric / nullif(count(DISTINCT id), 0), 2) AS "averagePerService",
        week < date_trunc('week', p_as_of::timestamp)::date AS "isFinished",
        (p_from > week OR p_to < week + 6) AS "isPartialRange",
        NULL::bigint AS "eligibleMemberCount", NULL::numeric AS "participationRatePercent"
      FROM attendance_source GROUP BY GROUPING SETS ((church_branch_id, week), (week))
    ),
    scoped_follow_ups AS (
      SELECT f.id, f.church_branch_id, f.member_id, f.follow_up_date, f.method, f.outcome, f.next_follow_up_date, f.created_at
      FROM public.member_follow_ups f JOIN scoped_branches b ON b.id = f.church_branch_id
    ),
    ranged_follow_ups AS (
      SELECT * FROM scoped_follow_ups WHERE follow_up_date BETWEEN p_from AND p_to
    ),
    follow_ups AS (
      SELECT church_branch_id AS "branchId", count(*) AS total, count(DISTINCT member_id) AS "uniqueMembers"
      FROM ranged_follow_ups GROUP BY GROUPING SETS ((church_branch_id), ())
    ),
    follow_up_by_method AS (
      SELECT church_branch_id AS "branchId", method, count(*) AS count
      FROM ranged_follow_ups GROUP BY GROUPING SETS ((church_branch_id, method), (method))
    ),
    follow_up_by_outcome AS (
      SELECT church_branch_id AS "branchId", outcome, count(*) AS count
      FROM ranged_follow_ups GROUP BY GROUPING SETS ((church_branch_id, outcome), (outcome))
    ),
    follow_up_trend AS (
      SELECT church_branch_id AS "branchId", date_trunc(p_grouping, follow_up_date::timestamp)::date AS "periodStart", count(*) AS value
      FROM ranged_follow_ups GROUP BY GROUPING SETS (
        (church_branch_id, date_trunc(p_grouping, follow_up_date::timestamp)::date),
        (date_trunc(p_grouping, follow_up_date::timestamp)::date)
      )
    ),
    -- Current state: latest accessible record per member, not latest in the report range.
    -- Ties use creation time then UUID so the definition remains deterministic.
    latest_follow_ups AS (
      SELECT DISTINCT ON (member_id) * FROM scoped_follow_ups WHERE follow_up_date <= p_as_of
      ORDER BY member_id, follow_up_date DESC, created_at DESC, id DESC
    ),
    follow_up_latest AS (
      SELECT church_branch_id AS "branchId", count(*) AS "latestMembers",
        count(*) FILTER (WHERE outcome = 'needs_follow_up') AS "latestNeedsFollowUpMembers",
        count(*) FILTER (WHERE next_follow_up_date < p_as_of) AS "overdueLatestNextFollowUps"
      FROM latest_follow_ups GROUP BY GROUPING SETS ((church_branch_id), ())
    ),
    follow_up_latest_by_outcome AS (
      SELECT church_branch_id AS "branchId", outcome, count(*) AS count
      FROM latest_follow_ups GROUP BY GROUPING SETS ((church_branch_id, outcome), (outcome))
    ),
    contributions_source AS (
      SELECT f.church_branch_id, f.contribution_date, f.amount, f.contribution_type, f.payment_method
      FROM public.financial_contributions f JOIN scoped_branches b ON b.id = f.church_branch_id
      WHERE contribution_date BETWEEN p_from AND p_to
    ),
    -- Exact PostgreSQL NUMERIC sums/averages cross the JSON boundary as decimal strings.
    -- AVG is rounded half-up to cents, never computed in JavaScript binary floats.
    contributions AS (
      SELECT church_branch_id AS "branchId", count(*) AS count,
        round(coalesce(sum(amount), 0), 2)::text AS "totalAmount",
        round(avg(amount), 2)::text AS "averageAmount"
      FROM contributions_source GROUP BY GROUPING SETS ((church_branch_id), ())
    ),
    contribution_by_type AS (
      SELECT church_branch_id AS "branchId", contribution_type AS "contributionType", count(*) AS count,
        round(coalesce(sum(amount), 0), 2)::text AS "totalAmount", round(avg(amount), 2)::text AS "averageAmount"
      FROM contributions_source GROUP BY GROUPING SETS ((church_branch_id, contribution_type), (contribution_type))
    ),
    contribution_by_payment AS (
      SELECT church_branch_id AS "branchId", payment_method AS "paymentMethod", count(*) AS count,
        round(coalesce(sum(amount), 0), 2)::text AS "totalAmount", round(avg(amount), 2)::text AS "averageAmount"
      FROM contributions_source GROUP BY GROUPING SETS ((church_branch_id, payment_method), (payment_method))
    ),
    contribution_trend AS (
      SELECT church_branch_id AS "branchId", date_trunc(p_grouping, contribution_date::timestamp)::date AS "periodStart", count(*) AS count,
        round(coalesce(sum(amount), 0), 2)::text AS "totalAmount", round(avg(amount), 2)::text AS "averageAmount"
      FROM contributions_source GROUP BY GROUPING SETS (
        (church_branch_id, date_trunc(p_grouping, contribution_date::timestamp)::date),
        (date_trunc(p_grouping, contribution_date::timestamp)::date)
      )
    ),
    baptism_source AS (
      SELECT r.church_branch_id, r.baptism_date, r.baptism_type
      FROM public.baptism_records r JOIN scoped_branches b ON b.id = r.church_branch_id
    ),
    baptisms AS (
      SELECT church_branch_id AS "branchId",
        count(*) FILTER (WHERE baptism_date BETWEEN p_from AND p_to) AS total,
        count(*) FILTER (WHERE baptism_date BETWEEN p_from AND p_to AND baptism_type = 'water') AS water,
        count(*) FILTER (WHERE baptism_date BETWEEN p_from AND p_to AND baptism_type = 'holy_ghost') AS "holyGhost",
        count(*) FILTER (WHERE baptism_date IS NULL) AS "undatedRecords"
      FROM baptism_source GROUP BY GROUPING SETS ((church_branch_id), ())
    ),
    baptism_trend AS (
      SELECT church_branch_id AS "branchId", date_trunc(p_grouping, baptism_date::timestamp)::date AS "periodStart",
        count(*) AS total, count(*) FILTER (WHERE baptism_type = 'water') AS water,
        count(*) FILTER (WHERE baptism_type = 'holy_ghost') AS "holyGhost"
      FROM baptism_source WHERE baptism_date BETWEEN p_from AND p_to
      GROUP BY GROUPING SETS (
        (church_branch_id, date_trunc(p_grouping, baptism_date::timestamp)::date),
        (date_trunc(p_grouping, baptism_date::timestamp)::date)
      )
    )
    SELECT jsonb_build_object(
      'version', 1,
      'membership', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM membership r),
      'membershipTrend', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "periodStart", "branchId"), '[]'::jsonb) FROM membership_trend r),
      'attendance', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM attendance r),
      'attendanceByType', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "serviceType", "branchId"), '[]'::jsonb) FROM attendance_by_type r),
      'attendanceTrend', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "periodStart", "branchId"), '[]'::jsonb) FROM attendance_trend r),
      'weeklyAttendance', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "weekStart", "branchId"), '[]'::jsonb) FROM weekly_attendance r),
      'followUps', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM follow_ups r),
      'followUpByMethod', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY method, "branchId"), '[]'::jsonb) FROM follow_up_by_method r),
      'followUpByOutcome', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY outcome, "branchId"), '[]'::jsonb) FROM follow_up_by_outcome r),
      'followUpTrend', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "periodStart", "branchId"), '[]'::jsonb) FROM follow_up_trend r),
      'followUpLatest', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM follow_up_latest r),
      'followUpLatestByOutcome', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY outcome, "branchId"), '[]'::jsonb) FROM follow_up_latest_by_outcome r),
      'contributions', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM contributions r),
      'contributionByType', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "contributionType", "branchId"), '[]'::jsonb) FROM contribution_by_type r),
      'contributionByPaymentMethod', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "paymentMethod", "branchId"), '[]'::jsonb) FROM contribution_by_payment r),
      'contributionTrend', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "periodStart", "branchId"), '[]'::jsonb) FROM contribution_trend r),
      'baptisms', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM baptisms r),
      'baptismTrend', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY "periodStart", "branchId"), '[]'::jsonb) FROM baptism_trend r)
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_reports_analytics"("p_branch_ids" "uuid"[], "p_from" "date", "p_to" "date", "p_grouping" "text", "p_as_of" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_reports_analytics"("p_branch_ids" "uuid"[], "p_from" "date", "p_to" "date", "p_grouping" "text", "p_as_of" "date") IS 'Read-only server aggregation. Server must authenticate reports.view and validate every branch ID before calling. Null branchId rows are global rollups over only the supplied branches.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.email
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_profile_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.members
  set
    account_status = 'no_account',
    email = null,
    updated_at = now()
  where id in (
    select member_id
    from public.account_members
    where user_id = old.id
  );

  return old;
end;
$$;


ALTER FUNCTION "public"."handle_profile_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_permission"("permission_keys" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    join public.role_permissions rp
      on rp.role_id = r.id
    join public.permissions p
      on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and r.is_active = true
      and p.is_active = true
      and p.key = any(permission_keys)
  );
$$;


ALTER FUNCTION "public"."has_any_permission"("permission_keys" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_role"("role_names" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.archived_at IS NULL
      AND r.is_active = true
      AND r.key = ANY(role_names)
  );
$$;


ALTER FUNCTION "public"."has_any_role"("role_names" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_branch_access"("branch_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.archived_at IS NULL
  ) AND (
    public.has_role('system_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_branch_access uba
      WHERE uba.user_id = auth.uid() AND uba.church_branch_id = branch_id
    )
  );
$$;


ALTER FUNCTION "public"."has_branch_access"("branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("permission_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    join public.role_permissions rp
      on rp.role_id = r.id
    join public.permissions p
      on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and r.is_active = true
      and p.is_active = true
      and p.key = permission_key
  );
$$;


ALTER FUNCTION "public"."has_permission"("permission_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("role_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND p.archived_at IS NULL
      AND r.is_active = true
      AND r.key = role_name
  );
$$;


ALTER FUNCTION "public"."has_role"("role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_invited_member"("p_member_id" "uuid", "p_user_id" "uuid", "p_invited_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_member_role_id uuid;
begin
  select id
  into v_member_role_id
  from public.roles
  where name = 'member';

  if v_member_role_id is null then
    raise exception 'Member role not found';
  end if;

  insert into public.account_members (
    user_id,
    member_id,
    relationship,
    can_view,
    can_edit
  )
  values (
    p_user_id,
    p_member_id,
    'member',
    true,
    true
  );

  insert into public.user_roles (
    user_id,
    role_id
  )
  values (
    p_user_id,
    v_member_role_id
  )
  on conflict (user_id, role_id) do nothing;

  update public.members
  set
    account_status = 'invited',
    invited_at = now(),
    invited_by = p_invited_by,
    updated_at = now()
  where id = p_member_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;


ALTER FUNCTION "public"."link_invited_member"("p_member_id" "uuid", "p_user_id" "uuid", "p_invited_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_role_lifecycle"("target_role_id" "uuid", "operation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  target_role public.roles%ROWTYPE;
  normalized_operation text := lower(trim(operation));
  required_permission_keys text[] := ARRAY[
    'administration.view',
    'roles.view',
    'roles.update',
    'roles.manage_permissions',
    'roles.assign',
    'roles.deactivate',
    'roles.delete'
  ];
  remaining_admin_role_count bigint;
  has_active_admin_account boolean;
  assigned_user_count bigint;
BEGIN
  IF normalized_operation IS NULL
     OR normalized_operation NOT IN ('activate', 'deactivate', 'delete') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Unsupported role lifecycle operation.';
  END IF;

  -- Serialize all lifecycle mutations. This lock is transaction-scoped and
  -- released automatically when the RPC transaction completes.
  PERFORM pg_advisory_xact_lock(hashtext('public.manage_role_lifecycle'));

  SELECT *
  INTO target_role
  FROM public.roles
  WHERE id = target_role_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Role not found.';
  END IF;

  IF normalized_operation = 'activate' THEN
    IF target_role.is_active THEN
      RETURN jsonb_build_object(
        'success', true,
        'role_id', target_role.id,
        'operation', normalized_operation,
        'is_active', true,
        'changed', false
      );
    END IF;

    UPDATE public.roles
    SET is_active = true
    WHERE id = target_role.id;

    RETURN jsonb_build_object(
      'success', true,
      'role_id', target_role.id,
      'operation', normalized_operation,
      'is_active', true,
      'changed', true
    );
  END IF;

  IF normalized_operation = 'deactivate' THEN
    IF target_role.key = 'system_admin' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'The system_admin role cannot be deactivated.';
    END IF;

    IF target_role.key = 'member' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'The member role cannot be deactivated.';
    END IF;

    IF NOT target_role.is_active THEN
      RETURN jsonb_build_object(
        'success', true,
        'role_id', target_role.id,
        'operation', normalized_operation,
        'is_active', false,
        'changed', false
      );
    END IF;
  END IF;

  IF normalized_operation = 'delete' THEN
    IF target_role.is_system THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'System roles cannot be deleted.';
    END IF;

    IF target_role.key IN (
      'system_admin',
      'member',
      'pastor',
      'accounting_officer',
      'evangelism_officer',
      'spiritual_ministry_officer',
      'usher'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'System roles cannot be deleted.';
    END IF;

    SELECT count(*)
    INTO assigned_user_count
    FROM public.user_roles
    WHERE role_id = target_role.id;

    IF assigned_user_count > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format(
          'This role is assigned to %s account%s. Remove those assignments before deleting it.',
          assigned_user_count,
          CASE WHEN assigned_user_count = 1 THEN '' ELSE 's' END
        );
    END IF;
  END IF;

  -- Evaluate the role-capability state after the requested role is removed
  -- from the active contribution set. Active permissions are counted by key,
  -- so inactive permission records cannot preserve administrator capability.
  SELECT count(*)
  INTO remaining_admin_role_count
  FROM (
    SELECT role_record.id
    FROM public.roles AS role_record
    INNER JOIN public.role_permissions AS role_permission
      ON role_permission.role_id = role_record.id
    INNER JOIN public.permissions AS permission_record
      ON permission_record.id = role_permission.permission_id
    WHERE role_record.is_active
      AND NOT (
        normalized_operation IN ('deactivate', 'delete')
        AND role_record.id = target_role.id
      )
      AND permission_record.is_active
      AND permission_record.key = ANY(required_permission_keys)
    GROUP BY role_record.id
    HAVING count(DISTINCT permission_record.key) = cardinality(required_permission_keys)
  ) AS capable_roles;

  IF remaining_admin_role_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'This change would remove the last active RBAC administrator role.';
  END IF;

  -- Evaluate effective permissions at the account level. Permissions from all
  -- active roles assigned to the account are unioned before the capability
  -- requirement is tested; one role does not need to contain every permission.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile_record
    WHERE profile_record.archived_at IS NULL
      AND (
        SELECT count(DISTINCT permission_record.key)
        FROM public.user_roles AS user_role
        INNER JOIN public.roles AS role_record
          ON role_record.id = user_role.role_id
        INNER JOIN public.role_permissions AS role_permission
          ON role_permission.role_id = role_record.id
        INNER JOIN public.permissions AS permission_record
          ON permission_record.id = role_permission.permission_id
        WHERE user_role.user_id = profile_record.id
          AND role_record.is_active
          AND NOT (
            normalized_operation IN ('deactivate', 'delete')
            AND role_record.id = target_role.id
          )
          AND permission_record.is_active
          AND permission_record.key = ANY(required_permission_keys)
      ) = cardinality(required_permission_keys)
  )
  INTO has_active_admin_account;

  IF NOT has_active_admin_account THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'This change would leave no active account with RBAC administration access.';
  END IF;

  IF normalized_operation = 'deactivate' THEN
    UPDATE public.roles
    SET is_active = false
    WHERE id = target_role.id;

    RETURN jsonb_build_object(
      'success', true,
      'role_id', target_role.id,
      'operation', normalized_operation,
      'is_active', false,
      'changed', true
    );
  END IF;

  DELETE FROM public.roles
  WHERE id = target_role.id;

  RETURN jsonb_build_object(
    'success', true,
    'role_id', target_role.id,
    'operation', normalized_operation,
    'deleted', true
  );
END;
$$;


ALTER FUNCTION "public"."manage_role_lifecycle"("target_role_id" "uuid", "operation" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "relationship" "text" NOT NULL,
    "can_view" boolean DEFAULT true,
    "can_edit" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "account_members_relationship_check" CHECK (("relationship" = 'member'::"text"))
);


ALTER TABLE "public"."account_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "recorded_by" "uuid",
    "attendance_status" "text" DEFAULT 'present'::"text" NOT NULL,
    "check_in_time" timestamp with time zone,
    "method" "text" DEFAULT 'qr'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "attendance_records_attendance_status_check" CHECK (("attendance_status" = ANY (ARRAY['present'::"text", 'late'::"text", 'excused'::"text"]))),
    CONSTRAINT "attendance_records_method_check" CHECK (("method" = ANY (ARRAY['qr'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."attendance_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."baptism_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "baptism_type" "text" NOT NULL,
    "baptism_date" "date",
    "church_branch_id" "uuid" NOT NULL,
    "officiated_by" "text",
    "location" "text",
    "recorded_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "baptism_records_baptism_type_check" CHECK (("baptism_type" = ANY (ARRAY['water'::"text", 'holy_ghost'::"text"])))
);


ALTER TABLE "public"."baptism_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."church_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "street_address" "text",
    "barangay" "text",
    "city" "text",
    "province" "text",
    "country" "text",
    "code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "inactivity_threshold_weeks" integer DEFAULT 3 NOT NULL,
    CONSTRAINT "church_branches_inactivity_threshold_weeks_check" CHECK ((("inactivity_threshold_weeks" >= 1) AND ("inactivity_threshold_weeks" <= 52)))
);


ALTER TABLE "public"."church_branches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."church_branches"."inactivity_threshold_weeks" IS 'Consecutive absent Monday-Sunday weeks before inactivity. Count only weeks with completed branch services; attendance at any completed service resets the count.';



CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."departments"."is_active" IS 'Inactive departments remain linked to existing members but are not offered for new assignments.';



CREATE TABLE IF NOT EXISTS "public"."financial_contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid",
    "service_id" "uuid",
    "contribution_type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "contribution_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" DEFAULT 'cash'::"text" NOT NULL,
    "recorded_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "church_branch_id" "uuid" NOT NULL,
    CONSTRAINT "financial_contributions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "financial_contributions_contribution_type_check" CHECK (("contribution_type" = ANY (ARRAY['tithe'::"text", 'love_offering'::"text", 'other'::"text"]))),
    CONSTRAINT "financial_contributions_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['cash'::"text", 'gcash'::"text", 'bank_transfer'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."financial_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_custom_field_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "field_definition_id" "uuid" NOT NULL,
    "value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member_custom_field_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_field_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "is_builtin" boolean DEFAULT false NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "options" "jsonb",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "placeholder" "text",
    "options_source" "text",
    "field_group" "text",
    CONSTRAINT "member_field_definitions_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'textarea'::"text", 'number'::"text", 'date'::"text", 'email'::"text", 'phone'::"text", 'select'::"text", 'checkbox'::"text"])))
);


ALTER TABLE "public"."member_field_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_follow_ups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_branch_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "follow_up_date" "date" NOT NULL,
    "method" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "followed_up_by" "uuid",
    "notes" "text",
    "next_follow_up_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "member_follow_ups_method_check" CHECK (("method" = ANY (ARRAY['call'::"text", 'message'::"text", 'visit'::"text", 'in_person'::"text", 'other'::"text"]))),
    CONSTRAINT "member_follow_ups_next_follow_up_date_check" CHECK ((("next_follow_up_date" IS NULL) OR ("next_follow_up_date" >= "follow_up_date"))),
    CONSTRAINT "member_follow_ups_outcome_check" CHECK (("outcome" = ANY (ARRAY['contacted'::"text", 'no_response'::"text", 'needs_follow_up'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."member_follow_ups" OWNER TO "postgres";


COMMENT ON TABLE "public"."member_follow_ups" IS 'Historical follow-up actions recorded by staff. Outcomes do not alter member status or derived inactivity.';



COMMENT ON COLUMN "public"."member_follow_ups"."followed_up_by" IS 'Account that performed the follow-up; future application actions must validate an appropriate active staff account.';



COMMENT ON COLUMN "public"."member_follow_ups"."created_by" IS 'Account that recorded the row; future application actions must derive this from the authenticated user (auth.uid()).';



COMMENT ON COLUMN "public"."member_follow_ups"."updated_at" IS 'Application-managed timestamp; set explicitly when correcting a follow-up record.';



CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "middle_name" "text",
    "last_name" "text" NOT NULL,
    "birth_date" "date",
    "gender" "text",
    "phone_number" "text",
    "email" "text",
    "member_status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "account_status" "text" DEFAULT 'no_account'::"text" NOT NULL,
    "invited_at" timestamp with time zone,
    "invited_by" "uuid",
    "accepted_at" timestamp with time zone,
    "profile_completed_at" timestamp with time zone,
    "profile_status" "text" DEFAULT 'incomplete'::"text" NOT NULL,
    "nickname" "text",
    "zone" smallint,
    "street_address" "text",
    "barangay" "text",
    "city" "text",
    "province" "text",
    "wedding_anniversary" "date",
    "first_attendance_date" "date",
    "department" "text",
    "position" "text",
    "country" "text",
    "church_branch_id" "uuid",
    "civil_status" "text",
    "department_id" "uuid",
    "photo_url" "text",
    "region" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "members_account_status_check" CHECK (("account_status" = ANY (ARRAY['no_account'::"text", 'invited'::"text", 'connected'::"text"]))),
    CONSTRAINT "members_civil_status_check" CHECK (("civil_status" = ANY (ARRAY['single'::"text", 'married'::"text", 'widowed'::"text", 'separated'::"text", 'divorced'::"text"]))),
    CONSTRAINT "members_member_status_check" CHECK (("member_status" = ANY (ARRAY['active'::"text", 'inactive'::"text"]))),
    CONSTRAINT "members_profile_status_check" CHECK (("profile_status" = ANY (ARRAY['incomplete'::"text", 'completed'::"text"]))),
    CONSTRAINT "members_zone_check" CHECK ((("zone" >= 1) AND ("zone" <= 5))),
    CONSTRAINT "valid_member_status" CHECK (("member_status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "is_staff" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_types_key_check" CHECK (("key" ~ '^[a-z][a-z0-9_]{0,79}$'::"text")),
    CONSTRAINT "service_types_name_check" CHECK ((("length"("btrim"("name")) >= 1) AND ("length"("btrim"("name")) <= 120)))
);


ALTER TABLE "public"."service_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_types" IS 'Global service type reference data. Keys identify historical service groups; inactive types remain valid for existing services and are unavailable for new services.';



CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "church_branch_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "service_type" "text" NOT NULL,
    "service_date" "date" NOT NULL,
    "start_time" time without time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "services_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'ongoing'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_branch_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "church_branch_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_branch_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_user_id_member_id_key" UNIQUE ("user_id", "member_id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_service_id_member_id_key" UNIQUE ("service_id", "member_id");



ALTER TABLE ONLY "public"."baptism_records"
    ADD CONSTRAINT "baptism_records_member_id_baptism_type_key" UNIQUE ("member_id", "baptism_type");



ALTER TABLE ONLY "public"."baptism_records"
    ADD CONSTRAINT "baptism_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."church_branches"
    ADD CONSTRAINT "church_branches_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."church_branches"
    ADD CONSTRAINT "church_branches_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."church_branches"
    ADD CONSTRAINT "church_branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_contributions"
    ADD CONSTRAINT "financial_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_custom_field_values"
    ADD CONSTRAINT "member_custom_field_values_member_id_field_definition_id_key" UNIQUE ("member_id", "field_definition_id");



ALTER TABLE ONLY "public"."member_custom_field_values"
    ADD CONSTRAINT "member_custom_field_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_field_definitions"
    ADD CONSTRAINT "member_field_definitions_field_key_key" UNIQUE ("field_key");



ALTER TABLE ONLY "public"."member_field_definitions"
    ADD CONSTRAINT "member_field_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_follow_ups"
    ADD CONSTRAINT "member_follow_ups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_types"
    ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_unique" UNIQUE ("user_id", "church_branch_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");



CREATE UNIQUE INDEX "account_members_one_account_per_member" ON "public"."account_members" USING "btree" ("member_id") WHERE ("relationship" = 'member'::"text");



CREATE INDEX "attendance_records_member_id_idx" ON "public"."attendance_records" USING "btree" ("member_id");



CREATE INDEX "attendance_records_service_id_idx" ON "public"."attendance_records" USING "btree" ("service_id");



CREATE INDEX "baptism_records_baptism_date_idx" ON "public"."baptism_records" USING "btree" ("baptism_date");



CREATE INDEX "baptism_records_branch_id_idx" ON "public"."baptism_records" USING "btree" ("church_branch_id");



CREATE INDEX "baptism_records_member_id_idx" ON "public"."baptism_records" USING "btree" ("member_id");



CREATE UNIQUE INDEX "departments_normalized_name_uidx" ON "public"."departments" USING "btree" ("lower"("regexp_replace"("btrim"("name"), '[[:space:]]+'::"text", ' '::"text", 'g'::"text")));



CREATE INDEX "financial_contributions_branch_id_idx" ON "public"."financial_contributions" USING "btree" ("church_branch_id");



CREATE INDEX "financial_contributions_date_idx" ON "public"."financial_contributions" USING "btree" ("contribution_date");



CREATE INDEX "financial_contributions_member_id_idx" ON "public"."financial_contributions" USING "btree" ("member_id");



CREATE INDEX "financial_contributions_service_id_idx" ON "public"."financial_contributions" USING "btree" ("service_id");



CREATE INDEX "member_follow_ups_church_branch_id_idx" ON "public"."member_follow_ups" USING "btree" ("church_branch_id");



CREATE INDEX "member_follow_ups_follow_up_date_idx" ON "public"."member_follow_ups" USING "btree" ("follow_up_date");



CREATE INDEX "member_follow_ups_followed_up_by_idx" ON "public"."member_follow_ups" USING "btree" ("followed_up_by") WHERE ("followed_up_by" IS NOT NULL);



CREATE INDEX "member_follow_ups_member_id_follow_up_date_idx" ON "public"."member_follow_ups" USING "btree" ("member_id", "follow_up_date" DESC);



CREATE INDEX "member_follow_ups_next_follow_up_date_idx" ON "public"."member_follow_ups" USING "btree" ("next_follow_up_date") WHERE ("next_follow_up_date" IS NOT NULL);



CREATE INDEX "member_follow_ups_outcome_idx" ON "public"."member_follow_ups" USING "btree" ("outcome");



CREATE INDEX "role_permissions_permission_id_idx" ON "public"."role_permissions" USING "btree" ("permission_id");



CREATE UNIQUE INDEX "roles_key_key" ON "public"."roles" USING "btree" ("key");



CREATE UNIQUE INDEX "service_types_normalized_name_uidx" ON "public"."service_types" USING "btree" ("lower"("regexp_replace"("btrim"("name"), '[[:space:]]+'::"text", ' '::"text", 'g'::"text")));



CREATE INDEX "services_church_branch_id_idx" ON "public"."services" USING "btree" ("church_branch_id");



CREATE INDEX "services_service_date_idx" ON "public"."services" USING "btree" ("service_date");



CREATE INDEX "user_branch_access_branch_id_idx" ON "public"."user_branch_access" USING "btree" ("church_branch_id");



CREATE INDEX "user_branch_access_user_id_idx" ON "public"."user_branch_access" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "before_profile_delete_cleanup_members" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_profile_delete"();



CREATE OR REPLACE TRIGGER "set_members_updated_at" BEFORE UPDATE ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."account_members"
    ADD CONSTRAINT "account_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance_records"
    ADD CONSTRAINT "attendance_records_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."baptism_records"
    ADD CONSTRAINT "baptism_records_church_branch_id_fkey" FOREIGN KEY ("church_branch_id") REFERENCES "public"."church_branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."baptism_records"
    ADD CONSTRAINT "baptism_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."baptism_records"
    ADD CONSTRAINT "baptism_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_contributions"
    ADD CONSTRAINT "financial_contributions_church_branch_id_fkey" FOREIGN KEY ("church_branch_id") REFERENCES "public"."church_branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_contributions"
    ADD CONSTRAINT "financial_contributions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_contributions"
    ADD CONSTRAINT "financial_contributions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_contributions"
    ADD CONSTRAINT "financial_contributions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_custom_field_values"
    ADD CONSTRAINT "member_custom_field_values_field_definition_id_fkey" FOREIGN KEY ("field_definition_id") REFERENCES "public"."member_field_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_custom_field_values"
    ADD CONSTRAINT "member_custom_field_values_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_follow_ups"
    ADD CONSTRAINT "member_follow_ups_church_branch_id_fkey" FOREIGN KEY ("church_branch_id") REFERENCES "public"."church_branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."member_follow_ups"
    ADD CONSTRAINT "member_follow_ups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_follow_ups"
    ADD CONSTRAINT "member_follow_ups_followed_up_by_fkey" FOREIGN KEY ("followed_up_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."member_follow_ups"
    ADD CONSTRAINT "member_follow_ups_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_church_branch_id_fkey" FOREIGN KEY ("church_branch_id") REFERENCES "public"."church_branches"("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_church_branch_id_fkey" FOREIGN KEY ("church_branch_id") REFERENCES "public"."church_branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_service_type_fkey" FOREIGN KEY ("service_type") REFERENCES "public"."service_types"("key") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_church_branch_id_fkey" FOREIGN KEY ("church_branch_id") REFERENCES "public"."church_branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can view church branches" ON "public"."church_branches" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view departments" ON "public"."departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view member field definitions" ON "public"."member_field_definitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view roles" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "System admin can create member field definitions" ON "public"."member_field_definitions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'system_admin'::"text")))));



CREATE POLICY "System admin can delete custom member fields" ON "public"."member_field_definitions" FOR DELETE TO "authenticated" USING ((("is_builtin" = false) AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'system_admin'::"text"))))));



CREATE POLICY "System admin can update member field definitions" ON "public"."member_field_definitions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'system_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = 'system_admin'::"text")))));



CREATE POLICY "System admins can delete branch access" ON "public"."user_branch_access" FOR DELETE TO "authenticated" USING ("public"."has_role"('system_admin'::"text"));



CREATE POLICY "System admins can insert branch access" ON "public"."user_branch_access" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"('system_admin'::"text"));



CREATE POLICY "System admins can view all branch access" ON "public"."user_branch_access" FOR SELECT TO "authenticated" USING ("public"."has_role"('system_admin'::"text"));



CREATE POLICY "Users can delete allowed member custom values" ON "public"."member_custom_field_values" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."user_id" = "auth"."uid"()) AND ("am"."member_id" = "member_custom_field_values"."member_id") AND ("am"."relationship" = 'member'::"text")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['system_admin'::"text", 'pastor'::"text", 'evangelism_officer'::"text", 'spiritual_ministry_officer'::"text"])))))));



CREATE POLICY "Users can insert allowed member custom values" ON "public"."member_custom_field_values" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."user_id" = "auth"."uid"()) AND ("am"."member_id" = "member_custom_field_values"."member_id") AND ("am"."relationship" = 'member'::"text")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['system_admin'::"text", 'pastor'::"text", 'evangelism_officer'::"text", 'spiritual_ministry_officer'::"text"])))))));



CREATE POLICY "Users can update allowed member custom values" ON "public"."member_custom_field_values" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."user_id" = "auth"."uid"()) AND ("am"."member_id" = "member_custom_field_values"."member_id") AND ("am"."relationship" = 'member'::"text")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['system_admin'::"text", 'pastor'::"text", 'evangelism_officer'::"text", 'spiritual_ministry_officer'::"text"]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."user_id" = "auth"."uid"()) AND ("am"."member_id" = "member_custom_field_values"."member_id") AND ("am"."relationship" = 'member'::"text")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['system_admin'::"text", 'pastor'::"text", 'evangelism_officer'::"text", 'spiritual_ministry_officer'::"text"])))))));



CREATE POLICY "Users can update linked member records" ON "public"."members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."member_id" = "members"."id") AND ("am"."user_id" = "auth"."uid"()) AND ("am"."relationship" = 'member'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."member_id" = "members"."id") AND ("am"."user_id" = "auth"."uid"()) AND ("am"."relationship" = 'member'::"text")))));



CREATE POLICY "Users can view allowed member custom values" ON "public"."member_custom_field_values" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."user_id" = "auth"."uid"()) AND ("am"."member_id" = "member_custom_field_values"."member_id") AND ("am"."relationship" = 'member'::"text")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['system_admin'::"text", 'pastor'::"text", 'evangelism_officer'::"text", 'spiritual_ministry_officer'::"text"])))))));



CREATE POLICY "Users can view linked member records" ON "public"."members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."account_members" "am"
  WHERE (("am"."member_id" = "members"."id") AND ("am"."user_id" = "auth"."uid"()) AND ("am"."relationship" = 'member'::"text")))));



CREATE POLICY "Users can view their linked members" ON "public"."account_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("relationship" = 'member'::"text")));



CREATE POLICY "Users can view their own branch access" ON "public"."user_branch_access" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users with attendance.correct can update attendance" ON "public"."attendance_records" FOR UPDATE TO "authenticated" USING (("public"."has_permission"('attendance.correct'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "attendance_records"."service_id") AND "public"."has_branch_access"("s"."church_branch_id")))))) WITH CHECK (("public"."has_permission"('attendance.correct'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."services" "s"
     JOIN "public"."church_branches" "cb" ON (("cb"."id" = "s"."church_branch_id")))
  WHERE (("s"."id" = "attendance_records"."service_id") AND ("cb"."is_active" = true) AND "public"."has_branch_access"("s"."church_branch_id"))))));



CREATE POLICY "Users with attendance.record can record attendance" ON "public"."attendance_records" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"('attendance.record'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."services" "s"
     JOIN "public"."church_branches" "cb" ON (("cb"."id" = "s"."church_branch_id")))
  WHERE (("s"."id" = "attendance_records"."service_id") AND ("cb"."is_active" = true) AND "public"."has_branch_access"("s"."church_branch_id"))))));



CREATE POLICY "Users with attendance.view can view attendance" ON "public"."attendance_records" FOR SELECT TO "authenticated" USING (("public"."has_permission"('attendance.view'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "attendance_records"."service_id") AND "public"."has_branch_access"("s"."church_branch_id"))))));



CREATE POLICY "Users with baptism create permission can record baptisms" ON "public"."baptism_records" FOR INSERT TO "authenticated" WITH CHECK ((((("baptism_type" = 'water'::"text") AND "public"."has_permission"('baptisms.water.create'::"text")) OR (("baptism_type" = 'holy_ghost'::"text") AND "public"."has_permission"('baptisms.holy_ghost.create'::"text"))) AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "cb"
  WHERE (("cb"."id" = "baptism_records"."church_branch_id") AND ("cb"."is_active" = true))))));



CREATE POLICY "Users with baptism update permission can update baptisms" ON "public"."baptism_records" FOR UPDATE TO "authenticated" USING ((((("baptism_type" = 'water'::"text") AND "public"."has_permission"('baptisms.water.update'::"text")) OR (("baptism_type" = 'holy_ghost'::"text") AND "public"."has_permission"('baptisms.holy_ghost.update'::"text"))) AND "public"."has_branch_access"("church_branch_id"))) WITH CHECK ((((("baptism_type" = 'water'::"text") AND "public"."has_permission"('baptisms.water.update'::"text")) OR (("baptism_type" = 'holy_ghost'::"text") AND "public"."has_permission"('baptisms.holy_ghost.update'::"text"))) AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "cb"
  WHERE (("cb"."id" = "baptism_records"."church_branch_id") AND ("cb"."is_active" = true))))));



CREATE POLICY "Users with baptisms.view can view baptism records" ON "public"."baptism_records" FOR SELECT TO "authenticated" USING (("public"."has_permission"('baptisms.view'::"text") AND "public"."has_branch_access"("church_branch_id")));



CREATE POLICY "Users with contributions.create can record contributions" ON "public"."financial_contributions" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"('contributions.create'::"text") AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "cb"
  WHERE (("cb"."id" = "financial_contributions"."church_branch_id") AND ("cb"."is_active" = true))))));



CREATE POLICY "Users with contributions.update can update contributions" ON "public"."financial_contributions" FOR UPDATE TO "authenticated" USING (("public"."has_permission"('contributions.update'::"text") AND "public"."has_branch_access"("church_branch_id"))) WITH CHECK (("public"."has_permission"('contributions.update'::"text") AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "cb"
  WHERE (("cb"."id" = "financial_contributions"."church_branch_id") AND ("cb"."is_active" = true))))));



CREATE POLICY "Users with contributions.view can view contributions" ON "public"."financial_contributions" FOR SELECT TO "authenticated" USING (("public"."has_permission"('contributions.view'::"text") AND "public"."has_branch_access"("church_branch_id")));



CREATE POLICY "Users with roles.view can view permissions" ON "public"."permissions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('roles.view'::"text"));



CREATE POLICY "Users with roles.view can view role permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('roles.view'::"text"));



CREATE POLICY "Users with service type access can view service types" ON "public"."service_types" FOR SELECT TO "authenticated" USING (("public"."has_permission"('service_types.view'::"text") OR "public"."has_permission"('service_types.manage'::"text")));



CREATE POLICY "Users with services.create can create services" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"('services.create'::"text") AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "cb"
  WHERE (("cb"."id" = "services"."church_branch_id") AND ("cb"."is_active" = true))))));



CREATE POLICY "Users with services.update can update services" ON "public"."services" FOR UPDATE TO "authenticated" USING (("public"."has_permission"('services.update'::"text") AND "public"."has_branch_access"("church_branch_id"))) WITH CHECK (("public"."has_permission"('services.update'::"text") AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "cb"
  WHERE (("cb"."id" = "services"."church_branch_id") AND ("cb"."is_active" = true))))));



CREATE POLICY "Users with services.view can view services" ON "public"."services" FOR SELECT TO "authenticated" USING (("public"."has_permission"('services.view'::"text") AND "public"."has_branch_access"("church_branch_id")));



ALTER TABLE "public"."account_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."baptism_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."church_branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_custom_field_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_field_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_follow_ups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_follow_ups_insert" ON "public"."member_follow_ups" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"('follow_ups.create'::"text") AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "branch_record"
  WHERE (("branch_record"."id" = "member_follow_ups"."church_branch_id") AND ("branch_record"."is_active" = true))))));



CREATE POLICY "member_follow_ups_select" ON "public"."member_follow_ups" FOR SELECT TO "authenticated" USING (("public"."has_permission"('follow_ups.view'::"text") AND "public"."has_branch_access"("church_branch_id")));



CREATE POLICY "member_follow_ups_update" ON "public"."member_follow_ups" FOR UPDATE TO "authenticated" USING (("public"."has_permission"('follow_ups.update'::"text") AND "public"."has_branch_access"("church_branch_id"))) WITH CHECK (("public"."has_permission"('follow_ups.update'::"text") AND "public"."has_branch_access"("church_branch_id") AND (EXISTS ( SELECT 1
   FROM "public"."church_branches" "branch_record"
  WHERE (("branch_record"."id" = "member_follow_ups"."church_branch_id") AND ("branch_record"."is_active" = true))))));



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_branch_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."get_reports_analytics"("p_branch_ids" "uuid"[], "p_from" "date", "p_to" "date", "p_grouping" "text", "p_as_of" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_reports_analytics"("p_branch_ids" "uuid"[], "p_from" "date", "p_to" "date", "p_grouping" "text", "p_as_of" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_profile_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_profile_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_profile_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_any_permission"("permission_keys" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_any_permission"("permission_keys" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_any_permission"("permission_keys" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_any_permission"("permission_keys" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_any_role"("role_names" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_any_role"("role_names" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_any_role"("role_names" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_branch_access"("branch_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_branch_access"("branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_branch_access"("branch_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_permission"("permission_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_permission"("permission_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("role_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("role_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."link_invited_member"("p_member_id" "uuid", "p_user_id" "uuid", "p_invited_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_invited_member"("p_member_id" "uuid", "p_user_id" "uuid", "p_invited_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."manage_role_lifecycle"("target_role_id" "uuid", "operation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."manage_role_lifecycle"("target_role_id" "uuid", "operation" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."account_members" TO "anon";
GRANT ALL ON TABLE "public"."account_members" TO "authenticated";
GRANT ALL ON TABLE "public"."account_members" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_records" TO "anon";
GRANT ALL ON TABLE "public"."attendance_records" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_records" TO "service_role";



GRANT ALL ON TABLE "public"."baptism_records" TO "anon";
GRANT ALL ON TABLE "public"."baptism_records" TO "authenticated";
GRANT ALL ON TABLE "public"."baptism_records" TO "service_role";



GRANT ALL ON TABLE "public"."church_branches" TO "anon";
GRANT ALL ON TABLE "public"."church_branches" TO "authenticated";
GRANT ALL ON TABLE "public"."church_branches" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."financial_contributions" TO "anon";
GRANT ALL ON TABLE "public"."financial_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."member_custom_field_values" TO "anon";
GRANT ALL ON TABLE "public"."member_custom_field_values" TO "authenticated";
GRANT ALL ON TABLE "public"."member_custom_field_values" TO "service_role";



GRANT ALL ON TABLE "public"."member_field_definitions" TO "anon";
GRANT ALL ON TABLE "public"."member_field_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."member_field_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."member_follow_ups" TO "anon";
GRANT ALL ON TABLE "public"."member_follow_ups" TO "authenticated";
GRANT ALL ON TABLE "public"."member_follow_ups" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."service_types" TO "anon";
GRANT ALL ON TABLE "public"."service_types" TO "authenticated";
GRANT ALL ON TABLE "public"."service_types" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."user_branch_access" TO "anon";
GRANT ALL ON TABLE "public"."user_branch_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_branch_access" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































