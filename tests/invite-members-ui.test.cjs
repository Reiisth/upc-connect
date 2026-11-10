const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const members = [{ id: 'eligible', first_name: 'Sample', middle_name: null, last_name: 'Member', account_status: 'no_account' }];
function render(props = {}, pending = false) {
  const Form = loadTypeScript('app/portal/members/invite/InviteMembersForm.tsx', {
    'react-dom': { ...require('react-dom'), useFormStatus: () => ({ pending }) },
    './connection-line.module.css': { connector: 'connector', light: 'light' },
  }).default;
  return renderToStaticMarkup(React.createElement(Form, { members, existingEmails: [], defaultEmail: '', action: async () => {}, ...props }));
}
function input(html, id) { return html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? ''; }
test('connection form gates member search until email is supplied and uses repeated member IDs', () => {
  const empty = render();
  assert.match(input(empty, 'connection-member-0'), / disabled=/);
  assert.doesNotMatch(input(render({ defaultEmail: 'account@example.test' }), 'connection-member-0'), / disabled=/);
  assert.match(empty, /name="member_ids"/);
  assert.doesNotMatch(empty, /type="checkbox"/);
});
test('only an eligible prefilled member bypasses the empty-email input gate', () => {
  const prefilled = render({ defaultMemberId: 'eligible' });
  assert.match(input(prefilled, 'connection-member-0'), /value="Sample Member"/);
  assert.doesNotMatch(input(prefilled, 'connection-member-0'), / disabled=/);
  assert.match(input(render({ defaultMemberId: 'foreign' }), 'connection-member-0'), / disabled=/);
});
test('pending connection locks both endpoints and activates the connector', () => {
  const html = render({ defaultMemberId: 'eligible', defaultEmail: 'account@example.test' }, true);
  assert.match(input(html, 'connection-email'), / disabled=/);
  assert.match(input(html, 'connection-member-0'), / disabled=/);
  assert.match(html, /data-connecting="true"/);
  assert.match(html, /Connecting members/);
});

