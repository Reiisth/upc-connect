/* eslint-disable @typescript-eslint/no-require-imports -- Node client event harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const { clientHooks, findElement } = require('./helpers/client-hooks.cjs');

for (const status of ['ongoing', 'scheduled']) {
  test(`${status} icon reviews the correct action and only saves after confirmation`, async () => {
    const calls = [];
    const h = clientHooks('app/portal/services/ServiceLifecycleActions.tsx', {
      './actions': {
        previewServiceCompletion: async id => { calls.push(['preview', id]); return { present: 3, excused: 1, absent: 0, missing: 2 }; },
        finishService: async (...args) => calls.push(['finish', ...args]),
      },
      'next/navigation': { useRouter: () => ({ refresh: () => calls.push(['refresh']) }) },
    });
    const render = () => h.render({ id: 'service', status, iconOnly: true });
    const modal = tree => findElement(tree, e => typeof e.props.onConfirm === 'function');
    let tree = render();
    findElement(tree, e => typeof e.props.actionLabel === 'string').props.onClick();
    await h.settle(); tree = render();
    assert.equal(modal(tree).props.open, true);
    assert.equal(modal(tree).props.title, status === 'ongoing' ? 'Complete Service?' : 'Cancel Service?');
    assert.deepEqual(calls, status === 'ongoing' ? [['preview', 'service']] : []);
    modal(tree).props.onClose(); tree = render();
    assert.equal(modal(tree).props.open, false);
    findElement(tree, e => typeof e.props.actionLabel === 'string').props.onClick();
    await h.settle(); tree = render();
    modal(tree).props.onConfirm(); await h.settle();
    assert.ok(calls.some(call => call[0] === 'finish' && call[1] === 'service' && call[2] === (status === 'ongoing' ? 'completed' : 'cancelled')));
  });
}
