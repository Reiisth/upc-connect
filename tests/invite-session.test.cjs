/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

function invitePage(hash, setSession = async () => ({ error: null })) {
  const values = ['password123', 'password123', false, false, null, false, false];
  let index = 0, effect, submitCalls = 0;
  const started = { current: false }, events = [];
  const location = { hash, pathname: '/set-password', search: '' };
  const Page = loadTypeScript('app/set-password/page.tsx', {
    react: { ...React,
      useState: () => { const i = index++; return [values[i], value => { values[i] = value; }]; },
      useRef: () => started,
      useEffect: callback => { effect = callback; },
    },
    'next/navigation': { useRouter: () => ({ replace() {}, refresh() {} }) },
    '@/lib/supabase/client': { createClient: () => { events.push('client'); return { auth: { setSession } }; } },
    './actions': { setAccountPassword: async () => { submitCalls++; return { destination: '/portal/profile' }; } },
  }, { window: { location, history: { state: null, replaceState: () => { events.push('scrub'); location.hash = ''; } } } }).default;
  function render() { index = 0; return Page(); }
  function findForm(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'form') return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const result = findForm(child); if (result) return result;
    }
    return null;
  }
  render();
  return { values, events, runEffect: () => effect(), submit: () => findForm(render()).props.onSubmit({ preventDefault() {} }), submitCalls: () => submitCalls };
}

test('verified invite hash is persisted by shared browser client before server password submission', async () => {
  let complete, credentials;
  const h = invitePage('#type=invite&access_token=fixture-access&refresh_token=fixture-refresh', payload => {
    credentials = payload;
    return new Promise(resolve => { complete = resolve; });
  });
  h.runEffect();
  h.runEffect(); // React Strict Mode effect replay must not bypass initialization.
  assert.deepEqual(h.events, ['scrub', 'client']);
  assert.equal(credentials.access_token, 'fixture-access');
  assert.equal(credentials.refresh_token, 'fixture-refresh');
  await h.submit();
  assert.equal(h.submitCalls(), 0);
  complete({ error: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.values[6], true);
  await h.submit();
  assert.equal(h.submitCalls(), 1);
});

test('failed or malformed invite sessions cannot submit a password', async () => {
  for (const hash of ['#type=invite', '#error=access_denied&error_description=expired', '#type=invite&access_token=fixture&refresh_token=fixture']) {
    const h = invitePage(hash, async () => ({ error: { message: 'invalid token' } }));
    h.runEffect();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(h.values[4], /invalid or expired/);
    assert.equal(h.values[6], false);
    await h.submit();
    assert.equal(h.submitCalls(), 0);
  }
});

test('existing cookie or server-confirmed invitation sessions keep server password flow', async () => {
  const h = invitePage('');
  h.runEffect();
  assert.equal(h.values[6], true);
  assert.equal(h.events.length, 0);
  await h.submit();
  assert.equal(h.submitCalls(), 1);
});
