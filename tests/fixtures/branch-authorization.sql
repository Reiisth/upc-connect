-- Disposable test database only. Reproduce the client-supplied live helper
-- definitions, ACLs, policies, column types and relevant RLS restrictions.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY, display_name text, created_at timestamptz, archived_at timestamptz
);
CREATE TABLE public.roles (
  id uuid PRIMARY KEY, name text NOT NULL, description text, key text NOT NULL UNIQUE,
  display_name text NOT NULL, is_system boolean NOT NULL, is_staff boolean NOT NULL,
  is_active boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role_id uuid NOT NULL REFERENCES public.roles(id), created_at timestamptz
);
CREATE TABLE public.church_branches (id uuid PRIMARY KEY, is_active boolean NOT NULL);
CREATE TABLE public.user_branch_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  church_branch_id uuid NOT NULL REFERENCES public.church_branches(id), created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.profiles, public.roles, public.user_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_branch_access TO authenticated;
CREATE POLICY own_roles ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY role_metadata ON public.roles FOR SELECT TO authenticated USING (true);

CREATE FUNCTION public.has_role(role_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = role_name);
$$;
CREATE FUNCTION public.has_any_role(role_names text[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = ANY(role_names));
$$;
CREATE FUNCTION public.has_branch_access(branch_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT public.has_role('system_admin') OR EXISTS (
    SELECT 1 FROM public.user_branch_access uba WHERE uba.user_id = auth.uid() AND uba.church_branch_id = branch_id);
$$;
REVOKE ALL ON FUNCTION public.has_role(text), public.has_any_role(text[]), public.has_branch_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text), public.has_any_role(text[]), public.has_branch_access(uuid) TO anon, authenticated, service_role;

CREATE POLICY "System admins can view all branch access" ON public.user_branch_access FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'system_admin'));
CREATE POLICY "System admins can insert branch access" ON public.user_branch_access FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'system_admin'));
CREATE POLICY "System admins can delete branch access" ON public.user_branch_access FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = auth.uid() AND r.name = 'system_admin'));
CREATE POLICY "Users can view their own branch access" ON public.user_branch_access FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.roles(id,name,key,display_name,is_system,is_staff,is_active) VALUES
 ('00000000-0000-0000-0000-000000000101','system_admin','system_admin','Administrator',true,true,true),
 ('00000000-0000-0000-0000-000000000102','custom_staff','custom_staff','Custom staff',false,true,true),
 ('00000000-0000-0000-0000-000000000103','inactive_staff','inactive_staff','Inactive staff',false,true,false);
INSERT INTO public.profiles(id,display_name) VALUES
 ('00000000-0000-0000-0000-000000000001','Administrator'),
 ('00000000-0000-0000-0000-000000000002','Assigned custom staff'),
 ('00000000-0000-0000-0000-000000000003','Other staff');
INSERT INTO public.user_roles(user_id,role_id) VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000101'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000102'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000103');
INSERT INTO public.church_branches VALUES
 ('00000000-0000-0000-0000-000000000201',true), ('00000000-0000-0000-0000-000000000202',false);
INSERT INTO public.user_branch_access(user_id,church_branch_id) VALUES
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000201'),
 ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000201'),
 ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000202');

-- Exercise an unchanged operational permission AND branch policy. This does
-- not stand in for live has_permission(): permission comes from a test claim.
CREATE FUNCTION public.has_permission(permission_key text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(current_setting('test.permission',true), '') = permission_key;
$$;
CREATE TABLE public.scope_probe(id integer PRIMARY KEY, church_branch_id uuid);
INSERT INTO public.scope_probe VALUES
 (1,'00000000-0000-0000-0000-000000000201'),(2,'00000000-0000-0000-0000-000000000202');
ALTER TABLE public.scope_probe ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.scope_probe TO authenticated;
CREATE POLICY permission_and_branch ON public.scope_probe FOR SELECT TO authenticated
 USING (public.has_permission('services.view') AND public.has_branch_access(church_branch_id));
