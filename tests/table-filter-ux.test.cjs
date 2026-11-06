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
  assert.match(table, /className="block w-full text-left font-medium/);
  assert.match(table, /className="flex w-full flex-col items-start gap-1 text-left"/);
});

test('Phase 2F tables retain headers when their nonempty source dataset filters to zero rows', () => {
  const cases = [
    ['app/portal/accounts/members/MemberAccountsTable.tsx', 'displayedAccounts', 5, 'filteredAccounts'],
    ['app/portal/accounts/staff/StaffAccountsTable.tsx', 'accounts', 8, 'filteredAccounts'],
    ['app/portal/services/ServicesTable.tsx', 'services', 4, 'filteredServices'],
    ['app/portal/attendance/AttendanceServicesTable.tsx', 'services', 3, 'filteredServices'],
    ['app/portal/attendance/AttendanceView.tsx', 'rows', 6, 'filteredRows'],
    ['app/portal/follow-ups/FollowUpsTable.tsx', 'rows', 8, 'filtered'],
    ['app/portal/contributions/ContributionsTable.tsx', 'records', 9, 'filteredRecords'],
    ['app/portal/baptisms/BaptismsTable.tsx', 'records', 7, 'filteredRecords'],
  ];
  for (const [file, dataset, columns, filtered] of cases) {
    const text = source(file);
    assert.ok(text.includes(`${dataset}.length === 0`) || text.includes(`!${dataset}.length`) || text.includes(`!${dataset}.some(service => service.status === group)`), `${file} must branch on its source dataset`);
    assert.ok(text.includes(`${filtered}.length === 0`) || text.includes(`!${filtered}.length`) || text.includes(`${filtered}.filter(service => service.status === group).length === 0`), `${file} must render the filtered empty row`);
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
    ['app/portal/attendance/AttendanceServicesTable.tsx', ['Service Type']],
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

test('filtered tables share the Services clear action and preserve broader context', () => {
  const clearButton = source('components/ui/clear-filters-button.tsx');
  assert.match(clearButton, /variant="ghost"/);
  assert.match(clearButton, /text-slate-500 hover:bg-transparent hover:text-\[#203264\] hover:underline/);
  assert.match(clearButton, /type="button"/);
  for (const file of [
    'app/portal/services/ServicesTable.tsx',
    'app/portal/members/MembersTable.tsx',
    'app/portal/accounts/members/MemberAccountsTable.tsx',
    'app/portal/accounts/staff/StaffAccountsTable.tsx',
    'app/portal/attendance/AttendanceServicesTable.tsx',
    'app/portal/attendance/AttendanceView.tsx',
    'app/portal/follow-ups/FollowUpsTable.tsx',
    'app/portal/contributions/ContributionsTable.tsx',
    'app/portal/baptisms/BaptismsTable.tsx',
  ]) {
    assert.match(source(file), /ClearFiltersButton/ , `${file} should use the shared action`);
    assert.match(source(file), /hasClearableFilters|hasFilters/ , `${file} should show the action only when filters are active`);
  }
  const members = source('app/portal/members/MembersTable.tsx');
  assert.match(members, /function clearFilters\(\)\s*\{\s*setSearch\(""\);\s*setMemberStatusFilter\("all"\);\s*setAccountStatusFilter\("all"\);\s*setProfileStatusFilter\("all"\);/);
  assert.match(members, /archiveFilter,\s*sortBy/);
  const memberAccounts = source('app/portal/accounts/members/MemberAccountsTable.tsx');
  assert.match(memberAccounts, /const hasClearableFilters = search\.trim\(\) !== "" \|\| memberCountFilter !== "all"/);
  assert.doesNotMatch(memberAccounts.slice(memberAccounts.indexOf('function clearFilters'), memberAccounts.indexOf('\n  }', memberAccounts.indexOf('function clearFilters'))), /setStatusFilter/);
  for (const file of ['app/portal/contributions/ContributionsTable.tsx', 'app/portal/baptisms/BaptismsTable.tsx']) {
    const text = source(file);
    assert.match(text, /setDateFrom\(event\.target\.value\)/);
    assert.match(text, /setDateTo\(event\.target\.value\)/);
    assert.doesNotMatch(text.slice(text.indexOf('function clearFilters'), text.indexOf('\n  }', text.indexOf('function clearFilters'))), /setDateFrom|setDateTo/);
  }
  const followUps = source('app/portal/follow-ups/FollowUpsTable.tsx');
  assert.match(followUps, /current, search: "", branch: "", method: "", outcome: "", due: "all"/);
  assert.doesNotMatch(followUps.slice(followUps.indexOf('function clearFilters'), followUps.indexOf('\n  }', followUps.indexOf('function clearFilters'))), /dateFrom|dateTo/);
});

test('Login uses the canonical shared Input and keeps password visibility custom', () => {
  const login = source('app/login/page.tsx');
  assert.match(login, /import \{ Input \} from "@\/components\/ui\/input"/);
  assert.equal((login.match(/<Input/g) ?? []).length, 2);
  assert.match(login, /aria-invalid=\{Boolean\(emailError\) \|\| undefined\}/);
  assert.match(login, /className="pr-12"/);
  assert.match(login, /aria-label=\{\s*showPassword\s*\?/);
  assert.match(login, /<Button\s+type="submit"/);
});

test('shared form controls use login focus, radius and disabled/error states', () => {
  const input = source('components/ui/input.tsx');
  const textarea = source('components/ui/textarea.tsx');
  const select = source('components/ui/select.tsx');
  assert.match(input, /h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3/);
  assert.match(input, /focus-visible:ring-4 focus-visible:ring-\[#5D94E8\]\/10/);
  assert.match(input, /aria-invalid:border-red-400/);
  assert.match(input, /disabled:cursor-not-allowed/);
  for (const control of [textarea, select]) {
    assert.match(control, /rounded-xl border border-slate-300 bg-white/);
    assert.match(control, /focus-visible:ring-4 focus-visible:ring-\[#5D94E8\]\/10/);
    assert.match(control, /disabled:cursor-not-allowed/);
  }
});
