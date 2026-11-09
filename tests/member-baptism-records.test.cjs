/* eslint-disable @typescript-eslint/no-require-imports -- Node server-page harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const memberId = '00000000-0000-0000-0000-000000000001';

function harness({ permitted = true, home = 'outside', history = true } = {}) {
  const records = [
    { id:'water',member_id:memberId,baptism_type:'water',baptism_date:null,church_branch_id:'allowed',officiated_by:'Staff',notes:'Water record' },
    { id:'holy',member_id:memberId,baptism_type:'holy_ghost',baptism_date:'2026-11-01',church_branch_id:'allowed',notes:'Holy Ghost record' },
    { id:'hidden',member_id:memberId,baptism_type:'water',baptism_date:'2026-01-01',church_branch_id:'outside',notes:'PRIVATE RECORD' },
  ];
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
  const Page = loadTypeScript('app/portal/baptisms/member/[memberId]/page.tsx', {
    'next/link': { __esModule: true, default: props => React.createElement('a', props) },
    'next/navigation': { notFound: () => { throw Error('not-found'); } },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: table => new Query(table) }) },
    '../../../services/access': { getAccessibleActiveBranches: async () => [{ id: 'allowed', name: 'Accessible branch' }] },
    '../../access': { getBaptismUpdatePermission:type=>type==='water'?'baptisms.water.update':'baptisms.holy_ghost.update', requireBaptismPermission: async permission => { assert.equal(permission, 'baptisms.view'); if (!permitted) throw Error('denied'); return {permissions:[]}; } },
  }).default;
  return { reads, html: async page => {
    const wrapper = Page({ params: Promise.resolve({ memberId }), searchParams: Promise.resolve({ page }) });
    return renderToStaticMarkup(await wrapper.props.children.type(wrapper.props.children.props));
  } };
}

test('baptism records show both types, preserve unknown dates and hide foreign-branch records after transfer', async () => {
 const html=await harness().html();
 for(const label of ['Maria Santos','Water Baptism','Holy Ghost Baptism','Date not recorded','Water record','Holy Ghost record']) assert.ok(html.includes(label),label);
 assert.ok(!html.includes('PRIVATE RECORD'));
 assert.ok(!html.includes('pagination') && !html.includes('>Edit<'));
});
test('baptism records require view permission and current branch or accessible historical records', async () => {
 const denied=harness({permitted:false});await assert.rejects(denied.html(),/denied/);assert.equal(denied.reads.length,0);
 await assert.rejects(harness({history:false}).html(),/not-found/);
 const empty=await harness({history:false,home:'allowed'}).html();
 assert.ok(empty.includes('No baptism records') && empty.includes('No accessible record'));
});
