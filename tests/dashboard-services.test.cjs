/* eslint-disable @typescript-eslint/no-require-imports -- Actual server loader and rendered dashboard context. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const branches=[{id:'a',name:'North',isActive:true,street_address:'123 Church St',city:'Batangas City',province:'Batangas',country:'Philippines'},{id:'b',name:'South',isActive:true},{id:'closed',name:'Closed branch',isActive:false}];
const now=new Date('2026-11-18T02:00:00Z'); // 10:00 in Manila.
const service=(id,branch,date,time,status='scheduled')=>({id,name:`Service ${id}`,service_type:'worship',church_branch_id:branch,service_date:date,start_time:time,status});
function harness({selected=null,allowed=branches,rows=[],failure=false,denied=false}={}){
 const calls=[];
 class Query{
  constructor(table){this.table=table;this.rows=table==='services'?[...rows]:[...allowed];}
  select(columns){calls.push({columns,table:this.table});return this;}
  eq(key,value){calls.push({key,value,table:this.table});this.rows=this.rows.filter(row=>row[key]===value);return this;}
  maybeSingle(){return Promise.resolve({data:this.rows[0]??null,error:null});}
  in(key,values){calls.push({key,values});this.rows=this.rows.filter(row=>values.includes(row[key]));return this;}
  order(key,{nullsFirst=false}={}){this.sort??=[];this.sort.push({key,nullsFirst});return this;}
  range(from,to){calls.push({from,to});this.rows.sort((a,b)=>{for(const {key,nullsFirst} of this.sort){const x=a[key],y=b[key];if(x===y)continue;if(x==null||y==null)return x==null?(nullsFirst?-1:1):(nullsFirst?1:-1);return String(x).localeCompare(String(y));}return 0;});return Promise.resolve({data:this.rows.slice(from,to+1),error:failure?{message:'PRIVATE SQL'}:null});}
 }
 const api=loadTypeScript('lib/dashboard-services.ts',{
  '@/lib/analytics/server':{getAnalyticsBranchOptions:async()=>{if(denied)throw Error('Access denied');return allowed;}},
  '@/lib/portal-branch-server':{getPortalBranchId:async()=>selected},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:table=>{assert.ok(['services','church_branches'].includes(table));return new Query(table);}})},
 });
 return {calls,load:()=>api.getDashboardServiceOverview(now)};
}

test('ongoing services follow Manila start times, take priority and remain strictly branch scoped',async()=>{
 const h=harness({selected:'a',rows:[service('started','a','2026-11-18','10:00'),service('future','a','2026-11-18','10:01'),service('legacy','a','2026-11-17',null),service('foreign','b','2026-11-18','09:00'),service('finished','a','2026-11-18','09:00','completed'),service('cancelled','a','2026-11-18','09:00','cancelled')]});
 const result=await h.load();assert.equal(result.branchName,'North');assert.equal(result.state,'ongoing');
 assert.equal(result.branchLocation,'123 Church St, Batangas City, Batangas, Philippines');assert.equal(result.services[0].serviceType,'worship');
 assert.equal(h.calls.find(call=>call.table==='church_branches'&&call.key==='id').value,'a');
 assert.deepEqual(Array.from(result.services,row=>row.id),['legacy','started']);assert.equal(result.scheduledTotal,1);
 assert.deepEqual(Array.from(h.calls.find(call=>call.key==='church_branch_id').values),['a']);
 assert.doesNotMatch(h.calls[0].columns,/notes|member|attendance/);
});

test('All branches labels each service and reads every ongoing row beyond the source page limit',async()=>{
 const h=harness({allowed:branches.slice(0,2),rows:Array.from({length:505},(_,index)=>service(String(index),index%2?'a':'b','2026-11-18','09:00'))});
 const result=await h.load();assert.equal(result.branchName,'All branches');assert.equal(result.multipleBranches,true);assert.equal(result.services.length,505);
 assert.ok(result.services.some(row=>row.branchName==='North')&&result.services.some(row=>row.branchName==='South'));
 assert.equal(h.calls.filter(call=>call.from!==undefined).length,2);
});

test('scheduled fallback is ordered, bounded and distinct from empty or unavailable data',async()=>{
 const rows=[5,1,3,4,2].map(day=>service(String(day),'a',`2026-11-${18+day}`,'08:00'));
 const result=await harness({selected:'a',rows}).load();assert.equal(result.state,'scheduled');assert.equal(result.scheduledTotal,5);assert.deepEqual(Array.from(result.services,row=>row.id),['1','2','3']);
 assert.equal((await harness().load()).state,'empty');
 assert.equal((await harness({failure:true}).load()).state,'unavailable');
 const closed=harness({selected:'closed',rows:[service('old','closed','2026-11-18','09:00')]});assert.equal((await closed.load()).state,'empty');assert.ok(!closed.calls.some(call=>call.table==='services'));
 const none=harness({allowed:[]});assert.equal((await none.load()).state,'no-access');assert.equal(none.calls.length,0);
 await assert.rejects(harness({denied:true}).load(),/Access denied/);
 await assert.rejects(harness({selected:'foreign'}).load(),/outside your access/);
});

test('branch context renders multiple ongoing services, scheduled fallback and honest error states in the filter card',async()=>{
 const Overview=loadTypeScript('app/portal/reports/DashboardBranchOverview.tsx').default;
 const Filters=loadTypeScript('app/portal/reports/ReportFilters.tsx').default;
 const data=await harness({selected:'a',rows:[service('one','a','2026-11-18','09:00'),service('two','a','2026-11-18','10:00')]}).load();
 const html=renderToStaticMarkup(React.createElement(Filters,{branches,values:{preset:'last_30_days',grouping:'week',from:'2026-10-20',to:'2026-11-18',branch:'a'},context:React.createElement(Overview,{overview:data,serviceTypeNames:{worship:'Sunday Worship'},showReports:true})}));
 assert.match(html,/href="#ai-decision-support"/);assert.match(html,/View Reports/);
 assert.match(html,/123 Church St, Batangas City, Batangas, Philippines/);assert.match(html,/Sunday Worship/);
 assert.match(html,/<h2[^>]*>North<\/h2>/);assert.match(html,/2 Ongoing Services/);assert.match(html,/Service one/);assert.match(html,/Service two/);assert.match(html,/Dashboard filters/);assert.doesNotMatch(html,/Independent of the dashboard date range|Inclusive calendar dates/);assert.match(html,/Date range: /);
 assert.match(html,/<button[^>]*aria-expanded="false"[^>]*>[\s\S]*?2 Ongoing Services[\s\S]*?<\/button>/);assert.doesNotMatch(html,/<details[^>]*\sopen(?:\s|=|>)/);
 const scheduled=await harness({selected:'b',rows:[service('next','b','2026-11-19','08:00')]}).load();
 const next=renderToStaticMarkup(React.createElement(Overview,{overview:scheduled}));assert.match(next,/No ongoing service/);assert.match(next,/1 Scheduled Service/);assert.match(next,/Service next/);
 const error=renderToStaticMarkup(React.createElement(Overview,{overview:{...data,state:'unavailable',services:[]}}));assert.match(error,/currently unavailable/);assert.doesNotMatch(error,/No ongoing or scheduled services/);
});
