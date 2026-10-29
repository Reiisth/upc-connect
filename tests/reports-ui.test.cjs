const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { assembleAnalytics, emptyAnalyticsAggregates } = loadTypeScript('lib/analytics/assemble.ts');
const dates = loadTypeScript('lib/analytics/date-range.ts');
const { parseReportFilters, reportFilterUrl } = loadTypeScript('app/portal/reports/filters.ts');
const { formatReportMoney, formatReportPercent, relativeMoneyCoordinates } = loadTypeScript('app/portal/reports/presentation.ts');
const today = '2026-10-29';
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const branches = [1, 2, 3].map((n) => ({ id: id(n), name: n === 3 ? 'Inaccessible Branch' : `Branch ${n}`, code: null, isActive: true, inactivityThresholdWeeks: n + 2 }));
const withLinks = { 'next/link': { __esModule: true, default: (props) => React.createElement('a', props) } };

function overviewFixture() {
  const result = assembleAnalytics({ aggregates: emptyAnalyticsAggregates(), branches: branches.slice(0, 2), inactivity: [],
    range: dates.resolveAnalyticsDateRange(undefined, today), grouping: 'week', asOfDate: today });
  result.membership.nonArchivedMembers = 108;
  result.membership.storedActiveMembers = 99;
  result.membership.recordsAddedInRange = 2;
  result.membership.recordCreationTrend = [{ periodStart: '2026-10-05', value: 2 }];
  result.attendance.completedServices = 2;
  result.attendance.physicalCheckIns = 12;
  result.attendance.uniqueMembers = 8;
  result.attendance.averagePerService = 6;
  result.attendance.trend = [{ periodStart: '2026-10-05', completedServices: 2, physicalCheckIns: 12, uniqueMembers: 8, averagePerService: 6 }];
  result.attendance.weekly = [{ ...result.attendance.trend[0], weekStart: '2026-10-05', isFinished: true, isPartialRange: false, eligibleMemberCount: null, participationRatePercent: null }];
  result.inactivity = { monitoredMembers: 10, calculableMembers: 9, derivedActiveMembers: 7, derivedInactiveMembers: 2, unknownMembers: 1, inactivePercent: 200 / 9, averageConsecutiveAbsentWeeks: 1.5, oneWeekAwayMembers: 1 };
  result.followUps.total = 6;
  result.followUps.uniqueMembers = 2;
  result.followUps.byOutcome = [{ outcome: 'needs_follow_up', count: 5 }, { outcome: 'resolved', count: 1 }];
  result.followUps.latestMembers = 2;
  result.followUps.latestNeedsFollowUpMembers = 0;
  result.followUps.latestByOutcome = [{ outcome: 'resolved', count: 2 }];
  result.baptisms.undatedRecords = 3;
  result.contributions = { count: 2, totalAmount: '99999999999900.01', averageAmount: '49999999999950.01',
    byContributionType: [{ contributionType: 'love_offering', count: 2, totalAmount: '99999999999900.01', averageAmount: '49999999999950.01' }],
    byPaymentMethod: [{ paymentMethod: 'gcash', count: 2, totalAmount: '99999999999900.01', averageAmount: '49999999999950.01' }],
    trend: [{ periodStart: '2026-10-05', count: 2, totalAmount: '99999999999900.01', averageAmount: '49999999999950.01' }] };
  return result;
}

function stat(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`<dt[^>]*>${escaped}</dt><dd[^>]*>(.*?)</dd>`).exec(html);
  assert.ok(match, `Missing metric ${label}`);
  return match[1];
}

test('URL presets, custom dates and grouping reuse inclusive Manila analytics boundaries', () => {
  for (const [preset, from] of [['last_7_days', '2026-10-23'], ['last_30_days', '2026-09-30'], ['last_90_days', '2026-08-01'], ['year_to_date', '2026-01-01']]) {
    const parsed = parseReportFilters({ range: preset, grouping: 'month' }, today);
    assert.equal(parsed.error, null);
    assert.equal(dates.resolveAnalyticsDateRange(parsed.request.range, today).from, from);
    assert.equal(parsed.values.from, from);
    assert.equal(parsed.request.grouping, 'month');
  }
  const parsed = parseReportFilters({ range: 'custom', from: '2024-02-29', to: '2024-03-01', branch: id(1), grouping: 'day' }, today);
  assert.equal(parsed.error, null);
  const url = reportFilterUrl(parsed.values);
  const params = Object.fromEntries(new URL(url, 'https://local.test').searchParams);
  const restored = parseReportFilters(params, today);
  assert.equal(restored.request.branchId, id(1));
  assert.equal(restored.request.range.from, '2024-02-29');
  assert.equal(restored.request.range.to, '2024-03-01');
  assert.equal(restored.request.grouping, 'day');
  assert.equal(parseReportFilters({}, today).request.branchId, undefined);
});

test('invalid and ambiguous search params cannot execute analytics', () => {
  for (const params of [
    { range: 'custom', from: today, to: '2026-01-01' }, { range: 'custom', from: '2026-02-30', to: today },
    { range: 'custom', from: today }, { range: 'made_up' }, { grouping: 'quarter' }, { branch: 'arbitrary' },
    { branch: [id(1), id(2)] }, { range: ['last_7_days', 'last_90_days'] }, { grouping: ['day', 'month'] },
  ]) {
    const parsed = parseReportFilters(params, today);
    assert.equal(parsed.request, null, JSON.stringify(params));
    assert.ok(parsed.error);
  }
});

test('money formatting preserves cents and arbitrarily large aggregate strings without binary floats', () => {
  for (const [value, expected] of [
    ['0.00', '₱0.00'], ['0.30', '₱0.30'], ['0.1', '₱0.10'], ['12', '₱12.00'],
    ['99999999999900.01', '₱99,999,999,999,900.01'], ['9007199254740993123456.01', '₱9,007,199,254,740,993,123,456.01'],
  ]) assert.equal(formatReportMoney(value), expected);
  for (const value of [null, 'NaN', '1.001', '1e20', '']) assert.equal(formatReportMoney(value), 'Unavailable');
  assert.equal(formatReportPercent(null), 'Unavailable');
  assert.equal(formatReportPercent(0), '0%');
  assert.deepEqual(Array.from(relativeMoneyCoordinates([['0.10', '0.30']])[0]), [33.33, 100]);
  assert.deepEqual(Array.from(relativeMoneyCoordinates([['0.00', null]])[0]), [0, 0]);
});

test('money chart geometry is relative, while tooltips and accessible data retain the original exact value', () => {
  let captured;
  const capture = (props) => { captured = props; return React.createElement('canvas', { role: props.role, 'aria-labelledby': props['aria-labelledby'] }); };
  const Chart = loadTypeScript('app/portal/reports/ReportChart.tsx', { 'react-chartjs-2': { Line: capture, Bar: capture } }).default;
  const amount = '9007199254740993123456.01';
  const html = renderToStaticMarkup(React.createElement(Chart, { title: 'Exact money', labels: ['October'], money: true,
    series: [{ label: 'Contributions', values: [amount] }], emptyMessage: 'No activity' }));
  assert.equal(captured.data.datasets[0].data[0], 100);
  assert.equal(captured.options.scales.y.title.text, 'Relative amount');
  assert.equal(captured.options.plugins.tooltip.callbacks.label({ datasetIndex: 0, dataIndex: 0 }), `Contributions: ${formatReportMoney(amount)}`);
  assert.ok(html.includes(formatReportMoney(amount)));
  assert.ok(html.includes('<details') && html.includes('View chart data'));
  assert.ok(html.includes('role="img"'));
});

test('dashboard displays DTO states separately: stored status, derived status, latest resolution and undated baptisms', () => {
  const Dashboard = loadTypeScript('app/portal/reports/ReportsDashboard.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Dashboard, { overview: overviewFixture() }));
  assert.equal(stat(html, 'Stored Active Members'), '99');
  assert.equal(stat(html, 'Derived Active'), '7');
  assert.equal(stat(html, 'Derived Inactive'), '2');
  assert.equal(stat(html, 'Needs Follow-up · Current'), '0', 'Historical needs do not override latest resolved state');
  assert.equal(stat(html, 'Participation Rate'), 'Unavailable');
  assert.equal(stat(html, 'Baptisms in Period'), '0');
  assert.equal(stat(html, 'Undated Baptism Records'), '3');
  assert.ok(html.includes('₱99,999,999,999,900.01'));
  assert.ok(html.includes('Member Records Added') && !html.includes('Membership Growth'));
  assert.ok(html.includes('present + late') && html.includes('branch’s own threshold'));
  assert.ok(html.includes('Branch Comparison') && !html.includes('Inaccessible Branch'));
  assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
});

test('empty reports render zeros, informative chart empty states and unavailable averages/rates', () => {
  const Dashboard = loadTypeScript('app/portal/reports/ReportsDashboard.tsx').default;
  const overview = assembleAnalytics({ aggregates: emptyAnalyticsAggregates(), branches: [branches[0]], inactivity: [],
    range: dates.resolveAnalyticsDateRange(undefined, today), grouping: 'week', asOfDate: today });
  const html = renderToStaticMarkup(React.createElement(Dashboard, { overview }));
  assert.equal(stat(html, 'Non-archived Members'), '0');
  assert.equal(stat(html, 'Average Contribution'), 'Unavailable');
  assert.equal(stat(html, 'Inactive Among Calculable Members'), 'Unavailable');
  assert.equal(stat(html, 'Participation Rate'), 'Unavailable');
  assert.ok(html.includes('₱0.00') && html.includes('No chart activity'));
  assert.ok(!html.includes('NaN') && !html.includes('Infinity') && !html.includes('>0%<'));
  assert.ok(!html.includes('Branch Comparison') && !html.includes('Attendance by Branch'));
});

function pageHarness({ permissions = ['reports.view'], scopeIds = [id(1), id(2)], isSystemAdmin = false, rpcFailure = false, branchFailure = false } = {}) {
  const calls = { rpc: [], permission: [], branchScope: [] };
  const db = { church_branches: branches.map((branch) => ({ id: branch.id, name: branch.name, code: null, is_active: branch.isActive, inactivity_threshold_weeks: branch.inactivityThresholdWeeks })), members: [] };
  class Query {
    constructor(table) { this.table = table; this.rows = [...db[table]]; }
    select() { return this; }
    in(key, values) { this.rows = this.rows.filter((row) => values.includes(row[key])); return this; }
    eq(key, value) { this.rows = this.rows.filter((row) => row[key] === value); return this; }
    order() { return this; }
    range(from, to) { this.rows = this.rows.slice(from, to + 1); return this; }
    then(resolve, reject) { return Promise.resolve({ data: this.rows, error: branchFailure ? { message: 'PRIVATE_SCHEMA_ERROR' } : null }).then(resolve, reject); }
  }
  const admin = {
    from: (table) => { assert.ok(Object.hasOwn(db, table), `No per-chart source fetch: ${table}`); return new Query(table); },
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: emptyAnalyticsAggregates(), error: rpcFailure ? { message: 'PRIVATE_RPC_ERROR' } : null }; },
  };
  const api = loadTypeScript('lib/analytics/server.ts', {
    'server-only': {},
    '@/lib/permissions-server': { requirePermission: async (permission) => {
      calls.permission.push(permission);
      if (!permissions.includes(permission)) throw new Error('redirect:/access-denied');
      return { user: { id: id(10) }, permissions };
    } },
    '@/lib/branch-access': { getUserBranchScope: async (userId) => { calls.branchScope.push(userId); return { branchIds: scopeIds, isSystemAdmin }; } },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    './date-range': { ...dates, analyticsToday: () => today },
  });
  const Page = loadTypeScript('app/portal/reports/page.tsx', { ...withLinks,
    '@/lib/analytics/server': api,
    '@/lib/analytics/date-range': { ...dates, analyticsToday: () => today },
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
  }).default;
  async function html(params = {}) {
    const element = Page({ searchParams: Promise.resolve(params) });
    assert.equal(element.type, React.Suspense);
    const content = element.props.children;
    return renderToStaticMarkup(await content.type(content.props));
  }
  return { calls, api, html };
}

test('reports.view is required and a custom Reports-only account can use the actual loader and page', async () => {
  const denied = pageHarness({ permissions: ['members.view'] });
  await assert.rejects(denied.html(), /redirect:\/access-denied/);
  assert.equal(denied.calls.branchScope.length, 0);
  assert.equal(denied.calls.rpc.length, 0);
  await assert.rejects(denied.api.getAnalyticsBranchOptions(), /redirect:\/access-denied/);
  const custom = pageHarness();
  const html = await custom.html();
  assert.ok(html.includes('Reports &amp; Analytics'));
  assert.ok(custom.calls.permission.every((key) => key === 'reports.view'));
  assert.equal(custom.calls.rpc.length, 1, 'One analytics request supplies every chart');
});

test('selected and all-branch requests use only scope IDs; system administrator visibility comes exclusively from scope', async () => {
  for (const isSystemAdmin of [false, true]) {
    const h = pageHarness({ scopeIds: [id(2)], isSystemAdmin });
    const html = await h.html();
    assert.deepEqual(Array.from(h.calls.rpc[0].args.p_branch_ids), [id(2)]);
    assert.ok(!html.includes('Branch 1') && !html.includes('Inaccessible Branch'));
  }
  const h = pageHarness();
  const html = await h.html({ branch: id(1), range: 'last_7_days', grouping: 'day' });
  assert.deepEqual(Array.from(h.calls.rpc[0].args.p_branch_ids), [id(1)]);
  assert.equal(h.calls.rpc[0].args.p_from, '2026-10-23');
  assert.equal(h.calls.rpc[0].args.p_grouping, 'day');
  assert.ok(html.includes('Branch 2'), 'Selector retains all accessible options when one branch is selected');
  assert.ok(!html.includes('Branch Comparison'));
  const rejected = pageHarness();
  await assert.rejects(rejected.html({ branch: id(3) }), /redirect:\/access-denied/);
  assert.equal(rejected.calls.rpc.length, 0);
});

test('invalid dates show a repairable filter error, failed loads never display zeros or private errors, and no scope has its own state', async () => {
  const invalid = pageHarness();
  const invalidHtml = await invalid.html({ range: 'custom', from: today, to: '2026-01-01' });
  assert.ok(invalidHtml.includes('Check your report filters'));
  assert.equal(invalid.calls.rpc.length, 0);
  assert.ok(!invalidHtml.includes('Report overview'));
  const failed = await pageHarness({ rpcFailure: true }).html();
  assert.ok(failed.includes('Reports could not be loaded') && failed.includes('Try again'));
  assert.ok(!failed.includes('PRIVATE_RPC_ERROR') && !failed.includes('Report overview'));
  const empty = pageHarness({ scopeIds: [] });
  assert.ok((await empty.html()).includes('No branch access'));
  assert.equal(empty.calls.rpc.length, 0);
  const ErrorPage = loadTypeScript('app/portal/reports/error.tsx').default;
  const errorHtml = renderToStaticMarkup(React.createElement(ErrorPage, { error: new Error('PRIVATE_SCHEMA_ERROR'), reset() {} }));
  assert.ok(errorHtml.includes('temporarily unavailable') && !errorHtml.includes('PRIVATE_SCHEMA_ERROR'));
  await assert.rejects(pageHarness({ branchFailure: true }).html(), (error) => !error.message.includes('PRIVATE_SCHEMA_ERROR'));
});

test('GET filters restore applied values, stack on mobile and enable date controls only for custom ranges', () => {
  const Filters = loadTypeScript('app/portal/reports/ReportFilters.tsx').default;
  const values = parseReportFilters({ branch: id(2), range: 'custom', from: '2026-10-01', to: today, grouping: 'month' }, today).values;
  const html = renderToStaticMarkup(React.createElement(Filters, { branches: branches.slice(0, 2), values }));
  assert.ok(html.includes('action="/portal/reports"') && html.includes('method="get"'));
  assert.ok(html.includes(`value="${id(2)}" selected=""`));
  assert.ok(html.includes('value="custom" selected=""') && html.includes('value="month" selected=""'));
  assert.ok(html.includes('value="2026-10-01"') && html.includes('value="2026-10-29"'));
  assert.ok(!html.includes('disabled=""'));
  const presetHtml = renderToStaticMarkup(React.createElement(Filters, { branches: branches.slice(0, 2), values: parseReportFilters({}, today).values }));
  assert.equal((presetHtml.match(/disabled=""/g) || []).length, 2);
  assert.ok(html.includes('sm:grid-cols-2') && html.includes('xl:grid-cols-4'));
  const Dashboard = loadTypeScript('app/portal/reports/ReportsDashboard.tsx').default;
  const dashboardHtml = renderToStaticMarkup(React.createElement(Dashboard, { overview: overviewFixture() }));
  assert.ok(dashboardHtml.includes('min-w-0') && dashboardHtml.includes('overflow-x-auto'));
  assert.ok(dashboardHtml.includes('aria-label="Report sections"'));
  const loading = loadTypeScript('app/portal/reports/loading.tsx').default;
  assert.ok(renderToStaticMarkup(React.createElement(loading)).includes('Loading reports'));
  for (const file of ['page.tsx', 'ReportsDashboard.tsx', 'ReportChart.tsx', 'ReportFilters.tsx', 'loading.tsx', 'error.tsx']) {
    const source = readFileSync(`app/portal/reports/${file}`, 'utf8');
    assert.ok(!source.includes('dark:'));
    assert.ok(!source.includes('system_admin') && !source.includes('pastor'), 'UI must not authorize by role name');
  }
});
