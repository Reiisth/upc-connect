/* eslint-disable @typescript-eslint/no-require-imports -- Actual server boundaries and client handlers. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {clientHooks,findElement}=require('./helpers/client-hooks.cjs');
const helpers=loadTypeScript('lib/portal-branch.ts');
const branches=[{id:'a',name:'North',isActive:true},{id:'b',name:'South',isActive:false}];

test('shared branch cookies are user-bound, authorized and resilient to stale or malformed values',()=>{
 const resolve=value=>helpers.resolvePortalBranch(value,'user',branches);
 assert.equal(resolve(JSON.stringify({userId:'user',branchId:'b'})),'b');
 for(const value of [undefined,'{', 'null','123',JSON.stringify({userId:'other',branchId:'a'}),JSON.stringify({userId:'user',branchId:'foreign'}),JSON.stringify({userId:'user',branchId:null})])assert.equal(resolve(value),null);
 const url=helpers.portalBranchSwitchUrl('/portal/members?branch=a&page=4&view.branchFilter=%22a%22&view.page=3&search=Ana&archive=all&returnTo=bad');
 assert.equal(url,'/portal/members?search=Ana&archive=all');
 const state=new URL(helpers.portalBranchSwitchUrl('/portal/follow-ups?view.filters='+encodeURIComponent(JSON.stringify({search:'Ana',branch:'a'}))),'http://test');
 assert.deepEqual(JSON.parse(state.searchParams.get('view.filters')),{search:'Ana',branch:''});
 assert.equal(helpers.portalPageName('/portal/services/new'),'Services');
});

test('view selection narrows reads without narrowing or expanding authorization scope',async()=>{
 let saved=JSON.stringify({userId:'user',branchId:'b'});
 const scope={branchIds:['a','b'],isSystemAdmin:false};
 const api=loadTypeScript('lib/portal-branch-server.ts',{
  './auth':{requireActiveAccount:async()=>({user:{id:'user'}})},
  './branch-access':{getUserBranchScope:async()=>scope},
  './historical-records':{getHistoricalRecordBranches:async received=>{assert.equal(received,scope);return branches;}},
  './supabase/admin':{createAdminClient:()=>({})},
  'next/headers':{cookies:async()=>({get:()=>({value:saved})})},
 });
 assert.equal((await api.getPortalBranchContext()).scope,scope);
 assert.deepEqual(Array.from(await api.selectPortalBranches(branches),row=>row.id),['b']);
 assert.equal((await api.selectPortalBranches([branches[0]])).length,0,'A closed selection must never fall back to all active branches');
 saved=JSON.stringify({userId:'user',branchId:'foreign'});
 assert.deepEqual(Array.from(await api.selectPortalBranches(branches),row=>row.id),['a','b']);
 assert.deepEqual(scope.branchIds,['a','b']);
});

test('branch switch action rejects unauthorized choices, persists All and clears selection on logout',async()=>{
 const writes=[];let signedOut=false;
 const api=loadTypeScript('app/portal/actions.ts',{
  '@/lib/portal-branch-server':{getPortalBranchContext:async()=>({userId:'user',branches})},
  'next/headers':{cookies:async()=>({set:(...args)=>writes.push(args),delete:key=>writes.push(['delete',key])})},
  '@/lib/supabase/server':{createClient:async()=>({auth:{signOut:async()=>{signedOut=true;}}})},
  'next/navigation':{redirect:path=>{throw Error(path);}},
 });
 assert.ok((await api.selectPortalBranch('foreign')).error);assert.equal(writes.length,0);
 assert.equal((await api.selectPortalBranch('a')).error,null);
 assert.deepEqual(JSON.parse(writes[0][1]),{userId:'user',branchId:'a'});assert.equal(writes[0][2].httpOnly,true);
 await api.selectPortalBranch('all');assert.equal(JSON.parse(writes[1][1]).branchId,null);
 await assert.rejects(api.logoutPortal(),/\/login/);assert.equal(signedOut,true);assert.equal(writes.at(-1)[0],'delete');
});

test('responsive shell exposes page, account and accessible collapse controls and refreshes branch context',async()=>{
 const calls=[];
 const h=clientHooks('app/portal/PortalFrame.tsx',{
  '@/components/portal-branch-context':{PortalBranchContext:React.createContext({})},
  'next/navigation':{usePathname:()=>'/portal/reports',useRouter:()=>({replace:(...args)=>calls.push(args),refresh:()=>calls.push('refresh')})},
  './actions':{selectPortalBranch:async value=>{calls.push(value);return {error:null};},logoutPortal:async()=>{}},
 },'default',{window:{location:{href:'http://test/portal/reports?branch=a&page=3&range=last_7_days'}}});
 const props={userId:'user',identity:{displayName:'Ana Cruz',roles:[{key:'pastor',displayName:'Pastor'}]},branches,branchId:null,children:'Page data'};
 let tree=h.render(props);
 assert.ok(findElement(tree,e=>e.props['aria-label']==='Account menu for Ana Cruz'));
 findElement(tree,e=>e.props['aria-label']==='Collapse sidebar').props.onClick();
 tree=h.render(props);assert.ok(findElement(tree,e=>e.props['aria-label']==='Expand sidebar'));
 // Successful switching clears old branch/page URLs and refreshes the server context.
 findElement(tree,e=>e.props['aria-label']==='Current branch throughout the portal').props.onChange({target:{value:'b'}});
 await h.settle();assert.equal(calls[0],'b');
 assert.equal(calls[1][0],'/portal/reports?range=last_7_days');assert.equal(calls[2],'refresh');
 tree=h.render(props);assert.equal(findElement(tree,e=>e.props.role==='alert'),undefined);
});

test('summary refreshes use the shared branch instead of all authorized branches',async()=>{
 for(const [entry,permission,loader,exportName] of [
  ['contributions','requireContributionsPermission','loadModuleSummary','refreshContributionSummary'],
  ['baptisms','requireBaptismPermission','loadModuleSummary','refreshBaptismSummary'],
 ]){
  const calls=[];
  const api=loadTypeScript(`app/portal/${entry}/dashboard-actions.ts`,{
   './access':{[permission]:async()=>({branchIds:['a','b']})},
   '@/lib/supabase/admin':{createAdminClient:()=>({})},
   '@/lib/historical-records':{getHistoricalRecordBranches:async()=>branches},
   '@/lib/portal-branch-server':{selectPortalBranches:async values=>values.filter(row=>row.id==='a')},
   '@/lib/module-summary':{[loader]:async(...args)=>calls.push(args)},
  });
  await api[exportName]('2026-11-01','2026-11-30');assert.deepEqual(Array.from(calls[0][2]),['a']);
 }
});
