const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-typescript.cjs');
const { assembleAnalytics, emptyAnalyticsAggregates } = loadTypeScript('lib/analytics/assemble.ts');
const dates = loadTypeScript('lib/analytics/date-range.ts');
const today = '2026-10-29';
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const branchOptions = [1, 2, 3].map((n) => ({ id: id(n), name: `Private Church ${n}`, code: `SECRET-${n}`, isActive: true, inactivityThresholdWeeks: n + 2 }));
const serverOnly = { 'server-only': {} };

function analyticsFixture() {
  const result = assembleAnalytics({ aggregates: emptyAnalyticsAggregates(), branches: branchOptions.slice(0, 2), inactivity: [],
    range: dates.resolveAnalyticsDateRange(undefined, today), grouping: 'week', asOfDate: today });
  result.membership.nonArchivedMembers = 12;
  result.membership.storedActiveMembers = 11;
  result.membership.recordsAddedInRange = 2;
  result.membership.recordCreationTrend = [{ periodStart: '2026-10-05', value: 2 }];
  result.membership.missingFirstAttendanceDate = 1;
  result.attendance = { completedServices: 2, physicalCheckIns: 9, uniqueMembers: 7, averagePerService: 4.5,
    eligibleCompletedServiceWeeks: 1,
    byServiceType: [{ serviceType: 'prayer_meeting', completedServices: 2, physicalCheckIns: 9, uniqueMembers: 7, averagePerService: 4.5 }],
    trend: [{ periodStart: '2026-10-05', completedServices: 2, physicalCheckIns: 9, uniqueMembers: 7, averagePerService: 4.5 }],
    weekly: [{ weekStart: '2026-10-05', completedServices: 2, physicalCheckIns: 9, uniqueMembers: 7, averagePerService: 4.5,
      isFinished: true, isPartialRange: false, eligibleMemberCount: null, participationRatePercent: null }] };
  result.inactivity = { monitoredMembers: 12, calculableMembers: 11, derivedActiveMembers: 8, derivedInactiveMembers: 3, unknownMembers: 1,
    inactivePercent: 300 / 11, averageConsecutiveAbsentWeeks: 1.75, oneWeekAwayMembers: 2 };
  result.followUps = { total: 4, uniqueMembers: 2, latestMembers: 2, latestNeedsFollowUpMembers: 0, overdueLatestNextFollowUps: 1,
    byMethod: [{ method: 'call', count: 4 }], byOutcome: [{ outcome: 'needs_follow_up', count: 3 }, { outcome: 'resolved', count: 1 }],
    latestByOutcome: [{ outcome: 'resolved', count: 2 }], trend: [{ periodStart: '2026-10-05', value: 4 }] };
  result.contributions = { count: 2, totalAmount: '9999999999999999999900.01', averageAmount: '4999999999999999999950.01',
    byContributionType: [{ contributionType: 'love_offering', count: 2, totalAmount: '9999999999999999999900.01', averageAmount: '4999999999999999999950.01' }],
    byPaymentMethod: [], trend: [{ periodStart: '2026-10-05', count: 2, totalAmount: '9999999999999999999900.01', averageAmount: '4999999999999999999950.01' }] };
  result.baptisms = { total: 3, water: 2, holyGhost: 1, undatedRecords: 4,
    trend: [{ periodStart: '2026-10-05', total: 3, water: 2, holyGhost: 1 }] };
  result.branches[0].inactivity = { ...result.inactivity, derivedInactiveMembers: 3 };
  result.branches[1].branch.isActive = false;
  result.branches[1].inactivity = null;
  return result;
}

function validInsight() {
  return { executiveSummary: 'Review the supplied report alongside local operational context.',
    keyFindings: [{ title: 'Current follow-up dates', observation: 'There are 1 overdue latest next follow-ups.',
      evidence: ['followUps.overdueLatestNextFollowUps'], severity: 'attention' }],
    recommendations: [{ title: 'Review contact capacity', recommendation: 'Consider reviewing capacity for the overdue follow-ups.',
      rationale: 'The latest explicit contact dates indicate a current review need.', evidence: ['followUps.overdueLatestNextFollowUps'], priority: 'medium' }],
    limitations: ['Recommendations are advisory and require human review.'] };
}

async function withGeminiEnv(overrides, work) {
  const keys = ['GEMINI_API_KEY', 'GEMINI_MODEL'];
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.GEMINI_API_KEY = 'test-placeholder-key-not-real';
    delete process.env.GEMINI_MODEL;
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    return await work();
  } finally {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key];
    }
  }
}

function aiServerHarness({ permissions = ['reports.view'], scopeIds = [id(1), id(2)], isSystemAdmin = false,
  rpcFailure = false, branchFailure = false, aggregates = emptyAnalyticsAggregates(), providerFailure = false, response, providerWork } = {}) {
  const calls = { permissions: [], scope: [], reads: [], rpc: [], provider: [], sdk: 0 };
  const db = { church_branches: branchOptions.map((row) => ({ id: row.id, name: row.name, code: row.code, is_active: row.isActive, inactivity_threshold_weeks: row.inactivityThresholdWeeks })), members: [] };
  class Query {
    constructor(table) { this.table = table; this.rows = [...db[table]]; }
    select() { return this; }
    eq(key, value) { this.rows = this.rows.filter((row) => row[key] === value); return this; }
    in(key, values) { this.rows = this.rows.filter((row) => values.includes(row[key])); return this; }
    order() { return this; }
    range(from, to) { this.rows = this.rows.slice(from, to + 1); return this; }
    then(resolve, reject) { calls.reads.push(this.table); return Promise.resolve({ data: this.rows, error: branchFailure ? { message: 'PRIVATE_BRANCH_ERROR' } : null }).then(resolve, reject); }
  }
  const admin = {
    from: (table) => { assert.ok(Object.hasOwn(db, table), `Unexpected raw source read: ${table}`); return new Query(table); },
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: aggregates, error: rpcFailure ? { message: 'PRIVATE_ANALYTICS_ERROR' } : null }; },
  };
  const permissionBoundary = { requirePermission: async (key) => {
    calls.permissions.push(key);
    if (!permissions.includes(key)) { const error = new Error('redirect:/access-denied'); error.digest = 'NEXT_REDIRECT'; throw error; }
    return { user: { id: id(10) }, permissions };
  } };
  const analytics = loadTypeScript('lib/analytics/server.ts', {
    ...serverOnly, '@/lib/permissions-server': permissionBoundary,
    '@/lib/branch-access': { getUserBranchScope: async (userId) => { calls.scope.push(userId); return { branchIds: scopeIds, isSystemAdmin }; } },
    '@/lib/supabase/admin': { createAdminClient: () => admin }, './date-range': { ...dates, analyticsToday: () => today },
  });
  const navigation = { unstable_rethrow: (error) => { if (error?.digest === 'NEXT_REDIRECT') throw error; }, redirect: (url) => { throw new Error(`redirect:${url}`); } };
  const provider = { requestGeminiDecisionSupport: async (input) => {
    calls.provider.push(input);
    if (providerWork) return providerWork(input);
    if (providerFailure) throw new Error('PRIVATE_PROVIDER_ERROR test-placeholder-key-not-real FULL_PROMPT');
    return response ?? JSON.stringify({ executiveSummary: 'The supplied report has limited activity.', keyFindings: [], recommendations: [], limitations: ['Advisory interpretation only; human review is required.'] });
  } };
  const api = loadTypeScript('lib/ai/server.ts', { ...serverOnly, '@/lib/permissions-server': permissionBoundary,
    '@/lib/analytics/server': analytics, './provider': provider, 'next/navigation': navigation,
    '@/lib/analytics/date-range': { ...dates, analyticsToday: () => today } });
  function loadReportsPage() {
    return loadTypeScript('app/portal/reports/page.tsx', { ...serverOnly,
      '@/lib/analytics/server': analytics, '@/lib/analytics/date-range': { ...dates, analyticsToday: () => today },
      'next/navigation': navigation,
      'next/link': { __esModule: true, default: (props) => require('react').createElement('a', props) },
      '@google/genai': { GoogleGenAI: class { constructor() { calls.sdk++; throw new Error('Reports must not initialize Gemini'); } } },
      '@/lib/ai/server': { generateDecisionSupportInsights: () => { throw new Error('Reports must not generate AI insights'); } },
    }).default;
  }
  return { ...api, calls, analytics, loadReportsPage };
}

module.exports = { today, id, branchOptions, serverOnly, dates, analyticsFixture, validInsight, withGeminiEnv, aiServerHarness };
