-- Historical staff-recorded actions, separate from derived inactivity.
-- No automatic records, member status writes, or follow-up case ownership.
BEGIN;

CREATE TABLE public.member_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_branch_id uuid NOT NULL
    REFERENCES public.church_branches(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL
    REFERENCES public.members(id) ON DELETE RESTRICT,
  follow_up_date date NOT NULL,
  method text NOT NULL,
  outcome text NOT NULL,
  followed_up_by uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text NULL,
  next_follow_up_date date NULL,
  created_by uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_follow_ups_method_check
    CHECK (method IN ('call', 'message', 'visit', 'in_person', 'other')),
  CONSTRAINT member_follow_ups_outcome_check
    CHECK (outcome IN ('contacted', 'no_response', 'needs_follow_up', 'resolved')),
  CONSTRAINT member_follow_ups_next_follow_up_date_check
    CHECK (next_follow_up_date IS NULL OR next_follow_up_date >= follow_up_date)
);

COMMENT ON TABLE public.member_follow_ups IS
  'Historical follow-up actions recorded by staff. Outcomes do not alter member status or derived inactivity.';
COMMENT ON COLUMN public.member_follow_ups.followed_up_by IS
  'Account that performed the follow-up; future application actions must validate an appropriate active staff account.';
COMMENT ON COLUMN public.member_follow_ups.created_by IS
  'Account that recorded the row; future application actions must derive this from the authenticated user (auth.uid()).';
COMMENT ON COLUMN public.member_follow_ups.updated_at IS
  'Application-managed timestamp; set explicitly when correcting a follow-up record.';

CREATE INDEX member_follow_ups_church_branch_id_idx
  ON public.member_follow_ups (church_branch_id);

-- Also supports member_id lookups without a redundant single-column index.
CREATE INDEX member_follow_ups_member_id_follow_up_date_idx
  ON public.member_follow_ups (member_id, follow_up_date DESC);

CREATE INDEX member_follow_ups_follow_up_date_idx
  ON public.member_follow_ups (follow_up_date);

CREATE INDEX member_follow_ups_followed_up_by_idx
  ON public.member_follow_ups (followed_up_by)
  WHERE followed_up_by IS NOT NULL;

CREATE INDEX member_follow_ups_outcome_idx
  ON public.member_follow_ups (outcome);

CREATE INDEX member_follow_ups_next_follow_up_date_idx
  ON public.member_follow_ups (next_follow_up_date)
  WHERE next_follow_up_date IS NOT NULL;

INSERT INTO public.permissions (key, name, description, is_active)
VALUES
  (
    'follow_ups.view',
    'View Member Follow-ups',
    'View historical member follow-up actions within the user''s permitted branch scope.',
    true
  ),
  (
    'follow_ups.create',
    'Record Member Follow-ups',
    'Record a member follow-up action within the user''s permitted branch scope.',
    true
  ),
  (
    'follow_ups.update',
    'Update Member Follow-ups',
    'Correct member follow-up records within the user''s permitted branch scope.',
    true
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM public.roles AS role_record
CROSS JOIN public.permissions AS permission_record
WHERE (
    role_record.key IN (
      'system_admin',
      'pastor',
      'evangelism_officer',
      'spiritual_ministry_officer'
    )
    AND permission_record.key = 'follow_ups.view'
  )
  OR (
    role_record.key IN ('pastor', 'evangelism_officer')
    AND permission_record.key IN ('follow_ups.create', 'follow_ups.update')
  )
ON CONFLICT DO NOTHING;

ALTER TABLE public.member_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_follow_ups_select
  ON public.member_follow_ups
  FOR SELECT TO authenticated
  USING (
    public.has_permission('follow_ups.view')
    AND public.has_branch_access(church_branch_id)
  );

CREATE POLICY member_follow_ups_insert
  ON public.member_follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('follow_ups.create')
    AND public.has_branch_access(church_branch_id)
    AND EXISTS (
      SELECT 1 FROM public.church_branches AS branch_record
      WHERE branch_record.id = member_follow_ups.church_branch_id
        AND branch_record.is_active = true
    )
  );

CREATE POLICY member_follow_ups_update
  ON public.member_follow_ups
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('follow_ups.update')
    AND public.has_branch_access(church_branch_id)
  )
  WITH CHECK (
    public.has_permission('follow_ups.update')
    AND public.has_branch_access(church_branch_id)
    AND EXISTS (
      SELECT 1 FROM public.church_branches AS branch_record
      WHERE branch_record.id = member_follow_ups.church_branch_id
        AND branch_record.is_active = true
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.member_follow_ups TO authenticated;

-- Intentionally no DELETE policy. Future actions must additionally verify
-- member/branch consistency and validate followed_up_by as active staff.
-- RLS validates row branch scope, not the member's branch or derived activity.
COMMIT;
