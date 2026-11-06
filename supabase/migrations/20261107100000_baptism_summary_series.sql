BEGIN;
-- Keep the existing totals/undated/breakdown definitions; add independently
-- counted monthly Water and Holy Ghost series, scoped to stored record branch.
CREATE OR REPLACE FUNCTION public.get_baptism_module_summary(p_branch_ids uuid[],p_from date,p_to date)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO public, pg_temp AS $$
 WITH source AS (
  SELECT church_branch_id AS branch,baptism_date AS date,baptism_type AS type
  FROM public.baptism_records
  WHERE church_branch_id=ANY(p_branch_ids) AND baptism_date BETWEEN p_from AND p_to
 ), trend AS (
  SELECT branch AS "branchId",date_trunc('month',date)::date AS period,count(*) AS value,
   count(*) FILTER(WHERE type='water') AS water,
   count(*) FILTER(WHERE type='holy_ghost') AS "holyGhost"
  FROM source GROUP BY GROUPING SETS((branch,date_trunc('month',date)::date),(date_trunc('month',date)::date))
 )
 SELECT public.get_module_summary('baptisms',p_branch_ids,p_from,p_to) || jsonb_build_object(
  'trend',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY period,"branchId") FROM trend t),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.get_baptism_module_summary(uuid[],date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_baptism_module_summary(uuid[],date,date) TO service_role;
COMMENT ON FUNCTION public.get_baptism_module_summary(uuid[],date,date) IS 'Read-only Baptism module aggregates. Server must authorize baptisms.view and validate every stored-record branch ID. Null branchId rows roll up only supplied branches.';
COMMIT;
