/* eslint-disable @typescript-eslint/no-require-imports -- Actual component regression harness. */
const test = require('node:test'), assert = require('node:assert/strict'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { clientHooks, findElement } = require('./helpers/client-hooks.cjs');

test('shared pagination clamps pages, handles empty results and retains navigation context', () => {
  const { Pagination } = loadTypeScript('components/ui/pagination.tsx');
  const html = renderToStaticMarkup(React.createElement(Pagination, {page:9,pageSize:10,total:12,label:'Records pagination',hrefForPage:p=>`/records?branch=north&page=${p}`}));
  assert.match(html,/Showing 11-12 of 12 records/);assert.match(html,/Page 2 of 2/);
  assert.match(html,/branch=north&amp;page=1/);assert.match(html,/<button[^>]*disabled/);
  assert.equal(renderToStaticMarkup(React.createElement(Pagination,{page:1,pageSize:10,total:0,label:'Empty',onPageChange(){}})), '');
});

test('member status distinguishes unknown values and feedback announces error/success consistently', () => {
  const { MemberStatus } = loadTypeScript('components/ui/member-status.tsx');
  for(const status of ['active','inactive',null]){
    const html=renderToStaticMarkup(React.createElement(MemberStatus,{status}));
    assert.ok(html.includes(`Member status: ${status??'unknown'}`));assert.match(html,/tabindex="0"/);
  }
  const { FeedbackMessage } = loadTypeScript('components/ui/feedback-message.tsx');
  assert.match(renderToStaticMarkup(React.createElement(FeedbackMessage,{},'Failed')),/role="alert"/);
  assert.match(renderToStaticMarkup(React.createElement(FeedbackMessage,{variant:'success'},'Saved')),/role="status"/);
});

test('Contributions cards, chart and comparisons follow combined filters across all pages', () => {
  const h=clientHooks('app/portal/contributions/ContributionsTable.tsx',{'./dashboard-actions':{}});
  const records=Array.from({length:24},(_,i)=>({id:String(i),contributorType:'member',memberName:i<22?'Ana':'Ben',memberId:String(i),churchBranchId:i%2?'b':'a',contributionType:i%2?'other':'tithe',paymentMethod:'cash',amount:'0.10',contributionDate:i<20?'2026-11-05':'2026-10-05'}));
  const props={records,branches:[],canUpdate:false,dashboard:{module:'contributions',from:'2026-11-01',to:'2026-11-30',totals:[],trend:[],breakdown:[],comparison:{from:'2026-10-01',to:'2026-10-31',totals:[]}}};
  const render=()=>h.render(props);
  const summary=tree=>findElement(tree,e=>e.type.name==='ModuleMiniDashboard').props.data;
  let tree=render();assert.equal(summary(tree).totals[0].count,20);assert.equal(summary(tree).totals[0].amount,'2.00');
  findElement(tree,e=>e.props['aria-label']==='Search contributions by contributor name').props.onChange({target:{value:'Ana'}});
  tree=render();findElement(tree,e=>e.props.label==='Contribution Type').props.onChange('tithe');
  tree=render();assert.equal(summary(tree).totals[0].count,10);assert.equal(summary(tree).totals[0].amount,'1.00');assert.equal(summary(tree).comparison.totals[0].amount,'0.10');
  assert.equal(summary(tree).trend[0].value,'1.00');
  findElement(tree,e=>e.props['aria-label']==='Search contributions by contributor name').props.onChange({target:{value:'Missing'}});
  assert.equal(summary(render()).totals[0].count,0);
});

test('Baptism cards follow type/search and keep undated records separate from dated metrics', () => {
  const h=clientHooks('app/portal/baptisms/BaptismsTable.tsx',{'./dashboard-actions':{}});
  const props={records:[{id:'1',memberName:'Ana',baptismType:'water',baptismDate:'2026-11-03',churchBranchId:'a'},{id:'2',memberName:'Ben',baptismType:'holy_ghost',baptismDate:'2026-11-03',churchBranchId:'a'},{id:'3',memberName:'Ana',baptismType:'water',baptismDate:null,churchBranchId:'a'}],branches:[],canUpdate:false,dashboard:{module:'baptisms',from:'2026-11-01',to:'2026-11-30',totals:[],trend:[],breakdown:[]}};
  let tree=h.render(props);findElement(tree,e=>e.props.label==='Baptism Type').props.onChange('water');
  tree=h.render(props);const data=findElement(tree,e=>e.type.name==='ModuleMiniDashboard').props.data;
  assert.equal(data.totals[0].count,1);assert.equal(data.totals[0].water,1);assert.equal(data.totals[0].holyGhost,0);assert.equal(data.totals[0].undated,1);
});

test('filtered money aggregation retains precision above Number safe range', () => {
  const { filteredModuleSummary }=loadTypeScript('lib/filtered-module-summary.ts');
  const base={module:'contributions',from:'2026-11-01',to:'2026-11-30'};
  const rows=['9007199254740999.99','0.02'].map(amount=>({amount,contributionDate:'2026-11-03',contributorType:'anonymous'}));
  assert.equal(filteredModuleSummary(base,rows).totals[0].amount,'9007199254741000.01');
});

test('Services summary uses the complete filtered result rather than its current page', () => {
  const h=clientHooks('app/portal/services/ServicesTable.tsx',{'./ServiceLifecycleActions':{__esModule:true,default:()=>null}});
  const props={services:Array.from({length:23},(_,i)=>({id:String(i),name:`Service ${i}`,churchBranchId:i<12?'a':'b',serviceType:'worship',status:'scheduled',serviceDate:'2026-11-14',startTime:'09:00',branch:null})),branches:[],serviceTypes:[],serviceTypeNames:{},canEdit:false};
  let tree=h.render(props);
  assert.equal(findElement(tree,e=>e.props.label==='Visible Services').props.value,23);
  findElement(tree,e=>e.props['aria-label']==='Filter by branch').props.onChange({target:{value:'a'}});
  tree=h.render(props);assert.equal(findElement(tree,e=>e.props.label==='Visible Services').props.value,12);
  findElement(tree,e=>e.type.name==='Pagination').props.onPageChange(2);
  tree=h.render(props);assert.equal(findElement(tree,e=>e.props.label==='Visible Services').props.value,12);
});

test('Members server cards apply branch, archive, status and search constraints before pagination', async () => {
  const members=[
    {id:'1',first_name:'Ana',middle_name:null,last_name:'Cruz',church_branch_id:'a',is_archived:false,member_status:'active',account_status:'connected',profile_status:'completed'},
    {id:'2',first_name:'Ana',middle_name:null,last_name:'Santos',church_branch_id:'b',is_archived:false,member_status:'active',account_status:'connected',profile_status:'incomplete'},
    {id:'3',first_name:'Ben',middle_name:null,last_name:'Cruz',church_branch_id:'a',is_archived:true,member_status:'inactive',account_status:'no_account',profile_status:'incomplete'},
  ];
  class Query {
    constructor(table){this.rows=table==='members'?members:[{id:'a',name:'North'},{id:'b',name:'South'}];this.filters=[];}
    select(columns,options={}){this.options=options;return this;}
    eq(key,value){this.filters.push(row=>row[key]===value);return this;}
    in(key,values){this.filters.push(row=>values.includes(row[key]));return this;}
    or(expression){const terms=expression.split(',').map(term=>term.split('.ilike.'));this.filters.push(row=>terms.some(([key,value])=>String(row[key]??'').toLowerCase().includes(value.slice(1,-1).toLowerCase())));return this;}
    order(){return this;}range(){return this;}
    then(resolve,reject){const rows=this.rows.filter(row=>this.filters.every(filter=>filter(row)));return Promise.resolve({data:rows,count:rows.length,error:null}).then(resolve,reject);}
  }
  const Page=loadTypeScript('app/portal/members/page.tsx',{'./access':{requireMembersPermission:async()=>({isSystemAdmin:false,branchIds:['a','b'],permissions:[]})},'@/lib/supabase/admin':{createAdminClient:()=>({from:table=>new Query(table)})}}).default;
  const render=async filters=>{const shell=Page({searchParams:Promise.resolve(filters)});return shell.props.children.type(shell.props.children.props);};
  const active=await render({branch:'a',search:'Ana'});
  assert.equal(findElement(active,e=>e.props.label==='Total Members').props.value,1);
  assert.equal(findElement(active,e=>e.props.label==='Connected').props.value,1);
  assert.equal(findElement(active,e=>e.props.label==='Incomplete').props.value,0);
  const archived=await render({branch:'a',archive:'archived',status:'inactive'});
  assert.equal(findElement(archived,e=>e.props.label==='Total Members').props.value,1);
  assert.equal(findElement(archived,e=>e.props.label==='Active Members').props.value,0);
  assert.equal(findElement(archived,e=>e.props.label==='Incomplete').props.value,1);
});
