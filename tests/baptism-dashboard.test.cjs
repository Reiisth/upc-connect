/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const test=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');

test('Baptism loader uses typed monthly aggregates and equal-length preceding counts in the same authorized scope',async()=>{
 const calls=[];const {loadModuleSummary}=loadTypeScript('lib/module-summary.ts',{'server-only':{},'@/lib/supabase/admin':{}});
 const data={totals:[],trend:[{branchId:'stored',period:'2026-02-01',value:3,water:2,holyGhost:1}],breakdown:[]};
 const admin={rpc:async(name,args)=>{calls.push({name,args});return {data,error:null};}};
 const result=await loadModuleSummary(admin,'baptisms',['stored'],{from:'2026-02-20',to:'2026-03-02'});
 assert.equal(calls[0].name,'get_baptism_module_summary');assert.equal(calls[1].name,'get_module_summary');assert.equal(calls[1].args.p_module,'baptisms');
 for(const call of calls)assert.deepEqual(Array.from(call.args.p_branch_ids),['stored']);
 assert.equal(calls[1].args.p_from,'2026-02-09');assert.equal(calls[1].args.p_to,'2026-02-19');assert.equal(result.trend[0].water,2);assert.equal(result.trend[0].holyGhost,1);
 const before=calls.length;await assert.rejects(loadModuleSummary(admin,'baptisms',['stored'],{from:'2026-03-02',to:'2026-02-20'}),/valid reporting/);assert.equal(calls.length,before);
});
test('Baptism range refresh requires its own view permission and uses stored-record branch access',async()=>{
 let authorized=true,checks=0,args;
 const {refreshBaptismSummary}=loadTypeScript('app/portal/baptisms/dashboard-actions.ts',{
  './access':{requireBaptismPermission:async key=>{checks++;assert.equal(key,'baptisms.view');if(!authorized)throw Error('denied');return {scope:'baptism'};}},
  '@/lib/supabase/admin':{createAdminClient:()=>({})},'@/lib/historical-records':{getHistoricalRecordBranches:async access=>{assert.equal(access.scope,'baptism');return[{id:'historical'}];}},
  '@/lib/module-summary':{loadModuleSummary:async(...values)=>{args=values;return{};}},
 });
 await refreshBaptismSummary('2026-01-01','2026-01-31');assert.equal(args[1],'baptisms');assert.deepEqual(Array.from(args[2]),['historical']);
 authorized=false;await assert.rejects(refreshBaptismSummary('2026-01-01','2026-01-31'),/denied/);assert.equal(checks,2);
});
test('Baptism trend renders independently scoped Water and Holy Ghost lines, zero-filled months and three count tickers',()=>{
 const charts=[];const Dashboard=loadTypeScript('components/module-summary.tsx',{'@/app/portal/reports/ReportChart':{__esModule:true,default:props=>{charts.push(props);return null;}}}).default;
 const data={module:'baptisms',from:'2026-02-20',to:'2026-03-02',totals:[{branchId:'a',count:6,water:4,holyGhost:2,undated:1}],trend:[{branchId:'a',period:'2026-02-01',value:6,water:4,holyGhost:2},{branchId:'foreign',period:'2026-03-01',value:99,water:50,holyGhost:49}],breakdown:[],comparison:{from:'2026-02-09',to:'2026-02-19',totals:[{branchId:'a',count:6,water:2,holyGhost:4}]}};
 const html=renderToStaticMarkup(React.createElement(Dashboard,{data,branchId:'a',branchName:'Stored Branch'}));
 assert.equal(charts[0].kind,'line');assert.equal(charts[0].series.length,2);assert.deepEqual(Array.from(charts[0].series[0].values),[4,0]);assert.deepEqual(Array.from(charts[0].series[1].values),[2,0]);
 assert.equal(charts[0].series[0].label,'Water');assert.equal(charts[0].series[1].label,'Holy Ghost');assert.notEqual(charts[0].series[0].color,charts[0].series[1].color);
 assert.match(html,/Baptism comparison: up 100%/);assert.match(html,/Baptism comparison: down 50%/);assert.match(html,/undated records/);assert.match(html,/not distinct people/);
 const empty=renderToStaticMarkup(React.createElement(Dashboard,{data:{...data,totals:[],trend:[],comparison:{...data.comparison,totals:[]}},branchId:'all',branchName:'All'}));assert.equal((empty.match(/No previous comparison<\/p>/g)||[]).length,3);
});
test('Baptism table has date-under-name, distinct icons, 10-row pages and a labeled date-range card',()=>{
 const Table=loadTypeScript('app/portal/baptisms/BaptismsTable.tsx',{'./dashboard-actions':{}}).default;
 const records=Array.from({length:12},(_,index)=>({id:String(index),memberId:String(index),memberName:`Member ${index}`,churchBranchId:'a',baptismType:index%2?'holy_ghost':'water',baptismDate:'2026-02-21',memberStatus:'inactive',memberIsArchived:false,notes:'Do not show this note',officiatedBy:null,location:null,recordedBy:null,recordedByName:null,branch:{id:'a',name:'Stored Branch'}}));
 const html=renderToStaticMarkup(React.createElement(Table,{records,branches:[],canUpdateWater:false,canUpdateHolyGhost:false}));
 assert.match(html,/Page 1 of 2/);assert.match(html,/Showing 1-10 of 12 baptism records/);assert.equal((html.match(/font-medium text-slate-900/g)||[]).length,10);
 assert.match(html,/lucide-droplets/);assert.match(html,/lucide-flame/);assert.doesNotMatch(html,/Historical member link|Do not show this note|>Baptism Date<\/th>/);
 assert.match(html,/Feb 21, 2026/);assert.match(html,/<h2 id="baptism-range-title"/);assert.match(html,/Recent 12 months/);assert.match(html,/All time/);assert.match(html,/Apply range/);
 const unknown=renderToStaticMarkup(React.createElement(Table,{records:[{...records[0],baptismDate:null}],branches:[],canUpdateWater:false,canUpdateHolyGhost:false}));assert.match(unknown,/Date unknown/);
});
