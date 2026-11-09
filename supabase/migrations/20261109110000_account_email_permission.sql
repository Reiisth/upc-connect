BEGIN;
INSERT INTO public.permissions(key,name,description)
VALUES ('accounts.update_email','Update account email','Change the Auth email of an account within full target scope.')
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key='system_admin' AND p.key='accounts.update_email'
ON CONFLICT DO NOTHING;
COMMIT;
