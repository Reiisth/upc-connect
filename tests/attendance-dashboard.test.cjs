/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness */
const test=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const now=new Date('2026-11-06T04:00:00Z');
function fixture(){
 const branches=[{id:'a',name:'North'},{id:'b',name:'South'}];
 const services=[
  ['old','a','2026-10-04','09:00','completed'],['a1','a','2026-11-01','09:00','completed'],['a2','a','2026-11-01','18:00','scheduled'],['b1','b','2026-11-01','10:00','completed'],['empty','a','2026-11-01','21:00','ongoing'],['midnight','b','2026-11-06','00:00','completed'],
  ['future','a','2026-11-08','09:00','scheduled'],['future-today','a','2026-11-06','23:59','ongoing'],['cancelled','a','2026-11-01','11:00','cancelled'],['foreign','c','2026-11-01','09:00','completed'],
 ].map(([id,church_branch_id,service_date,start_time,status])=>({id,name:id,church_branch_id,service_date,start_time,status}));
 const members=[['1','a',false,'active'],['2','a',false,'inactive'],['3','a',true,'active'],['4','b',false,'active'],['5','c',false,'active']].map(([id,church_branch_id,is_archived,member_status])=>({id,church_branch_id,is_archived,member_status,email:'PRIVATE'}));
 const rows=[['old','1','present'],['a1','4','present'],['a1','2','excused'],['a1','1','absent'],['a2','1','present'],['a2','2','present'],['b1','4','present'],['b1','1','present'],['b1','2','present'],['b1','6','excused'],['b1','7','absent'],['midnight','1','present'],['future','1','present'],['future-today','1','present'],['cancelled','1','present'],['foreign','5','present']];
 const attendance_records=rows.map(([service_id,member_id,attendance_status],i)=>({id:String(i),service_id,member_id,attendance_status,check_in_time:service_id==='midnight'?'2026-11-05T16:00:00Z':null}));
 return{branches,services,members,attendance_records};
}
function harness(db=fixture()){
 const calls=[];
 class Query{
  constructor(table){this.table=table;this.filters=[];this.orders=[];this.first=0;this.last=Infinity;}
  select(columns,options={}){this.columns=columns;this.options=options;return this;}
  eq(key,value){this.filters.push(row=>row[key]===value);return this;}
  in(key,values){this.filters.push(row=>values.includes(row[key]));return this;}
  gte(key,value){this.filters.push(row=>row[key]>=value);return this;}
  lte(key,value){this.filters.push(row=>row[key]<=value);return this;}
  order(key,options={}){this.orders.push([key,options]);return this;}
  limit(count,options){if(!options)this.last=count-1;return this;}
  range(first,last){this.first=first;this.last=last;return this;}
  then(resolve,reject){calls.push({table:this.table,columns:this.columns,head:this.options.head});let selected=db[this.table].filter(row=>this.filters.every(filter=>filter(row)));
   if(this.columns.includes('!inner'))selected=selected.filter(row=>db.attendance_records.some(record=>record.service_id===row.id));
   selected.sort((a,b)=>{for(const[key,options]of this.orders){if(a[key]===b[key])continue;if(a[key]==null)return 1;if(b[key]==null)return-1;return(a[key]<b[key]?-1:1)*(options.ascending===false?-1:1);}return 0;});
   return Promise.resolve({data:this.options.head?null:selected.slice(this.first,this.last+1),count:this.options.count?selected.length:null,error:null}).then(resolve,reject);
  }
 }
 const admin={from:table=>new Query(table)};
 const stubs={'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>admin}};
 const api=loadTypeScript('lib/attendance-dashboard.ts',stubs);
 return{db,calls,admin,api,stubs,load:(branch=null,date=null)=>api.loadAttendanceDashboard(admin,db.branches,branch,date,now)};
}
test('latest Service is attendance-bearing and changes with authorized host branch/date',async()=>{
 const h=harness();const all=await h.load();assert.equal(all.latest.id,'midnight');
 const north=await h.load('a');assert.equal(north.latest.id,'a2');assert.equal(north.latest.present,2);assert.equal(north.latest.excused,0);
 const south=await h.load('b','2026-11-01');assert.equal(south.latest.id,'b1');assert.equal(south.latest.present+south.latest.excused+south.latest.absent,5);
 const dated=await h.load(null,'2026-11-01');assert.equal(dated.latest.id,'a2');assert.equal((await h.load(null,'2026-10-04')).latest.id,'old');
 assert.notEqual(all.latest.id,'future-today');assert.notEqual(north.latest.id,'empty');
});
test('average uses Present only; completed and effective ongoing Services include empty Services but exclude scheduled/cancelled',async()=>{
 const all=await harness().load();assert.equal(all.qualifyingServices,6);assert.equal(all.average,1.33);
 const date=await harness().load(null,'2026-11-01');assert.equal(date.qualifyingServices,4);assert.equal(date.average,1.5);
 const north=await harness().load('a','2026-11-01');assert.equal(north.qualifyingServices,3);assert.equal(north.average,1);
});
test('current member population uses home branch, includes inactive, excludes archived and ignores dashboard date',async()=>{
 const h=harness();assert.equal((await h.load()).totalMembers,3);assert.equal((await h.load('a')).totalMembers,2);assert.equal((await h.load('b')).totalMembers,1);
 assert.equal((await h.load('a','2000-01-01')).totalMembers,2);assert.equal((await h.load('b','2026-11-01')).totalMembers,1);
});
test('same-day composition groups multiple Services by host branch and uses only stored Absent',async()=>{
 const h=harness();const data=await h.load(null,'2026-11-01');assert.equal(data.byBranch.length,2);
 for(const row of data.byBranch)assert.deepEqual({present:row.present,excused:row.excused,absent:row.absent},{present:3,excused:1,absent:1});
 const north=await h.load('a','2026-11-01');assert.equal(north.byBranch.length,1);assert.equal(north.byBranch[0].present,3,'South member attendance belongs to North host');
 assert.equal(north.byBranch[0].absent,1,'does not subtract population 2 from records 5');
});
test('date context uses Manila Service DATE, not attendance check-in UTC day; empty date has no invented latest Service',async()=>{
 const h=harness();const day=await h.load('b','2026-11-06');assert.equal(day.latest.id,'midnight');assert.equal(day.byBranch[0].present,1);
 const previous=await h.load('b','2026-11-05');assert.equal(previous.latest,null);assert.equal(previous.average,null);assert.equal(previous.byBranch[0].present,0);
 const empty=await h.load(null,'2000-01-01');assert.equal(empty.latest,null);assert.equal(empty.average,null);assert.equal(empty.qualifyingServices,0);assert.equal(empty.totalMembers,3);
});
test('overview trend is ordered and count queries download neither raw attendance rows nor Member details',async()=>{
 const h=harness(),data=await h.load();assert.deepEqual(Array.from(data.trend,row=>row.period),['2026-06-01','2026-07-01','2026-08-01','2026-09-01','2026-10-01','2026-11-01']);assert.deepEqual(Array.from(data.trend,row=>row.present),[0,0,0,0,1,7]);
 assert.ok(h.calls.filter(call=>call.table==='attendance_records').every(call=>call.head&&call.columns==='id'));
 assert.ok(h.calls.filter(call=>call.table==='members').every(call=>call.head&&call.columns==='id'));assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
});
test('loader rejects inaccessible branches and invalid dates before querying, returns no data for empty scope and sanitizes errors',async()=>{
 const h=harness();await assert.rejects(h.load('c'),/outside your access/);await assert.rejects(h.load(null,'2026-02-30'),/valid dashboard calendar date/);assert.equal(h.calls.length,0);
 const none=await h.api.loadAttendanceDashboard(h.admin,[],null,null,now);assert.equal(none.latest,null);assert.equal(none.totalMembers,0);assert.equal(h.calls.length,0);
 await assert.rejects(h.api.loadAttendanceDashboard({from(){throw Error('PRIVATE')}},h.db.branches,null,null,now),/Unable to load Attendance dashboard/);
});
test('refresh server action reauthorizes attendance.view and resolves branch scope on each request',async()=>{
 const h=harness();let permitted=true,checks=0;
 const action=loadTypeScript('app/portal/attendance/dashboard-actions.ts',{...h.stubs,'./access':{requireAttendancePermission:async permission=>{checks++;assert.equal(permission,'attendance.view');if(!permitted)throw Error('denied');return{};}},'../services/access':{getAccessibleActiveBranches:async()=>h.db.branches}}).refreshAttendanceDashboard;
 await action('a','2026-11-01');permitted=false;await assert.rejects(action('a','2026-11-01'),/denied/);assert.equal(checks,2);
});
test('chart switching is derived only from filter context and donut/stacked share accessible exact count tables',()=>{
 const {attendanceChartMode}=loadTypeScript('lib/attendance-dashboard-model.ts');assert.equal(attendanceChartMode(null,null),'line');assert.equal(attendanceChartMode(null,'a'),'line');assert.equal(attendanceChartMode('2026-11-01',null),'stacked');assert.equal(attendanceChartMode('2026-11-01','a'),'doughnut');
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx').default;
 for(const props of [{kind:'doughnut',centerValue:5},{kind:'bar',stacked:true}]){const html=renderToStaticMarkup(React.createElement(Chart,{...props,compact:true,title:'Attendance',labels:['Present','Excused','Absent'],series:[{label:'Records',values:[3,1,1]}],emptyMessage:'No attendance records for this date.'}));assert.match(html,/View chart data/);assert.match(html,/Present/);assert.match(html,/Absent/);}
 const html=renderToStaticMarkup(React.createElement(Chart,{kind:'doughnut',title:'Empty',labels:['Present','Excused','Absent'],series:[{label:'Records',values:[0,0,0]}],emptyMessage:'No attendance records for this date.'}));assert.match(html,/No attendance records for this date/);assert.equal(html.includes('<canvas'),false);
});

test('latest lookup pages past same-day future attendance candidates instead of treating them as Ongoing',async()=>{
 const h=harness();for(let n=0;n<25;n++){const id='future-'+n;h.db.services.push({id,name:id,church_branch_id:'a',service_date:'2026-11-06',start_time:'23:59',status:'scheduled'});h.db.attendance_records.push({id,service_id:id,member_id:'1',attendance_status:'present'});}
 const result=await h.load();assert.equal(result.latest.id,'midnight');assert.ok(h.calls.filter(call=>call.table==='services'&&call.columns.includes('!inner')).length>=2);
});
test('large service scopes paginate metadata and batch SQL counts without downloading attendance histories',async()=>{
 const h=harness();for(let n=0;n<505;n++){const id='bulk-'+String(n).padStart(4,'0');h.db.services.push({id,name:id,church_branch_id:'a',service_date:'2026-10-30',start_time:'09:00',status:'completed'});h.db.attendance_records.push({id,service_id:id,member_id:'1',attendance_status:'present'});}
 const result=await h.load('a','2026-10-30');assert.equal(result.qualifyingServices,505);assert.equal(result.byBranch[0].present,505);assert.equal(result.average,1);assert.equal(result.latest.present,1);
 assert.ok(h.calls.filter(call=>call.table==='attendance_records').every(call=>call.head));
});
