BEGIN;
ALTER TABLE public.member_follow_ups DROP CONSTRAINT member_follow_ups_followed_up_by_fkey;
ALTER TABLE public.member_follow_ups ALTER COLUMN followed_up_by TYPE text USING followed_up_by::text;

UPDATE public.member_follow_ups f SET followed_up_by = coalesce(
  nullif(btrim(f.followed_up_by_name), ''),
  (SELECT nullif(btrim(p.display_name), '') FROM public.profiles p WHERE p.id::text = f.followed_up_by),
  (SELECT nullif(btrim(p.display_name), '') FROM public.profiles p WHERE p.id = f.created_by)
);

ALTER TABLE public.member_follow_ups DROP COLUMN followed_up_by_name;
COMMENT ON COLUMN public.member_follow_ups.followed_up_by IS
  'Recorded performer display name or custom free text. Blank form submissions use the original created_by account display name; created_by remains the recorder identity.';
COMMIT;
