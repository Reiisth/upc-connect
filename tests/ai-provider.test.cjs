const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { serverOnly, analyticsFixture, validInsight, withGeminiEnv } = require('./helpers/ai-harness.cjs');
const { buildDecisionSupportInput } = loadTypeScript('lib/ai/input.ts', serverOnly);
const { getGeminiServerConfig, DEFAULT_GEMINI_MODEL, DECISION_SUPPORT_MAX_OUTPUT_TOKENS } = loadTypeScript('lib/ai/config.ts', serverOnly);

function providerHarness(behavior) {
  const calls = [];
  class MockGoogleGenAI {
    constructor(clientOptions) {
      this.interactions = { create: async (params, options) => {
        calls.push({ clientOptions, params, options });
        return behavior(params, options);
      } };
    }
  }
  const api = loadTypeScript('lib/ai/provider.ts', { ...serverOnly, '@google/genai': { GoogleGenAI: MockGoogleGenAI } });
  return { ...api, calls };
}
const input = buildDecisionSupportInput(analyticsFixture(), 'all_accessible_branches');
const config = { apiKey: 'test-placeholder-key-not-real', model: DEFAULT_GEMINI_MODEL, timeoutMs: 200 };

test('configuration is lazy, server-only, centrally defaults the model and fails without exposing missing/malformed settings', async () => {
  await withGeminiEnv({}, async () => {
    assert.equal(getGeminiServerConfig().model, DEFAULT_GEMINI_MODEL);
    assert.equal(getGeminiServerConfig().timeoutMs, 30000);
  });
  await withGeminiEnv({ GEMINI_MODEL: 'gemini-compatible-test-model' }, async () => assert.equal(getGeminiServerConfig().model, 'gemini-compatible-test-model'));
  await withGeminiEnv({ GEMINI_API_KEY: undefined }, async () => {
    assert.throws(getGeminiServerConfig, (error) => error.code === 'NOT_CONFIGURED' && !error.message.includes('test-placeholder'));
  });
  await withGeminiEnv({ GEMINI_API_KEY: '   ' }, async () => assert.throws(getGeminiServerConfig, (error) => error.code === 'NOT_CONFIGURED'));
  await withGeminiEnv({ GEMINI_MODEL: 'https://untrusted.example/PRIVATE_CONFIG' }, async () => {
    assert.throws(getGeminiServerConfig, (error) => error.code === 'INVALID_CONFIGURATION' && !error.message.includes('PRIVATE_CONFIG'));
  });
});

test('official SDK boundary requests structured Interactions output without tools, persistence, retries, continuation or background work', async () => {
  const response = JSON.stringify(validInsight());
  const h = providerHarness(async () => ({ status: 'completed', output_text: response }));
  assert.equal(await h.requestGeminiDecisionSupport(input, config), response);
  assert.equal(h.calls.length, 1);
  const call = h.calls[0];
  assert.equal(call.clientOptions.apiKey, config.apiKey);
  assert.equal(call.clientOptions.vertexai, false);
  assert.equal(call.params.model, DEFAULT_GEMINI_MODEL);
  assert.equal(call.params.store, false);
  assert.equal(call.params.background, false);
  assert.equal(call.params.stream, false);
  assert.equal(call.params.automatic_continuation, false);
  assert.equal(call.params.previous_interaction_id, undefined);
  assert.equal(call.params.tools.length, 0);
  assert.equal(call.params.generation_config.max_output_tokens, DECISION_SUPPORT_MAX_OUTPUT_TOKENS);
  assert.equal(call.params.response_format.type, 'text');
  assert.equal(call.params.response_format.mime_type, 'application/json');
  assert.equal(call.params.response_format.schema.additionalProperties, false);
  assert.ok(call.params.response_format.schema.required.includes('executiveSummary'));
  assert.ok(call.params.system_instruction.includes('source of truth'));
  assert.ok(call.params.input.includes(input.contributions.totalAmount));
  assert.ok(!call.params.input.includes(config.apiKey));
  assert.equal(call.options.retries.strategy, 'none');
  assert.equal(call.options.timeout_ms, config.timeoutMs);
  assert.equal(call.options.cache, 'no-store');
  assert.equal(call.options.signal.aborted, false);
});

test('rate limits, SDK timeouts and generic provider failures become fixed controlled errors', async () => {
  for (const [details, expected] of [
    [{ status: 429 }, 'RATE_LIMITED'], [{ statusCode: 429 }, 'RATE_LIMITED'],
    [{ status: 408 }, 'TIMEOUT'], [{ name: 'APIConnectionTimeoutError' }, 'TIMEOUT'],
    [{ name: 'RequestTimeoutError' }, 'TIMEOUT'], [{ status: 500 }, 'PROVIDER_UNAVAILABLE'],
    [{ status: 401 }, 'PROVIDER_UNAVAILABLE'],
  ]) {
    const raw = Object.assign(new Error('PRIVATE_PROVIDER_ERROR API_KEY FULL_PROMPT'), details);
    const h = providerHarness(async () => { throw raw; });
    await assert.rejects(h.requestGeminiDecisionSupport(input, config), (error) => error.code === expected && !error.message.includes('PRIVATE_PROVIDER_ERROR') && !error.message.includes('API_KEY'));
    assert.equal(h.calls.length, 1);
  }
});

test('deadline aborts and returns even if SDK ignores cancellation; a late response cannot become a successful result', async () => {
  let finish;
  const h = providerHarness(() => new Promise((resolve) => { finish = resolve; }));
  await assert.rejects(h.requestGeminiDecisionSupport(input, { ...config, timeoutMs: 15 }), (error) => error.code === 'TIMEOUT');
  assert.equal(h.calls[0].options.signal.aborted, true);
  finish({ status: 'completed', output_text: JSON.stringify(validInsight()) });
  assert.equal(h.calls.length, 1);
});

test('incomplete, blocked and empty model responses cannot pass the provider boundary as verified insights', async () => {
  for (const response of [
    { status: 'requires_continuation', output_text: '{}' }, { status: 'failed', output_text: '{}' },
    { status: 'requires_action', output_text: '{}' }, { status: 'completed', output_text: '' },
    { status: 'completed', output_text: null }, { status: 'completed' },
  ]) {
    const h = providerHarness(async () => response);
    await assert.rejects(h.requestGeminiDecisionSupport(input, config), (error) => error.code === 'INVALID_RESPONSE');
  }
});
