/* eslint-disable @typescript-eslint/no-require-imports -- Disposable PostgreSQL integration. */
const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync,spawn}=require('node:child_process'),{randomUUID}=require('node:crypto'),{readFileSync}=require('node:fs');
test('member migration transactions and reporting against PostgreSQL',{skip:!process.env.UPC_MIGRATION_TEST_PG_PORT},async t=>{
 const database='upc_migration_'+randomUUID().replaceAll('-','');
 const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const args=db=>['-X','-w','-qAt','-h','127.0.0.1','-p',process.env.UPC_MIGRATION_TEST_PG_PORT,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'];
 const sql=(source,db=database,fail=false)=>{const r=spawnSync('psql',args(db),{input:source,encoding:'utf8'});if(r.error)throw r.error;if(fail){assert.notEqual(r.status,0);return r.stderr;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const patch=destination=>JSON.stringify({church_branch_id:id(destination),first_attendance_date:null,member_status:'active',department_id:null,position:null,zone:null});
 const change=(operation,branch=2,actor=50,destination=1,member=11)=>`SET ROLE service_role;SELECT change_member_membership('${id(member)}','${id(actor)}',${branch?`'${id(branch)}'`:'NULL'},'${operation}','${operation==='transfer'?patch(destination):'{}'}');`;
 const report=(branches=[1,2],actor=50,from='2000-01-01',to='2000-01-01')=>JSON.parse(sql(`SET ROLE service_role;SELECT get_member_migration_analytics('${id(actor)}',ARRAY[${branches.map(n=>`'${id(n)}'::uuid`)}],'${from}','${to}','day');`));
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
  sql(readFileSync('supabase/migrations/20261116091000_member_migration_analytics.sql','utf8'));
  await t.test('initial state is not backfilled; permissions and both branches are rechecked inside transaction',()=>{
   assert.equal(sql('SELECT count(*) FROM member_migrations'),'0');
   for(const actor of [51,52,53,54])sql(change('transfer',1,actor,2),database,true);
   sql(`SET ROLE authenticated;SELECT change_member_membership('${id(11)}','${id(50)}','${id(1)}','departure');`,database,true);
   sql(`SET ROLE service_role;UPDATE members SET church_branch_id='${id(2)}' WHERE id='${id(11)}';`,database,true);
   assert.equal(sql('SELECT count(*) FROM member_migrations'),'0');
   sql(change('transfer',1,50,2));
   assert.equal(sql(`SELECT church_branch_id FROM members WHERE id='${id(11)}'`),id(2));
   assert.equal(sql(`SELECT kind||':'||recorded_by::text FROM member_migrations`),'transfer:'+id(50));
  });
  await t.test('departure archives atomically; restore logs return; ordinary archive is not departure',()=>{
   sql(change('departure'));
   assert.equal(sql(`SELECT is_archived AND departed_at IS NOT NULL FROM members WHERE id='${id(11)}'`),'t');
   sql(change('departure'),database,true);assert.equal(sql('SELECT count(*) FROM member_migrations'),'2');
   sql(change('return'));assert.equal(sql(`SELECT NOT is_archived AND departed_at IS NULL FROM members WHERE id='${id(11)}'`),'t');
   sql(`SET ROLE service_role;UPDATE members SET is_archived=true,archived_at=now() WHERE id='${id(11)}';UPDATE members SET is_archived=false,archived_at=NULL WHERE id='${id(11)}';`);
   assert.equal(sql('SELECT count(*) FROM member_migrations'),'3');
   sql(change('transfer',2,50,1));
  });
  await t.test('stale requests and log insertion failures roll back member and history together',()=>{
   sql(change('transfer',2,50,1),database,true);
   sql(`CREATE FUNCTION test_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'forced log failure';END$$;CREATE TRIGGER fail_event BEFORE INSERT ON member_migrations FOR EACH ROW EXECUTE FUNCTION test_fail_event();`);
   sql(change('transfer',1,50,2),database,true);
   assert.equal(sql(`SELECT church_branch_id FROM members WHERE id='${id(11)}'`),id(1));assert.equal(sql('SELECT count(*) FROM member_migrations'),'4');
   sql('DROP TRIGGER fail_event ON member_migrations;DROP FUNCTION test_fail_event();');
   sql(`SET ROLE service_role;DELETE FROM member_migrations;`,database,true);
   sql(`SET ROLE service_role;UPDATE member_migrations SET recorded_at=now();`,database,true);
  });
  await t.test('Manila dates, branch flows, unique members and internal-transfer net accounting agree',()=>{
   sql(`UPDATE member_migrations SET recorded_at='1999-12-31T16:01:00Z';`);
   const all=report();assert.equal(all.totals.events,4);assert.equal(all.totals.members,1);assert.equal(all.totals.transfers,2);assert.equal(all.totals.net,0);
   assert.equal(all.totals.departures,1);assert.equal(all.totals.returns,1);assert.equal(all.trend[0].incoming,2);assert.equal(all.trend[0].departures,1);
   const north=report([1],51);assert.equal(north.totals.departures,0);assert.equal(north.totals.incoming,1);assert.equal(north.totals.outgoing,1);
   assert.equal(north.branches.length,1);assert.ok(JSON.stringify(north.flows).includes('Outside accessible branches'));assert.ok(!JSON.stringify(north).includes('South'));
   assert.equal(report([1],53).totals.transfers,2,'Reports-only actor receives aggregates without identity access');
   assert.equal(report([1,2],50,'1999-12-31','1999-12-31').totals.events,0);
   sql(`SET ROLE service_role;SELECT get_member_migration_analytics('${id(51)}',ARRAY['${id(2)}'::uuid],'2000-01-01','2000-01-01','day');`,database,true);
   sql(`SET ROLE authenticated;SELECT * FROM member_migrations;`,database,true);
  });
  await t.test('first assignment is not migration; archived accounts and deactivated permissions cannot mutate',()=>{
   sql(change('transfer',null,55,1,13));assert.equal(sql('SELECT count(*) FROM member_migrations'),'4');
   sql(`UPDATE permissions SET is_active=false WHERE key='members.update';`);sql(change('transfer',1,50,2),database,true);
   sql(`UPDATE permissions SET is_active=true;`);
  });
  await t.test('concurrent duplicate departures serialize into exactly one event',async()=>{
   function worker(source){const child=spawn('psql',args(database));let output='',error='',ready;const started=new Promise(resolve=>ready=resolve);child.stdout.on('data',data=>{output+=data;if(output.includes('ready'))ready();});child.stderr.on('data',data=>error+=data);const done=new Promise(resolve=>child.on('close',code=>resolve({code,error})));child.stdin.end(source);return{started,done};}
   const first=worker(`BEGIN;${change('departure',1)}SELECT 'ready';SELECT pg_sleep(0.5);COMMIT;`);await first.started;
   const second=worker(change('departure',1));assert.equal((await first.done).code,0);assert.notEqual((await second.done).code,0);
   assert.equal(sql('SELECT count(*) FROM member_migrations'),'5');
  });
 }finally{sql('DROP DATABASE '+database+' WITH (FORCE)','postgres');}
});
