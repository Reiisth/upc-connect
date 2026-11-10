/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
test('warmup is bounded to two authorized small destinations and respects data saver',()=>{
 const {initialPortalPrefetch,permitBackgroundPrefetch}=loadTypeScript('lib/navigation-performance.ts');
 assert.deepEqual(Array.from(initialPortalPrefetch(['/portal/account','/portal/members','/portal/services','/portal/contributions'],'/portal/members')),['/portal/account','/portal/services']);
 assert.deepEqual(Array.from(initialPortalPrefetch(['/portal/profile'],'/portal/profile')),[]);
 assert.equal(permitBackgroundPrefetch({saveData:true}),false);assert.equal(permitBackgroundPrefetch({effectiveType:'2g'}),false);assert.equal(permitBackgroundPrefetch({effectiveType:'4g'}),true);
});
test('financial changes invalidate giving and reports without expiring unrelated member/profile views',()=>{
 const tags=[],paths=[];const {revalidatePortalPath}=loadTypeScript('lib/portal-invalidation.ts',{'next/cache':{updateTag:tag=>tags.push(tag),revalidatePath:(...args)=>paths.push(args)}});
 revalidatePortalPath('/portal/contributions/example/edit');
 assert.deepEqual(tags,['portal:contributions','portal:reports']);assert.equal(paths[0][0],'/portal/contributions/example/edit');
});
test('attendance, follow-up, and personal changes expire dependent reports and lists',()=>{
 const {portalInvalidationTags}=loadTypeScript('lib/portal-invalidation.ts');
 for(const path of ['/portal/attendance','/portal/follow-ups/member/member','/portal/profile/member'])assert.ok(portalInvalidationTags(path).includes('portal:reports'));
 assert.ok(portalInvalidationTags('/portal/attendance').includes('portal:inactivity'));
 assert.deepEqual(Array.from(portalInvalidationTags('/portal/administration/profile-fields')),['portal:administration-profile-fields','portal:profile']);
});
test('member filters clamp pages, sanitize search syntax, and generate stable URL cache keys',()=>{
 const {parseMemberListFilters,memberListUrl,memberSearchWords}=loadTypeScript('app/portal/members/list-filters.ts');
 const filters=parseMemberListFilters({page:'-1',archive:'unknown',sort:'bad',search:'Juan Cruz'});
 assert.equal(filters.page,1);assert.equal(filters.archive,'active');assert.equal(filters.sort,'newest');
 assert.equal(memberListUrl(parseMemberListFilters()),'/portal/members');
 assert.equal(memberListUrl(parseMemberListFilters({page:'2'})),'/portal/members?page=2');
 assert.equal(memberSearchWords('Cruz),id.neq.(evil%_*').join(' ').includes('('),false);
 assert.equal(parseMemberListFilters({page:'9000000000000'}).page,100000);
});
function membersHarness({branchIds=['a'],isSystemAdmin=false}={}){
 const reads=[],db={church_branches:[{id:'a',name:'A'},{id:'b',name:'B'}],members:Array.from({length:35},(_,i)=>({id:String(i).padStart(3,'0'),first_name:'Member',middle_name:null,last_name:String(i),church_branch_id:i<25?'a':'b',member_status:'active',account_status:'no_account',profile_status:'incomplete',is_archived:false,created_at:'2026-01-01'}))};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.head=false;this.bounds=null;}
  select(columns,opts){this.columns=columns;this.head=!!opts?.head;return this;}
  eq(k,v){this.filters.push(row=>row[k]===v);return this;}in(k,v){this.filters.push(row=>v.includes(row[k]));return this;}
  order(){return this;}or(value){reads.push({search:value});return this;}range(a,b){this.bounds=[a,b];return this;}
  then(resolve,reject){const rows=db[this.table].filter(row=>this.filters.every(fn=>fn(row)));reads.push({table:this.table,bounds:this.bounds,head:this.head,columns:this.columns});return Promise.resolve({data:this.head?null:(this.bounds?rows.slice(this.bounds[0],this.bounds[1]+1):rows).map(row=>({...row,church_branch:db.church_branches.find(b=>b.id===row.church_branch_id)})),count:rows.length,error:null}).then(resolve,reject);}
 }
 const Page=loadTypeScript('app/portal/members/page.tsx',{
  './access':{requireMembersPermission:async()=>({branchIds,isSystemAdmin,permissions:['members.view']})},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:table=>new Query(table)})},
  'next/navigation':{redirect:()=>{throw Error('Access denied');}},
 }).default;
 return{reads,async content(params={}){const tree=Page({searchParams:Promise.resolve(params)});return tree.props.children.type(tree.props.children.props);}};
}
test('member server pagination returns ten scoped records, exact totals, and no personal detail fields',async()=>{
 const h=membersHarness();const tree=await h.content({page:'2'});
 function find(node){if(!node||typeof node!=='object')return null;if(node.props?.paging)return node.props;for(const child of [node.props?.children].flat(Infinity)){const found=find(child);if(found)return found;}return null;}
 const table=find(tree);assert.equal(table.members.length,10);assert.equal(table.paging.total,25);assert.equal(table.paging.filters.page,2);
 assert.ok(table.members.every(row=>row.church_branch.id==='a'));
 const list=h.reads.find(row=>row.bounds);assert.deepEqual(list.bounds,[10,19]);assert.doesNotMatch(list.columns,/birth_date|phone_number|street_address|photo_url/);
});
test('member paging refuses a caller-selected branch outside current server scope',async()=>{
 const h=membersHarness();await assert.rejects(h.content({branch:'b'}),/Access denied/);assert.ok(!h.reads.some(row=>row.table==='members'));
});


test('session guard denies signed-out users and never returns cached application records',async()=>{
 const {GET}=loadTypeScript('app/api/portal/session/route.ts',{
  '@/lib/auth':{getActiveAccount:async()=>null},
  '@/lib/permissions-server':{getCurrentUserPermissions:async()=>{throw Error('Unexpected lookup');}},
  '@/lib/branch-access':{getUserBranchScope:async()=>{throw Error('Unexpected lookup');}},
 });
 const response=await GET();assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.deepEqual(await response.json(),{error:'Session unavailable'});
});
test('session revision changes on permissions, scope, account, or system-admin capability',()=>{
 const {portalSessionRevision}=loadTypeScript('lib/portal-session-revision.ts');
 const base=portalSessionRevision('user',['members.view'],['a'],false);
 for(const args of [['other',['members.view'],['a'],false],['user',['contributions.view'],['a'],false],['user',['members.view'],['b'],false],['user',['members.view'],['a'],true]])assert.notEqual(portalSessionRevision(...args),base);
 assert.equal(portalSessionRevision('user',['b','a'],['y','x'],false),portalSessionRevision('user',['a','b'],['x','y'],false));
});
