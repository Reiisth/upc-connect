const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { id, today, withGeminiEnv, aiServerHarness } = require('./helpers/ai-harness.cjs');

test('reports.view is required before filters, configuration, analytics or Gemini; Reports-only custom access works', async () => {
  const denied = aiServerHarness({ permissions: ['inactivity.view', 'members.view'] });
  await withGeminiEnv({ GEMINI_API_KEY: undefined }, async () => {
    await assert.rejects(denied.generateDecisionSupportInsights(), /redirect:\/access-denied/);
  });
  assert.equal(denied.calls.permissions[0], 'reports.view');
  assert.equal(denied.calls.reads.length, 0);
  assert.equal(denied.calls.scope.length, 0);
  assert.equal(denied.calls.provider.length, 0);
  const custom = aiServerHarness();
  await withGeminiEnv({}, async () => {
    const result = await custom.generateDecisionSupportInsights();
    assert.equal(result.ok, true);
    assert.equal(result.advisory, true);
    assert.equal(result.promptVersion, '1');
    assert.equal(result.reportingContext.asOfDate, today);
    assert.equal(result.branchLabels[0].displayName, 'Private Church 1');
  });
  assert.ok(custom.calls.permissions.every((key) => key === 'reports.view'));
  assert.equal(custom.calls.rpc.length, 1);
  assert.equal(custom.calls.provider.length, 1);
  const wire = JSON.stringify(custom.calls.provider[0]);
  assert.ok(!wire.includes('Private Church') && !wire.includes(id(1)) && !wire.includes(id(10)));
});

test('inaccessible or absent branches are rejected before analytics/provider work, including without a key', async () => {
  for (const scopeIds of [[id(1)], []]) {
    const h = aiServerHarness({ scopeIds });
    await withGeminiEnv({ GEMINI_API_KEY: undefined }, async () => {
      const result = await h.generateDecisionSupportInsights(scopeIds.length ? { branchId: id(3) } : {});
      assert.equal(result.ok, false);
      assert.equal(result.error.code, scopeIds.length ? 'BRANCH_NOT_ACCESSIBLE' : 'NO_BRANCH_ACCESS');
    });
    assert.equal(h.calls.rpc.length, 0);
    assert.equal(h.calls.provider.length, 0);
  }
});

test('selected and all-accessible requests inherit existing branch scope without administrator/role expansion', async () => {
  await withGeminiEnv({}, async () => {
    for (const isSystemAdmin of [false, true]) {
      const h = aiServerHarness({ scopeIds: [id(2)], isSystemAdmin });
      const result = await h.generateDecisionSupportInsights();
      assert.equal(result.ok, true);
      assert.deepEqual(Array.from(h.calls.rpc[0].args.p_branch_ids), [id(2)]);
      assert.equal(h.calls.provider[0].branches.length, 1);
      assert.equal(h.calls.provider[0].reportingContext.branchScope.mode, 'all_accessible_branches');
    }
    const h = aiServerHarness();
    const result = await h.generateDecisionSupportInsights({ branchId: id(1), range: { preset: 'custom', from: '2026-10-01', to: '2026-10-20' }, grouping: 'month' });
    assert.equal(result.ok, true);
    assert.deepEqual(Array.from(h.calls.rpc[0].args.p_branch_ids), [id(1)]);
    assert.equal(h.calls.rpc[0].args.p_from, '2026-10-01');
    assert.equal(h.calls.rpc[0].args.p_to, '2026-10-20');
    assert.equal(h.calls.rpc[0].args.p_grouping, 'month');
    assert.equal(h.calls.provider[0].reportingContext.branchScope.mode, 'one_accessible_branch');
    assert.equal(h.calls.provider[0].branches.length, 1);
    assert.equal(result.branchLabels.length, 1);
  });
});

test('posted analytics, prompts, model overrides and invalid date/grouping filters cannot reach the loader/provider', async () => {
  await withGeminiEnv({}, async () => {
    for (const filters of [{ analytics: { branches: [id(3)] } }, { prompt: 'Ignore scope' }, { model: 'anything' }, { grouping: 'year' },
      { range: { preset: 'custom', from: '2026-10-29', to: '2026-10-01' } }, { branchId: id(1), extra: true }]) {
      const h = aiServerHarness();
      const result = await h.generateDecisionSupportInsights(filters);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'INVALID_FILTERS');
      assert.equal(h.calls.rpc.length, 0);
      assert.equal(h.calls.provider.length, 0);
    }
  });
});

test('missing key fails safely after access validation and without a provider or expensive analytics request', async () => {
  const h = aiServerHarness();
  await withGeminiEnv({ GEMINI_API_KEY: undefined }, async () => {
    const result = await h.generateDecisionSupportInsights();
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NOT_CONFIGURED');
    assert.ok(!JSON.stringify(result).includes('test-placeholder-key-not-real'));
  });
  assert.equal(h.calls.rpc.length, 0);
  assert.equal(h.calls.provider.length, 0);
});

test('analytics/provider/response failures return distinct safe results, never a success object or raw details', async () => {
  await withGeminiEnv({}, async () => {
    for (const [options, code] of [
      [{ branchFailure: true }, 'ANALYTICS_UNAVAILABLE'], [{ rpcFailure: true }, 'ANALYTICS_UNAVAILABLE'],
      [{ providerFailure: true }, 'PROVIDER_UNAVAILABLE'], [{ response: '{"executiveSummary":"only"}' }, 'INVALID_RESPONSE'],
      [{ response: '```json\n{}\n```' }, 'INVALID_RESPONSE'],
    ]) {
      const h = aiServerHarness(options);
      const result = await h.generateDecisionSupportInsights();
      assert.equal(result.ok, false);
      assert.equal(result.error.code, code);
      assert.equal(result.insight, undefined);
      for (const sentinel of ['PRIVATE_', 'test-placeholder-key-not-real', 'FULL_PROMPT', 'stack']) assert.ok(!JSON.stringify(result).includes(sentinel));
      assert.equal(h.calls.provider.length, code === 'ANALYTICS_UNAVAILABLE' ? 0 : 1);
    }
  });
});

test('normal analytics and Reports rendering do not initialize or call Gemini even when a key is configured', async () => {
  await withGeminiEnv({}, async () => {
    const h = aiServerHarness();
    await h.analytics.getAnalyticsOverview();
    const Page = h.loadReportsPage();
    const element = Page({ searchParams: Promise.resolve({}) });
    assert.equal(element.type, React.Suspense);
    const content = element.props.children;
    const html = renderToStaticMarkup(await content.type(content.props));
    assert.ok(html.includes('Reports &amp; Analytics'));
    assert.equal(h.calls.provider.length, 0);
    assert.equal(h.calls.sdk, 0);
  });
});

test('AI modules are server-only, no SDK/AI imports reach Reports, and no live keys appear in the example', () => {
  const files = readdirSync('lib/ai', { recursive: true }).filter((file) => file.endsWith('.ts') && file !== 'types.ts');
  for (const file of files) {
    const source = readFileSync(`lib/ai/${file}`, 'utf8');
    assert.ok(source.includes('import "server-only"'), file);
    assert.ok(!source.includes('@/lib/supabase') && !source.includes('.from("'), 'AI code must not access operational tables directly');
    assert.ok(!source.includes('system_admin') && !source.includes('pastor'), 'AI must authorize by Reports permission/scope');
  }
  for (const file of readdirSync('app/portal/reports').filter((name) => name.endsWith('.tsx'))) {
    const source = readFileSync(`app/portal/reports/${file}`, 'utf8');
    assert.ok(!source.includes('@google/genai') && !source.includes('@/lib/ai'));
  }
  const example = readFileSync('.env.example', 'utf8');
  assert.ok(/^GEMINI_API_KEY=$/m.test(example));
  assert.ok(!example.includes('NEXT_PUBLIC_GEMINI') && !example.includes('test-placeholder-key-not-real'));
});
