BEGIN;

ALTER TABLE public.members ADD COLUMN departed_at timestamptz;
ALTER TABLE public.members ADD CONSTRAINT departed_members_are_archived CHECK (departed_at IS NULL OR is_archived);

CREATE TABLE public.member_migration_tracking (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  started_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.member_migration_tracking(singleton) VALUES (true);

CREATE TABLE public.member_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('transfer','departure','return')),
  from_branch_id uuid REFERENCES public.church_branches(id) ON DELETE RESTRICT,
  to_branch_id uuid REFERENCES public.church_branches(id) ON DELETE RESTRICT,
  member_name text NOT NULL,
  from_branch_name text,
  to_branch_name text,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK ((kind='transfer' AND from_branch_id IS NOT NULL AND to_branch_id IS NOT NULL AND from_branch_id<>to_branch_id)
    OR (kind='departure' AND from_branch_id IS NOT NULL AND to_branch_id IS NULL)
    OR (kind='return' AND from_branch_id IS NULL AND to_branch_id IS NOT NULL))
);
CREATE INDEX member_migrations_member_time ON public.member_migrations(member_id,recorded_at DESC,id);
CREATE INDEX member_migrations_from_time ON public.member_migrations(from_branch_id,recorded_at);
CREATE INDEX member_migrations_to_time ON public.member_migrations(to_branch_id,recorded_at);
ALTER TABLE public.member_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_migration_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_migrations,public.member_migration_tracking FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.member_migrations,public.member_migration_tracking TO service_role;

-- RPCs are service-only and verify the authenticated actor supplied by the server.
CREATE FUNCTION public.assert_member_migration_access(p_actor uuid,p_branches uuid[],p_permission text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND archived_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
   JOIN public.role_permissions rp ON rp.role_id=r.id JOIN public.permissions p ON p.id=rp.permission_id
   WHERE ur.user_id=p_actor AND r.is_active AND p.is_active AND p.key=p_permission)
 OR EXISTS(SELECT 1 FROM unnest(p_branches) b(id) WHERE b.id IS NOT NULL AND NOT (
   EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor AND r.is_active AND r.key='system_admin')
   OR EXISTS(SELECT 1 FROM public.user_branch_access WHERE user_id=p_actor AND church_branch_id=b.id))) THEN
   RAISE EXCEPTION 'Member movement is outside your access.';
 END IF;
END; $$;

CREATE FUNCTION public.capture_member_migration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event_kind text; source_id uuid; destination_id uuid; actor uuid;
BEGIN
 IF NEW.church_branch_id IS NOT DISTINCT FROM OLD.church_branch_id AND NEW.departed_at IS NOT DISTINCT FROM OLD.departed_at THEN RETURN NEW; END IF;
 IF current_setting('role',true) IN ('service_role','authenticated','anon')
    AND current_setting('upc.migrating_member',true) IS DISTINCT FROM NEW.id::text THEN
   RAISE EXCEPTION 'Change membership using the authorized member movement workflow.';
 END IF;
 actor:=nullif(current_setting('upc.migration_actor',true),'')::uuid;
 IF OLD.departed_at IS NULL AND NEW.departed_at IS NOT NULL THEN
   IF NEW.church_branch_id IS DISTINCT FROM OLD.church_branch_id THEN RAISE EXCEPTION 'Departure cannot change branch.'; END IF;
   event_kind:='departure';source_id:=OLD.church_branch_id;
 ELSIF OLD.departed_at IS NOT NULL AND NEW.departed_at IS NULL THEN
   event_kind:='return';destination_id:=NEW.church_branch_id;
 ELSIF OLD.church_branch_id IS DISTINCT FROM NEW.church_branch_id THEN
   IF OLD.departed_at IS NOT NULL THEN RAISE EXCEPTION 'Restore a departed member before transferring.'; END IF;
   IF NEW.church_branch_id IS NULL THEN RAISE EXCEPTION 'Record a departure instead of clearing a branch.'; END IF;
   -- First assignment repairs an unknown branch; it is not an invented transfer.
   IF OLD.church_branch_id IS NULL THEN RETURN NEW; END IF;
   event_kind:='transfer';source_id:=OLD.church_branch_id;destination_id:=NEW.church_branch_id;
 END IF;
 IF event_kind IS NOT NULL THEN
   INSERT INTO public.member_migrations(member_id,kind,from_branch_id,to_branch_id,member_name,from_branch_name,to_branch_name,recorded_by)
   VALUES(NEW.id,event_kind,source_id,destination_id,concat_ws(' ',NEW.first_name,NEW.middle_name,NEW.last_name),
     (SELECT name FROM public.church_branches WHERE id=source_id),(SELECT name FROM public.church_branches WHERE id=destination_id),actor);
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER member_migration_capture AFTER UPDATE OF church_branch_id,departed_at ON public.members
 FOR EACH ROW EXECUTE FUNCTION public.capture_member_migration();

CREATE FUNCTION public.change_member_membership(p_member_id uuid,p_actor_id uuid,p_expected_branch uuid,p_operation text,p_patch jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.members%ROWTYPE; destination uuid; prior_member text; prior_actor text;
BEGIN
 SELECT * INTO m FROM public.members WHERE id=p_member_id FOR UPDATE;
 IF NOT FOUND OR m.church_branch_id IS DISTINCT FROM p_expected_branch THEN RAISE EXCEPTION 'Member changed. Reload and try again.'; END IF;
 IF p_operation NOT IN ('transfer','departure','return') THEN RAISE EXCEPTION 'Invalid membership operation.'; END IF;
 PERFORM public.assert_member_migration_access(p_actor_id,ARRAY[m.church_branch_id],CASE WHEN p_operation='transfer' THEN 'members.update' ELSE 'members.archive' END);
 IF p_operation='transfer' THEN
   IF m.is_archived OR m.departed_at IS NOT NULL THEN RAISE EXCEPTION 'Restore the member before editing.'; END IF;
   IF jsonb_typeof(p_patch)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('church_branch_id','first_attendance_date','member_status','department_id','position','zone')) THEN RAISE EXCEPTION 'Invalid church information.'; END IF;
   destination:=(p_patch->>'church_branch_id')::uuid;
   IF destination IS NULL THEN RAISE EXCEPTION 'Choose a destination branch.'; END IF;
   PERFORM public.assert_member_migration_access(p_actor_id,ARRAY[destination],'members.update');
   IF NOT EXISTS(SELECT 1 FROM public.church_branches WHERE id=destination AND is_active) THEN RAISE EXCEPTION 'Choose an active branch.'; END IF;
   IF (p_patch->>'member_status') IS NULL OR (p_patch->>'member_status') NOT IN ('active','inactive')
      OR length(coalesce(p_patch->>'position',''))>120
      OR ((p_patch->>'first_attendance_date')::date > (now() AT TIME ZONE 'Asia/Manila')::date)
      OR ((p_patch->>'zone')::int NOT BETWEEN 1 AND 5) THEN RAISE EXCEPTION 'Invalid church information.'; END IF;
   IF (p_patch->>'department_id') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.departments WHERE id=(p_patch->>'department_id')::uuid AND (is_active OR id=m.department_id)) THEN RAISE EXCEPTION 'Choose an active department.'; END IF;
 ELSE
   IF p_patch<>'{}'::jsonb THEN RAISE EXCEPTION 'Membership lifecycle does not accept church edits.'; END IF;
   IF p_operation='departure' AND (m.is_archived OR m.departed_at IS NOT NULL) THEN RAISE EXCEPTION 'Only a current member can depart.'; END IF;
   IF p_operation='return' AND (NOT m.is_archived OR m.departed_at IS NULL) THEN RAISE EXCEPTION 'Only a departed member can return.'; END IF;
 END IF;
 IF m.church_branch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.church_branches WHERE id=m.church_branch_id AND is_active) THEN RAISE EXCEPTION 'Current branch must be active.'; END IF;
 IF p_operation<>'transfer' AND m.church_branch_id IS NULL THEN RAISE EXCEPTION 'Member requires a branch.'; END IF;
 IF m.church_branch_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=p_actor_id AND r.is_active AND r.key='system_admin') THEN RAISE EXCEPTION 'Only a system administrator can repair an unassigned member.'; END IF;
 prior_member:=current_setting('upc.migrating_member',true);prior_actor:=current_setting('upc.migration_actor',true);
 PERFORM set_config('upc.migrating_member',m.id::text,true);PERFORM set_config('upc.migration_actor',p_actor_id::text,true);
 IF p_operation='transfer' THEN
   UPDATE public.members SET church_branch_id=destination,first_attendance_date=(p_patch->>'first_attendance_date')::date,
    member_status=p_patch->>'member_status',department_id=(p_patch->>'department_id')::uuid,
    position=p_patch->>'position',zone=(p_patch->>'zone')::smallint,updated_at=now() WHERE id=m.id;
 ELSIF p_operation='departure' THEN
   UPDATE public.members SET departed_at=clock_timestamp(),is_archived=true,archived_at=now(),updated_at=now() WHERE id=m.id;
 ELSE
   UPDATE public.members SET departed_at=NULL,is_archived=false,archived_at=NULL,updated_at=now() WHERE id=m.id;
 END IF;
 PERFORM set_config('upc.migrating_member',coalesce(prior_member,''),true);PERFORM set_config('upc.migration_actor',coalesce(prior_actor,''),true);
 RETURN m.id;
END; $$;

REVOKE ALL ON FUNCTION public.assert_member_migration_access(uuid,uuid[],text),public.capture_member_migration(),public.change_member_membership(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.change_member_membership(uuid,uuid,uuid,text,jsonb) TO service_role;
COMMIT;
