-- Read-only aggregation for the server's reports.view + branch-scope entry point.
-- No source schema changes, snapshots, new permissions, or operational writes.
BEGIN;

-- Core table DDL predates this repository's migrations. Refuse silent timezone
-- or floating-money assumptions if the deployed schema differs from the model.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.members'::regclass AND attname = 'created_at'
      AND NOT attisdropped AND atttypid = 'timestamptz'::regtype
  ) THEN
    RAISE EXCEPTION 'Analytics requires members.created_at to be timestamptz; review the deployed timestamp semantics first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.financial_contributions'::regclass AND attname = 'amount'
      AND NOT attisdropped AND atttypid = 'numeric'::regtype
  ) THEN
    RAISE EXCEPTION 'Analytics requires exact NUMERIC contribution amounts; review the deployed money schema first.';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_reports_analytics(
  p_branch_ids uuid[],
  p_from date,
  p_to date,
  p_grouping text,
  p_as_of date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
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
$function$;

COMMENT ON FUNCTION public.get_reports_analytics(uuid[], date, date, text, date) IS
  'Read-only server aggregation. Server must authenticate reports.view and validate every branch ID before calling. Null branchId rows are global rollups over only the supplied branches.';

-- Do not expose a caller-controlled branch array to browser/anonymous RPC users.
REVOKE ALL ON FUNCTION public.get_reports_analytics(uuid[], date, date, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_reports_analytics(uuid[], date, date, text, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reports_analytics(uuid[], date, date, text, date) TO service_role;
COMMIT;
