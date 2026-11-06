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

test('effective authorized branch count drives date charts and Attendance palette is explicit',()=>{
 const {attendanceChartMode,ATTENDANCE_COLORS}=loadTypeScript('lib/attendance-dashboard-model.ts');
 assert.equal(attendanceChartMode('2026-11-01',null,1),'doughnut');assert.equal(attendanceChartMode('2026-11-01',null,2),'stacked');assert.equal(attendanceChartMode(null,null,1),'line');
 assert.equal(ATTENDANCE_COLORS.present,'#365FA6');assert.equal(ATTENDANCE_COLORS.excused,'#8BAFE5');assert.equal(ATTENDANCE_COLORS.absent,'#CBD5E1');
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');let chart,stateIndex=0;
 const Dashboard=loadTypeScript('app/portal/attendance/AttendanceMiniDashboard.tsx',{'./dashboard-actions':{},'@/app/portal/reports/ReportChart':{__esModule:true,default:props=>{chart=props;return null;}},react:{...React,useState:initial=>[stateIndex++===0?'2026-11-01':initial,()=>{}]}}).default;
 const initial={branchId:null,date:'2026-11-01',from:'2026-11-01',to:'2026-11-01',latest:null,average:null,totalMembers:10,qualifyingServices:0,trend:[],byBranch:[{id:'a',name:'South',present:2,excused:1,absent:1}]};
 renderToStaticMarkup(React.createElement(Dashboard,{initial,branches:[{id:'a',name:'South'}],branchFilter:'all',onBranchChange(){}}));
 assert.equal(chart.kind,'doughnut');assert.match(chart.description,/South/);assert.deepEqual(Array.from(chart.categoryColors),['#365FA6','#8BAFE5','#CBD5E1']);
});

test('camera-first scanner renders square target and sanitized QR-only recent list without manual entry',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const Scanner=loadTypeScript('app/portal/attendance/[serviceId]/scan/QrAttendanceScanner.tsx',{'../../actions':{recordQrAttendance:async()=>{}}}).default;
 const html=renderToStaticMarkup(React.createElement(Scanner,{serviceId:'service',initialRecent:[{recordId:'row',memberName:'Juan Cruz',attendanceStatus:'present',checkInTime:'2026-11-06T01:00:00Z',visitingMember:true,homeBranchName:'North'}]}));
 assert.match(html,/aspect-square/);assert.match(html,/data-scanner-frame/);assert.match(html,/<video/);assert.match(html,/Recently Scanned/);assert.match(html,/Juan Cruz/);assert.match(html,/Visiting Member/);assert.match(html,/North/);assert.doesNotMatch(html,/Manual QR|<input|Visitor|Inactive Member/);
});

test('recent QR query is current-Service, QR-only, bounded and returns minimal display information',async()=>{
 const calls=[];const row={id:'record',attendance_status:'present',check_in_time:'2026-11-06T01:00:00Z',members:{first_name:'Juan',middle_name:null,last_name:'Cruz',church_branch_id:'north',church_branches:{name:'North'}}};
 const q={select(v){calls.push(['select',v]);return this;},eq(k,v){calls.push(['eq',k,v]);return this;},order(k,v){calls.push(['order',k,v.ascending]);return this;},limit(n){calls.push(['limit',n]);return Promise.resolve({data:[row],error:null});}};
 const {loadRecentQrScans}=loadTypeScript('app/portal/attendance/data.ts',{'server-only':{},'@/lib/supabase/admin':{},'../services/access':{}});
 const rows=await loadRecentQrScans({from:()=>q},{id:'current',churchBranchId:'south'});
 assert.equal(rows[0].memberName,'Juan Cruz');assert.equal(rows[0].visitingMember,true);assert.equal(rows[0].homeBranchName,'North');
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='service_id'&&c[2]==='current'));assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='method'&&c[2]==='qr'));assert.ok(calls.some(c=>c[0]==='limit'&&c[1]===20));assert.ok(calls.some(c=>c[0]==='order'&&c[1]==='created_at'&&c[2]===false));
 assert.doesNotMatch(JSON.stringify(rows),/email|phone|member_status|church_branch_id/);
});

test('latest comparison uses immediately previous attendance-bearing Service in authorized host scope',async()=>{
 const h=harness();const north=await h.load('a');assert.equal(north.latestComparison.previous,1);assert.equal(north.latestComparison.percent,100);
 const all=await h.load();assert.equal(all.latestComparison.previous,2);assert.equal(all.latestComparison.percent,-50);
 const south=await h.load('b','2026-11-01');assert.equal(south.latestComparison.previous,null);assert.equal(south.latestComparison.percent,null);
 const dated=await h.load('a','2026-10-04');assert.equal(dated.latestComparison.label,'No previous comparison');
 const empty=await h.load(null,'2000-01-01');assert.equal(empty.latestComparison.percent,null);
 // Empty completed, future Scheduled, Cancelled and unauthorized Services never become comparisons.
 assert.equal(north.latest.id,'a2');assert.equal(north.latestComparison.previous,1);
});
test('average comparison uses adjacent equal-length ranges, Present numerator and meaningful Service denominator',async()=>{
 const h=harness();const add=(id,branch,day,status)=>h.db.services.push({id,name:id,church_branch_id:branch,service_date:day,start_time:'09:00',status});
 add('prior','a','2026-10-31','completed');add('prior-empty','a','2026-10-31','completed');add('prior-cancel','a','2026-10-31','cancelled');add('prior-foreign','c','2026-10-31','completed');
 for(let n=0;n<4;n++)h.db.attendance_records.push({id:'prior'+n,service_id:'prior',member_id:String(n),attendance_status:n<2?'present':'excused'});
 const day=await h.load('a','2026-11-01');assert.equal(day.average,1);assert.equal(day.averageComparison.previous,1);assert.equal(day.averageComparison.percent,0);assert.equal(day.averageComparison.label,'vs previous day');
 // Current Jun 1-Nov 6 has 159 days; preceding range ends May 31.
 add('old-period','a','2026-05-31','completed');h.db.attendance_records.push({id:'prev',service_id:'old-period',member_id:'1',attendance_status:'present'});
 const overview=await h.load('a');assert.equal(overview.averageComparison.previous,1);assert.match(overview.averageComparison.label,/vs previous \d+ days/);assert.equal(overview.totalMembers,2);
 const missing=await h.load('b','2026-11-01');assert.equal(missing.averageComparison.label,'No previous comparison');
});
test('comparison edge cases never invent percent from missing/zero baselines',()=>{
 const {attendanceComparison:c}=loadTypeScript('lib/attendance-dashboard-model.ts');
 for(const[current,previous]of[[null,4],[4,null],[null,null]])assert.equal(c(current,previous,'vs previous').label,'No previous comparison');
 assert.equal(c(5,0,'vs previous').percent,null);assert.equal(c(5,0,'vs previous').label,'Previous value was 0');assert.equal(c(0,0,'vs previous').percent,0);assert.equal(c(0,5,'vs previous').percent,-100);assert.equal(c(5,5,'vs previous').percent,0);
});
test('scanner page uses actual shared PageHeader and primary-blue guides without manual input',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const Page=loadTypeScript('app/portal/attendance/[serviceId]/scan/page.tsx',{'../../access':{requireAttendancePermission:async()=>({permissions:['attendance.record']})},'@/lib/supabase/admin':{createAdminClient:()=>({})},'../../data':{loadAccessibleService:async()=>({id:'current',name:'Sunday Service',status:'ongoing',branch:{name:'North'},serviceDate:'2026-11-07',startTime:'09:00'}),loadRecentQrScans:async()=>[]},'./QrAttendanceScanner':{__esModule:true,default:()=>null}}).default;
 const tree=Page({params:Promise.resolve({serviceId:'current'})});const content=await tree.props.children.type(tree.props.children.props);const html=renderToStaticMarkup(content);
 assert.match(html,/QR Attendance Scanner/);assert.match(html,/Attendance<\/span>/);assert.match(html,/Back to Service Attendance/);assert.match(html,/href="\/portal\/attendance\/current"/);assert.match(html,/font-radio-canada/);
});

test('Attendance-only chart appearance uses blue area, restrained grid and thinner donut while other charts keep defaults',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');let captured;
 const capture=props=>{captured=props;return null;};
 const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{'react-chartjs-2':{Line:capture,Bar:capture,Doughnut:capture}}).default;
 const base={compact:true,title:'Attendance',labels:['One','Two'],series:[{label:'Present',color:'#365FA6',values:[3,4]}],emptyMessage:'Empty'};
 renderToStaticMarkup(React.createElement(Chart,{...base,appearance:'attendance',kind:'line'}));assert.equal(captured.data.datasets[0].fill,true);assert.equal(captured.data.datasets[0].borderColor,'#365FA6');assert.match(captured.data.datasets[0].backgroundColor,/rgba/);assert.equal(captured.options.scales.y.grid.color,'#F0F4FA');
 renderToStaticMarkup(React.createElement(Chart,{...base,appearance:'attendance',kind:'bar',stacked:true}));assert.equal(captured.options.scales.x.stacked,true);assert.equal(captured.data.datasets[0].borderRadius,6);
 renderToStaticMarkup(React.createElement(Chart,{...base,appearance:'attendance',kind:'doughnut',categoryColors:['#365FA6','#8BAFE5','#CBD5E1']}));assert.equal(captured.options.cutout,'80%');assert.equal(captured.data.datasets[0].backgroundColor[0],'#365FA6');
 renderToStaticMarkup(React.createElement(Chart,{...base,kind:'line'}));assert.equal(captured.data.datasets[0].fill,false);assert.equal(captured.options.scales.y.grid.color,'#E8EDF5');
});

test('Latest card and comparison count Present only, including a real Service with zero Present',async()=>{
 const h=harness();const data=await h.load('b','2026-11-01');
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const Dashboard=loadTypeScript('app/portal/attendance/AttendanceMiniDashboard.tsx',{'./dashboard-actions':{},'@/app/portal/reports/ReportChart':{__esModule:true,default:()=>null}}).default;
 const initial={...data,branchId:null,date:null};const html=renderToStaticMarkup(React.createElement(Dashboard,{initial,branches:h.db.branches,branchFilter:'all',onBranchChange(){}}));
 assert.match(html,/Latest Service Attendance<\/p><p[^>]*>3<\/p>/);assert.equal(data.latest.present+data.latest.excused+data.latest.absent,5);
 for(const row of h.db.attendance_records)if(row.service_id==='a2')row.attendance_status='absent';
 const zero=await h.load('a');assert.equal(zero.latest.id,'a2');assert.equal(zero.latest.present,0);assert.equal(zero.latestComparison.previous,1);assert.equal(zero.latestComparison.percent,-100);
});
