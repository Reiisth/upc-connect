/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const accounts=[{userId:'b',email:'z@example.test',members:['One'],archivedAt:null,canChangeAccount:true},{userId:'a',email:'a@example.test',members:['Two','Three'],archivedAt:null,canChangeAccount:true},{userId:'c',email:'old@example.test',members:['Four'],archivedAt:'2026-01-01',canChangeAccount:true}];
function render(overrides={}){
 let index=0;
 const Table=loadTypeScript('app/portal/accounts/members/MemberAccountsTable.tsx',{
  react:{...React,useEffect:()=>{},useMemo:fn=>fn(),useState:initial=>{const i=index++;return [Object.hasOwn(overrides,i)?overrides[i]:initial,()=>{}];}},
  './actions':{archiveMemberAccount:async()=>{},restoreMemberAccount:async()=>{}},
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  '@/components/ui/confirm-action-modal':{ConfirmActionModal:()=>null},
  '@/components/ui/table-column-filter':{TableColumnFilter:({label})=>React.createElement('button',null,'Filter '+label)},
 }).default;
 return renderToStaticMarkup(React.createElement(Table,{accounts,canArchive:true,canRestore:true,canLinkAccount:true}));
}
test('member accounts default to active email order and combine status with email',()=>{
 const html=render();assert.ok(html.indexOf('a@example.test')<html.indexOf('z@example.test'));
 assert.doesNotMatch(html,/old@example.test/);assert.match(html,/Account status: Active/);
 assert.match(html,/Email<button>Filter Account Status/);assert.doesNotMatch(html,/>Status<\/th>/);
 assert.match(html,/a@example.test<svg/);assert.match(html,/Sort member accounts/);
});
test('member account sorting applies after search and status filtering',()=>{
 const descending=render({2:'email-desc'});assert.ok(descending.indexOf('z@example.test')<descending.indexOf('a@example.test'));
 const counts=render({2:'members-desc'});assert.ok(counts.indexOf('a@example.test')<counts.indexOf('z@example.test'));
 const archived=render({3:'archived'});assert.match(archived,/old@example.test/);assert.doesNotMatch(archived,/z@example.test/);assert.match(archived,/Account status: Archived/);
 const search=render({0:'Three'});assert.match(search,/a@example.test/);assert.doesNotMatch(search,/z@example.test/);
});


test('account status is circular when collapsed and filters expose the clear action',()=>{
 const normal=render();assert.match(normal,/inline-flex h-3 shrink-0/);assert.match(normal,/h-3 w-3 shrink-0/);
 assert.match(normal,/Email: A to Z/);assert.match(normal,/Email: Z to A/);assert.doesNotMatch(normal,/A\?Z|Z\?A/);
 assert.doesNotMatch(normal,/>Clear filters</);
 for(const filters of [{0:'Three'},{1:'multiple'},{3:'archived'},{2:'email-desc'}])assert.match(render(filters),/Clear filters/);
});
