BEGIN;

-- API writes take the same Service lock as completion. Historical seed/import
-- work by the database owner remains possible; application roles cannot race
-- a late scan/correction past the completion transaction.
CREATE OR REPLACE FUNCTION public.guard_attendance_finalization() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE s public.services%ROWTYPE; m public.members%ROWTYPE;
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.service_id <> OLD.service_id OR NEW.member_id <> OLD.member_id) THEN
  RAISE EXCEPTION 'Attendance identity cannot be changed.';
 END IF;
 SELECT * INTO s FROM public.services WHERE id=NEW.service_id FOR UPDATE;
 IF current_setting('role',true) IN ('service_role','authenticated','anon') THEN
  IF s.id IS NULL OR s.status IN ('completed','cancelled') OR
     (s.service_date + coalesce(s.start_time,'00:00'::time)) AT TIME ZONE 'Asia/Manila' > clock_timestamp() THEN
   RAISE EXCEPTION 'Attendance is allowed only while a Service is ongoing.';
  END IF;
  IF TG_OP = 'INSERT' THEN
   SELECT * INTO m FROM public.members WHERE id=NEW.member_id FOR SHARE;
   IF m.id IS NULL OR m.is_archived OR m.member_status IS NULL OR m.member_status NOT IN ('active','inactive') THEN
    RAISE EXCEPTION 'New attendance requires a non-archived Active or Inactive Member.';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_attendance_finalization() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER attendance_finalization_guard BEFORE INSERT OR UPDATE ON public.attendance_records
 FOR EACH ROW EXECUTE FUNCTION public.guard_attendance_finalization();

CREATE OR REPLACE FUNCTION public.guard_service_completion() RETURNS trigger
LANGUAGE plpgsql SET search_path TO public, pg_temp AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed'
    AND current_setting('role',true) IN ('service_role','authenticated','anon')
    AND current_setting('upc.finalizing_service',true) IS DISTINCT FROM NEW.id::text THEN
  RAISE EXCEPTION 'Complete this Service using attendance finalization.';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_service_completion() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER service_completion_guard BEFORE UPDATE OF status ON public.services
 FOR EACH ROW EXECUTE FUNCTION public.guard_service_completion();

CREATE OR REPLACE FUNCTION public.finalize_service_attendance(p_service_id uuid,p_actor_id uuid,p_preview boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE s public.services%ROWTYPE; summary jsonb; missing bigint; inserted bigint := 0; prior_flag text;
BEGIN
 SELECT * INTO s FROM public.services WHERE id=p_service_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Service not found.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor_id AND archived_at IS NULL)
 OR NOT EXISTS(
  SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
  JOIN public.role_permissions rp ON rp.role_id=r.id JOIN public.permissions p ON p.id=rp.permission_id
  WHERE ur.user_id=p_actor_id AND r.is_active AND p.is_active AND p.key='services.update'
 ) OR NOT EXISTS(SELECT 1 FROM public.church_branches WHERE id=s.church_branch_id AND is_active)
 OR NOT (EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
                 WHERE ur.user_id=p_actor_id AND r.is_active AND r.key='system_admin')
         OR EXISTS(SELECT 1 FROM public.user_branch_access WHERE user_id=p_actor_id AND church_branch_id=s.church_branch_id)) THEN
  RAISE EXCEPTION 'Service completion is outside your access.';
 END IF;
 IF s.status NOT IN ('scheduled','ongoing') OR
    (s.service_date + coalesce(s.start_time,'00:00'::time)) AT TIME ZONE 'Asia/Manila' > clock_timestamp() THEN
  RAISE EXCEPTION 'Only an Ongoing Service can be completed.';
 END IF;
 -- Freeze current home-roster eligibility against concurrent archive/transfer.
 PERFORM id FROM public.members WHERE church_branch_id=s.church_branch_id
  AND is_archived=false AND member_status IN ('active','inactive') ORDER BY id FOR SHARE;
 SELECT count(*) INTO missing FROM public.members m WHERE m.church_branch_id=s.church_branch_id
  AND m.is_archived=false AND m.member_status IN ('active','inactive')
  AND NOT EXISTS(SELECT 1 FROM public.attendance_records a WHERE a.service_id=s.id AND a.member_id=m.id);
 SELECT jsonb_build_object('present',count(*) FILTER(WHERE attendance_status='present'),
  'excused',count(*) FILTER(WHERE attendance_status='excused'),
  'absent',count(*) FILTER(WHERE attendance_status='absent'),'missing',missing) INTO summary
 FROM public.attendance_records WHERE service_id=s.id;
 IF p_preview THEN RETURN summary; END IF;
 INSERT INTO public.attendance_records(service_id,member_id,attendance_status,method,recorded_by,check_in_time)
 SELECT s.id,m.id,'absent','manual',p_actor_id,NULL FROM public.members m
 WHERE m.church_branch_id=s.church_branch_id AND m.is_archived=false AND m.member_status IN ('active','inactive')
 AND NOT EXISTS(SELECT 1 FROM public.attendance_records a WHERE a.service_id=s.id AND a.member_id=m.id)
 ON CONFLICT(service_id,member_id) DO NOTHING;
 GET DIAGNOSTICS inserted = ROW_COUNT;
 prior_flag := current_setting('upc.finalizing_service',true);
 PERFORM set_config('upc.finalizing_service',s.id::text,true);
 UPDATE public.services SET status='completed',updated_at=now() WHERE id=s.id;
 PERFORM set_config('upc.finalizing_service',coalesce(prior_flag,''),true);
 RETURN summary || jsonb_build_object('generatedAbsent',inserted,'success',true);
END; $$;
REVOKE ALL ON FUNCTION public.finalize_service_attendance(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_service_attendance(uuid,uuid,boolean) TO service_role;
COMMENT ON FUNCTION public.finalize_service_attendance(uuid,uuid,boolean) IS 'Authorized services.update preview/completion. Inserts missing current home-roster Absent rows and completes atomically; existing attendance is never overwritten.';
COMMIT;
