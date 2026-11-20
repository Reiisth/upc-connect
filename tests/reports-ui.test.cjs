/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS regression harness */
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
  result.membersAtEndDate = 108;
  result.membership.nonArchivedMembers = 108;
  result.membership.storedActiveMembers = 99;
  result.membership.storedInactiveMembers = 9;
  result.membership.recordsAddedInRange = 2;
  result.membership.recordCreationTrend = [{ periodStart: '2026-10-05', value: 2 }];
  result.attendance.completedServices = 2;
  result.attendance.physicalCheckIns = 12;
  result.attendance.uniqueMembers = 8;
  result.attendance.averagePerService = 6;
  result.attendance.trend = [{ periodStart: '2026-10-05', completedServices: 2, physicalCheckIns: 12, uniqueMembers: 8, averagePerService: 6 }];
  result.attendance.weekly = [{ ...result.attendance.trend[0], weekStart: '2026-10-05', isFinished: true, isPartialRange: false, eligibleMemberCount: null, participationRatePercent: null }];
  result.inactivity = { monitoredMembers: 10, calculableMembers: 9, monitoringMembers: 7, needsFollowUpMembers: 2, unknownMembers: 1, needsFollowUpPercent: 200 / 9, averageConsecutiveAbsentWeeks: 1.5, approachingFollowUpThreshold: 1 };
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

test('featured member card uses cumulative end-date totals for its value, growth and sparkline', () => {
  let sparkline;
  const MembershipCard = loadTypeScript('app/portal/reports/MembershipOverviewCard.tsx', {
    '@/components/ui/sparkline': { Sparkline: props => { sparkline = props; return React.createElement('svg', { 'aria-label': props.label }); } },
  }).default;
  const overview = overviewFixture(), previous = overviewFixture();
  previous.membersAtEndDate = 106;
  previous.membership.recordsAddedInRange = 40; // Period additions are not the growth denominator.
  const render = () => renderToStaticMarkup(React.createElement(MembershipCard, { overview, previous, departures: 4 }));
  let html = render();
  assert.match(html, />108<\/p>/);assert.doesNotMatch(html, />2<\/p>/);
  assert.equal(stat(html,'New Members'),'2');assert.equal(stat(html,'Departures'),'4');
  assert.doesNotMatch(html,/lucide-users-round/);
  assert.match(html, /Membership growth: \+1.9% vs previous period/);
  assert.match(sparkline.label, /2026-09-30 to 2026-10-29, ending at 108/);
  assert.deepEqual(Array.from(sparkline.values), [106,106,108,108,108,108]);
  assert.equal(sparkline.previousValues.at(-1),106);
  assert.match(html,/As of <time[^>]*>Oct 29, 2026<\/time>/);
  assert.match(html,/Grey comparison/);
  overview.membersAtEndDate = 54;
  overview.membership.recordCreationTrend = [{periodStart:'2026-10-12',value:4}];
  html = render();assert.match(html, />54<\/p>/);assert.match(html, /49.1% vs previous period/);
  assert.deepEqual(Array.from(sparkline.values), [50,50,50,54,54,54]);
  overview.membership.recordsAddedInRange = 0;overview.membership.recordCreationTrend = [];
  html = render();assert.match(html, />54<\/p>/);
  assert.deepEqual(Array.from(sparkline.values), [54,54,54,54,54,54]);
  overview.membersAtEndDate = 0;previous.membersAtEndDate = 0;
  html = render();assert.match(html, /0% vs previous period/);assert.doesNotMatch(html,/NaN|Infinity/);
  overview.membersAtEndDate = 3;
  html = render();assert.match(html, /\+3 vs previous period/);assert.doesNotMatch(html,/NaN|Infinity/);
  html = renderToStaticMarkup(React.createElement(MembershipCard,{overview,previous:null}));
  assert.match(html,/No previous comparison/);
  assert.equal(stat(html,'Departures'),'Unavailable');
});

test('analytics overview and section metrics omit the removed card footnotes', () => {
  const Dashboard = loadTypeScript('app/portal/reports/ReportsDashboard.tsx', {
    './ReportDashboardGroups': { __esModule: true, default: ({groups}) => React.createElement('div',null,...groups.map(group=>group.content)) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Dashboard,{overview:overviewFixture()}));
  for (const text of ['Current non-archived members','In the selected period','Physical attendance at completed services','Recorded in the selected period','Includes Member, Visitor, and Anonymous contributions','Current Member Status','Current archive state']) assert.ok(!html.includes(text),text);
  assert.match(html,/role="img" aria-label="Total members from/);assert.match(html,/Member Registrations/);
  assert.equal(stat(html,'Inactive Members'),'9');
});

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
    ['0.00', '\u20b10.00'], ['0.30', '\u20b10.30'], ['0.1', '\u20b10.10'], ['12', '\u20b112.00'],
    ['99999999999900.01', '\u20b199,999,999,999,900.01'], ['9007199254740993123456.01', '\u20b19,007,199,254,740,993,123,456.01'],
  ]) assert.equal(formatReportMoney(value), expected);
  for (const value of [null, 'NaN', '1.001', '1e20', '']) assert.equal(formatReportMoney(value), 'Unavailable');
  assert.equal(formatReportPercent(null), 'Unavailable');
  assert.equal(formatReportPercent(0), '0%');
  assert.deepEqual(Array.from(relativeMoneyCoordinates([['0.10', '0.30']])[0]), [33.33, 100]);
  assert.deepEqual(Array.from(relativeMoneyCoordinates([['0.00', null]])[0]), [0, 0]);
});

test('explicit relative money chart retains exact values in tooltips and accessible data', () => {
  let captured;
  const capture = (props) => { captured = props; return React.createElement('canvas', { role: props.role, 'aria-labelledby': props['aria-labelledby'] }); };
  const Chart = loadTypeScript('app/portal/reports/ReportChart.tsx', { 'react-chartjs-2': { Line: capture, Bar: capture } }).default;
  const amount = '9007199254740993123456.01';
  const html = renderToStaticMarkup(React.createElement(Chart, { title: 'Exact money', labels: ['October'], money: true, moneyScale: 'relative',
    series: [{ label: 'Contributions', values: [amount] }], emptyMessage: 'No activity' }));
  assert.equal(captured.data.datasets[0].data[0], 100);
  assert.equal(captured.options.scales.y.title.text, 'Relative amount');
  assert.equal(captured.options.plugins.tooltip.callbacks.label({ datasetIndex: 0, dataIndex: 0 }), `Contributions: ${formatReportMoney(amount)}`);
  assert.ok(html.includes(formatReportMoney(amount)));
  assert.ok(html.includes('aria-expanded="false"') && html.includes('View chart data'));
  assert.ok(html.includes('role="img"'));
});

test('dashboard displays DTO states separately: stored status, derived status, latest resolution and undated baptisms', () => {
  const Dashboard = loadTypeScript('app/portal/reports/ReportsDashboard.tsx', {
    './ReportDashboardGroups': { __esModule: true, default: ({ groups }) => React.createElement('div', null, ...groups.map(group => group.content)) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(Dashboard, { overview: overviewFixture() }));
  assert.equal(stat(html, 'Active Members'), '99');
  assert.equal(stat(html, 'Monitoring'), '7');
  assert.equal(stat(html, 'Needs Follow-up'), '2');
  assert.equal(stat(html, 'Needs Follow-up \u00b7 Current'), '0', 'Historical needs do not override latest resolved state');
  assert.doesNotMatch(html, /Weekly Participation|Participation Rate/);
  assert.equal(stat(html, 'Baptisms in Period'), '0');
  assert.equal(stat(html, 'Undated Baptism Records'), '3');
  assert.ok(html.includes('\u20b199,999,999,999,900.01'));
  assert.ok(!html.includes('present only') && !html.includes('never set administrative Member Status'));
  assert.ok(html.includes('Branch Comparison') && !html.includes('Inaccessible Branch'));
});

test('empty reports render zeros, informative chart empty states and unavailable averages/rates', () => {
  const Dashboard = loadTypeScript('app/portal/reports/ReportsDashboard.tsx', {
    './ReportDashboardGroups': { __esModule: true, default: ({ groups }) => React.createElement('div', null, ...groups.map(group => group.content)) },
  }).default;
  const overview = assembleAnalytics({ aggregates: emptyAnalyticsAggregates(), branches: [branches[0]], inactivity: [],
    range: dates.resolveAnalyticsDateRange(undefined, today), grouping: 'week', asOfDate: today });
  const html = renderToStaticMarkup(React.createElement(Dashboard, { overview }));
  assert.equal(stat(html, 'Non-archived Members'), '0');
  assert.equal(stat(html, 'Average Contribution'), 'Unavailable');
  assert.equal(stat(html, 'Needs Follow-up Among Calculable Members'), 'Unavailable');
  assert.ok(html.includes('\u20b10.00') && html.includes('No chart activity'));
  assert.ok(!html.includes('Branch Comparison') && !html.includes('Attendance by Branch'));
});

test('service type report labels resolve current names while report data retains stable keys', () => {
  const { formatServiceType } = loadTypeScript('app/portal/services/types.ts');
  const grouped = { serviceType: 'midweek_service', physicalCheckIns: 4 };
  assert.equal(formatServiceType(grouped.serviceType, { midweek_service: 'Wednesday Worship' }), 'Wednesday Worship');
  assert.equal(grouped.serviceType, 'midweek_service');
});

function pageHarness({ permissions = ['reports.view'], scopeIds = [id(1), id(2)], isSystemAdmin = false, rpcFailure = false, branchFailure = false, migrationFailure = false, selectedBranch = null } = {}) {
  const calls = { rpc: [], permission: [], branchScope: [], migrations: [], statuses: [] };
  const db = { church_branches: branches.map((branch) => ({ id: branch.id, name: branch.name, code: null, is_active: branch.isActive, inactivity_threshold_weeks: branch.inactivityThresholdWeeks })), members: [], service_types: [{ key: 'prayer_meeting', name: 'Wednesday Prayer', is_active: true }] };
  class Query {
    constructor(table) { this.table = table; this.rows = [...db[table]]; }
    select(_columns, options = {}) { this.options = options; return this; }
    in(key, values) { this.rows = this.rows.filter((row) => values.includes(row[key])); return this; }
    eq(key, value) { this.rows = this.rows.filter((row) => row[key] === value); return this; }
    lte(key, value) { this.rows = this.rows.filter(row => row[key] != null && Date.parse(row[key]) <= Date.parse(value)); return this; }
    order() { return this; }
    range(from, to) { this.rows = this.rows.slice(from, to + 1); return this; }
    then(resolve, reject) { return Promise.resolve({ data: this.options.head ? null : this.rows, count: this.options.count ? this.rows.length : null, error: branchFailure ? { message: 'PRIVATE_SCHEMA_ERROR' } : null }).then(resolve, reject); }
  }
  const admin = {
    from: (table) => { assert.ok(Object.hasOwn(db, table), `No per-chart source fetch: ${table}`); return new Query(table); },
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: emptyAnalyticsAggregates(), error: rpcFailure ? { message: 'PRIVATE_RPC_ERROR' } : null }; },
  };
  const api = loadTypeScript('lib/analytics/server.ts', {
    'server-only': {},
    '@/lib/portal-branch-server': {getPortalBranchId:async()=>selectedBranch},
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
    '@/lib/dashboard-services':{getDashboardServiceOverview:async()=>({branchName:'All branches',branchNames:[],multipleBranches:false,state:'empty',services:[],scheduledTotal:0})},
    '@/lib/portal-branch-server': {getPortalBranchId:async()=>selectedBranch},
    './actions': { generateReportInsights: () => assert.fail('Normal Reports rendering must not request AI insights') },
    '@/lib/analytics/server': {...api,getMostAttendedService:async()=>null,getMemberStatusHistory:async request=>{calls.statuses.push(request);return null;}},
    '@/lib/member-migrations/server': { getMigrationAnalytics: async request => {
      calls.migrations.push(request);
      if (migrationFailure) throw new Error('PRIVATE_MIGRATION_ERROR');
      return {trackingStartedAt:'2026-11-16T00:00:00Z',totals:{events:0,members:0,transfers:0,incoming:0,outgoing:0,departures:0,returns:0,net:0},trend:[],branches:[],flows:[]};
    } },
    '@/lib/analytics/date-range': { ...dates, analyticsToday: () => today },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
  }).default;
  async function html(params = {}) {
    const element = Page({ searchParams: Promise.resolve(params) });
    assert.equal(element.type, React.Suspense);
    const content = element.props.children;
    const page = await content.type(content.props);
    const view = React.Children.toArray(page.props.children).at(-1);
    calls.insightFilters = view.props.insightFilters;
    return renderToStaticMarkup(page);
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
  assert.ok(html.includes('Dashboard'));
  assert.ok(html.includes('AI Decision Support') && html.includes('Generate AI Insights'));
  assert.ok(custom.calls.permission.every((key) => key === 'reports.view'));
  assert.equal(custom.calls.rpc.length, 2, 'One current aggregation and one previous-period aggregation supply all cards');
  const [current, previous] = custom.calls.rpc.map(call => call.args);
  const time = date => Date.parse(`${date}T00:00:00Z`);
  assert.equal(time(current.p_from) - time(previous.p_to), 86400000);
  assert.equal(time(current.p_to) - time(current.p_from), time(previous.p_to) - time(previous.p_from));
  assert.deepEqual(Array.from(current.p_branch_ids), Array.from(previous.p_branch_ids));
});

test('dashboard migration tab shares applied filters and replaces Weekly Participation without a header shortcut', async () => {
  const h=pageHarness({selectedBranch:id(1)});
  const html=await h.html({branch:id(1),range:'custom',from:'2026-10-01',to:'2026-10-29',grouping:'day'});
  assert.match(html,/Migration Analytics/);assert.doesNotMatch(html,/Weekly Participation|href="\/portal\/reports\/migrations"/);
  assert.equal(h.calls.migrations.length,1);
  assert.equal(h.calls.migrations[0].branchId,id(1));assert.equal(h.calls.migrations[0].grouping,'day');
  assert.deepEqual({...h.calls.migrations[0].range},{preset:'custom',from:'2026-10-01',to:'2026-10-29'});
  const failed=await pageHarness({migrationFailure:true}).html();
  assert.match(failed,/Dashboard/);assert.doesNotMatch(failed,/Dashboard could not be loaded|PRIVATE_MIGRATION_ERROR/);
  const invalid=pageHarness();await invalid.html({range:'custom',from:'bad',to:'bad'});assert.equal(invalid.calls.migrations.length,0);
});

test('migration tab renders the shared movement panel and isolates missing migration data',()=>{
  const {findElement}=require('./helpers/client-hooks.cjs');const charts=[];
  const Dashboard=loadTypeScript('app/portal/reports/ReportsDashboard.tsx',{
    './ReportChart':{__esModule:true,default:props=>{charts.push(props);return null;}},
  }).default;
  const overview=overviewFixture();
  const migration={trackingStartedAt:'2026-11-16T00:00:00Z',totals:{events:3,members:2,transfers:2,incoming:1,outgoing:2,departures:1,returns:0,net:-2},trend:[{periodStart:'2026-10-05',incoming:1,outgoing:2,departures:1,returns:0}],branches:[],flows:[]};
  const groups=data=>findElement(Dashboard({overview,migration:data}),e=>e.type.name==='ReportDashboardGroups').props.groups;
  const items=groups(migration);assert.equal(items[2].id,'migrations');assert.ok(!items.some(group=>group.id==='weekly'));
  const html=renderToStaticMarkup(items[2].content);
  assert.match(html,/Net Movement|Departures/);assert.match(html,/Distinct Members Moved/);assert.doesNotMatch(html,/<form/);
  assert.equal(charts[0].title,'Member Movement Over Time');assert.equal(charts[0].series[2].values[0],1);
  const failure=renderToStaticMarkup(groups(null)[2].content);
  assert.match(failure,/role="alert"/);assert.match(failure,/Migration analytics could not be loaded/);assert.doesNotMatch(failure,/PRIVATE_|Transfer Events/);
});

test('selected and all-branch requests use only scope IDs; system administrator visibility comes exclusively from scope', async () => {
  for (const isSystemAdmin of [false, true]) {
    const h = pageHarness({ scopeIds: [id(2)], isSystemAdmin });
    const html = await h.html();
    assert.deepEqual(Array.from(h.calls.rpc[0].args.p_branch_ids), [id(2)]);
    assert.ok(!html.includes('Branch 1') && !html.includes('Inaccessible Branch'));
  }
  const h = pageHarness({selectedBranch:id(1)});
  const html = await h.html({ branch: id(1), range: 'last_7_days', grouping: 'day' });
  assert.deepEqual(Array.from(h.calls.rpc[0].args.p_branch_ids), [id(1)]);
  assert.equal(h.calls.rpc[0].args.p_from, '2026-10-23');
  assert.equal(h.calls.rpc[0].args.p_grouping, 'day');
  assert.equal(h.calls.insightFilters.branchId, id(1));
  assert.equal(h.calls.insightFilters.range.preset, 'custom', 'Generation freezes the dates actually shown by Reports');
  assert.equal(h.calls.insightFilters.range.from, h.calls.rpc[0].args.p_from);
  assert.equal(h.calls.insightFilters.range.to, h.calls.rpc[0].args.p_to);
  assert.equal(h.calls.insightFilters.grouping, 'day');
  assert.ok(!html.includes('name="branch"'), 'Branch selection belongs to the top bar');
  assert.ok(!html.includes('Branch Comparison'));
  const rejected = pageHarness();
  await rejected.html({ branch: id(3) });
  assert.deepEqual(Array.from(rejected.calls.rpc[0].args.p_branch_ids),[id(1),id(2)], 'URL branch is ignored; only authorized shared context applies');
});

test('invalid dates show a repairable filter error, failed loads never display zeros or private errors, and no scope has its own state', async () => {
  const invalid = pageHarness();
  const invalidHtml = await invalid.html({ range: 'custom', from: today, to: '2026-01-01' });
  assert.ok(invalidHtml.includes('Check your dashboard filters'));
  assert.equal(invalid.calls.rpc.length, 0);
  assert.ok(!invalidHtml.includes('Dashboard overview'));
  const failed = await pageHarness({ rpcFailure: true }).html();
  assert.ok(failed.includes('Dashboard could not be loaded') && failed.includes('Try again'));
  assert.ok(!failed.includes('PRIVATE_RPC_ERROR') && !failed.includes('Dashboard overview'));
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
  assert.ok(!html.includes('name="branch"'));
  assert.ok(html.includes('value="custom" selected=""') && html.includes('value="month" selected=""'));
  assert.ok(html.includes('value="2026-10-01"') && html.includes('value="2026-10-29"'));
  assert.ok(!html.includes('disabled=""'));
  const presetHtml = renderToStaticMarkup(React.createElement(Filters, { branches: branches.slice(0, 2), values: parseReportFilters({}, today).values }));
  assert.equal((presetHtml.match(/disabled=""/g) || []).length, 2);
  assert.ok(html.includes('sm:grid-cols-2') && html.includes('xl:grid-cols-3'));
  const Dashboard = loadTypeScript('app/portal/reports/ReportsDashboard.tsx').default;
  const dashboardHtml = renderToStaticMarkup(React.createElement(Dashboard, { overview: overviewFixture() }));
  assert.ok(dashboardHtml.includes('min-w-0') && dashboardHtml.includes('role="tabpanel"'));
  assert.ok(dashboardHtml.includes('aria-label="Dashboard sections"'));
  assert.doesNotMatch(dashboardHtml,/href="#ai-decision-support"/);
  const loading = loadTypeScript('app/portal/reports/loading.tsx').default;
  assert.ok(renderToStaticMarkup(React.createElement(loading)).includes('Loading dashboard'));
  for (const file of ['page.tsx', 'ReportsDashboard.tsx', 'ReportChart.tsx', 'ReportFilters.tsx', 'ReportsView.tsx', 'DecisionSupportSection.tsx', 'loading.tsx', 'error.tsx']) {
    const source = readFileSync(`app/portal/reports/${file}`, 'utf8');
    assert.ok(!source.includes('dark:'));
    assert.ok(!source.includes('system_admin') && !source.includes('pastor'), 'UI must not authorize by role name');
  }
});

test('report tickers show direction, zero baseline and unavailable comparison without losing exact money', () => {
  const Ticker = loadTypeScript('app/portal/reports/ReportComparisonTicker.tsx').default;
  const render = (current, previous) => renderToStaticMarkup(React.createElement(Ticker, { comparison: { current, previous } }));
  assert.ok(render(20, 10).includes('up 100% vs previous period'));
  assert.ok(render(5, 10).includes('down 50% vs previous period'));
  assert.ok(render(1, 0).includes('Previous value was 0'));
  assert.ok(render(1, null).includes('No previous comparison'));
  assert.ok(render('99999999999900.02', '99999999999900.01').includes('0% vs previous period'));
});


test('membership status history renders tracked zeros and unavailable dates with accessible data',()=>{
 const Dashboard=loadTypeScript('app/portal/reports/ReportsDashboard.tsx',{
  './ReportDashboardGroups':{__esModule:true,default:({groups})=>React.createElement('div',null,...groups.map(group=>group.content))},
 }).default;
 const html=renderToStaticMarkup(React.createElement(Dashboard,{overview:overviewFixture(),statusHistory:{trackingStartedAt:'2026-10-01T16:01:00Z',points:[{periodStart:'2026-10-01',asOfDate:'2026-10-01',active:null,inactive:null},{periodStart:'2026-10-02',asOfDate:'2026-10-02',active:0,inactive:0}]}}));
 assert.match(html,/Active and Inactive Members/);assert.doesNotMatch(html,/Tracking began/);
 assert.match(html,/View chart data/);assert.doesNotMatch(html,/>Registered Members</);
 assert.equal(stat(html,'Inactive Members'),'9');
});


test('membership closing snapshots drive tickers and donut; first attendances live under Attendance',()=>{
 const charts=[],sections={};
 const Dashboard=loadTypeScript('app/portal/reports/ReportsDashboard.tsx',{
  './ReportDashboardGroups':{__esModule:true,default:({groups})=>{for(const group of groups)sections[group.id]=renderToStaticMarkup(group.content);return React.createElement('div',null,...groups.map(group=>group.content));}},
  './ReportChart':{__esModule:true,default:props=>{charts.push(props);return React.createElement('p',null,props.title);}},
 }).default;
 const overview=overviewFixture();
 const history={trackingStartedAt:'2026-09-01T00:00:00Z',points:[{periodStart:'2026-10-29',asOfDate:'2026-10-29',active:120,inactive:5}]};
 const prior={trackingStartedAt:history.trackingStartedAt,points:[{periodStart:'2026-09-29',asOfDate:'2026-09-29',active:100,inactive:10}]};
 renderToStaticMarkup(React.createElement(Dashboard,{overview,statusHistory:history,previousStatusHistory:prior}));
 assert.equal(stat(sections.membership,'Active Members'),'120');assert.equal(stat(sections.membership,'Inactive Members'),'5');
 assert.match(sections.membership,/up 20% vs previous period/);assert.match(sections.membership,/down 50% vs previous period/);
 assert.doesNotMatch(sections.membership,/Recorded First Attendances/);assert.match(sections.attendance,/Recorded First Attendances/);
 const donut=charts.find(chart=>chart.title==='Member Status Distribution');assert.equal(donut.kind,'doughnut');assert.equal(donut.centerValue,'96%');assert.deepEqual(Array.from(donut.series[0].values),[120,5]);assert.equal(donut.appearance,'sparkline');
});

test('page loads prior closing status in the same branch scope without requiring a whole prior history',async()=>{
 const h=pageHarness({selectedBranch:id(1)});await h.html({range:'custom',from:'2026-10-01',to:'2026-10-29',grouping:'week'});
 assert.equal(h.calls.statuses.length,2);
 assert.equal(h.calls.statuses[0].branchId,id(1));assert.equal(h.calls.statuses[1].branchId,id(1));
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.statuses[1].range)),{preset:'custom',from:'2026-09-30',to:'2026-09-30'});
 assert.equal(h.calls.statuses[1].grouping,'day');
});

test('status snapshots never substitute current members for untracked historical dates',()=>{
 const {memberStatusSnapshot}=loadTypeScript('lib/analytics/member-status-presentation.ts');
 const overview=overviewFixture();overview.range.to='2026-10-20';
 assert.equal(memberStatusSnapshot(overview,null).active,null);
 const history={trackingStartedAt:'2026-10-21T00:00:00Z',points:[{asOfDate:'2026-10-20',active:null,inactive:null}]};
 assert.equal(memberStatusSnapshot(overview,history).inactive,null);
 overview.range.to=today;assert.equal(memberStatusSnapshot(overview,null).active,99);
 overview.range.from='2026-11-01';overview.range.to='2026-11-30';assert.equal(memberStatusSnapshot(overview,null).active,null);
});


test('Attendance replaces its average metric with the winning service name and attendee count without a ticker',()=>{
 let attendance;
 const Dashboard=loadTypeScript('app/portal/reports/ReportsDashboard.tsx',{
  './ReportDashboardGroups':{__esModule:true,default:({groups})=>{attendance=renderToStaticMarkup(groups.find(group=>group.id==='attendance').content);return null;}},
 }).default;
 renderToStaticMarkup(React.createElement(Dashboard,{overview:overviewFixture(),mostAttendedService:{id:'one',name:'Sunday Worship',date:'2026-10-25',attendees:75}}));
 assert.equal(stat(attendance,'Most Attended Service'),'Sunday Worship');assert.match(attendance,/75 attendees/);assert.doesNotMatch(attendance,/Avg Attendance \/ Completed Service/);
 const card=attendance.split('Most Attended Service')[1].split('</dl>')[0];assert.doesNotMatch(card,/previous period/);
 renderToStaticMarkup(React.createElement(Dashboard,{overview:overviewFixture(),mostAttendedService:null}));assert.equal(stat(attendance,'Most Attended Service'),'No completed services');
 renderToStaticMarkup(React.createElement(Dashboard,{overview:overviewFixture()}));assert.equal(stat(attendance,'Most Attended Service'),'Unavailable');
});


test('most-attended service type ranks per-service averages instead of total check-ins and sits beside the winning service',()=>{
 let attendance;
 const Dashboard=loadTypeScript('app/portal/reports/ReportsDashboard.tsx',{
  './ReportDashboardGroups':{__esModule:true,default:({groups})=>{attendance=renderToStaticMarkup(groups.find(group=>group.id==='attendance').content);return null;}},
 }).default;
 const overview=overviewFixture();overview.attendance.byServiceType=[
  {serviceType:'frequent',completedServices:10,physicalCheckIns:200,averagePerService:20,uniqueMembers:50},
  {serviceType:'special',completedServices:2,physicalCheckIns:100,averagePerService:50,uniqueMembers:80},
  {serviceType:'none',completedServices:0,physicalCheckIns:999,averagePerService:null,uniqueMembers:0},
 ];
 renderToStaticMarkup(React.createElement(Dashboard,{overview,serviceTypeNames:{special:'Special Gathering'},mostAttendedService:{id:'one',name:'Sunday Worship',date:'2026-10-25',attendees:75}}));
 assert.equal(stat(attendance,'Most Attended Service Type'),'Special Gathering');assert.match(attendance,/50 avg attendees\/service/);
 assert.deepEqual([...attendance.matchAll(/<dt[^>]*>(.*?)<\/dt>/g)].map(match=>match[1]),['Completed Services','Unique Attendees','Most Attended Service Type','Most Attended Service']);
 overview.attendance.byServiceType=[];
 renderToStaticMarkup(React.createElement(Dashboard,{overview}));assert.equal(stat(attendance,'Most Attended Service Type'),'No completed services');
});
