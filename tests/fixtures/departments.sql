CREATE TABLE public.roles (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE
);
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL
);
CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id),
  permission_id uuid NOT NULL REFERENCES public.permissions(id),
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE public.departments (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

INSERT INTO public.roles (id, key) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system_admin'),
  ('00000000-0000-0000-0000-000000000002', 'pastor'),
  ('00000000-0000-0000-0000-000000000003', 'evangelism_officer');
INSERT INTO public.permissions (id, key, name, description, is_active) VALUES
  ('00000000-0000-0000-0000-000000000011', 'dashboard.view', 'Dashboard', NULL, true),
  ('00000000-0000-0000-0000-000000000012', 'reports.view', 'Reports', NULL, true);
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012');
INSERT INTO public.departments (id, name) VALUES
  ('00000000-0000-0000-0000-000000000021', 'Youth'),
  ('00000000-0000-0000-0000-000000000022', 'Worship');
