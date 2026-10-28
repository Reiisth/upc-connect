-- Configuration foundation only; no inactivity calculation or member status updates.
-- Future calculations use Monday-Sunday weeks with completed branch services:
-- no completed services means skip the week; any attendance resets the streak.
BEGIN;

ALTER TABLE public.church_branches
  ADD COLUMN inactivity_threshold_weeks integer NOT NULL DEFAULT 3,
  ADD CONSTRAINT church_branches_inactivity_threshold_weeks_check
    CHECK (inactivity_threshold_weeks BETWEEN 1 AND 52);

COMMENT ON COLUMN public.church_branches.inactivity_threshold_weeks IS
  'Consecutive absent Monday-Sunday weeks before inactivity. Count only weeks with completed branch services; attendance at any completed service resets the count.';

INSERT INTO public.permissions (key, name, description, is_active)
VALUES
  (
    'inactivity.view',
    'View Inactivity Monitoring',
    'View weekly attendance inactivity within the user''s permitted branch scope.',
    true
  ),
  (
    'inactivity.manage_settings',
    'Manage Inactivity Settings',
    'Manage the inactivity threshold within the user''s permitted branch scope.',
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
    AND permission_record.key = 'inactivity.view'
  )
  OR (
    role_record.key = 'pastor'
    AND permission_record.key = 'inactivity.manage_settings'
  )
ON CONFLICT DO NOTHING;

-- Leave branch RLS unchanged. A future dedicated settings action must enforce
-- inactivity.manage_settings and branch scope, and update only the threshold.
COMMIT;
