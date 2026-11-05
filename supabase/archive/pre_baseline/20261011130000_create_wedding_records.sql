-- Add historical wedding records and their permission-based access rules.
--
-- This migration intentionally does not add a delete policy. Wedding records
-- are historical records and must be preserved rather than hard-deleted.

CREATE TABLE public.wedding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_branch_id uuid NOT NULL
    REFERENCES public.church_branches(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL
    REFERENCES public.members(id) ON DELETE RESTRICT,
  spouse_member_id uuid NULL
    REFERENCES public.members(id) ON DELETE RESTRICT,
  spouse_name text NULL,
  wedding_date date NOT NULL,
  officiated_by text NULL,
  location text NULL,
  certificate_number text NULL,
  recorded_by uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_records_spouse_source_check CHECK (
    (
      spouse_member_id IS NOT NULL
      AND spouse_name IS NULL
    )
    OR (
      spouse_member_id IS NULL
      AND spouse_name IS NOT NULL
      AND btrim(spouse_name) <> ''
    )
  ),
  CONSTRAINT wedding_records_distinct_members_check CHECK (
    spouse_member_id IS NULL OR member_id <> spouse_member_id
  )
);

CREATE INDEX wedding_records_church_branch_id_idx
  ON public.wedding_records (church_branch_id);

CREATE INDEX wedding_records_member_id_idx
  ON public.wedding_records (member_id);

CREATE INDEX wedding_records_spouse_member_id_idx
  ON public.wedding_records (spouse_member_id);

CREATE INDEX wedding_records_wedding_date_idx
  ON public.wedding_records (wedding_date);

-- The permission catalog is keyed by stable text identifiers. Re-running this
-- seed keeps these built-in permissions active without relying on UUIDs.
INSERT INTO public.permissions (key, name, description, is_active)
VALUES
  (
    'weddings.view',
    'View Wedding Records',
    'View wedding records within the user''s permitted branch scope.',
    true
  ),
  (
    'weddings.create',
    'Create Wedding Records',
    'Create wedding records within the user''s permitted branch scope.',
    true
  ),
  (
    'weddings.update',
    'Update Wedding Records',
    'Update wedding records within the user''s permitted branch scope.',
    true
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true;

-- Seed only the requested built-in role capabilities. No role UUIDs are
-- assumed, and existing assignments remain untouched.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM public.roles AS role_record
CROSS JOIN public.permissions AS permission_record
WHERE (
    role_record.key = 'system_admin'
    AND permission_record.key = 'weddings.view'
  )
  OR (
    role_record.key = 'pastor'
    AND permission_record.key IN (
      'weddings.view',
      'weddings.create',
      'weddings.update'
    )
  )
  OR (
    role_record.key = 'evangelism_officer'
    AND permission_record.key = 'weddings.view'
  )
  OR (
    role_record.key = 'spiritual_ministry_officer'
    AND permission_record.key = 'weddings.view'
  )
ON CONFLICT DO NOTHING;

ALTER TABLE public.wedding_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY wedding_records_select
  ON public.wedding_records
  FOR SELECT
  USING (
    public.has_permission('weddings.view')
    AND public.has_branch_access(church_branch_id)
  );

CREATE POLICY wedding_records_insert
  ON public.wedding_records
  FOR INSERT
  WITH CHECK (
    public.has_permission('weddings.create')
    AND public.has_branch_access(church_branch_id)
    AND EXISTS (
      SELECT 1
      FROM public.church_branches AS branch_record
      WHERE branch_record.id = church_branch_id
        AND branch_record.is_active = true
    )
  );

CREATE POLICY wedding_records_update
  ON public.wedding_records
  FOR UPDATE
  USING (
    public.has_permission('weddings.update')
    AND public.has_branch_access(church_branch_id)
  )
  WITH CHECK (
    public.has_permission('weddings.update')
    AND public.has_branch_access(church_branch_id)
    AND EXISTS (
      SELECT 1
      FROM public.church_branches AS branch_record
      WHERE branch_record.id = church_branch_id
        AND branch_record.is_active = true
    )
  );
