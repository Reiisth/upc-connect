/* eslint-disable @typescript-eslint/no-require-imports -- Real PostgreSQL transaction regression tests. */
const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync,spawn}=require('node:child_process'),{randomUUID}=require('node:crypto'),{readFileSync}=require('node:fs');
test('Service completion finalization against disposable PostgreSQL',{skip:!process.env.UPC_FINALIZATION_TEST_PG_PORT},async t=>{
 const db='upc_completion_'+randomUUID().replaceAll('-','');
 const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const args=database=>['-X','-w','-qAt','-h','127.0.0.1','-p',process.env.UPC_FINALIZATION_TEST_PG_PORT,'-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'];
 function sql(source,database=db,fail=false){const r=spawnSync('psql',args(database),{input:source,encoding:'utf8'});if(r.error)throw r.error;if(fail){assert.notEqual(r.status,0);return r.stderr;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
 const call=(service=100,preview=false,actor=50)=>`SET ROLE service_role; SELECT public.finalize_service_attendance('${id(service)}','${id(actor)}',${preview});`;
 function worker(source){const child=spawn('psql',args(db));let output='',error='';let ready;const started=new Promise(resolve=>{ready=resolve;});child.stdout.on('data',data=>{output+=data; if(output.includes('success'))ready();});child.stderr.on('data',data=>{error+=data;});const done=new Promise(resolve=>child.on('close',code=>resolve({code,output,error})));child.stdin.end(source);return {started,done};}
 sql('CREATE DATABASE '+db,'postgres');
 try{
  sql(readFileSync('tests/fixtures/analytics.sql','utf8'));
  sql(`TRUNCATE attendance_records,members,services;
   ALTER TABLE services ADD COLUMN name text, ADD COLUMN start_time time, ADD COLUMN updated_at timestamptz DEFAULT now();
   ALTER TABLE attendance_records ADD COLUMN method text DEFAULT 'manual',ADD COLUMN recorded_by uuid,ADD COLUMN check_in_time timestamptz,ADD COLUMN created_at timestamptz DEFAULT now(),ADD UNIQUE(service_id,member_id);
   CREATE TABLE profiles(id uuid PRIMARY KEY,archived_at timestamptz);
   CREATE TABLE roles(id uuid PRIMARY KEY,key text,is_active boolean);
   CREATE TABLE user_roles(user_id uuid,role_id uuid);
   CREATE TABLE permissions(id uuid PRIMARY KEY,key text,is_active boolean);
   CREATE TABLE role_permissions(role_id uuid,permission_id uuid);
   CREATE TABLE user_branch_access(user_id uuid,church_branch_id uuid);
   INSERT INTO profiles VALUES('${id(50)}',NULL),('${id(51)}',NULL),('${id(52)}',now());
   INSERT INTO roles VALUES('${id(60)}','custom_completion_role',true);
   INSERT INTO permissions VALUES('${id(61)}','services.update',true);
   INSERT INTO role_permissions VALUES('${id(60)}','${id(61)}');
   INSERT INTO user_roles VALUES('${id(50)}','${id(60)}'),('${id(51)}','${id(60)}'),('${id(52)}','${id(60)}');
   INSERT INTO user_branch_access VALUES('${id(50)}','${id(1)}'),('${id(51)}','${id(2)}'),('${id(52)}','${id(1)}');
   INSERT INTO members(id,church_branch_id,is_archived,member_status,created_at) SELECT '${id(11)}', '${id(1)}',false,'active',now();
   INSERT INTO members(id,church_branch_id,is_archived,member_status,created_at) VALUES
    ('${id(12)}','${id(1)}',false,'active',now()),('${id(13)}','${id(1)}',false,'active',now()),
    ('${id(14)}','${id(1)}',false,'active',now()),('${id(15)}','${id(1)}',false,'inactive',now()),
    ('${id(16)}','${id(1)}',true,'active',now()),('${id(17)}','${id(2)}',false,'active',now()),('${id(18)}','${id(2)}',false,'active',now());
   INSERT INTO services(id,church_branch_id,service_date,start_time,service_type,status) SELECT
    ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'${id(1)}','2000-01-01','09:00','sunday_morning',
    CASE n WHEN 103 THEN 'completed' WHEN 104 THEN 'cancelled' WHEN 105 THEN 'scheduled' WHEN 106 THEN 'scheduled' ELSE 'ongoing' END FROM generate_series(100,108) n;
   UPDATE services SET service_date='2099-01-01' WHERE id IN ('${id(105)}','${id(107)}');
   INSERT INTO attendance_records(service_id,member_id,attendance_status,method,check_in_time) VALUES
    ('${id(100)}','${id(11)}','present','qr','2000-01-01T01:00:00Z'),('${id(100)}','${id(12)}','excused','manual',NULL),
    ('${id(100)}','${id(13)}','absent','manual',NULL),('${id(100)}','${id(17)}','present','qr','2000-01-01T01:01:00Z');
   GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`);
  sql(readFileSync('supabase/migrations/20261107090000_finalize_service_attendance.sql','utf8'));
  await t.test('preview is aggregate-only and preserves all recorded facts',()=>{
   const preview=JSON.parse(sql(call(100,true)));assert.deepEqual(preview,{present:2,excused:1,absent:1,missing:2});
   assert.equal(sql(`SELECT status FROM services WHERE id='${id(100)}'`),'ongoing');assert.equal(sql('SELECT count(*) FROM attendance_records'),'4');
  });
  await t.test('new QR Present after preview is preserved; only remaining home roster missing becomes Absent',()=>{
   const before=sql(`SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM attendance_records a`);
   sql(`SET ROLE service_role;INSERT INTO attendance_records(service_id,member_id,attendance_status,method) VALUES('${id(100)}','${id(14)}','present','qr');`);
   const result=JSON.parse(sql(call()));assert.equal(result.generatedAbsent,1);assert.equal(result.missing,1);
   assert.equal(sql(`SELECT status FROM services WHERE id='${id(100)}'`),'completed');
   assert.equal(sql(`SELECT attendance_status FROM attendance_records WHERE service_id='${id(100)}' AND member_id='${id(15)}'`),'absent');
   assert.equal(sql(`SELECT attendance_status FROM attendance_records WHERE service_id='${id(100)}' AND member_id='${id(14)}'`),'present');
   for(const row of JSON.parse(before))assert.deepEqual(JSON.parse(sql(`SELECT to_jsonb(a) FROM attendance_records a WHERE id='${row.id}'`)),row,'existing row preserved');
   assert.equal(sql(`SELECT count(*) FROM attendance_records WHERE service_id='${id(100)}' AND member_id IN ('${id(16)}','${id(18)}')`),'0');
   assert.equal(sql(`SELECT church_branch_id FROM members WHERE id='${id(17)}'`),id(2));
   assert.equal(sql(`SELECT method||':'||(check_in_time IS NULL)::text||':'||recorded_by::text FROM attendance_records WHERE member_id='${id(15)}'`),`manual:true:${id(50)}`);
  });
  await t.test('duplicate, terminal, future, archived-account and foreign-scope attempts fail; elapsed Scheduled qualifies',()=>{
   for(const service of [100,103,104,105,107])assert.match(sql(call(service),db,true),/Only an Ongoing/);
   for(const actor of [51,52,99])assert.match(sql(call(101,false,actor),db,true),/outside your access/);
   assert.match(sql(`SET ROLE authenticated;SELECT public.finalize_service_attendance('${id(101)}','${id(50)}',false);`,db,true),/permission denied/);
   assert.equal(JSON.parse(sql(call(106))).generatedAbsent,5);
   assert.match(sql(`SET ROLE service_role;UPDATE services SET status='completed' WHERE id='${id(101)}';`,db,true),/using attendance finalization/);
  });
  await t.test('a failure after inserts rolls back both attendance and Service state',()=>{
   sql(`CREATE FUNCTION fail_completion_test() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.id='${id(101)}' AND NEW.status='completed' THEN RAISE EXCEPTION 'forced failure'; END IF;RETURN NEW;END;$$;
   CREATE TRIGGER z_fail_completion_test BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION fail_completion_test();`);
   assert.match(sql(call(101),db,true),/forced failure/);
   assert.equal(sql(`SELECT count(*) FROM attendance_records WHERE service_id='${id(101)}'`),'0');assert.equal(sql(`SELECT status FROM services WHERE id='${id(101)}'`),'ongoing');
   sql('DROP TRIGGER z_fail_completion_test ON services;DROP FUNCTION fail_completion_test();');
  });
  await t.test('concurrent completions serialize; a queued late QR cannot replace generated Absent',async()=>{
   const first=worker(`BEGIN;${call(102)} SELECT pg_sleep(0.7);COMMIT;`);await first.started;
   const second=worker(call(102));const scan=worker(`SET ROLE service_role;INSERT INTO attendance_records(service_id,member_id,attendance_status,method) VALUES('${id(102)}','${id(11)}','present','qr');`);
   assert.equal((await first.done).code,0);assert.notEqual((await second.done).code,0);assert.notEqual((await scan.done).code,0);
   assert.equal(sql(`SELECT count(*) FROM attendance_records WHERE service_id='${id(102)}'`),'5');
   assert.equal(sql(`SELECT attendance_status FROM attendance_records WHERE service_id='${id(102)}' AND member_id='${id(11)}'`),'absent');
  });
  await t.test('completion waiting behind an in-flight QR sees its committed Present',async()=>{
   const scan=worker(`BEGIN;SET ROLE service_role;INSERT INTO attendance_records(service_id,member_id,attendance_status,method) VALUES('${id(108)}','${id(11)}','present','qr');SELECT '{"success":true}';SELECT pg_sleep(0.7);COMMIT;`);
   await scan.started;const completion=worker(call(108));assert.equal((await scan.done).code,0);
   const finished=await completion.done;assert.equal(finished.code,0,finished.error);assert.equal(JSON.parse(finished.output.trim()).generatedAbsent,4);
   assert.equal(sql(`SELECT attendance_status FROM attendance_records WHERE service_id='${id(108)}' AND member_id='${id(11)}'`),'present');
  });
  await t.test('zero missing still confirms without inserts and completed corrections retain current read-only rule',()=>{
   assert.equal(JSON.parse(sql(call(101,true))).missing,5);
   sql(`INSERT INTO attendance_records(service_id,member_id,attendance_status) SELECT '${id(101)}',id,'excused' FROM members WHERE church_branch_id='${id(1)}' AND NOT is_archived;`);
   assert.equal(JSON.parse(sql(call(101,true))).missing,0);assert.equal(JSON.parse(sql(call(101))).generatedAbsent,0);
   assert.match(sql(`SET ROLE service_role;UPDATE attendance_records SET attendance_status='present' WHERE service_id='${id(102)}' AND member_id='${id(11)}';`,db,true),/only while a Service is ongoing/);
  });
  await t.test('actual Reports and module summary consume generated Absent as ordinary records',()=>{
   sql(readFileSync('supabase/archive/pre_baseline/20261029090000_add_reports_analytics.sql','utf8'));
   const report=JSON.parse(sql(`SET ROLE service_role;SELECT get_reports_analytics(ARRAY['${id(1)}'::uuid],'2000-01-01','2000-01-01','day','2000-01-02');`));
   assert.equal(report.attendance.find(r=>r.branchId===null).physicalCheckIns,4);
   sql('ALTER TABLE financial_contributions ADD COLUMN contributor_type text;');
   sql(readFileSync('supabase/migrations/20261106090000_module_summaries.sql','utf8'));
   const summary=JSON.parse(sql(`SET ROLE service_role;SELECT get_module_summary('attendance',ARRAY['${id(1)}'::uuid],'2000-01-01','2000-01-01');`));
   assert.ok(summary.breakdown.find(r=>r.branchId===null&&r.label==='absent').value>=11);
  });
  await t.test('cross-branch physical Present still protects inactivity despite generated home Absent',()=>{
   sql(`INSERT INTO services(id,church_branch_id,service_date,start_time,service_type,status) VALUES('${id(109)}','${id(2)}','2000-01-01','09:00','sunday_morning','completed');
   INSERT INTO attendance_records(service_id,member_id,attendance_status,method) VALUES('${id(109)}','${id(15)}','present','qr');`);
   const {loadTypeScript}=require('./helpers/load-typescript.cjs');const {calculateWeeklyInactivity}=loadTypeScript('lib/inactivity/calculate.ts');
   const services=JSON.parse(sql(`SELECT json_agg(json_build_object('id',id,'branchId',church_branch_id,'serviceDate',service_date,'status',status)) FROM services;`));
   const attendance=JSON.parse(sql(`SELECT json_agg(json_build_object('memberId',member_id,'serviceId',service_id,'status',attendance_status)) FROM attendance_records;`));
   const input={today:'2000-01-03',thresholds:new Map([[id(1),1]]),members:[{id:id(15),branchId:id(1),registrationDate:'1999-01-01'}],services,attendance};
   const result=calculateWeeklyInactivity(input)[0];assert.equal(result.consecutiveAbsentWeeks,0);
   const withoutVisit=calculateWeeklyInactivity({...input,attendance:attendance.filter(a=>a.serviceId!==id(109))})[0];assert.equal(withoutVisit.consecutiveAbsentWeeks,0, 'Home Excused exempts the week even without visiting Present');
   const withoutExcuse=calculateWeeklyInactivity({...input,attendance:attendance.filter(a=>a.serviceId!==id(109)&&a.status!=='excused')})[0];assert.equal(withoutExcuse.consecutiveAbsentWeeks,1);
  });
 }finally{sql('DROP DATABASE '+db+' WITH (FORCE)','postgres');}
});
