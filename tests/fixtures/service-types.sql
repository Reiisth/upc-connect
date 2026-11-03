DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE TABLE public.roles(id uuid PRIMARY KEY,key text UNIQUE);
CREATE TABLE public.permissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text UNIQUE,name text,description text,is_active boolean);
CREATE TABLE public.role_permissions(role_id uuid REFERENCES roles,permission_id uuid REFERENCES permissions,PRIMARY KEY(role_id,permission_id));
CREATE FUNCTION public.has_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.church_branches(id uuid PRIMARY KEY);
INSERT INTO public.church_branches VALUES ('00000000-0000-0000-0000-000000000001');
CREATE TABLE public.services(
 id uuid PRIMARY KEY, church_branch_id uuid NOT NULL REFERENCES church_branches(id),
 service_type text NOT NULL CONSTRAINT services_service_type_check CHECK(service_type = ANY(ARRAY['sunday_morning','sunday_evening','prayer_meeting','special_service','other'])),
 status text NOT NULL CONSTRAINT services_status_check CHECK(status=ANY(ARRAY['scheduled','ongoing','completed','cancelled']))
);
INSERT INTO public.services VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','sunday_morning','completed');
INSERT INTO public.roles VALUES
 ('00000000-0000-0000-0000-000000000021','system_admin'),('00000000-0000-0000-0000-000000000022','pastor'),
 ('00000000-0000-0000-0000-000000000023','custom');
