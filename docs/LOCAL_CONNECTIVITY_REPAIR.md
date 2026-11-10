# Local Docker HTTP connectivity repair — 2026-11-10

## Diagnosis

The stack is managed by Supabase CLI 3.0.0 through `scripts/local-db.mjs`, using project `upc-connect-local` and `supabase/config.toml`. Container labels matched this repository. Kong, Studio, Auth, and PostgREST were attached to the same expected bridge network; network IDs, endpoint IDs, aliases, addresses, and port bindings were consistent. No duplicate project network was found.

The existing Kong and Studio containers were healthy internally but their original published ports accepted TCP and closed without an HTTP response. Windows curl returned error 52 on both 54321 and 54323. A fresh nginx container published successfully. A temporary proxy on the Supabase network also reached existing Kong and Studio through fresh loopback ports: Auth 200 and Studio 307.

This isolated the HTTP failure to the old containers' published-port path, rather than Auth, Kong routing, the application, or general Docker port forwarding. Reattaching their network endpoints and restarting the containers did not repair it. Recreating only Kong and Studio restored their original published ports. This supports stale per-container Docker publishing/forwarding state as the failure domain; the underlying Docker Desktop/WSL defect that originally caused that state was not established.

## Repair and preservation

Only `supabase_kong_upc-connect-local` and `supabase_studio_upc-connect-local` were recreated. Their exact image IDs, environment, command, port bindings, and mounts were preserved and compared after creation. Existing aliases/IPs were retained. Kong's generated configuration and certificate/key files were preserved privately. Original stopped HTTP containers were retained for rollback until verification, then removed without any volume-removal flags.

PostgreSQL, Auth, Storage, PostgREST, Realtime, and their data volumes were not recreated or reset. The PostgreSQL and Storage container IDs stayed unchanged. No migration, reseed, volume prune, `down -v`, or database reset was run.

Before/after counts and ordered ID fingerprints matched for all 8 Auth users, all 31 members, and storage objects (0). The pre/post table statistics also matched before test execution. Auth sign-in naturally updates session/login metadata; no existing user or member identities were removed. Private configuration snapshots and diagnostic artifacts live only under ignored `supabase/.temp` and were not printed or committed.

The temporary HTTP/SQL proxy and stopped rollback HTTP containers were removed after checks. The user's pre-existing `port-test` container was left untouched.

## Environment and application verification

`.env.local` intentionally targets hosted Supabase. It was not overwritten. `.env.supabase.local` supplies the local loopback API URL; `npm run dev:lan` injects the detected LAN URL for the browser before Next starts and keeps privileged Supabase on loopback. The managed LAN development server was freshly started and left running. No environment files, authentication code, caching, pagination, or prefetch settings changed.

- Windows Auth health on `127.0.0.1:54321`: HTTP 200, final check 9 ms.
- Windows Studio on `127.0.0.1:54323`, following its redirect: HTTP 200 with HTML, final check 60 ms.
- Both localhost and detected-LAN browser login flows succeeded with local QA credentials.
- Protected Reports and Members loaded. Logout returned session 401; browser Back did not restore protected data.
- No `AuthRetryableFetchError` or Auth fetch failure occurred in those flows.
- Warm `/login` requests measured 33–66 ms total with approximately 3–6 ms in proxy, versus the reported roughly 25 seconds in proxy. Initial dev compilation was slower, as expected.
- ESLint, `npx tsc --noEmit`, and production build passed. The unrelated parent-directory package-lock warning remains.

## Remaining findings and test qualification

The first full test run exposed the same stale publishing symptom on PostgreSQL host port **54322**: host psql connections were closed, while internal PostgreSQL accepted connections. That port was not repaired because recreating the database container was unnecessary for the HTTP/login repair. It remains a separate local tooling connectivity issue; do not describe all published stack ports as repaired.

To verify SQL behavior without touching the database container, a temporary loopback SQL forward on 18082 connected to the existing database over the Docker network. All **472 tests passed, none skipped**, using this forward. Tests used their existing disposable databases and cleanup. The forward was subsequently removed; rerunning database integration tests directly on 54322 will remain blocked until that publishing issue is repaired.

Browser probes also observed Next development's `Performance.measure` error: `PortalPage [Prerender] cannot have a negative time stamp`. Authentication, protected navigation, logout, and Back assertions still passed. This is separate from the repaired transport failure and was not addressed by changing auth/cache code.
