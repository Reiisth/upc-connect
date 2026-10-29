const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

/** Load the actual TS/TSX UI for server rendering, with only external boundaries stubbed. */
exports.loadTypeScript = function loadTypeScript(entry, stubs = {}) {
  const root = path.resolve(__dirname, '../..');
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, process, console, URLSearchParams,
      AbortController, setTimeout, clearTimeout,
      require(name) {
        if (Object.hasOwn(stubs, name)) return stubs[name];
        if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
        const resolved = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
        const source = [resolved, `${resolved}.ts`, `${resolved}.tsx`].find((candidate) => existsSync(candidate));
        if (!source) throw new Error(`Cannot resolve ${name} from ${filename}`);
        return load(source);
      },
    }, { filename });
    return module.exports;
  }
  return load(path.resolve(root, entry));
};
