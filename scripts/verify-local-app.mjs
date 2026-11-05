import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { loadLocalEnv, assertLoopback } from './local-env.mjs';

loadLocalEnv();
const url = assertLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
const origin = 'http://127.0.0.1:3000';
for (const [account, pages] of [
  ['admin', ['/portal', '/portal/members', '/portal/administration/departments', '/portal/administration/service-types', '/portal/reports']],
  ['pastor', ['/portal', '/portal/inactivity', '/portal/follow-ups', '/portal/services']],
  ['member', ['/portal', '/portal/profile', '/portal/profile/a0000000-0000-4000-8000-000000000001', '/portal/account']],
]) {
  const jar = new Map();
  const client = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: cookies => { for (const c of cookies) jar.set(c.name, c.value); } },
  });
  const { error } = await client.auth.signInWithPassword({ email: `demo.${account}@example.com`, password: process.env.UPC_LOCAL_TEST_PASSWORD });
  if (error) throw error;
  for (const page of pages) {
    const response = await fetch(origin + page, { headers: { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }, redirect: 'manual' });
    const html = await response.text();
    assert.equal(response.status, 200, `${account} ${page}: ${response.status} ${response.headers.get('location')}`);
    if (page === '/portal') {
      const destination = account === 'member' ? '/portal/profile' : '/portal/reports';
      assert.ok(html.includes(`NEXT_REDIRECT;replace;${destination};`), `${account}: expected portal redirect to ${destination}`);
    } else {
      assert.equal(/NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|An error occurred in the Server Components render|Application error: a server-side exception/.test(html), false, `${account} ${page}: unexpected redirect/render error`);
    }
    assert.ok(html.length > 1000, 'Expected rendered page');
    console.log(`PASS ${account}: ${page} renders with real local Auth cookies`);
  }
  await client.auth.signOut();
}
