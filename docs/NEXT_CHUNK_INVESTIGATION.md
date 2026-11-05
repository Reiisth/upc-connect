# Chunk URL investigation — 5 November 2026

## Observed evidence and limits

Two Next processes were simultaneously listening on port 3000:

- PID 25276: `next start --hostname 127.0.0.1`, left running by the earlier local
  validation. Loopback served production Turbopack chunks including
  `/_next/static/chunks/3taof0oe_wp86.js`.
- PID 12504: a Webpack dev server launched with `next dev --webpack --hostname
  0.0.0.0`. LAN served `webpack.js`, `main-app.js` and route-named dev chunks.

Fresh browser sessions initially loaded those different formats on the two
origins. The exact reported `chunks//_next/...js.js` request was **not reproduced
in fresh tabs** during this investigation. Therefore its historical emitting
response cannot be conclusively identified. Mixed/stale Flight metadata and
client runtimes are consistent with the exact URL and the observed conflicting
servers; that part of the diagnosis is an inference, not a captured stack trace.

The stale production server was stopped. The raw dev server was then replaced
with the guarded local LAN launcher so no hosted Auth was used for login tests.
No database schema, permissions, fixture rows or production settings were changed.
Only fictional local-account login/logout flows were exercised.

## Why that exact string can be produced

The inspected Webpack runtime's chunk filename function was:

```js
return "static/chunks/" + chunkId + ".js";
```

With the normal `/_next/` public path, passing a full already-suffixed production
path as a chunk ID yields:

```text
/_next/ + static/chunks/ + /_next/static/chunks/3taof0oe_wp86.js + .js
```

This explains both the duplicate directory and duplicate extension. The first
incorrect transformation would be treating a complete chunk URL as a Webpack
chunk ID. React's Webpack Flight loader normally maps IDs to filenames through
its chunkMap; an incompatible/stale metadata format would miss that mapping.
No application code was found performing that transformation, and the historical
input to that runtime could not be recovered. The runtime/node_modules were not
patched and no string-replacement workaround was introduced.

## Independently reproduced development faults

On the single guarded LAN dev server, browser console and server logs confirmed
that HMR from origin 127.0.0.1 was blocked by allowedDevOrigins. Password visibility
remained unresponsive. The allowlist contained only the LAN host.

Also, unauthenticated ordinary GETs to `/_next/hmr?id=test` received a 307 login
redirect. The proxy matcher excluded only static/image paths, leaving other
Next internals under application auth routing. This was a separate routing
defect; it is not claimed to be proof of the historical doubled URL.

Fixes:

- Development origins include localhost, 127.0.0.1 and the validated optional LAN
  host. Production retains an empty development-origin list.
- Proxy matcher excludes all `/_next/` paths; portal paths remain protected.
- Local launcher refuses occupied loopback ports and uses explicit --port.
- Stopped conflicting processes, removed only the verified project `.next`
  directory, then started one guarded LAN runtime and tested fresh contexts.

## Configuration/search audit

Only `next.config.ts` exists. Its explicit values are cacheComponents=true and
the development-origin list above. assetPrefix, basePath, webpack callback,
output.publicPath, crossOrigin, deploymentId, rewrites, redirects and custom
headers are all unset. No config helpers supply asset paths.

The local/LAN helpers change only the browser Supabase URL, private server URL,
LAN origin and Next bind/port arguments. They do not alter Next asset paths,
runtime globals, NODE_OPTIONS, or NEXT_* asset variables. The database wrapper
only invokes fixed Supabase commands. No asset-related environment names were
found in the two env files or current process; secret values were not logged.

Application static-path matches were the proxy matcher/comments. Other matches
were test assertions, docs/tutorials, normal .json() calls and Chart.js imports.
No base tag, custom server, service-worker registration, public/sw.js,
service-worker.js, next-pwa dependency or PWA interception code was found.
Fresh test browser contexts had zero service-worker registrations. This does
not inspect or clear a physical phone's existing browser registrations/cache.

## Browser validation

After a clean restart, actual headless Chrome sessions on the laptop tested:

- http://127.0.0.1:3000: 26 JS chunk responses, all 200 JavaScript.
- http://192.168.1.13:3000: 27 JS chunk responses, all 200 JavaScript.

Example real request on each origin:

```text
/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client_hmr-client_ts_1rgi81y._.js
```

Both sessions verified password show/hide, fictional local administrator login,
Reports→Members navigation and the unchanged logout Server Action. No doubled
chunk path, .js.js, ChunkLoadError, Unexpected token '<', or blocked HMR appeared.
Response evidence is in ignored `supabase/.temp/chunk-validation-*.json` files.

The original production-named chunk is not expected to exist in a new dev build;
validation uses chunks actually emitted by that build. Logout logic/form and
password visibility component were not changed.

The dev console still reports an existing `/portal` uncached-data/Suspense
diagnostic. Login and navigation succeeded, but that unrelated diagnostic is
not represented as fixed. No physical phone was available; phone validation
remains a user check. Use a new tab/hard reload after the laptop restarts.

## Automated validation

Production build passed (71 generated pages), separate TypeScript and targeted
ESLint passed, and git diff --check passed. Full suite: 333 passed, zero failed
or skipped, including disposable local PostgreSQL integration suites. Regression
tests cover internal endpoint exclusion, retained portal protection, local/LAN
HMR origins, absent asset-path overrides, and occupied-port rejection.
