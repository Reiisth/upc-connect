-- Minimal projections of columns already used by the repository's live modules.
-- Run only in the disposable database created by analytics-postgres.test.cjs.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE TABLE church_branches (id uuid PRIMARY KEY, name text, code text, is_active boolean, inactivity_threshold_weeks integer);
CREATE TABLE members (id uuid PRIMARY KEY, church_branch_id uuid, is_archived boolean, member_status text, first_attendance_date date, created_at timestamptz);
CREATE TABLE services (id uuid PRIMARY KEY, church_branch_id uuid, service_date date, service_type text, status text);
CREATE TABLE attendance_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service_id uuid, member_id uuid, attendance_status text);
CREATE TABLE financial_contributions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), church_branch_id uuid, member_id uuid, contribution_date date, amount numeric(12,2), contribution_type text, payment_method text);
CREATE TABLE baptism_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), church_branch_id uuid, baptism_date date, baptism_type text);
CREATE TABLE member_follow_ups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), church_branch_id uuid, member_id uuid, follow_up_date date, method text, outcome text, next_follow_up_date date, created_at timestamptz DEFAULT now());
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;

INSERT INTO church_branches VALUES
  ('00000000-0000-0000-0000-000000000001','Main','A',true,3),
  ('00000000-0000-0000-0000-000000000002','Second','B',true,4),
  ('00000000-0000-0000-0000-000000000003','Outside','C',true,3);
INSERT INTO members VALUES
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001',false,'active','2026-09-01','2026-09-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001',false,'inactive','2026-10-01','2026-10-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001',false,'active',null,'2026-10-04T16:00:00Z'),
  ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001',true,'inactive','2026-09-01','2026-10-12T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000002',false,'active','2026-09-01','2026-09-01T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000003',false,'active','2026-09-01','2026-09-01T00:00:00Z');
INSERT INTO services VALUES
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000001','2026-10-05','sunday_morning','completed'),
  ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000001','2026-10-07','prayer_meeting','completed'),
  ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000001','2026-10-12','sunday_morning','completed'),
  ('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000001','2026-10-19','sunday_morning','completed'),
  ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000001','2026-10-26','sunday_morning','completed'),
  ('00000000-0000-0000-0000-000000000026','00000000-0000-0000-0000-000000000001','2026-10-20','other','scheduled'),
  ('00000000-0000-0000-0000-000000000027','00000000-0000-0000-0000-000000000001','2026-10-21','other','ongoing'),
  ('00000000-0000-0000-0000-000000000028','00000000-0000-0000-0000-000000000001','2026-10-22','other','cancelled'),
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000002','2026-10-05','sunday_morning','completed'),
  ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000002','2026-10-12','sunday_morning','completed'),
  ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000002','2026-10-19','sunday_morning','completed'),
  ('00000000-0000-0000-0000-000000000034','00000000-0000-0000-0000-000000000003','2026-10-12','sunday_morning','completed');
INSERT INTO attendance_records(service_id,member_id,attendance_status) VALUES
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','present'),
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','late'),
  ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011','late'),
  ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000012','excused'),
  ('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000014','present'),
  ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000012','late'),
  ('00000000-0000-0000-0000-000000000026','00000000-0000-0000-0000-000000000012','present'),
  ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000011','present'),
  ('00000000-0000-0000-0000-000000000034','00000000-0000-0000-0000-000000000016','present');
INSERT INTO financial_contributions(church_branch_id,member_id,contribution_date,amount,contribution_type,payment_method) VALUES
  ('00000000-0000-0000-0000-000000000001',null,'2026-10-05',0.10,'tithe','cash'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','2026-10-12',0.20,'love_offering','gcash'),
  ('00000000-0000-0000-0000-000000000001',null,'2026-09-01',1.00,'other','cash'),
  ('00000000-0000-0000-0000-000000000002',null,'2026-10-12',0.05,'tithe','bank_transfer'),
  ('00000000-0000-0000-0000-000000000003',null,'2026-10-12',999.00,'other','cash');
INSERT INTO baptism_records(church_branch_id,baptism_date,baptism_type) VALUES
  ('00000000-0000-0000-0000-000000000001','2026-10-05','water'),
  ('00000000-0000-0000-0000-000000000001','2026-10-12','holy_ghost'),
  ('00000000-0000-0000-0000-000000000001',null,'water'),
  ('00000000-0000-0000-0000-000000000001','2026-09-01','holy_ghost'),
  ('00000000-0000-0000-0000-000000000002','2026-10-19','water');
INSERT INTO member_follow_ups(church_branch_id,member_id,follow_up_date,method,outcome,next_follow_up_date,created_at) VALUES
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','2026-10-05','call','needs_follow_up','2026-10-06','2026-10-05T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','2026-10-20','visit','resolved',null,'2026-10-20T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','2026-10-19','message','no_response','2026-10-20','2026-10-19T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000014','2026-10-10','in_person','needs_follow_up','2026-10-12','2026-10-10T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','2026-11-01','call','needs_follow_up','2026-11-02','2026-10-29T00:00:00Z'),
  ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000015','2026-10-12','call','needs_follow_up','2026-10-30','2026-10-12T00:00:00Z');
