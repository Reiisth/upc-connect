-- Activity belongs to its receiving/service branch; member home branch is independent.
-- No existing branch authorization policy or historical relationship is changed.
BEGIN;
ALTER TABLE public.financial_contributions
  ADD COLUMN contributor_type text,
  ADD COLUMN visitor_name text;
UPDATE public.financial_contributions
SET contributor_type = CASE WHEN member_id IS NULL THEN 'anonymous' ELSE 'member' END;
ALTER TABLE public.financial_contributions
  ALTER COLUMN contributor_type SET NOT NULL,
  ADD CONSTRAINT financial_contributions_contributor_check CHECK (
    (contributor_type = 'member' AND member_id IS NOT NULL AND visitor_name IS NULL)
    OR (contributor_type = 'visitor' AND member_id IS NULL AND visitor_name IS NOT NULL
        AND length(btrim(visitor_name)) BETWEEN 1 AND 160 AND visitor_name = btrim(visitor_name))
    OR (contributor_type = 'anonymous' AND member_id IS NULL AND visitor_name IS NULL)
  );
COMMENT ON COLUMN public.financial_contributions.contributor_type IS
  'Historical donor identity: registered member, named non-member visitor, or anonymous. Financial attribution remains the receiving branch.';
COMMENT ON COLUMN public.financial_contributions.visitor_name IS
  'Name recorded on this contribution only; not a person identifier or visitor profile.';
COMMIT;
