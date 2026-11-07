-- Discard obsolete Region data; preserve province, city, barangay and other address columns.
BEGIN;
DELETE FROM public.member_custom_field_values
WHERE field_definition_id IN (
  SELECT id FROM public.member_field_definitions
  WHERE field_key = 'region' OR options_source = 'psgc_regions'
);
DELETE FROM public.member_field_definitions
WHERE field_key = 'region';
-- Retire the removed options source on any supplemental fields without deleting their definitions.
UPDATE public.member_field_definitions
SET options_source = 'custom', options = '[]'::jsonb, is_visible = false, is_required = false
WHERE options_source = 'psgc_regions';
ALTER TABLE public.members DROP COLUMN IF EXISTS region;
COMMIT;
