-- Account/login email is authoritative in auth.users, linked via account_members.
-- No synchronization trigger or replacement contact-email column is introduced.
BEGIN;
CREATE OR REPLACE FUNCTION public.handle_profile_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.members
  SET account_status = 'no_account', updated_at = now()
  WHERE id IN (SELECT member_id FROM public.account_members WHERE user_id = old.id);
  RETURN old;
END;
$$;
DELETE FROM public.member_custom_field_values
WHERE field_definition_id IN (SELECT id FROM public.member_field_definitions WHERE field_key='email');
DELETE FROM public.member_field_definitions WHERE field_key='email';
ALTER TABLE public.members DROP COLUMN email;
NOTIFY pgrst, 'reload schema';
COMMIT;
