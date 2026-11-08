BEGIN;

ALTER TABLE public.services ADD COLUMN ended_at timestamptz;
COMMENT ON COLUMN public.services.ended_at IS
  'Server-recorded completion instant. Historical services without a recorded end remain NULL. Duration uses scheduled service_date/start_time in Asia/Manila.';

ALTER TABLE public.services ADD CONSTRAINT services_end_time_check CHECK (
  ended_at IS NULL OR (status = 'completed' AND
    (start_time IS NULL OR ended_at >= (service_date + start_time) AT TIME ZONE 'Asia/Manila'))
);

-- Runs in the same locked transaction as finalize_service_attendance. Preview
-- performs no service update, and rollback also rolls back this timestamp.
CREATE FUNCTION public.record_service_end_time() RETURNS trigger
LANGUAGE plpgsql SET search_path TO public, pg_temp AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.ended_at := clock_timestamp();
  ELSE
    NEW.ended_at := OLD.ended_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_service_end_time() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER record_service_end_time BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.record_service_end_time();

COMMIT;
