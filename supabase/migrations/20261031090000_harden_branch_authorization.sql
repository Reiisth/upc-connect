-- Harden the existing role/branch helpers and the three legacy administrator
-- policies. No data, assignment, operational policy, or own-SELECT changes.
BEGIN;

DO $preflight$
DECLARE
  helper record;
BEGIN
  IF to_regprocedure('public.has_role(text)') IS NULL
     OR to_regprocedure('public.has_any_role(text[])') IS NULL
     OR to_regprocedure('public.has_branch_access(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected role/branch authorization helpers are missing. Inspect the deployed schema before applying this migration.';
  END IF;

  -- CREATE OR REPLACE preserves owner and dependent policies. The retained
  -- owner must bypass RLS on source tables to avoid policy recursion and the
  -- no-ordinary-profile-policy restriction in the verified live schema.
  FOR helper IN
    SELECT p.oid, p.proowner, p.prorettype, r.rolsuper, r.rolbypassrls
    FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.oid IN (
      'public.has_role(text)'::regprocedure,
      'public.has_any_role(text[])'::regprocedure,
      'public.has_branch_access(uuid)'::regprocedure
    )
  LOOP
    IF helper.prorettype <> 'boolean'::regtype THEN
      RAISE EXCEPTION 'Expected boolean return type for %.', helper.oid::regprocedure;
    END IF;
    IF NOT (helper.rolsuper OR helper.rolbypassrls) AND EXISTS (
      SELECT 1 FROM pg_class c
      WHERE c.oid IN ('public.roles'::regclass, 'public.user_roles'::regclass,
                     'public.profiles'::regclass, 'public.user_branch_access'::regclass)
        AND (c.relowner <> helper.proowner OR c.relforcerowsecurity)
    ) THEN
      RAISE EXCEPTION 'Owner of % cannot safely bypass source-table RLS. Review function ownership first.', helper.oid::regprocedure;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_policy
      WHERE polrelid = 'public.user_branch_access'::regclass
        AND (polname, polcmd) IN (
          ('System admins can view all branch access', 'r'),
          ('System admins can insert branch access', 'a'),
          ('System admins can delete branch access', 'd'),
          ('Users can view their own branch access', 'r')
        )) <> 4 THEN
    RAISE EXCEPTION 'Expected user_branch_access policies differ from the verified schema. Review policies before applying this migration.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.has_any_role(role_names text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.has_branch_access(branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

-- Verified callers are authenticated policies. Anonymous execution is not
-- needed; authenticated and service_role retain access, as does the owner.
REVOKE ALL ON FUNCTION public.has_role(text), public.has_any_role(text[]), public.has_branch_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text), public.has_any_role(text[]), public.has_branch_access(uuid) TO authenticated, service_role;

ALTER POLICY "System admins can view all branch access"
  ON public.user_branch_access USING (public.has_role('system_admin'));
ALTER POLICY "System admins can insert branch access"
  ON public.user_branch_access WITH CHECK (public.has_role('system_admin'));
ALTER POLICY "System admins can delete branch access"
  ON public.user_branch_access USING (public.has_role('system_admin'));

-- "Users can view their own branch access" remains byte-for-byte unchanged.
COMMIT;
