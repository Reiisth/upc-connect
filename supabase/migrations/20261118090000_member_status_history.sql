BEGIN;
-- Serialize the initial snapshot with member writes; older status is unknown.
LOCK TABLE public.members IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.member_status_tracking (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.member_status_tracking DEFAULT VALUES;
CREATE TABLE public.member_status_counts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 branch_id uuid NOT NULL REFERENCES public.church_branches(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 active_delta bigint NOT NULL,
 inactive_delta bigint NOT NULL,
 CHECK (active_delta <> 0 OR inactive_delta <> 0)
);
CREATE INDEX member_status_counts_branch_date ON public.member_status_counts(branch_id,recorded_at);
INSERT INTO public.member_status_counts(branch_id,recorded_at,active_delta,inactive_delta)
 SELECT church_branch_id,(SELECT started_at FROM public.member_status_tracking),
 count(*) FILTER (WHERE member_status='active'),count(*) FILTER (WHERE member_status='inactive')
 FROM public.members WHERE is_archived IS FALSE AND church_branch_id IS NOT NULL AND member_status IN ('active','inactive')
 GROUP BY church_branch_id;
ALTER TABLE public.member_status_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_status_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_status_tracking,public.member_status_counts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.member_status_tracking,public.member_status_counts TO service_role;

CREATE FUNCTION public.capture_member_status_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_branch uuid; new_branch uuid; oa bigint:=0; oi bigint:=0; na bigint:=0; ni bigint:=0; recorded timestamptz:=clock_timestamp();
BEGIN
 IF TG_OP <> 'INSERT' THEN
  old_branch:=OLD.church_branch_id;
  IF OLD.is_archived IS FALSE THEN oa:=(OLD.member_status IS NOT DISTINCT FROM 'active')::int; oi:=(OLD.member_status IS NOT DISTINCT FROM 'inactive')::int; END IF;
 END IF;
 IF TG_OP <> 'DELETE' THEN
  new_branch:=NEW.church_branch_id;
  IF NEW.is_archived IS FALSE THEN na:=(NEW.member_status IS NOT DISTINCT FROM 'active')::int; ni:=(NEW.member_status IS NOT DISTINCT FROM 'inactive')::int; END IF;
 END IF;
 IF old_branch IS NOT DISTINCT FROM new_branch THEN
  IF new_branch IS NOT NULL AND (na<>oa OR ni<>oi) THEN
   INSERT INTO public.member_status_counts(branch_id,recorded_at,active_delta,inactive_delta) VALUES(new_branch,recorded,na-oa,ni-oi);
  END IF;
 ELSE
  IF old_branch IS NOT NULL AND (oa<>0 OR oi<>0) THEN INSERT INTO public.member_status_counts(branch_id,recorded_at,active_delta,inactive_delta) VALUES(old_branch,recorded,-oa,-oi); END IF;
  IF new_branch IS NOT NULL AND (na<>0 OR ni<>0) THEN INSERT INTO public.member_status_counts(branch_id,recorded_at,active_delta,inactive_delta) VALUES(new_branch,recorded,na,ni); END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER members_status_count AFTER INSERT OR UPDATE OR DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.capture_member_status_count();
REVOKE ALL ON FUNCTION public.capture_member_status_count() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.get_member_status_history(p_actor_id uuid,p_branch_ids uuid[],p_from date,p_to date,p_grouping text DEFAULT 'week')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE started timestamptz; effective_to date; result jsonb;
BEGIN
 IF p_branch_ids IS NULL OR array_position(p_branch_ids,NULL) IS NOT NULL OR p_from IS NULL OR p_to IS NULL
 OR p_from>p_to OR p_to-p_from>3660 OR p_grouping IS NULL OR p_grouping NOT IN ('day','week','month') THEN RAISE EXCEPTION 'Invalid member status history filters.'; END IF;
 PERFORM public.assert_member_migration_access(p_actor_id,p_branch_ids,'reports.view');
 SELECT started_at INTO STRICT started FROM public.member_status_tracking;
 effective_to:=least(p_to,(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date);
 WITH buckets AS (
  SELECT greatest(d::date,p_from) AS period_start,
   least((d+('1 '||p_grouping)::interval)::date-1,effective_to) AS as_of_date,
   d::date AS bucket
  FROM generate_series(date_trunc(p_grouping,p_from::timestamp),date_trunc(p_grouping,effective_to::timestamp),('1 '||p_grouping)::interval) d
  WHERE effective_to>=p_from
 ), initial AS (
  SELECT coalesce(sum(active_delta),0) a,coalesce(sum(inactive_delta),0) i FROM public.member_status_counts
  WHERE branch_id=ANY(p_branch_ids) AND recorded_at < (p_from::timestamp AT TIME ZONE 'Asia/Manila')
 ), changes AS (
  SELECT date_trunc(p_grouping,recorded_at AT TIME ZONE 'Asia/Manila')::date bucket,sum(active_delta) a,sum(inactive_delta) i
  FROM public.member_status_counts WHERE branch_id=ANY(p_branch_ids)
   AND recorded_at >= (p_from::timestamp AT TIME ZONE 'Asia/Manila')
   AND recorded_at < ((effective_to+1)::timestamp AT TIME ZONE 'Asia/Manila') GROUP BY 1
 ), points AS (
  SELECT b.period_start,b.as_of_date,
   CASE WHEN b.as_of_date >= (started AT TIME ZONE 'Asia/Manila')::date THEN initial.a+sum(coalesce(c.a,0)) OVER (ORDER BY b.bucket) END active,
   CASE WHEN b.as_of_date >= (started AT TIME ZONE 'Asia/Manila')::date THEN initial.i+sum(coalesce(c.i,0)) OVER (ORDER BY b.bucket) END inactive
  FROM buckets b CROSS JOIN initial LEFT JOIN changes c ON c.bucket=b.bucket
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('periodStart',period_start,'asOfDate',as_of_date,'active',active,'inactive',inactive) ORDER BY period_start),'[]'::jsonb) INTO result FROM points;
 RETURN jsonb_build_object('trackingStartedAt',started,'points',result);
END; $$;
REVOKE ALL ON FUNCTION public.get_member_status_history(uuid,uuid[],date,date,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_member_status_history(uuid,uuid[],date,date,text) TO service_role;
COMMIT;
