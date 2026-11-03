/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test=require('node:test'); const assert=require('node:assert/strict'); const {spawnSync}=require('node:child_process'); const {randomUUID}=require('node:crypto'); const {readFileSync}=require('node:fs'); const path=require('node:path');
const enabled=Boolean(process.env.UPC_AUTHZ_TEST_PG_PORT);
test('managed service type migration preserves legacy service keys and status constraints', {skip:!enabled},()=>{
 const database=`upc_types_test_${randomUUID().replaceAll('-','')}`;
 function sql(source,db=database,fail=false){const r=spawnSync(process.env.UPC_AUTHZ_PSQL||'psql',['-X','-w','-qAt','-h',process.env.UPC_AUTHZ_TEST_PG_HOST||'127.0.0.1','-p',process.env.UPC_AUTHZ_TEST_PG_PORT,'-U',process.env.UPC_AUTHZ_TEST_PG_USER||'postgres','-d',db,'-v','ON_ERROR_STOP=1'],{input:source,encoding:'utf8'});if(r.error)throw r.error;if(fail){assert.notEqual(r.status,0);return r.stderr;}assert.equal(r.status,0,r.stderr);return r.stdout.replace(/\r\n/g,'\n').trim();}
 sql(`CREATE DATABASE ${database};`,'postgres');
 try {
  sql(readFileSync(path.join(__dirname,'fixtures/service-types.sql'),'utf8'));
  const migration=readFileSync(path.join(__dirname,'../supabase/migrations/20261103110000_manage_service_types.sql'),'utf8'); sql(migration);
  assert.equal(sql(`SELECT service_type||'|'||status FROM public.services;`),'sunday_morning|completed');
  assert.equal(sql(`SELECT count(*) FROM public.service_types WHERE key IN ('sunday_morning','sunday_evening','prayer_meeting','special_service','other');`),'5');
  assert.equal(sql(`SELECT count(*) FROM pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_service_type_check';`),'0');
  assert.equal(sql(`SELECT count(*) FROM pg_constraint WHERE conrelid='public.services'::regclass AND conname='services_status_check';`),'1');
  assert.equal(sql(`SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id JOIN public.roles r ON r.id=rp.role_id WHERE r.key IN ('system_admin','pastor') AND p.key LIKE 'service_types.%';`),'4');
  assert.equal(sql(`SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id JOIN public.roles r ON r.id=rp.role_id WHERE r.key='custom' AND p.key LIKE 'service_types.%';`),'0');
  assert.match(sql(`DELETE FROM public.service_types WHERE key='sunday_morning';`,database,true),/foreign key/i);
  assert.equal(sql(`SELECT count(*) FROM public.services;`),'1');
 } finally { sql(`DROP DATABASE ${database};`,'postgres'); }
});
