/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
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

test('all three Members column filters change matches and clearing one preserves the other filter values', () => {
  const { matchesMemberColumnFilter } = loadTypeScript('app/portal/members/member-filters.ts');
  const scopedRows = [
    { id: 'a', member_status: 'active', account_status: 'connected', profile_status: 'completed' },
    { id: 'i', member_status: 'inactive', account_status: 'no_account', profile_status: 'incomplete' },
  ];
  const filters = { member_status: 'active', account_status: 'connected', profile_status: 'completed' };
  const filterRows = (activeFilters) => scopedRows.filter((row) =>
    matchesMemberColumnFilter(row.member_status, activeFilters.member_status) &&
    matchesMemberColumnFilter(row.account_status, activeFilters.account_status) &&
    matchesMemberColumnFilter(row.profile_status, activeFilters.profile_status));
  assert.deepEqual(filterRows(filters).map((row) => row.id), ['a']);
  const clearMemberStatus = { ...filters, member_status: 'all' };
  assert.deepEqual(filterRows(clearMemberStatus).map((row) => row.id), ['a']);
  assert.equal(clearMemberStatus.account_status, 'connected');
  assert.equal(clearMemberStatus.profile_status, 'completed');
  assert.deepEqual(filterRows({ ...filters, account_status: 'no_account' }), []);
  assert.deepEqual(filterRows({ ...filters, profile_status: 'incomplete' }), []);
  assert.deepEqual(filterRows({ member_status: 'all', account_status: 'all', profile_status: 'all' }).map((row) => row.id), ['a', 'i']);
});

test('actual MembersTable preserves headers and all filter buttons for a nonempty dataset with zero visible rows', () => {
  const component = loadTypeScript('app/portal/members/MembersTable.tsx', {
    './actions': { disconnectMember: async () => {} },
    './MemberArchiveControl': { MemberArchiveControl: () => null },
    './MemberCardModal': { __esModule: true, default: () => null },
  }).default;
  const archivedMember = {
    id: 'archived', first_name: 'A', middle_name: null, last_name: 'Member', nickname: null,
    birth_date: null, gender: null, phone_number: null, email: null, zone: null, civil_status: null,
    street_address: null, barangay: null, city: null, province: null, country: null, photo_url: null,
    position: null, member_status: 'active', account_status: 'connected', profile_status: 'completed',
    created_at: '2026-01-01', is_archived: true, department: null, church_branch: null,
  };
  const html = renderToStaticMarkup(React.createElement(component, {
    members: [archivedMember], canArchive: false, canLinkAccount: false,
  }));
  assert.ok(html.includes('No members match the current filters.'));
  for (const label of ['Member Status', 'Account Status', 'Profile Status']) {
    assert.ok(html.includes(`Filter ${label}`), `missing rendered ${label} filter`);
  }
  assert.ok(html.includes('<thead'));
  assert.equal((html.match(/aria-haspopup="menu"/g) ?? []).length, 3);
  assert.ok(html.includes('Search members...'));
  assert.ok(html.includes('Sort members'));
  assert.ok(html.includes('Filter by archive status'));
});

test('true zero-record Members dataset still uses the ordinary empty state', () => {
  const table = source('app/portal/members/MembersTable.tsx');
  assert.match(table, /members\.length === 0 \? \(/);
  assert.match(table, /filteredMembers\.length === 0 \? \(/);
  assert.match(table, /No members match the current filters\./);
  assert.match(table, /title="No members found"/);
});

test('Phase 2F tables retain headers when their nonempty source dataset filters to zero rows', () => {
  const cases = [
    ['app/portal/accounts/members/MemberAccountsTable.tsx', 'displayedAccounts', 5, 'filteredAccounts'],
    ['app/portal/accounts/staff/StaffAccountsTable.tsx', 'accounts', 8, 'filteredAccounts'],
    ['app/portal/services/ServicesTable.tsx', 'services', 7, 'filteredServices'],
    ['app/portal/attendance/AttendanceServicesTable.tsx', 'services', 7, 'filteredServices'],
    ['app/portal/attendance/AttendanceView.tsx', 'rows', 6, 'filteredRows'],
    ['app/portal/follow-ups/FollowUpsTable.tsx', 'rows', 8, 'filtered'],
    ['app/portal/contributions/ContributionsTable.tsx', 'records', 9, 'filteredRecords'],
    ['app/portal/baptisms/BaptismsTable.tsx', 'records', 8, 'filteredRecords'],
  ];
  for (const [file, dataset, columns, filtered] of cases) {
    const text = source(file);
    assert.ok(text.includes(`${dataset}.length === 0`) || text.includes(`!${dataset}.length`), `${file} must branch on its source dataset`);
    assert.ok(text.includes(`${filtered}.length === 0`) || text.includes(`!${filtered}.length`), `${file} must render the filtered empty row`);
    assert.ok(text.includes(`colSpan={${columns}}`), `${file} must span its table columns`);
  }
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
