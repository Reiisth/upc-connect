-- Convert the existing text/check service type model to global managed reference data.
-- Stored keys are preserved; labels can change independently.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.services') IS NULL OR to_regclass('public.service_types') IS NOT NULL THEN
    RAISE EXCEPTION 'Expected services and no existing service_types table. Inspect the deployed schema.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='services' AND column_name='service_type' AND data_type='text' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'Expected public.services.service_type to be NOT NULL text.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.services WHERE service_type !~ '^[a-z][a-z0-9_]{0,79}$') THEN
    RAISE EXCEPTION 'Existing service_type values do not match stable-key format. Resolve values before applying this migration.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.services'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%service_type%' AND conname <> 'services_service_type_check') THEN
    RAISE EXCEPTION 'Unexpected service_type check constraint exists; inspect it before applying this migration.';
  END IF;
END;
$preflight$;

CREATE TABLE public.service_types (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{0,79}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX service_types_normalized_name_uidx
  ON public.service_types (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));

INSERT INTO public.service_types(key,name) VALUES
 ('sunday_morning','Sunday Morning'),('sunday_evening','Sunday Evening'),
 ('prayer_meeting','Prayer Meeting'),('special_service','Special Service'),('other','Other');
INSERT INTO public.service_types(key,name)
SELECT DISTINCT service_type, initcap(replace(service_type,'_',' ')) FROM public.services
ON CONFLICT(key) DO NOTHING;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_service_type_check;
ALTER TABLE public.services ADD CONSTRAINT services_service_type_fkey
  FOREIGN KEY (service_type) REFERENCES public.service_types(key) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.service_types TO authenticated;
CREATE POLICY "Users with service type access can view service types"
  ON public.service_types FOR SELECT TO authenticated
  USING (public.has_permission('service_types.view') OR public.has_permission('service_types.manage'));

INSERT INTO public.permissions(key,name,description,is_active) VALUES
 ('service_types.view','View Service Types','View global service type reference data.',true),
 ('service_types.manage','Manage Service Types','Create, rename, activate, and deactivate service types.',true)
ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, is_active=true;

INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key IN ('system_admin','pastor') AND p.key IN ('service_types.view','service_types.manage')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.service_types IS 'Global service type reference data. Keys identify historical service groups; inactive types remain valid for existing services and are unavailable for new services.';
COMMIT;
