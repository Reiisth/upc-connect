const React = require('react');
const { loadTypeScript } = require('./load-typescript.cjs');

/** Exercise actual client event handlers/state without a browser or a new test dependency. */
exports.clientHooks = function clientHooks(entry, stubs = {}) {
  const slots = [];
  const work = [];
  let cursor = 0, pending = 0;
  const hooks = { ...React,
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useTransition() {
      return [pending > 0, (action) => {
        pending++;
        work.push(Promise.resolve(action()).finally(() => { pending--; }));
      }];
    },
  };
  const api = loadTypeScript(entry, { ...stubs, react: hooks });
  return {
    render(props) { cursor = 0; return api.default(props); },
    async settle() { await Promise.all(work.splice(0)); },
  };
};

exports.findElement = function findElement(tree, predicate) {
  if (!React.isValidElement(tree)) return undefined;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props.children)) {
    const match = exports.findElement(child, predicate);
    if (match) return match;
  }
};
