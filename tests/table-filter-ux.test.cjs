/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

function source(file) { return fs.readFileSync(file, 'utf8'); }

test('Members keeps search, sort and archive state global while status filters live in column headers', () => {
  const table = source('app/portal/members/MembersTable.tsx');
  const toolbar = table.slice(table.indexOf('<div className="flex flex-col gap-3 lg:flex-row'), table.indexOf('<div className="mt-6 overflow-x-auto'));
  assert.match(toolbar, /placeholder="Search members\.\.\."/);
  assert.match(toolbar, /aria-label="Sort members"/);
  assert.match(toolbar, /Filter by archive status/);
  assert.doesNotMatch(toolbar, /memberStatusFilter|accountStatusFilter|profileStatusFilter/);
  for (const label of ['Member Status', 'Account Status', 'Profile Status']) {
    assert.match(table, new RegExp(`<TableColumnFilter label="${label}"`));
  }
  assert.match(table, /<TableHead><ColumnHeading label="Member Status"/);
  assert.match(table, /archiveFilter,\s*sortBy/);
});

test('Member Status filter changes matching rows and clearing it returns all scoped statuses', () => {
  const { matchesMemberStatusFilter } = loadTypeScript('app/portal/members/member-filters.ts');
  const scopedRows = [{ id: 'a', member_status: 'active' }, { id: 'i', member_status: 'inactive' }];
  assert.deepEqual(scopedRows.filter((row) => matchesMemberStatusFilter(row.member_status, 'active')).map((row) => row.id), ['a']);
  assert.deepEqual(scopedRows.filter((row) => matchesMemberStatusFilter(row.member_status, 'all')).map((row) => row.id), ['a', 'i']);
});

test('column filter is keyboard-operable, specific, stateful and clears only its own value', () => {
  const filter = source('components/ui/table-column-filter.tsx');
  const menu = source('components/ui/dropdown-menu.tsx');
  assert.match(filter, /aria-label=\{`Filter \$\{label\}/);
  assert.match(filter, /Active filter: \{activeLabel\}/);
  assert.match(filter, /h-9 w-9/);
  assert.match(filter, /DropdownMenuRadioGroup/);
  assert.match(filter, /onSelect=\{\(\) => onChange\("all"\)\}/);
  assert.match(menu, /DropdownMenuPrimitive\.Portal/);
  assert.match(menu, /focus:bg-accent/);
});

test('column-mapped filters move into Accounts, Services, Attendance, Follow-ups, Contributions and Baptisms headers', () => {
  const cases = [
    ['app/portal/accounts/members/MemberAccountsTable.tsx', ['Linked Member Count', 'Account Status']],
    ['app/portal/accounts/staff/StaffAccountsTable.tsx', ['Role', 'Branch Access', 'Account Status']],
    ['app/portal/services/ServicesTable.tsx', ['Service Type', 'Service Status']],
    ['app/portal/attendance/AttendanceServicesTable.tsx', ['Service Type', 'Service Status']],
    ['app/portal/attendance/AttendanceView.tsx', ['Attendance Status']],
    ['app/portal/follow-ups/FollowUpsTable.tsx', ['Follow-up Method', 'Follow-up Outcome', 'Next Follow-up']],
    ['app/portal/contributions/ContributionsTable.tsx', ['Contribution Type', 'Payment Method']],
    ['app/portal/baptisms/BaptismsTable.tsx', ['Baptism Type']],
  ];
  for (const [file, labels] of cases) {
    const text = source(file);
    for (const label of labels) assert.ok(text.includes(`TableColumnFilter label="${label}"`), `${file} should filter ${label} in its header`);
  }
  assert.match(source('app/portal/services/ServicesTable.tsx'), /aria-label="Filter by branch"/);
  assert.match(source('app/portal/attendance/AttendanceServicesTable.tsx'), /aria-label="Filter attendance by branch"/);
  assert.match(source('app/portal/contributions/ContributionsTable.tsx'), /aria-label="Filter contributions by branch"/);
  assert.match(source('app/portal/baptisms/BaptismsTable.tsx'), /aria-label="Filter baptisms by branch"/);
  assert.match(source('app/portal/attendance/AttendanceServicesTable.tsx'), /aria-label="Filter attendance by service date"/);
  assert.match(source('app/portal/contributions/ContributionsTable.tsx'), /Contributions from date/);
  assert.match(source('app/portal/baptisms/BaptismsTable.tsx'), /Baptisms from date/);
});

test('branch and role administration tables keep their existing unfiltered layouts', () => {
  for (const file of ['app/portal/administration/branches/page.tsx', 'app/portal/administration/roles/page.tsx']) {
    assert.doesNotMatch(source(file), /TableColumnFilter|Filter by/);
  }
});
