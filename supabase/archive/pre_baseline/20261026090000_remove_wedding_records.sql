-- Remove the retired Wedding Records feature atomically, preserving any data.
BEGIN;

DO $$
DECLARE
  record_count bigint;
BEGIN
  IF to_regclass('public.wedding_records') IS NOT NULL THEN
    -- Keep concurrent inserts from racing the safety check and table removal.
    LOCK TABLE public.wedding_records IN ACCESS EXCLUSIVE MODE;

    SELECT count(*) INTO record_count FROM public.wedding_records;

    IF record_count > 0 THEN
      RAISE EXCEPTION
        'Cannot remove wedding_records because it contains % record(s). Review or export the data first.',
        record_count;
    END IF;
  END IF;
END
$$;

DELETE FROM public.role_permissions AS role_permission
USING public.permissions AS permission
WHERE role_permission.permission_id = permission.id
  AND permission.key IN ('weddings.view', 'weddings.create', 'weddings.update');

DELETE FROM public.permissions
WHERE key IN ('weddings.view', 'weddings.create', 'weddings.update');

DROP TABLE IF EXISTS public.wedding_records;

COMMIT;
