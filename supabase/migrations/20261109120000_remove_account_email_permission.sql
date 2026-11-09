BEGIN;
-- Email remains account-owner managed. Remove the unused staff capability.
DELETE FROM public.role_permissions
WHERE permission_id IN (SELECT id FROM public.permissions WHERE key='accounts.update_email');
DELETE FROM public.permissions WHERE key='accounts.update_email';
COMMIT;
