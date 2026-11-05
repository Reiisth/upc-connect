-- UPC Connect local development/demo data only.
-- Loaded after reference bootstrap by local Supabase reset. Reruns refresh fixture
-- dates and state, while preserving linked member account status. Never deploy this seed. It never creates Auth users or changes role grants.
BEGIN;

-- LOCAL ONLY: invoke through scripts/local-db.mjs; never pass a hosted connection.
-- SQL alone cannot reliably distinguish a hosted database from a local one.

CREATE TEMP TABLE _upc_demo_dates ON COMMIT DROP AS
SELECT (now() AT TIME ZONE 'Asia/Manila')::date AS today,
       date_trunc('week', now() AT TIME ZONE 'Asia/Manila')::date AS monday;

DO $preflight$
BEGIN
  IF to_regclass('public.church_branches') IS NULL
     OR to_regclass('public.members') IS NULL
     OR to_regclass('public.services') IS NULL
     OR to_regclass('public.attendance_records') IS NULL
     OR to_regclass('public.departments') IS NULL
     OR to_regclass('public.service_types') IS NULL
     OR to_regclass('public.member_follow_ups') IS NULL
     OR to_regclass('public.financial_contributions') IS NULL
     OR to_regclass('public.baptism_records') IS NULL THEN
    RAISE EXCEPTION 'UPC Connect core schema is incomplete. Provision the local app schema before running supabase/seed.sql.';
  END IF;
  IF (SELECT count(*) FROM public.service_types WHERE key IN
      ('sunday_morning','sunday_evening','prayer_meeting')) <> 3 THEN
    RAISE EXCEPTION 'Required service types are missing; load current_reference.sql before demo data.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.service_types WHERE key='demo_legacy_gathering' AND name <> 'UPC Demo Legacy Gathering') THEN
    RAISE EXCEPTION 'service type key demo_legacy_gathering is already used by another reference row.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND (table_name,column_name) IN (
        ('attendance_records','recorded_by'),
        ('financial_contributions','recorded_by'),
        ('baptism_records','recorded_by')
      )
      AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'A demo operational table requires a recorded_by Auth profile. Create local Auth accounts and use the application workflow before seeding that schema.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.departments WHERE lower(btrim(name)) IN
      ('upc demo - youth','upc demo - worship','upc demo - evangelism','upc demo - ushering',
       'upc demo - children','upc demo - prayer','upc demo - care','upc demo - legacy fellowship')
      AND id NOT IN ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002',
       'd0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004',
       'd0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000006',
       'd0000000-0000-4000-8000-000000000007','d0000000-0000-4000-8000-000000000008')) THEN
    RAISE EXCEPTION 'A UPC Demo department name already exists with a different id; inspect the local data before seeding.';
  END IF;
END;
$preflight$;

-- Two explicit branch thresholds make the same absence pattern testable at 3 vs 4 weeks.
INSERT INTO public.church_branches
  (id,name,code,street_address,barangay,city,province,country,is_active,inactivity_threshold_weeks,updated_at)
VALUES
 ('b0000000-0000-4000-8000-000000000001','UPC Demo - North Branch','DEMO-N','12 Sampaguita Street','San Isidro','Quezon City','Metro Manila','Philippines',true,3,now()),
 ('b0000000-0000-4000-8000-000000000002','UPC Demo - South Branch','DEMO-S','48 Ilang-Ilang Avenue','Santa Lucia','Pasig','Metro Manila','Philippines',true,4,now())
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, code=EXCLUDED.code,
 street_address=EXCLUDED.street_address, barangay=EXCLUDED.barangay, city=EXCLUDED.city,
 province=EXCLUDED.province, country=EXCLUDED.country, is_active=true,
 inactivity_threshold_weeks=EXCLUDED.inactivity_threshold_weeks, updated_at=now();

INSERT INTO public.departments (id,name,is_active,updated_at) VALUES
 ('d0000000-0000-4000-8000-000000000001','UPC Demo - Youth',true,now()),
 ('d0000000-0000-4000-8000-000000000002','UPC Demo - Worship',true,now()),
 ('d0000000-0000-4000-8000-000000000003','UPC Demo - Evangelism',true,now()),
 ('d0000000-0000-4000-8000-000000000004','UPC Demo - Ushering',true,now()),
 ('d0000000-0000-4000-8000-000000000005','UPC Demo - Children',true,now()),
 ('d0000000-0000-4000-8000-000000000006','UPC Demo - Prayer',true,now()),
 ('d0000000-0000-4000-8000-000000000007','UPC Demo - Care',true,now()),
 ('d0000000-0000-4000-8000-000000000008','UPC Demo - Legacy Fellowship',false,now())
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,is_active=EXCLUDED.is_active,updated_at=now();

-- This inactive reference row is intentionally retained for the historical service below.
INSERT INTO public.service_types (key,name,is_active,updated_at)
VALUES ('demo_legacy_gathering','UPC Demo Legacy Gathering',false,now())
ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name,is_active=false,updated_at=now();

-- Stable demo identities. Names and dates are fictional; all dates move with the Manila week.
INSERT INTO public.members
 (id,first_name,middle_name,last_name,birth_date,gender,phone_number,email,member_status,account_status,
  profile_status,nickname,zone,street_address,barangay,city,province,country,region,church_branch_id,
  civil_status,department_id,first_attendance_date,created_at,updated_at,is_archived,archived_at)
VALUES
 ('a0000000-0000-4000-8000-000000000001','Bagong','A.','Dela Cruz','1998-04-11','Female','+639171000001','bagong.member@example.com','active','no_account','incomplete','Bing',1,'12 Sampaguita Street','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','single','d0000000-0000-4000-8000-000000000001',NULL,(((SELECT monday FROM _upc_demo_dates) - 2 + time '10:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000002','Mila','B.','Reyes','1987-09-02','Female','+639171000002','mila.reyes@example.com','active','no_account','completed','Mila',2,'20 Narra Road','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','married','d0000000-0000-4000-8000-000000000002',(SELECT today FROM _upc_demo_dates) - 1460,(((SELECT monday FROM _upc_demo_dates) - 21 + 2 + time '13:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000003','Lino','C.','Santos','1994-01-19','Male','+639171000003','lino.santos@example.com','active','no_account','completed','Lino',3,'8 Acacia Lane','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','single','d0000000-0000-4000-8000-000000000003',(SELECT today FROM _upc_demo_dates) - 900,(((SELECT monday FROM _upc_demo_dates) - 35 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000004','Nena','D.','Garcia','1980-12-05','Female','+639171000004','nena.garcia@example.com','active','no_account','completed','Nena',4,'5 Mabini Street','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','widowed','d0000000-0000-4000-8000-000000000004',(SELECT today FROM _upc_demo_dates) - 1500,(((SELECT monday FROM _upc_demo_dates) - 21 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000005','Ramil','E.','Mendoza','1977-07-22','Male','+639171000005','ramil.mendoza@example.com','active','no_account','completed','Ramil',5,'19 Acacia Lane','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','married','d0000000-0000-4000-8000-000000000005',(SELECT today FROM _upc_demo_dates) - 1200,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000006','Celia','F.','Navarro','1990-03-14','Female','+639171000006','celia.navarro@example.com','active','no_account','completed','Celia',1,'32 Sampaguita Street','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','single','d0000000-0000-4000-8000-000000000006',(SELECT today FROM _upc_demo_dates) - 1000,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000007','Tomas','G.','Villanueva','1985-08-03','Male','+639171000007','tomas.v@example.com','active','no_account','completed','Tom',2,'17 Narra Road','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','married','d0000000-0000-4000-8000-000000000007',(SELECT today FROM _upc_demo_dates) - 1100,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000008','Rosa','H.','Bautista','1972-02-17','Female','+639171000008','rosa.bautista@example.com','inactive','no_account','completed','Rosing',3,'3 Ilang-Ilang Avenue','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','separated','d0000000-0000-4000-8000-000000000001',(SELECT today FROM _upc_demo_dates) - 1800,(((SELECT monday FROM _upc_demo_dates) - 84 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000009','Dario','I.','Flores','1992-05-26','Male','+639171000009','dario.flores@example.com','active','no_account','completed','Dado',4,'22 Mabini Street','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','single','d0000000-0000-4000-8000-000000000002',(SELECT today FROM _upc_demo_dates) - 900,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000010','Elena','J.','Ramos','1989-11-30','Female','+639171000010','elena.ramos@example.com','active','no_account','completed','Ely',5,'29 Narra Road','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','married','d0000000-0000-4000-8000-000000000003',(SELECT today FROM _upc_demo_dates) - 800,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000011','Noel','K.','Aquino','1996-06-10','Male','+639171000011','noel.aquino@example.com','active','no_account','completed','Noel',1,'14 Acacia Lane','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','single','d0000000-0000-4000-8000-000000000004',(SELECT today FROM _upc_demo_dates) - 500,(((SELECT monday FROM _upc_demo_dates) - 21)::timestamp AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000012','Luz','L.','Castillo','1993-10-08','Female','+639171000012','luz.castillo@example.com','active','no_account','completed','Luz',2,'7 Sampaguita Street','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','single','d0000000-0000-4000-8000-000000000005',(SELECT today FROM _upc_demo_dates) - 400,(((SELECT monday FROM _upc_demo_dates) - 21 + 2 + time '12:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000013','Pio','M.','Domingo','1975-01-03','Male','+639171000013','pio.domingo@example.com','active','no_account','completed','Pio',3,'11 Mabini Street','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','married','d0000000-0000-4000-8000-000000000006',(SELECT today FROM _upc_demo_dates) - 2500,(((SELECT monday FROM _upc_demo_dates) - 21 + 6 + time '18:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000014','Sinta','N.','Mercado','2001-02-27','Female','+639171000014','sinta.mercado@example.com','active','no_account','completed','Sinta',4,'1 Narra Road','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','single','d0000000-0000-4000-8000-000000000007',NULL,NULL,now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000015','Belen','O.','Salazar','1969-09-12','Female','+639171000015','belen.salazar@example.com','active','no_account','completed','Belen',5,'9 Ilang-Ilang Avenue','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','widowed','d0000000-0000-4000-8000-000000000008',(SELECT today FROM _upc_demo_dates) - 2400,(((SELECT monday FROM _upc_demo_dates) - 56 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),true,now()),
 ('a0000000-0000-4000-8000-000000000016','Isko','P.','Manalo','1981-04-18','Male','+639171000016','isko.manalo@example.com','active','no_account','completed','Isko',1,'16 Acacia Lane','San Isidro','Quezon City','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000001','married','d0000000-0000-4000-8000-000000000001',(SELECT today FROM _upc_demo_dates) - 1700,(((SELECT monday FROM _upc_demo_dates) - 56 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),true,now()),
 ('a0000000-0000-4000-8000-000000000017','Amihan','Q.','Dizon','1995-02-02','Female','+639171000017','amihan.dizon@example.com','active','no_account','completed','Amihan',2,'33 Acacia Lane','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','single','d0000000-0000-4000-8000-000000000002',(SELECT today FROM _upc_demo_dates) - 1300,(((SELECT monday FROM _upc_demo_dates) - 28 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000018','Benjie','R.','Lacson','1988-06-24','Male','+639171000018','benjie.lacson@example.com','active','no_account','completed','Ben',3,'2 Ilang-Ilang Avenue','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','married','d0000000-0000-4000-8000-000000000003',(SELECT today FROM _upc_demo_dates) - 1000,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000019','Corazon','S.','Tolentino','1979-12-01','Female','+639171000019','cora.tolentino@example.com','active','no_account','completed','Cora',4,'4 Narra Road','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','married','d0000000-0000-4000-8000-000000000004',(SELECT today FROM _upc_demo_dates) - 1600,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000020','Danilo','T.','Ocampo','1991-08-16','Male','+639171000020','danilo.ocampo@example.com','active','no_account','completed','Danny',5,'6 Sampaguita Street','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','single','d0000000-0000-4000-8000-000000000005',(SELECT today FROM _upc_demo_dates) - 900,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000021','Ester','U.','Pascual','1986-03-29','Female','+639171000021','ester.pascual@example.com','active','no_account','completed','Esther',1,'15 Narra Road','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','single','d0000000-0000-4000-8000-000000000006',(SELECT today FROM _upc_demo_dates) - 700,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000022','Felix','V.','Abad','1966-07-09','Male','+639171000022','felix.abad@example.com','active','no_account','completed','Felix',2,'17 Ilang-Ilang Avenue','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','married','d0000000-0000-4000-8000-000000000007',(SELECT today FROM _upc_demo_dates) - 2000,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000023','Gina','W.','Cruz','1999-10-13','Female','+639171000023','gina.cruz@example.com','active','no_account','completed','Gina',3,'21 Acacia Lane','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','single','d0000000-0000-4000-8000-000000000001',(SELECT today FROM _upc_demo_dates) - 600,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000024','Hector','X.','Abella','1971-05-05','Male','+639171000024','hector.abella@example.com','active','no_account','completed','Hec',4,'25 Mabini Street','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','divorced','d0000000-0000-4000-8000-000000000002',(SELECT today FROM _upc_demo_dates) - 2100,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000025','Inez','Y.','Sarmiento','1997-01-22','Female','+639171000025','inez.sarmiento@example.com','active','no_account','completed','Inez',5,'30 Sampaguita Street','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','single','d0000000-0000-4000-8000-000000000003',(SELECT today FROM _upc_demo_dates) - 800,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000026','Jovita','Z.','Estrada','1974-11-19','Female','+639171000026','jovita.estrada@example.com','active','no_account','completed','Jovi',1,'39 Acacia Lane','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','widowed','d0000000-0000-4000-8000-000000000004',(SELECT today FROM _upc_demo_dates) - 1900,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000027','Kiko','A.','Lim','2000-04-07','Male','+639171000027','kiko.lim@example.com','active','no_account','completed','Kiko',2,'41 Narra Road','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','single','d0000000-0000-4000-8000-000000000005',(SELECT today FROM _upc_demo_dates) - 300,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000028','Luningning','B.','Yap','1983-09-25','Female','+639171000028','luningning.yap@example.com','active','no_account','completed','Ning',3,'43 Mabini Street','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','married','d0000000-0000-4000-8000-000000000006',(SELECT today FROM _upc_demo_dates) - 1500,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000029','Mateo','C.','Barrera','1990-02-14','Male','+639171000029','mateo.barrera@example.com','active','no_account','completed','Teo',4,'45 Ilang-Ilang Avenue','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','single','d0000000-0000-4000-8000-000000000007',(SELECT today FROM _upc_demo_dates) - 1100,(((SELECT monday FROM _upc_demo_dates) - 49 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),false,NULL),
 ('a0000000-0000-4000-8000-000000000030','Nardo','D.','Valdez','1962-06-30','Male','+639171000030','nardo.valdez@example.com','inactive','no_account','completed','Nardo',5,'47 Sampaguita Street','Santa Lucia','Pasig','Metro Manila','Philippines','NCR','b0000000-0000-4000-8000-000000000002','married','d0000000-0000-4000-8000-000000000008',(SELECT today FROM _upc_demo_dates) - 2800,(((SELECT monday FROM _upc_demo_dates) - 56 + time '09:00') AT TIME ZONE 'Asia/Manila'),now(),true,now())
ON CONFLICT (id) DO UPDATE SET first_name=EXCLUDED.first_name,middle_name=EXCLUDED.middle_name,
 last_name=EXCLUDED.last_name,birth_date=EXCLUDED.birth_date,gender=EXCLUDED.gender,
 phone_number=EXCLUDED.phone_number,
 email=CASE WHEN EXISTS (SELECT 1 FROM public.account_members am WHERE am.member_id=members.id)
   THEN members.email ELSE EXCLUDED.email END,member_status=EXCLUDED.member_status,
 account_status=CASE WHEN EXISTS (SELECT 1 FROM public.account_members am WHERE am.member_id=members.id)
   THEN members.account_status ELSE EXCLUDED.account_status END,
 profile_status=EXCLUDED.profile_status,nickname=EXCLUDED.nickname,
 zone=EXCLUDED.zone,street_address=EXCLUDED.street_address,barangay=EXCLUDED.barangay,city=EXCLUDED.city,
 province=EXCLUDED.province,country=EXCLUDED.country,region=EXCLUDED.region,church_branch_id=EXCLUDED.church_branch_id,
 civil_status=EXCLUDED.civil_status,department_id=EXCLUDED.department_id,first_attendance_date=EXCLUDED.first_attendance_date,
 created_at=EXCLUDED.created_at,updated_at=now(),is_archived=EXCLUDED.is_archived,archived_at=EXCLUDED.archived_at;

-- Five completed Sundays per branch, a cancelled-only week, one older service using an inactive type,
-- and this week's scheduled/ongoing/cancelled examples. Total: 19 services.
WITH weekly AS (
 SELECT b.branch_id,b.prefix,w.week_no,(d.monday - 7*w.week_no + 6) AS service_date,
        CASE WHEN w.week_no=1 THEN 'sunday_morning' WHEN w.week_no%2=0 THEN 'prayer_meeting' ELSE 'sunday_evening' END AS service_type
 FROM (VALUES ('b0000000-0000-4000-8000-000000000001'::uuid,'a'),('b0000000-0000-4000-8000-000000000002'::uuid,'b')) b(branch_id,prefix)
 CROSS JOIN generate_series(1,5) w(week_no) CROSS JOIN _upc_demo_dates d
), demo_service_rows AS (
 SELECT (CASE WHEN prefix='a' THEN 'e1000000-0000-4000-8000-' ELSE 'e2000000-0000-4000-8000-' END || lpad(week_no::text,12,'0'))::uuid id,
        branch_id,service_date,service_type,'completed'::text status,'Sunday Worship Service'::text name,
        'Weekly completed service for inactivity and attendance QA.'::text notes FROM weekly
 UNION ALL
 SELECT (CASE WHEN prefix='a' THEN 'e1000000-0000-4000-8000-' ELSE 'e2000000-0000-4000-8000-' END || '000000000006')::uuid,
        branch_id,d.monday - 42 + 6,'sunday_morning','cancelled','Cancelled Service','No completed service this week; this week must be skipped.'
 FROM (VALUES ('b0000000-0000-4000-8000-000000000001'::uuid,'a'),('b0000000-0000-4000-8000-000000000002'::uuid,'b')) b(branch_id,prefix) CROSS JOIN _upc_demo_dates d
 UNION ALL
 SELECT 'e1000000-0000-4000-8000-000000000007'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,
        d.monday - 49 + 6,'demo_legacy_gathering','completed','Legacy Fellowship Gathering','Historical example retained with an inactive service type.'
 FROM _upc_demo_dates d
 UNION ALL
 SELECT (CASE WHEN prefix='a' THEN 'e1000000-0000-4000-8000-' ELSE 'e2000000-0000-4000-8000-' END || suffix)::uuid,
        branch_id, dt.service_date, 'sunday_morning', status, name, notes
 FROM (VALUES
  ('b0000000-0000-4000-8000-000000000001'::uuid,'a','000000000008','scheduled','Upcoming Sunday Service','Scheduled service is excluded from inactivity.'),
  ('b0000000-0000-4000-8000-000000000001'::uuid,'a','000000000009','ongoing','Midweek Prayer Service','Ongoing service is excluded from inactivity.'),
  ('b0000000-0000-4000-8000-000000000001'::uuid,'a','000000000010','cancelled','Cancelled Midweek Service','Cancelled service is excluded from inactivity.'),
  ('b0000000-0000-4000-8000-000000000002'::uuid,'b','000000000008','scheduled','Upcoming Sunday Service','Scheduled service is excluded from inactivity.'),
  ('b0000000-0000-4000-8000-000000000002'::uuid,'b','000000000009','ongoing','Midweek Prayer Service','Ongoing service is excluded from inactivity.'),
  ('b0000000-0000-4000-8000-000000000002'::uuid,'b','000000000010','cancelled','Cancelled Midweek Service','Cancelled service is excluded from inactivity.')
 ) v(branch_id,prefix,suffix,status,name,notes) CROSS JOIN _upc_demo_dates d
 CROSS JOIN LATERAL (SELECT CASE WHEN suffix='000000000008' THEN d.monday+6 WHEN suffix='000000000009' THEN d.today ELSE d.monday+1 END AS service_date) dt
)
INSERT INTO public.services (id,church_branch_id,name,service_type,service_date,start_time,status,notes)
SELECT id,branch_id,name,service_type,service_date,
       CASE WHEN status='ongoing' THEN '18:30'::time ELSE '09:00'::time END,status,notes FROM demo_service_rows
ON CONFLICT (id) DO UPDATE SET church_branch_id=EXCLUDED.church_branch_id,name=EXCLUDED.name,
 service_type=EXCLUDED.service_type,service_date=EXCLUDED.service_date,start_time=EXCLUDED.start_time,
 status=EXCLUDED.status,notes=EXCLUDED.notes;

-- Pattern characters represent completed service weeks, newest to oldest.
-- present/late are physical; an excused row deliberately does not reset the streak.
WITH patterns(member_id,branch_id,pattern) AS (VALUES
 ('a0000000-0000-4000-8000-000000000003'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00101'),
 ('a0000000-0000-4000-8000-000000000004'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00011'),
 ('a0000000-0000-4000-8000-000000000005'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000006'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000007'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000008'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'01010'),
 ('a0000000-0000-4000-8000-000000000009'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'10000'),
 ('a0000000-0000-4000-8000-000000000010'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'10000'),
 ('a0000000-0000-4000-8000-000000000011'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000012'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000013'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000014'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000015'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00010'),
 ('a0000000-0000-4000-8000-000000000016'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,'00001'),
 ('a0000000-0000-4000-8000-000000000017'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000018'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'00001'),
 ('a0000000-0000-4000-8000-000000000019'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'00000'),
 ('a0000000-0000-4000-8000-000000000020'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'11111'),
 ('a0000000-0000-4000-8000-000000000021'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'01011'),
 ('a0000000-0000-4000-8000-000000000022'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'10101'),
 ('a0000000-0000-4000-8000-000000000023'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'11100'),
 ('a0000000-0000-4000-8000-000000000024'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'11010'),
 ('a0000000-0000-4000-8000-000000000025'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'00111'),
 ('a0000000-0000-4000-8000-000000000026'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'10110'),
 ('a0000000-0000-4000-8000-000000000027'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'01101'),
 ('a0000000-0000-4000-8000-000000000028'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'11001'),
 ('a0000000-0000-4000-8000-000000000029'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'01110'),
 ('a0000000-0000-4000-8000-000000000030'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,'00010')
), attendance_rows AS (
 SELECT p.member_id,p.branch_id,w.week_no,
        CASE WHEN p.member_id='a0000000-0000-4000-8000-000000000010'::uuid AND w.week_no=1 THEN 'excused'
             WHEN p.member_id='a0000000-0000-4000-8000-000000000009'::uuid THEN 'late' ELSE 'present' END AS attendance_status
 FROM patterns p CROSS JOIN generate_series(1,5) w(week_no)
 WHERE substr(p.pattern,w.week_no,1)='1'
) , mapped_attendance AS (
 SELECT ('f0000000-0000-4000-8000-'||lpad(row_number() OVER (ORDER BY member_id,week_no)::text,12,'0'))::uuid AS id,
        CASE WHEN branch_id='b0000000-0000-4000-8000-000000000001'::uuid
             THEN ('e1000000-0000-4000-8000-'||lpad(week_no::text,12,'0'))::uuid
             ELSE ('e2000000-0000-4000-8000-'||lpad(week_no::text,12,'0'))::uuid END AS service_id,
        member_id,attendance_status
 FROM attendance_rows
)
INSERT INTO public.attendance_records (id,service_id,member_id,attendance_status,check_in_time,method)
SELECT m.id,m.service_id,m.member_id,m.attendance_status,
       CASE WHEN m.attendance_status='excused' THEN NULL
            ELSE (s.service_date + COALESCE(s.start_time,'09:00'::time)) AT TIME ZONE 'Asia/Manila' END,
       'manual'
FROM mapped_attendance m JOIN public.services s ON s.id=m.service_id
ON CONFLICT (id) DO UPDATE SET service_id=EXCLUDED.service_id,member_id=EXCLUDED.member_id,
 attendance_status=EXCLUDED.attendance_status,check_in_time=EXCLUDED.check_in_time,method=EXCLUDED.method;

-- Ten follow-ups, including a second historical entry for one member and an archived-member history.
WITH followups(id,member_id,branch_id,days_ago,method,outcome,notes,next_days) AS (VALUES
 ('c0000000-0000-4000-8000-000000000001'::uuid,'a0000000-0000-4000-8000-000000000006'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,3,'call','contacted','Reached Celia; agreed to reconnect next week.',7),
 ('c0000000-0000-4000-8000-000000000002'::uuid,'a0000000-0000-4000-8000-000000000006'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,17,'visit','needs_follow_up','Earlier visit; member requested a later check-in.',NULL),
 ('c0000000-0000-4000-8000-000000000003'::uuid,'a0000000-0000-4000-8000-000000000007'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,2,'message','resolved','Member confirmed availability; attendance status remains independent.',NULL),
 ('c0000000-0000-4000-8000-000000000004'::uuid,'a0000000-0000-4000-8000-000000000005'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,1,'in_person','no_response','Visit attempted; no response.',3),
 ('c0000000-0000-4000-8000-000000000005'::uuid,'a0000000-0000-4000-8000-000000000008'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,45,'visit','contacted','Historical record retained after member marked inactive.',NULL),
 ('c0000000-0000-4000-8000-000000000006'::uuid,'a0000000-0000-4000-8000-000000000016'::uuid,'b0000000-0000-4000-8000-000000000001'::uuid,22,'other','resolved','Archived member history retained.',NULL),
 ('c0000000-0000-4000-8000-000000000007'::uuid,'a0000000-0000-4000-8000-000000000017'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,5,'call','needs_follow_up','Asked for a follow-up after work schedule settles.',5),
 ('c0000000-0000-4000-8000-000000000008'::uuid,'a0000000-0000-4000-8000-000000000019'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,11,'message','no_response','Message delivered; awaiting reply.',NULL),
 ('c0000000-0000-4000-8000-000000000009'::uuid,'a0000000-0000-4000-8000-000000000021'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,30,'visit','contacted','Pastoral check-in completed.',NULL),
 ('c0000000-0000-4000-8000-000000000010'::uuid,'a0000000-0000-4000-8000-000000000030'::uuid,'b0000000-0000-4000-8000-000000000002'::uuid,60,'in_person','needs_follow_up','Archived member follow-up retained.',NULL)
)
INSERT INTO public.member_follow_ups (id,church_branch_id,member_id,follow_up_date,method,outcome,notes,next_follow_up_date)
SELECT f.id,f.branch_id,f.member_id,d.today-f.days_ago,f.method,f.outcome,f.notes,
       CASE WHEN f.next_days IS NULL THEN NULL ELSE d.today-f.days_ago+f.next_days END
FROM followups f CROSS JOIN _upc_demo_dates d
ON CONFLICT (id) DO UPDATE SET church_branch_id=EXCLUDED.church_branch_id,member_id=EXCLUDED.member_id,
 follow_up_date=EXCLUDED.follow_up_date,method=EXCLUDED.method,outcome=EXCLUDED.outcome,
 notes=EXCLUDED.notes,next_follow_up_date=EXCLUDED.next_follow_up_date,updated_at=now();

-- Twenty branch-consistent examples; one anonymous row and several service-linked rows.
WITH contributions(id,member_no,branch_no,service_no,days_ago,kind,amount,payment,notes) AS (VALUES
 ('c1000000-0000-4000-8000-000000000001'::uuid,3,1,1,7,'tithe',1500.00,'cash','Weekly tithe'),
 ('c1000000-0000-4000-8000-000000000002'::uuid,4,1,2,14,'love_offering',250.00,'gcash','Sunday offering'),
 ('c1000000-0000-4000-8000-000000000003'::uuid,5,1,3,21,'tithe',2200.00,'bank_transfer','Monthly tithe'),
 ('c1000000-0000-4000-8000-000000000004'::uuid,6,1,4,28,'other',100.00,'cash','Children activity support'),
 ('c1000000-0000-4000-8000-000000000005'::uuid,7,1,5,35,'love_offering',500.00,'cash','Special offering'),
 ('c1000000-0000-4000-8000-000000000006'::uuid,8,1,1,40,'tithe',1800.00,'gcash','Historical contribution remains linked'),
 ('c1000000-0000-4000-8000-000000000007'::uuid,9,1,2,18,'love_offering',300.00,'cash','Sunday offering'),
 ('c1000000-0000-4000-8000-000000000008'::uuid,10,1,3,25,'tithe',1250.00,'bank_transfer','Tithe'),
 ('c1000000-0000-4000-8000-000000000009'::uuid,15,1,4,32,'other',150.00,'cash','Archived member historical contribution'),
 ('c1000000-0000-4000-8000-000000000010'::uuid,NULL,1,5,12,'love_offering',75.00,'cash','Anonymous contribution'),
 ('c1000000-0000-4000-8000-000000000011'::uuid,17,2,1,7,'tithe',900.00,'gcash','Weekly tithe'),
 ('c1000000-0000-4000-8000-000000000012'::uuid,18,2,2,14,'love_offering',200.00,'cash','Sunday offering'),
 ('c1000000-0000-4000-8000-000000000013'::uuid,19,2,3,21,'tithe',1700.00,'bank_transfer','Monthly tithe'),
 ('c1000000-0000-4000-8000-000000000014'::uuid,20,2,4,28,'other',125.00,'cash','Youth activity support'),
 ('c1000000-0000-4000-8000-000000000015'::uuid,21,2,5,35,'love_offering',350.00,'gcash','Special offering'),
 ('c1000000-0000-4000-8000-000000000016'::uuid,22,2,1,8,'tithe',2400.00,'bank_transfer','Tithe'),
 ('c1000000-0000-4000-8000-000000000017'::uuid,23,2,2,15,'love_offering',175.00,'cash','Offering'),
 ('c1000000-0000-4000-8000-000000000018'::uuid,24,2,3,22,'tithe',800.00,'gcash','Tithe'),
 ('c1000000-0000-4000-8000-000000000019'::uuid,25,2,4,29,'other',90.00,'cash','Transport fund'),
 ('c1000000-0000-4000-8000-000000000020'::uuid,26,2,5,36,'love_offering',420.00,'bank_transfer','Offering')
)
INSERT INTO public.financial_contributions (id,member_id,service_id,church_branch_id,contribution_type,amount,contribution_date,payment_method,notes)
SELECT c.id,CASE WHEN c.member_no IS NULL THEN NULL ELSE ('a0000000-0000-4000-8000-'||lpad(c.member_no::text,12,'0'))::uuid END,
       CASE WHEN c.branch_no=1 THEN ('e1000000-0000-4000-8000-'||lpad(c.service_no::text,12,'0'))::uuid ELSE ('e2000000-0000-4000-8000-'||lpad(c.service_no::text,12,'0'))::uuid END,
       CASE WHEN c.branch_no=1 THEN 'b0000000-0000-4000-8000-000000000001'::uuid ELSE 'b0000000-0000-4000-8000-000000000002'::uuid END,
       c.kind,c.amount,d.today-c.days_ago,c.payment,c.notes
FROM contributions c CROSS JOIN _upc_demo_dates d
ON CONFLICT (id) DO UPDATE SET member_id=EXCLUDED.member_id,service_id=EXCLUDED.service_id,
 church_branch_id=EXCLUDED.church_branch_id,contribution_type=EXCLUDED.contribution_type,
 amount=EXCLUDED.amount,contribution_date=EXCLUDED.contribution_date,payment_method=EXCLUDED.payment_method,notes=EXCLUDED.notes;

-- Ten records cover both types, a member with both types, nullable dates, and historical branch linkage.
INSERT INTO public.baptism_records (id,member_id,baptism_type,baptism_date,church_branch_id,officiated_by,location,notes)
VALUES
 ('c2000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003','water',((SELECT today FROM _upc_demo_dates)-900),'b0000000-0000-4000-8000-000000000001','Pastor Demo','UPC Demo - North Branch','Water baptism'),
 ('c2000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','holy_ghost',((SELECT today FROM _upc_demo_dates)-850),'b0000000-0000-4000-8000-000000000001','Pastor Demo','UPC Demo - North Branch','Holy Ghost baptism; same member has both record types'),
 ('c2000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004','water',((SELECT today FROM _upc_demo_dates)-700),'b0000000-0000-4000-8000-000000000001','Pastor Demo','UPC Demo - North Branch','Water baptism'),
 ('c2000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000005','holy_ghost',((SELECT today FROM _upc_demo_dates)-650),'b0000000-0000-4000-8000-000000000001','Pastor Demo','UPC Demo - North Branch','Holy Ghost baptism'),
 ('c2000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000006','water',((SELECT today FROM _upc_demo_dates)-500),'b0000000-0000-4000-8000-000000000001','Pastor Demo','UPC Demo - North Branch','Water baptism'),
 ('c2000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000017','water',((SELECT today FROM _upc_demo_dates)-1000),'b0000000-0000-4000-8000-000000000002','Pastor Demo','UPC Demo - South Branch','Water baptism'),
 ('c2000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000018','holy_ghost',((SELECT today FROM _upc_demo_dates)-400),'b0000000-0000-4000-8000-000000000002','Pastor Demo','UPC Demo - South Branch','Holy Ghost baptism'),
 ('c2000000-0000-4000-8000-000000000008','a0000000-0000-4000-8000-000000000019','water',NULL,'b0000000-0000-4000-8000-000000000002','Pastor Demo','UPC Demo - South Branch','Date unknown; nullable date path'),
 ('c2000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000020','holy_ghost',((SELECT today FROM _upc_demo_dates)-300),'b0000000-0000-4000-8000-000000000002','Pastor Demo','UPC Demo - South Branch','Holy Ghost baptism'),
 ('c2000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000021','water',((SELECT today FROM _upc_demo_dates)-200),'b0000000-0000-4000-8000-000000000002','Pastor Demo','UPC Demo - South Branch','Water baptism')
ON CONFLICT (id) DO UPDATE SET member_id=EXCLUDED.member_id,baptism_type=EXCLUDED.baptism_type,
 baptism_date=EXCLUDED.baptism_date,church_branch_id=EXCLUDED.church_branch_id,
 officiated_by=EXCLUDED.officiated_by,location=EXCLUDED.location,notes=EXCLUDED.notes;

COMMIT;
