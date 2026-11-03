/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');
const read=(file)=>readFileSync(file,'utf8');
function header(file){const text=read(file);assert.match(text,/import\s*\{\s*PageHeader\s*\}\s*from\s*["']@\/components\/ui\/page-header["']/);assert.match(text,/<PageHeader\b/);return text;}
test('Profile Fields uses the shared Administration header with a clear route back',()=>{const text=header('app/portal/administration/profile-fields/page.tsx');assert.match(text,/backHref="\/portal\/administration"/);assert.match(text,/eyebrow="Administration"/);assert.match(text,/title="Profile Fields"/);assert.doesNotMatch(text,/<h1\b/);});
test('configuration list pages use shared Administration headers and action slots',()=>{
 const cases=[['app/portal/administration/branches/page.tsx','Church Branches','Add Branch'],['app/portal/administration/departments/page.tsx','Church Departments','Add Department'],['app/portal/administration/service-types/page.tsx','Service Types','Add Service Type'],['app/portal/administration/roles/page.tsx','Roles & Permissions','Add Role']];
 for(const [file,title,action] of cases){const text=header(file);assert.match(text,/backHref="\/portal\/administration"/);assert.match(text,/eyebrow="Administration"/);assert.ok(text.includes(`title="${title}"`)||text.includes(`title="${title.replace('&','&amp;')}"`),file);assert.ok(text.includes(action),`${file} header action`);}
});
test('nested configuration create/edit pages use shared headers and return to their list',()=>{
 const cases=[
  ['app/portal/administration/branches/new/page.tsx','/portal/administration/branches','Church Branches'],['app/portal/administration/branches/[branchId]/edit/page.tsx','/portal/administration/branches','Church Branches'],
  ['app/portal/administration/departments/new/page.tsx','/portal/administration/departments','Church Departments'],['app/portal/administration/departments/[departmentId]/edit/page.tsx','/portal/administration/departments','Church Departments'],
  ['app/portal/administration/service-types/new/page.tsx','/portal/administration/service-types','Service Types'],['app/portal/administration/service-types/[key]/edit/page.tsx','/portal/administration/service-types','Service Types'],
  ['app/portal/administration/roles/new/page.tsx','/portal/administration/roles','Administration'],['app/portal/administration/roles/[roleId]/page.tsx','/portal/administration/roles','Roles & Permissions'],
 ];
 for(const [file,href,eyebrow] of cases){const text=header(file);assert.ok(text.includes(`backHref="${href}"`),file);assert.ok(text.includes(`eyebrow="${eyebrow}"`),file);}
});
test('Administration root keeps its top-level header without a meaningless back link',()=>{const text=header('app/portal/administration/page.tsx');assert.match(text,/title="Administration"/);assert.doesNotMatch(text,/backHref=/);});
test('Staff Branch Access remains under canonical Accounts destinations',()=>{
 const list=header('app/portal/accounts/staff/page.tsx');const detail=header('app/portal/accounts/staff/[userId]/page.tsx');
 assert.ok(list.includes('/portal/accounts'));assert.ok(detail.includes('backHref="/portal/accounts/staff"'));
 const hub=read('app/portal/administration/page.tsx');assert.doesNotMatch(hub,/Staff Branch Access/);
});
