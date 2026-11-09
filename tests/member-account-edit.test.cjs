/* eslint-disable @typescript-eslint/no-require-imports -- Server action authorization harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
function harness({ permissions = ['accounts.update_display_name'], scope = true, archived = false, linked = true } = {}) {
  const writes = [], checked = [];
  const profile = { display_name: 'Old Name', archived_at: archived ? '2026-01-01' : null };
  const admin = { from: table => {
    let patch;
    const q = { select: () => q, eq: () => q, is: () => q, update: value => { patch = value; return q; }, maybeSingle: async () => {
      if (patch) { writes.push(['profile', patch]); return { data: { id: 'linked-account' }, error: null }; }
      return { data: table === 'account_members' ? linked ? { user_id: 'linked-account' } : null : profile, error: null };
    } }; return q;
  }, auth: { admin: { getUserById: async () => ({ data: { user: { email: 'old@example.com' } }, error: null }), updateUserById: async (id, patch) => { writes.push(['auth', id, patch]); return { error: null }; } } } };
  const action = loadTypeScript('app/portal/members/account-actions.ts', {
    './data': { requireStaffMember: async (id, permission) => { assert.equal(id, 'member'); assert.equal(permission, 'members.view'); return { admin }; } },
    '../accounts/access': { requireAccountsPermission: async permission => { checked.push(permission); if (!permissions.includes(permission)) throw Error('redirect:denied'); return {}; } },
    '../accounts/target-scope': { requireAccountTarget: async (_access, _admin, id) => { assert.equal(id, 'linked-account'); if (!scope) throw Error('redirect:denied'); } },
    'next/navigation': { unstable_rethrow: error => { if (error.message.startsWith('redirect:')) throw error; } },
    'next/cache': { revalidatePath() {} },
  }).saveLinkedAccount;
  const form = (name = 'New Name') => { const f = new FormData(); f.set('display_name', name); f.set('user_id', 'tampered-account'); return f; };
  return { writes, checked, save: formData => action('member', { error: null }, formData), form };
}
test('display-name editing uses full target scope and never writes Auth email', async () => {
 const h=harness();assert.equal((await h.save(h.form())).saved,true);
 assert.deepEqual(h.checked,['accounts.update_display_name']);
 assert.deepEqual(JSON.parse(JSON.stringify(h.writes)),[['profile',{display_name:'New Name'}]]);
 for(const options of [{permissions:[]},{scope:false}]){const h=harness(options);await assert.rejects(h.save(h.form()),/denied/);assert.equal(h.writes.length,0);}
});
test('email tampering, archived accounts and unlinked members cannot be saved', async () => {
 const h=harness();const form=h.form();form.set('email','new@example.com');assert.ok((await h.save(form)).error);assert.equal(h.writes.length,0);
 for(const options of [{archived:true},{linked:false}]){const h=harness(options);assert.ok((await h.save(h.form())).error);assert.equal(h.writes.length,0);}
});
