/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner. */
const test = require('node:test'), assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { memberHistoryNavigation } = loadTypeScript('lib/member-history-navigation.ts');
test('member history returns to its source and preserves the source across pagination', () => {
  for (const [path, label] of [['/portal/members/member-1', 'Back to Member'], ['/portal/attendance/service-1', 'Back to Service Attendance'], ['/portal/contributions', 'Back to Contributions'], ['/portal/inactivity', 'Back to Inactivity Monitoring']]) {
    const n = memberHistoryNavigation('member-1', path, '/portal/attendance', 'Back to Attendance');
    assert.equal(n.backHref, path); assert.equal(n.backLabel, label);
    const next = new URLSearchParams(n.pageHref(2).slice(1));
    assert.equal(next.get('page'), '2'); assert.equal(next.get('returnTo'), path);
  }
});
test('direct visits and invalid return destinations use the module fallback', () => {
  for (const path of [undefined, ['x'], '//evil.example', 'https://evil.example', 'javascript:alert(1)', '/portal/members/another-member', '/portal/accounts', '/portal/attendance/../accounts']) {
    const n = memberHistoryNavigation('member-1', path, '/portal/attendance', 'Back to Attendance');
    assert.equal(n.backHref, '/portal/attendance'); assert.equal(n.backLabel, 'Back to Attendance');
    assert.equal(n.pageHref(2), '?page=2');
  }
});
