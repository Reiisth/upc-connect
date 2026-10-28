const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { calculateWeeklyInactivity } = require('../lib/inactivity/calculate.ts');
const {
  filterInactivityRows, getMonitoringCounts, getDerivedStatus, formatRecentRate,
} = require('../lib/inactivity/presentation.ts');

function rows(threshold = 3) {
  return calculateWeeklyInactivity({
    today: '2026-10-27', thresholds: new Map([['a', threshold]]),
    members: [
      { id: 'absent', branchId: 'a', eligibilityDate: '2026-01-05' },
      { id: 'present', branchId: 'a', eligibilityDate: '2026-01-05' },
      { id: 'unknown', branchId: 'a', eligibilityDate: null },
    ],
    services: ['2026-10-05', '2026-10-12', '2026-10-19'].map((serviceDate, i) => ({
      id: `s${i}`, serviceDate, branchId: 'a', status: 'completed',
    })),
    attendance: [{ memberId: 'present', serviceId: 's2', status: 'late' }],
  }).map((row) => ({ ...row, memberName: { absent: 'Juan Dela Cruz', present: 'Maria Santos', unknown: 'Pedro Reyes' }[row.memberId] }));
}

test('presentation prioritizes inactive members, sorts streaks and keeps unknown members visible', () => {
  const data = rows();
  const ordered = filterInactivityRows([...data].reverse(), { search: '', status: 'all', minimumAbsences: 0 });
  assert.deepEqual(ordered.map((row) => row.memberId), ['absent', 'present', 'unknown']);
  assert.deepEqual(getMonitoringCounts(data), { total: 3, inactive: 1, active: 1, unknown: 1 });
  assert.equal(data[0].memberId, 'absent', 'Sorting must not mutate the source');
});

test('name, derived-status and minimum-absence filters operate on calculated results', () => {
  const data = rows();
  assert.equal(filterInactivityRows(data, { search: '  MARIA ', status: 'all', minimumAbsences: 0 })[0].memberId, 'present');
  assert.equal(filterInactivityRows(data, { search: '', status: 'unknown', minimumAbsences: 0 })[0].memberId, 'unknown');
  assert.equal(filterInactivityRows(data, { search: '', status: 'all', minimumAbsences: 3 }).length, 1);
  assert.equal(filterInactivityRows(data, { search: 'missing', status: 'all', minimumAbsences: 0 }).length, 0);
});

test('low recent rate has no bearing on active status and percentages show their actual denominator', () => {
  const data = rows(4);
  assert.equal(data[0].recentAttendanceRate, 0);
  assert.equal(getDerivedStatus(data[0]), 'active');
  assert.equal(formatRecentRate(data[1]), '33.3% (1/3 weeks)');
  assert.equal(formatRecentRate(data[2]), '—');
});

test('rendered table shows derived statuses, uncapped absences, unknown reason and neutral attendance rates', () => {
  const Table = loadTypeScript('app/portal/inactivity/InactivityTable.tsx').default;
  const data = rows();
  // Counts may exceed the threshold and must remain fully visible.
  data[0].consecutiveAbsentWeeks = 5;
  const html = renderToStaticMarkup(React.createElement(Table, { rows: data }));
  for (const text of ['Juan Dela Cruz', 'Inactive', 'Active', 'Unknown', '5 / 3 weeks',
    'Missing or invalid first attendance date', '33.3% (1/3 weeks)', 'Oct 19, 2026']) assert.ok(html.includes(text), text);
  assert.ok(html.indexOf('Juan Dela Cruz') < html.indexOf('Maria Santos'));
  assert.ok(html.includes('overflow-x-auto'));
  assert.ok(!html.includes('Low attendance'));
});

const branch = { id: 'a', name: 'Main Church', code: 'MAIN', inactivityThresholdWeeks: 3 };
const noopAction = async () => ({ status: 'success', message: 'Saved' });

test('threshold editor is absent for view-only users and available for explicit settings capability', () => {
  const Settings = loadTypeScript('app/portal/inactivity/ThresholdSettings.tsx', {
    './actions': { updateInactivityThreshold: noopAction },
  }).default;
  const readOnly = renderToStaticMarkup(React.createElement(Settings, { branch, canManage: false }));
  assert.ok(readOnly.includes('view-only access'));
  assert.ok(!readOnly.includes('<form'));
  const editable = renderToStaticMarkup(React.createElement(Settings, { branch, canManage: true }));
  assert.ok(editable.includes('Save rule'));
  assert.ok(editable.includes('name="inactivity_threshold_weeks"'));
  assert.ok(editable.includes('min="1" max="52"'));
});

test('page scopes branch selection and summary rendering under its Suspense boundary', async () => {
  const loadedBranches = [];
  const Page = loadTypeScript('app/portal/inactivity/page.tsx', {
    'next/link': { __esModule: true, default: (props) => React.createElement('a', props) },
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    '@/lib/inactivity/server': {
      getInactivityBranchOptions: async () => ({ branches: [branch], canManageSettings: false }),
      getBranchMemberInactivity: async (id) => { loadedBranches.push(id); return rows(); },
    },
    './actions': { updateInactivityThreshold: noopAction },
  }).default;
  const page = Page({ searchParams: Promise.resolve({}) });
  assert.equal(page.type, React.Suspense);
  const content = page.props.children;
  const html = renderToStaticMarkup(await content.type(content.props));
  assert.deepEqual(loadedBranches, ['a']);
  assert.ok(html.includes('Derived Active') && html.includes('Derived Inactive') && html.includes('Unknown'));
  assert.ok(html.includes('Pedro Reyes'));
  const forbidden = Page({ searchParams: Promise.resolve({ branch: 'unassigned' }) }).props.children;
  await assert.rejects(forbidden.type(forbidden.props), /redirect:\/access-denied/);
  assert.deepEqual(loadedBranches, ['a'], 'An unauthorized branch must not load member data');
});

test('page offers only accessible branch choices and an empty state when none are available', async () => {
  for (const branches of [[], [branch, { ...branch, id: 'b', name: 'Second Church' }]]) {
    const Page = loadTypeScript('app/portal/inactivity/page.tsx', {
      'next/link': { __esModule: true, default: (props) => React.createElement('a', props) },
      'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
      '@/lib/inactivity/server': {
        getInactivityBranchOptions: async () => ({ branches, canManageSettings: false }),
        getBranchMemberInactivity: async () => rows(),
      },
      './actions': { updateInactivityThreshold: noopAction },
    }).default;
    const content = Page({ searchParams: Promise.resolve({}) }).props.children;
    const html = renderToStaticMarkup(await content.type(content.props));
    assert.ok(html.includes(branches.length ? 'View branch' : 'No active branch access'));
    if (branches.length) assert.ok(html.includes('Second Church'));
  }
});

test('navigation and default portal routing use inactivity.view without operational role checks', async () => {
  const Navigation = loadTypeScript('app/portal/PortalNavigation.tsx', {
    'next/link': { __esModule: true, default: (props) => React.createElement('a', props) },
    'next/navigation': { usePathname: () => '/portal/inactivity' },
  }).default;
  for (const variant of ['desktop', 'mobile']) {
    const visible = renderToStaticMarkup(React.createElement(Navigation, { permissions: ['inactivity.view'], variant }));
    assert.ok(visible.includes('Inactivity Monitoring'));
    const hidden = renderToStaticMarkup(React.createElement(Navigation, { permissions: ['attendance.view'], variant }));
    assert.ok(!hidden.includes('Inactivity Monitoring'));
  }
  const Portal = loadTypeScript('app/portal/page.tsx', {
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'custom-role-user' }) },
    '@/lib/permissions-server': { getCurrentUserPermissions: async () => ['inactivity.view'] },
  }).default;
  await assert.rejects(Portal(), /redirect:\/portal\/inactivity/);
});
