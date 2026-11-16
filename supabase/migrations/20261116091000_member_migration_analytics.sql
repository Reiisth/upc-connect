BEGIN;
CREATE FUNCTION public.get_member_migration_analytics(p_actor_id uuid,p_branch_ids uuid[],p_from date,p_to date,p_grouping text DEFAULT 'month')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.assert_member_migration_access(p_actor_id,p_branch_ids,'reports.view');
 IF p_branch_ids IS NULL OR array_position(p_branch_ids,NULL) IS NOT NULL OR p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_to-p_from>3660
    OR p_grouping NOT IN ('day','week','month') THEN RAISE EXCEPTION 'Invalid migration reporting filters.'; END IF;
 WITH events AS (
   SELECT *, (recorded_at AT TIME ZONE 'Asia/Manila')::date AS event_date FROM public.member_migrations
   WHERE recorded_at >= p_from::timestamp AT TIME ZONE 'Asia/Manila'
    AND recorded_at < (p_to+1)::timestamp AT TIME ZONE 'Asia/Manila'
    AND (from_branch_id=ANY(p_branch_ids) OR to_branch_id=ANY(p_branch_ids))
 ), totals AS (
   SELECT count(*) AS events,count(DISTINCT member_id) AS members,
    count(*) FILTER(WHERE kind='transfer') AS transfers,
    count(*) FILTER(WHERE kind='transfer' AND to_branch_id=ANY(p_branch_ids)) AS incoming,
    count(*) FILTER(WHERE kind='transfer' AND from_branch_id=ANY(p_branch_ids)) AS outgoing,
    count(*) FILTER(WHERE kind='departure') AS departures,count(*) FILTER(WHERE kind='return') AS returns,
    count(*) FILTER(WHERE to_branch_id=ANY(p_branch_ids))-count(*) FILTER(WHERE from_branch_id=ANY(p_branch_ids)) AS net
   FROM events
 ), periods AS (
   SELECT generate_series(date_trunc(p_grouping,p_from::timestamp),date_trunc(p_grouping,p_to::timestamp),
     CASE p_grouping WHEN 'day' THEN interval '1 day' WHEN 'week' THEN interval '1 week' ELSE interval '1 month' END)::date AS period
 ), trend AS (
   SELECT p.period AS "periodStart",count(e.id) FILTER(WHERE kind='transfer' AND to_branch_id=ANY(p_branch_ids)) AS incoming,
    count(e.id) FILTER(WHERE kind='transfer' AND from_branch_id=ANY(p_branch_ids)) AS outgoing,
    count(e.id) FILTER(WHERE kind='departure') AS departures,count(e.id) FILTER(WHERE kind='return') AS returns
   FROM periods p LEFT JOIN events e ON date_trunc(p_grouping,e.event_date::timestamp)::date=p.period GROUP BY p.period ORDER BY p.period
 ), branch_totals AS (
   SELECT b.id,b.name,count(e.id) FILTER(WHERE e.kind='transfer' AND e.to_branch_id=b.id) AS incoming,
    count(e.id) FILTER(WHERE e.kind='transfer' AND e.from_branch_id=b.id) AS outgoing,
    count(e.id) FILTER(WHERE e.kind='departure') AS departures,count(e.id) FILTER(WHERE e.kind='return') AS returns,
    count(e.id) FILTER(WHERE e.to_branch_id=b.id)-count(e.id) FILTER(WHERE e.from_branch_id=b.id) AS net
   FROM public.church_branches b LEFT JOIN events e ON e.from_branch_id=b.id OR e.to_branch_id=b.id
   WHERE b.id=ANY(p_branch_ids) GROUP BY b.id,b.name ORDER BY b.name,b.id
 ), flow_counts AS (
   SELECT CASE WHEN from_branch_id=ANY(p_branch_ids) THEN from_branch_name ELSE 'Outside accessible branches' END AS source,
     CASE WHEN to_branch_id=ANY(p_branch_ids) THEN to_branch_name ELSE 'Outside accessible branches' END AS destination,count(*) AS transfers
   FROM events WHERE kind='transfer' GROUP BY 1,2 ORDER BY count(*) DESC,1,2
 )
 SELECT jsonb_build_object('trackingStartedAt',(SELECT started_at FROM public.member_migration_tracking),
  'totals',(SELECT to_jsonb(t) FROM totals t),'trend',coalesce((SELECT jsonb_agg(t) FROM trend t),'[]'::jsonb),
  'branches',coalesce((SELECT jsonb_agg(b) FROM branch_totals b),'[]'::jsonb),
  'flows',coalesce((SELECT jsonb_agg(f) FROM flow_counts f),'[]'::jsonb)) INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_member_migration_analytics(uuid,uuid[],date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_migration_analytics(uuid,uuid[],date,date,text) TO service_role;
COMMIT;
