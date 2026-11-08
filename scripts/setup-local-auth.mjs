import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { loadLocalEnv, assertLoopback } from './local-env.mjs';

export const accounts = [
  ['admin', 'system_admin', []],
  ['pastor', 'pastor', [1, 2]],
  ['accounting', 'accounting_officer', [1]],
  ['evangelism', 'evangelism_officer', [1, 2]],
  ['ministry', 'spiritual_ministry_officer', [2]],
  ['usher', 'usher', [1]],
  ['member', 'member', []],
];
const branch = number => `b0000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const memberId = 'a0000000-0000-4000-8000-000000000001';
function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function setupLocalAuth() {
  loadLocalEnv();
  const url = assertLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const key = process.env.SUPABASE_SECRET_KEY;
  const password = process.env.UPC_LOCAL_TEST_PASSWORD;
  if (!key || !password || password.length < 12) {
    throw new Error('Provide SUPABASE_SECRET_KEY and UPC_LOCAL_TEST_PASSWORD (12+ characters) for the local stack.');
  }
  // Refuse redirects so a loopback endpoint cannot forward privileged requests to a hosted service.
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }) },
  });
  const roles = checked(await admin.from('roles').select('id,key'));
  const branches = checked(await admin.from('church_branches').select('id').in('id', [branch(1), branch(2)]));
  if (branches.length !== 2) throw new Error('Load the demo seed before local Auth setup.');
  const fixture = checked(await admin.from('members').select('id').eq('id', memberId).single());
  if (!fixture) throw new Error('Demo member missing.');
  const users = [];
  for (let page = 1; ; page++) {
    const data = checked(await admin.auth.admin.listUsers({ page, perPage: 100 }));
    users.push(...data.users);
    if (data.users.length < 100) break;
  }
  for (const [label, roleKey, scopes] of accounts) {
    const email = `demo.${label}@example.com`;
    const role = roles.find(row => row.key === roleKey);
    if (!role) throw new Error(`Missing reference role ${roleKey}`);
    let user = users.find(row => row.email === email);
    if (!user) {
      user = checked(await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { display_name: `Demo ${label}` },
      })).user;
    }
    // Existing passwords and archived state are intentionally preserved on rerun.
    const profile = checked(await admin.from('profiles').select('id,archived_at').eq('id', user.id).single());
    if (!profile || profile.archived_at) throw new Error(`Missing or archived profile for ${email}; check Auth trigger/account state.`);
    checked(await admin.from('user_roles').upsert({ user_id: user.id, role_id: role.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true }));
    if (scopes.length) checked(await admin.from('user_branch_access').upsert(
      scopes.map(number => ({ user_id: user.id, church_branch_id: branch(number) })),
      { onConflict: 'user_id,church_branch_id', ignoreDuplicates: true },
    ));
    if (roleKey === 'member') {
      const link = checked(await admin.from('account_members').select('user_id').eq('member_id', memberId).maybeSingle());
      if (link && link.user_id !== user.id) throw new Error('Demo member is already linked to another account.');
      checked(await admin.from('account_members').upsert({ user_id: user.id, member_id: memberId, relationship: 'member', can_view: true, can_edit: true }, { onConflict: 'user_id,member_id' }));
      const member = checked(await admin.from('members').select('accepted_at').eq('id', memberId).single());
      checked(await admin.from('members').update({ account_status: 'connected', accepted_at: member.accepted_at || new Date().toISOString() }).eq('id', memberId));
    }
    console.log(`Ready: ${email} (${roleKey})`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setupLocalAuth().catch(error => { console.error(error.message); process.exitCode = 1; });
}
