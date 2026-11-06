-- Module summaries return aggregate values only. Callers must authorize the
-- module view permission and validate every branch ID before invoking.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_module_summary(p_module text, p_branch_ids uuid[], p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO public, pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN RAISE EXCEPTION 'Invalid module range'; END IF;
 IF p_module = 'attendance' THEN
 WITH source AS MATERIALIZED (
   SELECT s.id, s.church_branch_id AS branch, s.service_date AS date, a.member_id, a.attendance_status AS status
   FROM public.services s LEFT JOIN LATERAL (
     SELECT DISTINCT ON (member_id) member_id, attendance_status FROM public.attendance_records
     WHERE service_id=s.id ORDER BY member_id, CASE attendance_status WHEN 'present' THEN 0 WHEN 'late' THEN 1 ELSE 2 END
   ) a ON true
   WHERE s.church_branch_id=ANY(p_branch_ids) AND s.status='completed' AND s.service_date BETWEEN p_from AND p_to
 ), totals AS (
   SELECT branch AS "branchId", count(member_id) AS count, count(DISTINCT id) AS services,
     count(member_id) FILTER(WHERE status IN ('present','late')) AS physical,
     round(count(member_id) FILTER(WHERE status IN ('present','late'))::numeric/nullif(count(DISTINCT id),0),2) AS average
   FROM source GROUP BY GROUPING SETS((branch),())
 ), trend AS (
   SELECT branch AS "branchId", date_trunc('month',date)::date AS period,
     count(member_id) FILTER(WHERE status IN ('present','late')) AS value
   FROM source GROUP BY GROUPING SETS((branch,date_trunc('month',date)),(date_trunc('month',date)))
 ), breakdown AS (
   SELECT branch AS "branchId", status AS label, count(member_id) AS value FROM source WHERE member_id IS NOT NULL
   GROUP BY GROUPING SETS((branch,status),(status))
 ) SELECT jsonb_build_object('totals',(SELECT jsonb_agg(to_jsonb(t)) FROM totals t),
 'trend',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY period) FROM trend t),'[]'::jsonb),
 'breakdown',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM breakdown t),'[]'::jsonb)) INTO result;
 ELSIF p_module = 'baptisms' THEN
 WITH source AS MATERIALIZED (
   SELECT church_branch_id AS branch, baptism_date AS date, baptism_type AS type FROM public.baptism_records
   WHERE church_branch_id=ANY(p_branch_ids) AND (baptism_date BETWEEN p_from AND p_to OR baptism_date IS NULL)
 ), totals AS (
   SELECT branch AS "branchId", count(date) AS count,
     count(date) FILTER(WHERE type='water') AS water, count(date) FILTER(WHERE type='holy_ghost') AS "holyGhost",
     count(*) FILTER(WHERE date IS NULL) AS undated FROM source GROUP BY GROUPING SETS((branch),())
 ), trend AS (
   SELECT branch AS "branchId", date_trunc('month',date)::date AS period, count(*) AS value FROM source WHERE date IS NOT NULL
   GROUP BY GROUPING SETS((branch,date_trunc('month',date)),(date_trunc('month',date)))
 ), breakdown AS (
   SELECT branch AS "branchId", type AS label, count(*) AS value FROM source WHERE date IS NOT NULL
   GROUP BY GROUPING SETS((branch,type),(type))
 ) SELECT jsonb_build_object('totals',(SELECT jsonb_agg(to_jsonb(t)) FROM totals t),
 'trend',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY period) FROM trend t),'[]'::jsonb),
 'breakdown',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM breakdown t),'[]'::jsonb)) INTO result;
 ELSIF p_module = 'contributions' THEN
 WITH source AS MATERIALIZED (
   SELECT church_branch_id AS branch, contribution_date AS date, contributor_type AS type, amount FROM public.financial_contributions
   WHERE church_branch_id=ANY(p_branch_ids) AND contribution_date BETWEEN p_from AND p_to
 ), totals AS (
   SELECT branch AS "branchId", count(*) AS count, round(coalesce(sum(amount),0),2)::text AS amount,
     round(avg(amount),2)::text AS average FROM source GROUP BY GROUPING SETS((branch),())
 ), trend AS (
   SELECT branch AS "branchId", date_trunc('month',date)::date AS period, round(sum(amount),2)::text AS value FROM source
   GROUP BY GROUPING SETS((branch,date_trunc('month',date)),(date_trunc('month',date)))
 ), breakdown AS (
   SELECT branch AS "branchId", type AS label, round(sum(amount),2)::text AS value FROM source
   GROUP BY GROUPING SETS((branch,type),(type))
 ) SELECT jsonb_build_object('totals',(SELECT jsonb_agg(to_jsonb(t)) FROM totals t),
 'trend',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY period) FROM trend t),'[]'::jsonb),
 'breakdown',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM breakdown t),'[]'::jsonb)) INTO result;
 ELSE RAISE EXCEPTION 'Invalid module'; END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_module_summary(text,uuid[],date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_module_summary(text,uuid[],date,date) TO service_role;
COMMIT;
