BEGIN;
CREATE TABLE public.ai_report_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 branch_ids uuid[] NOT NULL CHECK (cardinality(branch_ids) > 0 AND array_position(branch_ids, NULL) IS NULL),
 description text NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
 result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object' AND result @> '{"ok":true}'::jsonb)
);
CREATE INDEX ai_report_documents_owner_date_idx ON public.ai_report_documents(created_by, created_at DESC, id DESC);
ALTER TABLE public.ai_report_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_report_documents FROM anon, authenticated;
GRANT SELECT ON public.ai_report_documents TO authenticated;
GRANT ALL ON public.ai_report_documents TO service_role;
CREATE POLICY ai_report_documents_select ON public.ai_report_documents FOR SELECT TO authenticated USING (
 created_by = auth.uid() AND public.has_permission('reports.view') AND
 NOT EXISTS (SELECT 1 FROM unnest(branch_ids) AS branch(id) WHERE NOT public.has_branch_access(branch.id))
);
COMMENT ON TABLE public.ai_report_documents IS 'Private validated AI report snapshots. Server-authorized insert only; owner, Reports permission and every stored branch are required for reads.';
COMMIT;
