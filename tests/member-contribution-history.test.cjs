/* eslint-disable @typescript-eslint/no-require-imports -- Node server-page harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const memberId = '00000000-0000-0000-0000-000000000001';

function harness({ permitted = true, home = 'outside', history = true } = {}) {
  const records = Array.from({ length: 13 }, (_, i) => ({ id: String(i), member_id: memberId, contributor_type: 'member', amount: '100.25', contribution_type: 'tithe', contribution_date: '2026-11-01', payment_method: 'cash', church_branch_id: i === 12 ? 'outside' : 'allowed', notes: `Record ${i} note` }));
  const reads = [];
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.from = 0; this.to = Infinity; }
    select() { return this; } order() { return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); return this; }
    in(key, ids) { this.filters.push(row => ids.includes(key === 'service.church_branch_id' ? row.service.church_branch_id : row[key])); return this; }
    limit() { return this; }
    range(from, to) { this.from = from; this.to = to; return this; }
    result() {
      reads.push(this.table);
      const rows = this.table === 'members' ? [{ id: memberId, first_name: 'Maria', last_name: 'Santos', church_branch_id: home }] : history ? records : [];
      const filtered = rows.filter(row => this.filters.every(filter => filter(row)));
      return { data: filtered.slice(this.from, this.to + 1), count: filtered.length, error: null };
    }
    async maybeSingle() { const result = this.result(); return { ...result, data: result.data[0] ?? null }; }
    then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
  }
  const Page = loadTypeScript('app/portal/contributions/member/[memberId]/page.tsx', {
    'next/link': { __esModule: true, default: props => React.createElement('a', props) },
    'next/navigation': { notFound: () => { throw Error('not-found'); } },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: table => new Query(table) }) },
    '../../../services/access': { getAccessibleActiveBranches: async () => [{ id: 'allowed', name: 'Accessible branch' }] },
    '../../access': { requireContributionsPermission: async permission => { assert.equal(permission, 'contributions.view'); if (!permitted) throw Error('denied'); return {permissions:[]}; } },
  }).default;
  return { reads, html: async page => {
    const wrapper = Page({ params: Promise.resolve({ memberId }), searchParams: Promise.resolve({ page }) });
    return renderToStaticMarkup(await wrapper.props.children.type(wrapper.props.children.props));
  } };
}

test('contribution history has exact full-history totals, ten-record pages, and stored-branch scope after transfer', async () => {
 const h=harness();const first=await h.html('1');
 assert.ok(first.includes('Maria Santos') && first.includes('of 12 records'));
 assert.ok(first.includes('\u20b11,203.00'));
 assert.ok(first.includes('Record 9 note') && !first.includes('Record 10 note'));
 const second=await h.html('2');
 assert.ok(second.includes('Record 10 note') && second.includes('Record 11 note'));
 assert.ok(!second.includes('Record 12 note') && !second.includes('Record 0 note'));
 assert.ok(second.includes('Page 2 of 2'));
});
test('contribution history requires permission and current scope or visible historical records', async () => {
 const denied=harness({permitted:false});await assert.rejects(denied.html(),/denied/);assert.equal(denied.reads.length,0);
 await assert.rejects(harness({history:false}).html(),/not-found/);
 assert.ok((await harness({history:false,home:'allowed'}).html()).includes('No contributions recorded'));
});
