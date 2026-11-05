-- Reuse the existing global departments reference table and retire the removed
-- Dashboard permission. Existing department assignments remain untouched.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.departments') IS NULL THEN
    RAISE EXCEPTION 'Expected the existing public.departments table. Inspect the deployed schema before applying this migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'name'
  ) THEN
    RAISE EXCEPTION 'Expected id and name columns on public.departments.';
  END IF;

  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'id') <> 'uuid'
     OR (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'name') <> 'text' THEN
    RAISE EXCEPTION 'Expected uuid id and text name columns on public.departments.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'church_branch_id') THEN
    RAISE EXCEPTION 'public.departments has a branch key. Inspect the deployed model before treating departments as global.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='is_active' AND data_type <> 'boolean')
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='updated_at' AND data_type <> 'timestamp with time zone') THEN
    RAISE EXCEPTION 'Existing departments lifecycle columns have incompatible types.';
  END IF;

  IF EXISTS (
    SELECT lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    FROM public.departments
    GROUP BY lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate department names ignoring case/outer whitespace exist. Resolve those rows before applying this migration.';
  END IF;
END;
$preflight$;

ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.departments SET is_active = true WHERE is_active IS NULL;
UPDATE public.departments SET updated_at = now() WHERE updated_at IS NULL;
ALTER TABLE public.departments
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS departments_normalized_name_uidx
  ON public.departments (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));

INSERT INTO public.permissions (key, name, description, is_active)
VALUES
  ('departments.view', 'View Church Departments', 'View the global church department list.', true),
  ('departments.manage', 'Manage Church Departments', 'Create, rename, activate, and deactivate church departments.', true)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = true;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM public.roles AS role_record
CROSS JOIN public.permissions AS permission_record
WHERE role_record.key IN ('system_admin', 'pastor')
  AND permission_record.key IN ('departments.view', 'departments.manage')
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions AS role_permission
USING public.permissions AS permission
WHERE role_permission.permission_id = permission.id
  AND permission.key = 'dashboard.view';

DELETE FROM public.permissions
WHERE key = 'dashboard.view';

COMMENT ON COLUMN public.departments.is_active IS
  'Inactive departments remain linked to existing members but are not offered for new assignments.';

COMMIT;
