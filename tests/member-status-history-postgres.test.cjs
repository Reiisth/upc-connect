/* eslint-disable @typescript-eslint/no-require-imports -- Disposable PostgreSQL integration. */
const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto'),{readFileSync}=require('node:fs');
test('member status history baseline, lifecycle, dates and access against PostgreSQL',{skip:!process.env.UPC_MIGRATION_TEST_PG_PORT},()=>{
 const database='upc_status_'+randomUUID().replaceAll('-','');
 const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const sql=(source,db=database,fail=false)=>{const r=spawnSync('psql',['-X','-w','-qAt','-h','127.0.0.1','-p',process.env.UPC_MIGRATION_TEST_PG_PORT,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],{input:source,encoding:'utf8'});if(r.error)throw r.error;if(fail){assert.notEqual(r.status,0);return r.stderr;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 sql('CREATE DATABASE '+database,'postgres');
 try{
  sql(`DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;END$$;
   CREATE TABLE profiles(id uuid PRIMARY KEY,archived_at timestamptz);
   CREATE TABLE church_branches(id uuid PRIMARY KEY,name text,is_active boolean);
   CREATE TABLE departments(id uuid PRIMARY KEY,is_active boolean);
   CREATE TABLE roles(id uuid PRIMARY KEY,key text,is_active boolean);
   CREATE TABLE permissions(id uuid PRIMARY KEY,key text,is_active boolean);
   CREATE TABLE role_permissions(role_id uuid,permission_id uuid);
   CREATE TABLE user_roles(user_id uuid,role_id uuid);
   CREATE TABLE user_branch_access(user_id uuid,church_branch_id uuid);
   CREATE TABLE members(id uuid PRIMARY KEY,first_name text,middle_name text,last_name text,church_branch_id uuid REFERENCES church_branches(id),
    is_archived boolean NOT NULL DEFAULT false,archived_at timestamptz,first_attendance_date date,member_status text,department_id uuid,position text,zone smallint,updated_at timestamptz);
   INSERT INTO church_branches VALUES('${id(1)}','North',true),('${id(2)}','South',true),('${id(3)}','Private Branch',true);
   INSERT INTO profiles SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,CASE WHEN n=52 THEN now() END FROM generate_series(50,55)n;
   INSERT INTO roles VALUES('${id(80)}','custom_movement',true),('${id(81)}','reports_only',true),('${id(82)}','system_admin',true);
   INSERT INTO permissions VALUES('${id(90)}','members.update',true),('${id(91)}','members.archive',true),('${id(92)}','reports.view',true);
   INSERT INTO role_permissions SELECT '${id(80)}',id FROM permissions;
   INSERT INTO role_permissions SELECT '${id(82)}',id FROM permissions;
   INSERT INTO role_permissions VALUES('${id(81)}','${id(92)}');
   INSERT INTO user_roles VALUES('${id(50)}','${id(80)}'),('${id(51)}','${id(80)}'),('${id(52)}','${id(80)}'),('${id(53)}','${id(81)}'),('${id(55)}','${id(82)}');
   INSERT INTO user_branch_access VALUES('${id(50)}','${id(1)}'),('${id(50)}','${id(2)}'),('${id(51)}','${id(1)}'),('${id(53)}','${id(1)}');
   INSERT INTO members(id,first_name,last_name,church_branch_id,member_status) VALUES('${id(11)}','Ana','Cruz','${id(1)}','active'),('${id(12)}','Ben','Cruz','${id(2)}','active'),('${id(13)}','Unknown','Branch',NULL,'active');
   GRANT USAGE ON SCHEMA public TO service_role,authenticated,anon;GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`);
  sql(readFileSync('supabase/migrations/20261116090000_member_migrations.sql','utf8'));
  sql(`INSERT INTO members(id,church_branch_id,member_status,is_archived) VALUES('${id(14)}','${id(1)}','inactive',false),('${id(15)}','${id(1)}',NULL,false),('${id(16)}','${id(1)}','active',true);`);
  sql(readFileSync('supabase/migrations/20261118090000_member_status_history.sql','utf8'));
  const current=()=>sql(`SELECT coalesce(sum(active_delta),0)||':'||coalesce(sum(inactive_delta),0) FROM member_status_counts WHERE branch_id='${id(1)}'`);
  assert.equal(current(),'1:1','baseline excludes archived, unknown status and unknown branch');
  const size=sql('SELECT count(*) FROM member_status_counts');
  sql(`UPDATE members SET first_name='Changed' WHERE id='${id(11)}'`);
  assert.equal(sql('SELECT count(*) FROM member_status_counts'),size,'personal updates do not create events');
  sql(`UPDATE members SET member_status='inactive' WHERE id='${id(11)}'`);assert.equal(current(),'0:2');
  sql(`UPDATE members SET church_branch_id='${id(2)}',member_status='active' WHERE id='${id(11)}'`);assert.equal(current(),'0:1');
  sql(`UPDATE members SET departed_at=now(),is_archived=true WHERE id='${id(11)}'`);
  assert.equal(sql(`SELECT sum(active_delta) FROM member_status_counts WHERE branch_id='${id(2)}'`),'1');
  sql(`UPDATE members SET departed_at=NULL,is_archived=false WHERE id='${id(11)}'`);
  sql(`INSERT INTO members(id,church_branch_id,member_status) VALUES('${id(17)}','${id(1)}','active');`);assert.equal(current(),'1:1');
  sql(`BEGIN;UPDATE members SET member_status='inactive' WHERE id='${id(17)}';ROLLBACK;`);assert.equal(current(),'1:1');
  sql(`DELETE FROM members WHERE id='${id(17)}'`);assert.equal(current(),'0:1');
  // Fix ledger timestamps for a reproducible Manila midnight and carry-forward test.
  sql(`UPDATE member_status_tracking SET started_at='2020-01-01T16:01:00Z';UPDATE member_status_counts SET recorded_at='2020-01-01T16:01:00Z';`);
  const report=(branches=[1,2],actor=50,from='2020-01-01',to='2020-01-04',group='day')=>JSON.parse(sql(`SET ROLE service_role;SELECT get_member_status_history('${id(actor)}',ARRAY[${branches.map(n=>`'${id(n)}'::uuid`)}],'${from}','${to}','${group}');`));
  const r=report();assert.equal(r.points.length,4);assert.equal(r.points[0].active,null);assert.equal(r.points[0].inactive,null);
  assert.deepEqual(r.points.slice(1).map(p=>[p.active,p.inactive]),[[2,1],[2,1],[2,1]]);
  assert.deepEqual(report([1],53).points.slice(1).map(p=>[p.active,p.inactive]),[[0,1],[0,1],[0,1]],'reports-only scope does not leak South');
  assert.equal(report([1],53,'2020-01-03','2020-01-04').points[0].inactive,1,'prior events seed requested range');
  assert.equal(report([1],53,'2020-01-03','2020-01-04','week').points[0].asOfDate,'2020-01-04');
  assert.equal(report([1],53,'2020-01-01','2020-02-01','month').points.length,2);
  assert.equal(report([1],53,'2099-01-01','2099-01-02').points.length,0,'no future projection');
  sql(`SET ROLE service_role;SELECT get_member_status_history('${id(51)}',ARRAY['${id(2)}'::uuid],'2020-01-01','2020-01-04','day');`,database,true);
  sql(`SET ROLE service_role;SELECT get_member_status_history('${id(52)}',ARRAY['${id(1)}'::uuid],'2020-01-01','2020-01-04','day');`,database,true);
  sql(`SET ROLE authenticated;SELECT get_member_status_history('${id(50)}',ARRAY['${id(1)}'::uuid],'2020-01-01','2020-01-04','day');`,database,true);
  sql('SET ROLE service_role;DELETE FROM member_status_counts;',database,true);
  sql('SET ROLE authenticated;SELECT * FROM member_status_counts;',database,true);
 }finally{sql('DROP DATABASE '+database+' WITH (FORCE)','postgres');}
});
