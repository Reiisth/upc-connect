const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

test('portal runtime renders without reading the clock and starts freshness clocks after mount', () => {
  const refs = [], effects = [];
  let now = 1000;
  let render = true;
  const Runtime = loadTypeScript('app/portal/PortalRuntime.tsx', {
    react: { ...React,
      useState: value => [value, () => {}],
      useRef: value => { const ref = { current: value }; refs.push(ref); return ref; },
      useCallback: callback => callback,
      useEffect: callback => effects.push(callback),
      useTransition: () => [false, () => {}],
    },
    'next/navigation': { useRouter: () => ({}), usePathname: () => '/portal/baptisms' },
  }, { Date: { now() { assert.equal(render, false, 'clock read during server/client render'); return now; } } }).default;
  const node = Runtime({ userId: 'member', revision: 'revision', routes: [], children: 'Baptisms' });
  assert.ok(node);
  assert.equal(refs[0].current, 0);
  assert.equal(refs[1].current, 0);
  render = false;
  effects[0](); effects[1]();
  assert.equal(refs[0].current, 1000);
  assert.equal(refs[1].current, 1000);
  now = 2000;
  effects[1]();
  assert.equal(refs[0].current, 1000, 'route changes must not delay the periodic session check');
  assert.equal(refs[1].current, 2000);
});


test('authenticated Supabase construction waits for IO and keeps request cookie handling', async () => {
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const cookies = { getAll: () => [{ name: 'session', value: 'private' }], set: (...args) => events.push(['set', ...args]) };
  let options;
  const { createClient } = loadTypeScript('lib/supabase/server.ts', {
    'next/headers': { cookies: async () => { events.push('cookies'); return cookies; } },
    'next/cache': { io: async () => { events.push('io'); await gate; } },
    '@supabase/ssr': { createServerClient: (_url, _key, config) => { events.push('construct'); options = config; return 'client'; } },
  });
  const pending = createClient();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['cookies', 'io']);
  release();
  assert.equal(await pending, 'client');
  assert.deepEqual(events, ['cookies', 'io', 'construct']);
  assert.deepEqual(options.cookies.getAll(), [{ name: 'session', value: 'private' }]);
  options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true } }]);
  assert.deepEqual(events[3], ['set', 'session', 'refreshed', { httpOnly: true }]);
});

