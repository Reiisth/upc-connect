-- Reclassify the date and place it last without changing member dates or preferences.
UPDATE public.member_field_definitions
SET field_group = 'personal',
    sort_order = (
      SELECT coalesce(max(sort_order), 0) + 1
      FROM public.member_field_definitions
      WHERE field_group = 'personal' AND field_key <> 'wedding_anniversary'
    ),
    updated_at = now()
WHERE field_key = 'wedding_anniversary' AND is_builtin;
