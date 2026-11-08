-- Preserve historical account links while allowing a recorded performer name.
ALTER TABLE public.member_follow_ups
  ADD COLUMN followed_up_by_name text;

ALTER TABLE public.member_follow_ups
  ADD CONSTRAINT member_follow_ups_performer_name_length
  CHECK (followed_up_by_name IS NULL OR char_length(followed_up_by_name) <= 120);

COMMENT ON COLUMN public.member_follow_ups.followed_up_by_name IS
  'Optional name entered by staff for the person who performed the follow-up. Historical account links remain available as a fallback; created_by identifies the authenticated recorder.';
