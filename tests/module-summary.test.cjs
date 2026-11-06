/* eslint-disable @typescript-eslint/no-require-imports -- Node/PostgreSQL regressions */
const test=require('node:test'),assert=require('node:assert/strict');
const{spawnSync}=require('node:child_process');const{randomUUID}=require('node:crypto');const{readFileSync}=require('node:fs');
const{loadTypeScript}=require('./helpers/load-typescript.cjs');
test('module SQL summaries match Reports with physical, historical and exact receiving-branch semantics',{skip:!process.env.UPC_AUTHZ_TEST_PG_PORT},()=>{
 const db='upc_modules_'+randomUUID().replaceAll('-','');
 function sql(source,database=db,fail=false){const r=spawnSync('psql',['-X','-w','-qAt','-h','127.0.0.1','-p',process.env.UPC_AUTHZ_TEST_PG_PORT,'-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{input:source,encoding:'utf8'});if(r.error)throw r.error;if(fail){assert.notEqual(r.status,0);return;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 const summary=(module,ids=[a])=>JSON.parse(sql(`SELECT get_module_summary('${module}',ARRAY[${ids.map(id=>`'${id}'::uuid`).join(',')}]::uuid[],'2026-10-01','2026-10-25');`));
 const total=r=>r.totals.find(t=>t.branchId===null);
 sql('CREATE DATABASE '+db,'postgres');try{
 sql(readFileSync('tests/fixtures/analytics.sql','utf8'));
 sql("ALTER TABLE financial_contributions ADD COLUMN contributor_type text; UPDATE financial_contributions SET contributor_type=CASE WHEN member_id IS NULL THEN 'anonymous' ELSE 'member' END;");
 sql(readFileSync('supabase/archive/pre_baseline/20261029090000_add_reports_analytics.sql','utf8'));
 sql(readFileSync('supabase/migrations/20261106090000_module_summaries.sql','utf8'));
 sql("ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_attendance_status_check CHECK(attendance_status IN ('present','excused','late'));");
 const countBefore=Number(sql('SELECT count(*) FROM attendance_records;'));
 sql("UPDATE attendance_records SET attendance_status='late' WHERE id=(SELECT id FROM attendance_records WHERE attendance_status='present' LIMIT 1);");
 sql(readFileSync('supabase/migrations/20261106100000_attendance_lifecycle.sql','utf8'));
 assert.equal(Number(sql('SELECT count(*) FROM attendance_records;')),countBefore);
 assert.equal(sql("SELECT count(*) FROM attendance_records WHERE attendance_status='late';"),'0');
 sql("INSERT INTO attendance_records(attendance_status) VALUES ('late');",db,true);
 sql("INSERT INTO attendance_records(attendance_status) VALUES ('absent'); DELETE FROM attendance_records WHERE service_id IS NULL;");
 for(const ids of [[a],[b],[a,b]]){
  const reports=JSON.parse(sql(`SELECT get_reports_analytics(ARRAY[${ids.map(id=>`'${id}'::uuid`).join(',')}],'2026-10-01','2026-10-25','month','2026-10-29');`));
  const global=key=>reports[key].find(t=>t.branchId===null);
  const attendance=summary('attendance',ids);assert.equal(total(attendance).physical,global('attendance').physicalCheckIns);assert.equal(total(attendance).services,global('attendance').completedServices);assert.equal(total(attendance).average,global('attendance').averagePerService);
  const baptism=summary('baptisms',ids);assert.equal(total(baptism).count,global('baptisms').total);assert.equal(total(baptism).water,global('baptisms').water);assert.equal(total(baptism).holyGhost,global('baptisms').holyGhost);assert.equal(total(baptism).undated,global('baptisms').undatedRecords);
  const money=summary('contributions',ids);assert.equal(total(money).amount,global('contributions').totalAmount);assert.equal(total(money).average,global('contributions').averageAmount);
 }
 sql(`INSERT INTO attendance_records(service_id,member_id,attendance_status) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000009999','absent');`);
 const recordedAbsent=summary('attendance');assert.equal(total(recordedAbsent).physical,3);assert.equal(recordedAbsent.breakdown.find(row=>row.branchId===null&&row.label==='absent').value,1);
 sql(`DELETE FROM attendance_records WHERE member_id='00000000-0000-0000-0000-000000009999';`);
 assert.equal(total(summary('attendance')).physical,3);assert.equal(total(summary('attendance')).count,4); // Includes Excused but physical excludes it.
 sql(`UPDATE members SET member_status='inactive',church_branch_id='${b}' WHERE id='00000000-0000-0000-0000-000000000011';`);
 assert.equal(total(summary('attendance')).physical,3,'current status/home branch never reattributes physical history');
 sql(`INSERT INTO financial_contributions(church_branch_id,contribution_date,amount,contribution_type,payment_method,contributor_type) VALUES ('${a}','2026-10-20',0.21,'other','cash','visitor');`);
 const money=summary('contributions');assert.equal(total(money).amount,'0.51');assert.equal(money.breakdown.find(t=>t.branchId===null&&t.label==='visitor').value,'0.21');assert.ok(money.breakdown.some(t=>t.branchId===null&&t.label==='anonymous'));
 assert.equal(total(summary('contributions',[b])).amount,'0.05','foreign contribution stays at receiving branch');
 for(const kind of ['attendance','baptisms','contributions']){const empty=summary(kind,[]);assert.equal(total(empty).count,0);assert.deepEqual(empty.trend,[]);}
 assert.equal(sql("SELECT has_function_privilege('authenticated','public.get_module_summary(text,uuid[],date,date)','EXECUTE');"),'f');
 assert.equal(sql("SELECT has_function_privilege('anon','public.get_module_summary(text,uuid[],date,date)','EXECUTE');"),'f');
 sql("SELECT get_module_summary('bad',ARRAY[]::uuid[],'2026-01-01','2026-02-01');",db,true);
 }finally{sql('DROP DATABASE '+db+' WITH (FORCE)','postgres');}
});
test('module loader sends only authorized branch IDs, fixed six-month range and aggregate data',async()=>{
 const calls=[];const api=loadTypeScript('lib/module-summary.ts',{'server-only':{},'@/lib/supabase/admin':{}});
 const admin={rpc:async(name,args)=>{calls.push({name,args});return{data:{totals:[],trend:[],breakdown:[]},error:null};}};
 const result=await api.loadModuleSummary(admin,'attendance',['host']);assert.equal(calls[0].name,'get_module_summary');assert.deepEqual(Array.from(calls[0].args.p_branch_ids),['host']);assert.equal(calls[0].args.p_from.slice(-2),'01');assert.equal(result.module,'attendance');
 await api.loadModuleSummary(admin,'contributions',[]);assert.equal(calls.length,1);
 await assert.rejects(api.loadModuleSummary({rpc:async()=>({error:{message:'PRIVATE'}})},'baptisms',['host']),/Unable to load module summary/);
});
test('mini dashboards render sparse/empty data, exact money and module definitions without identities',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const Component=loadTypeScript('components/module-summary.tsx',{'@/app/portal/reports/ReportChart':{__esModule:true,default:p=>React.createElement('div',{'data-chart':p.title},p.description,p.emptyMessage)}}).default;
 for(const kind of ['attendance','baptisms','contributions']){const html=renderToStaticMarkup(React.createElement(Component,{data:{module:kind,from:'2026-06-01',to:'2026-11-06',totals:[],trend:[],breakdown:[]},branchId:'all',branchName:'All accessible branches'}));assert.match(html,/Module mini dashboard/);assert.match(html,/Last (6|12) calendar months/);assert.match(html,/No .*data for this period/);if(kind==='attendance')assert.match(html,/Present only/);if(kind==='baptisms')assert.match(html,/not distinct people/);if(kind==='contributions')assert.match(html,/Amount by Contributor Type/);}
 const html=renderToStaticMarkup(React.createElement(Component,{data:{module:'contributions',from:'2026-06-01',to:'2026-11-06',totals:[{branchId:'b',amount:'9007199254740999.99',count:1,average:'9007199254740999.99'}],trend:[],breakdown:[]},branchId:'b',branchName:'B'}));assert.match(html,/9,007,199,254,740,999.99/);
});
