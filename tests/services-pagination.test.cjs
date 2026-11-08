/* eslint-disable @typescript-eslint/no-require-imports -- Actual client handlers with the existing test harness. */
const test = require('node:test'), assert = require('node:assert/strict'), React = require('react');
const { clientHooks, findElement } = require('./helpers/client-hooks.cjs');
test('Services paginates after filtering, resets all filters to page one and clamps changing data', () => {
  const h = clientHooks('app/portal/services/ServicesTable.tsx', { './ServiceLifecycleActions': { __esModule: true, default: () => null } });
  const services = Array.from({ length: 23 }, (_, i) => ({ id: String(i), name: `Service ${i}`, churchBranchId: i % 2 ? 'b' : 'a', serviceType: i % 2 ? 'prayer' : 'worship', status: i % 2 ? 'scheduled' : 'completed', serviceDate: `2026-01-${String(i + 1).padStart(2, '0')}`, startTime: '09:00:00', branch: { name: 'Branch' } }));
  const props = { services, serviceTypes: [], serviceTypeNames: {}, branches: [], canEdit: false, canManageAttendance: false };
  const render = () => h.render(props);
  const rows = tree => React.Children.toArray(findElement(tree, e => e.type.displayName === 'TableBody').props.children);
  const button = (tree, label) => findElement(tree, e => e.props.children === label);
  let tree = render(); assert.equal(rows(tree).length, 10); assert.equal(button(tree, 'Previous').props.disabled, true);
  const first = rows(tree).map(e => e.key);
  button(tree, 'Next').props.onClick(); tree = render(); assert.equal(rows(tree).length, 10); assert.ok(rows(tree).every(e => !first.includes(e.key)));
  button(tree, 'Next').props.onClick(); tree = render(); assert.equal(rows(tree).length, 3); assert.equal(button(tree, 'Next').props.disabled, true);
  for (const [label, value] of [['Filter by branch', 'a'], ['Service Type', 'worship'], ['Service Status', 'completed']]) {
    tree = render(); const filter = findElement(tree, e => e.props['aria-label'] === label || e.props.label === label);
    filter.props.onChange(label === 'Filter by branch' ? { target: { value } } : value);
    tree = render(); assert.equal(rows(tree).length, 10); assert.equal(button(tree, 'Previous').props.disabled, true);
    button(tree, 'Next').props.onClick();
  }
  tree = render(); findElement(tree, e => e.props['aria-label'] === 'Search services').props.onChange({ target: { value: 'Service 22' } });
  tree = render(); assert.equal(rows(tree).length, 1); assert.equal(button(tree, 'Previous').props.disabled, true);
  findElement(tree, e => e.type.name === 'ClearFiltersButton').props.onClick();
  tree = render(); assert.equal(rows(tree).length, 10); button(tree, 'Next').props.onClick();
  props.services = services.slice(0, 2); tree = render(); assert.equal(rows(tree).length, 2); assert.equal(button(tree, 'Previous').props.disabled, true);
  findElement(tree, e => e.props['aria-label'] === 'Search services').props.onChange({ target: { value: 'missing' } });
  tree = render(); assert.equal(findElement(tree, e => e.props['aria-label'] === 'Services pagination'), undefined);
});
