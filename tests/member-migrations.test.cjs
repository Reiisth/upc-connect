/* eslint-disable @typescript-eslint/no-require-imports -- Server action and actual UI regressions. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {clientHooks,findElement}=require('./helpers/client-hooks.cjs');
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';

function reportingHarness({permission=true,error=false}={}){
 const calls=[],permissions=[],rows=[{id:'event',member_id:'member',member_name:'Ana Cruz',kind:'transfer',recorded_at:'2026-11-16T00:00:00Z',from_branch_id:a,to_branch_id:b,from_branch_name:'North',to_branch_name:'Private branch'}];
 const admin={rpc:async(name,args)=>{calls.push({name,args});return{data:error?null:{trackingStartedAt:'2026-11-16T00:00:00Z',totals:{transfers:1}},error:error?{message:'PRIVATE SQL'}:null};},from:table=>{
   calls.push({table});const query={select(){return this;},eq(key,value){calls.push(['eq',key,value]);return this;},or(value){calls.push(['or',value]);return this;},ilike(key,value){calls.push(['ilike',key,value]);return this;},gte(key,value){calls.push(['gte',key,value]);return this;},lte(key,value){calls.push(['lte',key,value]);return this;},order(){return this;},range(first,last){calls.push(['range',first,last]);return Promise.resolve({data:rows,count:11,error:null});}};return query;
 }};
 const api=loadTypeScript('lib/member-migrations/server.ts',{
   '@/lib/permissions-server':{requirePermission:async key=>{permissions.push(key);if(!permission)throw Error('denied');return{user:{id:'actor'},permissions:[key]};}},
   '@/lib/branch-access':{getUserBranchScope:async()=>({branchIds:[a],isSystemAdmin:false})},
   '@/lib/historical-records':{getHistoricalRecordBranches:async()=>[{id:a,name:'North',code:null,isActive:true}]},
   '@/lib/supabase/admin':{createAdminClient:()=>admin},
 });return{api,calls,permissions,rows};
}

test('reporting uses reports.view, server-derived branches and no member identities',async()=>{
 const h=reportingHarness();await h.api.getMigrationAnalytics({range:{preset:'custom',from:'2026-11-01',to:'2026-11-16'},grouping:'day'});
 assert.deepEqual(h.permissions,['reports.view']);const call=h.calls[0];assert.equal(call.name,'get_member_migration_analytics');assert.deepEqual(Array.from(call.args.p_branch_ids),[a]);assert.equal(call.args.p_actor_id,'actor');
 assert.equal(call.args.p_from,'2026-11-01');assert.equal(call.args.p_grouping,'day');assert.ok(!h.calls.some(call=>call.table));
 await assert.rejects(h.api.getMigrationAnalytics({branchId:b}),/outside your access/);
 await assert.rejects(reportingHarness({permission:false}).api.getMigrationAnalytics(),/denied/);
 await assert.rejects(reportingHarness({error:true}).api.getMigrationAnalytics(),error=>!error.message.includes('PRIVATE SQL'));
});

test('historical movement lookup retains origin visibility, masks foreign branch metadata and preserves combined filters',async()=>{
 const h=reportingHarness();const result=await h.api.getMigrationEvents({memberId:'member',page:2,search:'Ana%',kind:'transfer',branch:a,from:'2026-11-01',to:'2026-11-16'});
 assert.deepEqual(h.permissions,['members.view']);assert.equal(result.rows[0].to_branch_name,'Outside accessible branches');assert.equal(result.rows[0].to_branch_id,undefined);
 assert.ok(h.calls.some(call=>call[0]==='or'&&call[1].includes(a)&&!call[1].includes(b)));
 assert.ok(h.calls.some(call=>call[0]==='range'&&call[1]===10&&call[2]===19));
 assert.ok(h.calls.some(call=>call[0]==='ilike'&&call[2]==='%Ana\\%%'));
 assert.ok(h.calls.some(call=>call[0]==='lte'&&call[2]==='2026-11-16T23:59:59.999999+08:00'));
 assert.ok(!h.calls.some(call=>call.table==='members'),'does not read current profile from a former branch');
 await assert.rejects(h.api.getMigrationEvents({branch:b}),/outside your access/);
 await assert.rejects(h.api.getMigrationEvents({kind:'made-up'}),/valid movement/);
 await assert.rejects(h.api.getMigrationEvents({from:'2026-02-30',to:'2026-11-16'}),/valid reporting/);
});

test('departure and return actions reauthorize archive permission and delegate to transactional RPC',async()=>{
 const calls=[],member={id:'member',church_branch_id:a,is_archived:false,departed_at:null};let fail=false;
 const api=loadTypeScript('app/portal/members/actions.ts',{
   './data':{requireStaffMember:async(id,key)=>{
     calls.push(['permission',key]);
     return {member,access:{user:{id:'actor'}},admin:{rpc:async(name,args)=>{
       calls.push({name,args});return {data:id,error:fail?{message:'PRIVATE'}:null};
     }}};
   }},
   '../services/access':{assertActiveServiceBranch:async(_admin,_access,branch)=>calls.push(['branch',branch])},
   '@/lib/portal-invalidation':{revalidatePortalPath:path=>calls.push(['invalidate',path])},
 });
 await api.recordMemberDeparture('member');assert.equal(calls[0][1],'members.archive');assert.equal(calls.find(call=>call.name).args.p_operation,'departure');
 member.departed_at='2026-11-16T00:00:00Z';member.is_archived=true;await api.restoreMember('member');assert.equal(calls.filter(call=>call.name).at(-1).args.p_operation,'return');
 fail=true;await assert.rejects(api.restoreMember('member'),error=>!error.message.includes('PRIVATE'));
 await assert.rejects(api.recordMemberDeparture('member'),/current member/);
});

test('departure confirmation explains operational effect and invokes explicit action',async()=>{
 let departures=0;const h=clientHooks('app/portal/members/MemberDepartureControl.tsx',{'./actions':{recordMemberDeparture:async()=>departures++}},'MemberDepartureControl');
 let tree=h.render({memberId:'member'});findElement(tree,e=>e.props.children&&Array.isArray(e.props.children)&&e.props.children.includes('Record Departure')).props.onClick();
 tree=h.render({memberId:'member'});const modal=findElement(tree,e=>e.props.title==='Record departure from the church?');assert.equal(modal.props.open,true);assert.match(modal.props.description,/archives/);assert.match(modal.props.description,/ordinary archive/);
 modal.props.onConfirm();await h.settle();assert.equal(departures,1);
});

test('migration report renders consistent metrics and chart from one filtered aggregate, without member-management access',async()=>{
 const charts=[];let request;
 const data={trackingStartedAt:'2026-11-16T00:00:00Z',totals:{events:5,members:3,transfers:3,incoming:1,outgoing:3,departures:2,returns:0,net:-4},trend:[{periodStart:'2026-11-16',incoming:1,outgoing:3,departures:2,returns:0}],branches:[{id:a,name:'North',incoming:1,outgoing:3,departures:2,returns:0,net:-4}],flows:[{source:'North',destination:'Outside accessible branches',transfers:3}]};
 const Page=loadTypeScript('app/portal/reports/migrations/page.tsx',{'@/lib/portal-branch-server':{getPortalBranchId:async()=> a},
   '@/lib/member-migrations/server':{getMigrationReportingContext:async()=>({access:{permissions:['reports.view']},branches:[{id:a,name:'North',code:null,isActive:true}]}),getMigrationAnalytics:async value=>{request=value;return data;}},
   './ReportChart':{__esModule:true,default:props=>{charts.push(props);return null;}},
 }).default;
 const shell=Page({searchParams:Promise.resolve({branch:a,range:'custom',from:'2026-11-01',to:'2026-11-16',grouping:'day'})});
 const content=await shell.props.children.type(shell.props.children.props);const html=renderToStaticMarkup(content);
 assert.equal(request.branchId,a);assert.equal(request.range.from,'2026-11-01');assert.equal(request.grouping,'day');
 assert.match(html,/Net Transfers/);assert.match(html,/-4/);assert.match(html,/Earlier movement history is unavailable/);assert.doesNotMatch(html,/Transfer Routes|A member can move multiple times/);
 assert.doesNotMatch(html,/View movement records/);assert.equal(charts[0].series[2].values[0],2);assert.equal(charts[0].series[1].values[0],3);
});

test('history UI preserves transfer/departure distinction and reporting filters target migration page',()=>{
 const {MigrationHistoryTable}=loadTypeScript('app/portal/members/MigrationHistoryTable.tsx');
 const html=renderToStaticMarkup(React.createElement(MigrationHistoryTable,{showMember:true,rows:[{id:'event',member_id:'member',member_name:'Ana Cruz',kind:'departure',recorded_at:'2026-11-16T00:00:00Z',from_branch_name:'North',to_branch_name:null}]}));
 assert.match(html,/Departure/);assert.match(html,/Outside the church/);assert.match(html,/\/portal\/members\/member\/migrations/);
 const Filters=loadTypeScript('app/portal/reports/ReportFilters.tsx').default;
 const filters=renderToStaticMarkup(React.createElement(Filters,{action:'/portal/reports/migrations',branches:[],values:{branch:'',preset:'last_30_days',from:'2026-11-01',to:'2026-11-16',grouping:'month'}}));
 assert.match(filters,/action="\/portal\/reports\/migrations"/);
 const {validateSelfServiceProfile}=loadTypeScript('lib/member-validation.ts');const form=new FormData();form.set('departed_at','2026-11-16');
 assert.throws(()=>validateSelfServiceProfile(form,[],{},{}),/Church and system/);
});


test('chart branch action delegates scope checks and returns only aggregate trend data',async()=>{
 let supplied;
 const action=loadTypeScript('app/portal/reports/migration-trend-actions.ts',{
  '@/lib/member-migrations/server':{getMigrationAnalytics:async request=>{supplied=request;return {trend:[{periodStart:'2026-11-16',incoming:1,outgoing:0,departures:0,returns:0}],privateField:'must not return'};}},
 }).loadMigrationTrend;
 const result=await action({branchId:a,range:{preset:'custom',from:'2026-11-01',to:'2026-11-20'},grouping:'day'});
 assert.equal(result.ok,true);assert.equal(supplied.branchId,a);assert.deepEqual(Object.keys(result).sort(),['ok','trend']);
 const h=reportingHarness();const secure=loadTypeScript('app/portal/reports/migration-trend-actions.ts',{'@/lib/member-migrations/server':h.api}).loadMigrationTrend;
 const denied=await secure({branchId:b});assert.equal(denied.ok,false);assert.equal(h.calls.length,0);
 const revoked=loadTypeScript('app/portal/reports/migration-trend-actions.ts',{'@/lib/member-migrations/server':reportingHarness({permission:false}).api}).loadMigrationTrend;
 assert.equal((await revoked({branchId:a})).ok,false);
});
