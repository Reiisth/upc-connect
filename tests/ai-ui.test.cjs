const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { clientHooks, findElement } = require('./helpers/client-hooks.cjs');
const { serverOnly, analyticsFixture, validInsight, id } = require('./helpers/ai-harness.cjs');
const { buildDecisionSupportInput, decisionSupportEvidenceIndex } = loadTypeScript('lib/ai/input.ts', serverOnly);
const { validateDecisionSupportResponse } = loadTypeScript('lib/ai/validate-response.ts', serverOnly);
const { labelDecisionSupportEvidence } = loadTypeScript('lib/ai/evidence.ts', serverOnly);
const { DECISION_SUPPORT_ERRORS } = loadTypeScript('lib/ai/errors.ts', serverOnly);
const filters = { branchId: id(1), range: { preset: 'custom', from: '2026-10-01', to: '2026-10-29' }, grouping: 'month' };
const props = { filters };
const html = renderToStaticMarkup;
const button = (tree) => findElement(tree, (element) => element.props.type === 'button');

function resultFixture() {
  const data = analyticsFixture();
  Object.assign(data.membership, { members: [{ name: 'PRIVATE_MEMBER', email: 'PRIVATE_EMAIL' }] });
  Object.assign(data.followUps, { notes: 'PRIVATE_FOLLOW_UP_NOTES' });
  Object.assign(data.contributions, { donor: 'PRIVATE_DONOR' });
  const input = buildDecisionSupportInput(data, 'all_accessible_branches');
  const insight = validInsight();
  insight.keyFindings[0].evidence.push('followUps.latestNeedsFollowUpMembers');
  insight.keyFindings.push({ title: 'Recorded giving', observation: 'Review the supplied amount alongside the report.',
    evidence: ['contributions.totalAmount', 'attendance.weekly.0.participationRatePercent'], severity: 'info' });
  const validated = validateDecisionSupportResponse(JSON.stringify(insight), input);
  const branchLabels = data.branches.map((row, i) => ({ label: input.branches[i].label, displayName: row.branch.name }));
  return { ok: true, insight: validated.insight, evidence: labelDecisionSupportEvidence(validated.evidence, input, branchLabels),
    advisory: true, reportingContext: input.reportingContext, branchLabels, generatedAt: '2026-10-29T09:00:00Z', model: 'test-model', promptVersion: '1' };
}

test('initial section is advisory, private, keyboard-operable and makes no automatic action call', () => {
  let calls = 0;
  const Section = loadTypeScript('app/portal/reports/DecisionSupportSection.tsx', {
    './actions': { generateReportInsights: () => { calls++; assert.fail('No automatic call'); } },
  }).default;
  const markup = html(React.createElement(Section, props));
  for (const text of ['AI Decision Support', 'Generate AI Insights', 'Advisory', 'aggregated analytics visible within your current branch scope',
    'Only aggregated report metrics are sent', 'Member names, contact information, attendance rows, contribution identities, and follow-up notes are not included',
    'AI insights may be incomplete or incorrect.', '30-second cooldown', 'type="button"']) assert.ok(markup.includes(text), text);
  assert.ok(!markup.includes('<input') && !markup.includes('<textarea') && !markup.includes('Executive Summary'));
  assert.equal(calls, 0);
});

test('Generate sends only applied filters, disables and announces pending work, deduplicates clicks, then Regenerate replaces current state', async () => {
  const calls = [];
  let finish;
  const h = clientHooks('app/portal/reports/DecisionSupportSection.tsx', {
    './actions': { generateReportInsights: (intent) => { calls.push(intent); return new Promise((resolve) => { finish = resolve; }); } },
  });
  const initial = h.render(props);
  const click = button(initial).props.onClick;
  click(); click();
  assert.equal(calls.length, 1, 'The synchronous lock also covers clicks before React commits pending state');
  assert.equal(JSON.stringify(calls[0]), JSON.stringify(filters));
  assert.deepEqual(Object.keys(calls[0]).sort(), ['branchId', 'grouping', 'range']);
  const pending = h.render(props);
  assert.equal(button(pending).props.disabled, true);
  assert.ok(html(pending).includes('Analyzing report data...') && html(pending).includes('role="status"'));
  finish(resultFixture());
  await h.settle();
  const success = h.render(props);
  assert.equal(button(success).props.disabled, false);
  assert.ok(html(success).includes('Regenerate Insights'));
  assert.ok(html(success).includes('Executive Summary'));
  button(success).props.onClick();
  const replacement = resultFixture();
  replacement.insight.executiveSummary = 'A replacement interpretation.';
  finish(replacement);
  await h.settle();
  const updated = html(h.render(props));
  assert.equal(calls.length, 2);
  assert.ok(updated.includes('A replacement interpretation.'));
  assert.ok(!updated.includes(resultFixture().insight.executiveSummary));
});

test('structured output shows actual server evidence, exact money, advisory recommendations, limitations and validated report context', () => {
  const { DecisionSupportResults } = loadTypeScript('app/portal/reports/DecisionSupportSection.tsx', { './actions': {} });
  const result = resultFixture();
  const markup = html(React.createElement(DecisionSupportResults, { result }));
  for (const text of ['Executive Summary', 'AI-generated summary', 'Key Findings', 'Report evidence', 'Advisory Recommendations',
    'Recommendations are advisory and should be reviewed by church leadership before action.', 'Rationale:', 'Limitations',
    'Recommendations are advisory and require human review.', 'Severity:', 'Attention', 'Priority:', 'Medium',
    'Members currently needing follow-up:', 'Overdue latest next follow-ups:', '9,999,999,999,999,999,999,900.01',
    'Unavailable', 'Generated for', 'All accessible branches', 'Oct 29, 2026', 'Weekly grouping', 'inclusive, Asia/Manila']) assert.ok(markup.includes(text), text);
  assert.ok(markup.includes('<ul') && markup.includes('<li'));
  for (const forbidden of ['followUps.overdueLatestNextFollowUps', 'contributions.totalAmount', 'PRIVATE_MEMBER', 'PRIVATE_EMAIL',
    'PRIVATE_FOLLOW_UP_NOTES', 'PRIVATE_DONOR', '<button', '<input']) assert.ok(!markup.includes(forbidden), forbidden);
  result.reportingContext.branchScope.mode = 'one_accessible_branch';
  assert.ok(html(React.createElement(DecisionSupportResults, { result })).includes('Private Church 1'));
});

test('every scalar evidence path has a readable label with branch, trend-date and category context', () => {
  const input = buildDecisionSupportInput(analyticsFixture(), 'all_accessible_branches');
  const scalars = [...decisionSupportEvidenceIndex(input)].map(([path, value]) => ({ path, value }));
  const displayed = labelDecisionSupportEvidence(scalars, input, [{ label: 'Branch 1', displayName: 'Accessible Church' }]);
  assert.equal(displayed.length, scalars.length);
  assert.ok(displayed.every((item) => item.label.length && item.value === scalars.find((scalar) => scalar.path === item.path).value));
  assert.ok(displayed.find((item) => item.path === 'branches.0.inactivity.derivedInactiveMembers').label.includes('Accessible Church'));
  assert.ok(displayed.find((item) => item.path === 'attendance.trend.0.uniqueMembers').label.includes('2026-10-05'));
  assert.ok(displayed.find((item) => item.path === 'followUps.byOutcome.0.count').label.includes('needs follow up'));
  assert.throws(() => labelDecisionSupportEvidence([{ path: '__proto__.value', value: 1 }], input, []), (error) => error.code === 'INVALID_RESPONSE');
});

test('provider, timeout, usage, validation, configuration and cooldown failures show only controlled messages', async () => {
  for (const code of ['NOT_CONFIGURED', 'PROVIDER_UNAVAILABLE', 'TIMEOUT', 'RATE_LIMITED', 'INVALID_RESPONSE', 'COOLDOWN']) {
    const h = clientHooks('app/portal/reports/DecisionSupportSection.tsx', {
      './actions': { generateReportInsights: async () => ({ ok: false, error: { code, message: DECISION_SUPPORT_ERRORS[code] }, raw: 'PRIVATE_PROVIDER_STACK GEMINI_API_KEY FULL_PROMPT' }) },
    });
    button(h.render(props)).props.onClick();
    await h.settle();
    const markup = html(h.render(props));
    assert.ok(markup.includes(DECISION_SUPPORT_ERRORS[code]), code);
    assert.ok(markup.includes('role="alert"'));
    assert.ok(!markup.includes('PRIVATE_') && !markup.includes('FULL_PROMPT') && !markup.includes('GEMINI_API_KEY'));
    assert.equal(button(h.render(props)).props.disabled, false);
  }
  const h = clientHooks('app/portal/reports/DecisionSupportSection.tsx', {
    './actions': { generateReportInsights: async () => { throw new Error('PRIVATE_TRANSPORT_STACK'); } },
  });
  button(h.render(props)).props.onClick();
  await h.settle();
  assert.ok(html(h.render(props)).includes('AI insights could not be generated right now.'));
  assert.ok(!html(h.render(props)).includes('PRIVATE_TRANSPORT_STACK'));
});

test('editing/submitting filters discards the AI component and disables generation until applied; new applied filters get a new instance', async () => {
  let calls = 0;
  const action = { generateReportInsights: async () => { calls++; return resultFixture(); } };
  const data = analyticsFixture();
  const values = { branch: id(1), preset: 'custom', from: filters.range.from, to: filters.range.to, grouping: 'month' };
  const viewProps = { branches: data.branches.map((row) => row.branch), values, insightFilters: filters, children: React.createElement('div', null, 'Existing dashboard') };
  const view = clientHooks('app/portal/reports/ReportsView.tsx', { './actions': action });
  const initial = view.render(viewProps);
  const before = findElement(initial, (element) => element.props.filters === filters);
  const prior = clientHooks('app/portal/reports/DecisionSupportSection.tsx', { './actions': action });
  button(prior.render(before.props)).props.onClick();
  await prior.settle();
  assert.ok(html(prior.render(before.props)).includes('Executive Summary'));
  const formElement = findElement(initial, (element) => typeof element.props.onFiltersChange === 'function');
  const form = clientHooks('app/portal/reports/ReportFilters.tsx').render(formElement.props);
  const formHandlers = findElement(form, (element) => element.type === 'form').props;
  assert.equal(formHandlers.onSubmit, formHandlers.onChange);
  formHandlers.onChange();
  const edited = view.render(viewProps);
  const after = findElement(edited, (element) => element.props.filters === filters);
  assert.notEqual(after.key, before.key, 'React discards the previous insight and any late response state');
  assert.equal(after.props.filtersChanged, true);
  const replacement = clientHooks('app/portal/reports/DecisionSupportSection.tsx', { './actions': action });
  const reset = replacement.render(after.props);
  assert.equal(button(reset).props.disabled, true);
  button(reset).props.onClick();
  assert.equal(calls, 1);
  assert.ok(!html(reset).includes('Executive Summary') && html(reset).includes('Apply filters before generating new insights'));
  for (const next of [{ ...filters, branchId: id(2) }, { ...filters, grouping: 'day' }, { ...filters, range: { ...filters.range, from: '2026-10-02' } }]) {
    const changed = view.render({ ...viewProps, insightFilters: next });
    assert.notEqual(findElement(changed, (element) => element.props.filters === next).key, before.key);
  }
});

test('model prose is escaped, severity and priority have text, mobile results stack, and no persistence/mutation controls exist', () => {
  const { DecisionSupportResults } = loadTypeScript('app/portal/reports/DecisionSupportSection.tsx', { './actions': {} });
  const result = resultFixture();
  result.insight.executiveSummary = '<script>UNTRUSTED_TEXT</script>';
  result.insight.keyFindings = ['info', 'attention', 'important'].map((severity) => ({ ...result.insight.keyFindings[0], severity }));
  result.insight.recommendations = ['low', 'medium', 'high'].map((priority) => ({ ...result.insight.recommendations[0], priority }));
  const markup = html(React.createElement(DecisionSupportResults, { result }));
  assert.ok(markup.includes('&lt;script&gt;') && !markup.includes('<script>'));
  for (const label of ['Info', 'Attention', 'Important', 'Low', 'Medium', 'High', 'lg:grid-cols-2']) assert.ok(markup.includes(label));
  for (const file of ['DecisionSupportSection.tsx', 'ReportsView.tsx', 'actions.ts']) {
    const source = readFileSync(`app/portal/reports/${file}`, 'utf8');
    for (const forbidden of ['localStorage', 'sessionStorage', 'indexedDB', 'dangerouslySetInnerHTML', 'dark:', '.insert(', '.update(', '.delete(', '.upsert(', 'revalidatePath(', 'setInterval(']) assert.ok(!source.includes(forbidden), `${file}: ${forbidden}`);
  }
});
