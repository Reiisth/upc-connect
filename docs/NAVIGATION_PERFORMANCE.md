# Navigation performance audit and implementation

## Audit (10 November 2026)

UPC Connect uses one permission-driven `/portal` shell for staff and members; there are no separate staff/member layouts to merge. Header/sidebar/identity live in `app/portal/layout.tsx` and already persist between child navigations. Next Link is used by navigation; raw anchors in reports are document download/printing, fragment links, or an error retry. No intentional full reload occurs during normal tab navigation. No TanStack Query/SWR or app data Context exists. Supabase reads mostly run in server components/actions with admin reads behind explicit permission + branch checks. Browser client handles Auth. No application-data localStorage cache or duplicated Realtime subscription was found.

Auth/active account/effective permissions already use request-scoped React cache. Branch scope and field definitions do not. Dynamic leaf content has no explicit private lifetime; loading boundaries prefetch shells rather than completing authenticated pages. List pages fetch all rows before client pagination. Members additionally downloads personal fields its table no longer renders. Contributions/Baptisms load records then summaries sequentially; service labels and attendance dashboard work also wait on independent reads. Reports calculate current and previous intervals sequentially and reload the same inactivity input. Navigation links are rendered twice (desktop/mobile), contributing to shell-prefetch bursts.

Baseline: isolated production build on localhost:3100, hosted QA demo admin, headless Chrome, reports -> members -> attendance -> contributions -> members -> reports -> members. Initial portal 17.56s; Members visits 2.109s / 2.084s / 2.095s; Attendance 4.657s; Contributions 3.607s; return Reports 7.707s. Each returned Members view made another RSC request. Timings include a fixed 200ms probe settle; WAN/database conditions affect results. No post-login document reloads. Measurements are not database EXPLAIN timings.

## Architecture and staged plan

Keep Server Components and the existing shell; no new dependency. Use Next private cache for browser-memory authenticated render reuse (never shared server cache). Freshness: live records/reports 30s, member/profile screens 120s, reference admin lists 300s. Queries/actions still authenticate and scope on the server. No records in localStorage/sessionStorage. Do not cache authorization decisions across server requests. Cached display may be briefly stale; mutations always verify fresh access.

Navigation uses bounded role-filtered warmup and hover/focus/touch intent, rather than downloading all module data after login. Keep state/content visible during transition refresh. Paginate large result lists on the server with stable filter/page keys. Optimize independent request waterfalls, request-only duplicate reads, and invalidate related views after mutations. Retain RLS, immutable historical-record rules, and existing module permissions. Do not make financial/attendance optimistic changes.

Files: portal navigation/client guard; relevant portal page loaders; branch/field helpers; analytics/module loaders; large-list loaders/tables; mutation invalidation; performance tests. `eslint.config.mjs` must ignore generated build/private temp artifacts so requested `npm run lint` checks source, not bundled output. No schema/index change without query evidence.

## Risks

Private caching is browser-memory only and lost on reload. It cannot eliminate first-visit WAN latency. Prefetch consumes traffic and is capped/skipped for data saver/slow links. Cached UI is not authorization: every read reaching the server and every mutation keeps checks. Cross-account navigation must clear private cache. Mutation dependencies and permission/scope changes need explicit refresh. Existing Next cacheComponents/Suspense boundaries remain in place.


## Implemented stages and results

- Preserved the existing unified portal shell; no UI redesign, new data library, Realtime subscription, or server-shared user-data cache.
- Enabled a conservative 30-second dynamic/static Router Cache window. Private browser-render scopes declare 30 seconds for live modules and histories, 60 for baptisms, 120 for member/profile/account views, and 300 for administrative reference lists. The route window remains a conservative bound; longer private scopes do not imply that every navigation is guaranteed network-free for that duration.
- Navigation intent (hover/focus/touch) enables Next prefetch. Automatic full-data warmup of all tabs is absent. Up to two authorized small routes may warm only after the visible page skeleton disappears; slow/data-saver connections skip background warming. Large table row links now prefetch on intent instead of eagerly requesting every detail/edit target.
- Auth/branch/field reads deduplicate only within server requests. Module records and dashboard summaries run in parallel. Services/Attendance label reads and the Attendance dashboard run alongside independent page reads. Report current/prior intervals run in parallel and reuse inactivity input within the render.
- Members now requests ten rows, scoped exact totals, and small branch options. Search, branch, archive/status/account/profile filters and sorting run in PostgreSQL; query-string page/filter keys separate cached results. Unused personal fields are no longer sent to the list. Earlier all-row list tests now cover bounded paging and exact counts instead.
- Added dependent private-cache tags while retaining existing path invalidation. Attendance invalidates services/monitoring/reports; contributions invalidate giving/reports; personal changes invalidate member/profile/care/report labels; reference writes invalidate their dependent screens. No optimistic attendance or financial facts are introduced.
- A no-store session revision endpoint detects current account, permission, system-admin capability and branch-scope changes. Focus, restored documents, and visible-page checks refresh or clear stale access. Sign-in uses a deliberate new document to purge previous-account memory; this is an authentication boundary, not normal portal navigation. Logout still deletes Auth cookies through its server action. The proxy lets the guard endpoint deliver its own 401 JSON rather than replacing it with login HTML.

Final solo production probe (hosted QA demo admin, existing authenticated session, same route sequence):

| Navigation | Before | After |
| --- | ---: | ---: |
| Members, first visit | 2,109 ms | 2,630 ms |
| Attendance, first visit | 4,657 ms | 3,632 ms |
| Contributions, first visit | 3,607 ms | 3,085 ms |
| Members, first return | 2,084 ms | 275 ms |
| Reports, return | 7,707 ms | 280 ms |
| Members, second return | 2,095 ms | 293 ms |

Each timing includes a fixed 200ms probe settle. First visits still authenticate/query over the WAN; Members adds exact server counts in exchange for sending only ten records. The first-return Members interval had zero RSC and zero Supabase requests versus one RSC and seven Supabase requests before. Second return also needed no Members RSC; other background requests may overlap an interval, so those are not counted as a new member-data query. Whole traces contain 47 versus 9 RSC requests, but their login entry differs. Comparing only the same navigation leg after the initial report view gives 25 versus 9 RSC requests. Initial report timing from a prepared session is not directly comparable to baseline login+redirect timing. These are observations, not latency guarantees or database execution plans.

Read-only browser checks additionally cover page 2 returning ten different members, search resetting pagination, and clearing filters. Unit/database regressions cover scopes, write authorization, dependent invalidation, session revision changes and no-store denial. Production browser sessions and fetch traces live only under ignored `supabase/.temp`; no credentials or session files are committed.

## Practical limits

Initial reports still require substantial inactivity/report work. No index was added without EXPLAIN evidence. Financial/baptism/service history loaders retain their existing ordered API paging and complete in-browser filter semantics; they are not preloaded at login and only warm after explicit user intent. If those datasets outgrow the current workload, their next improvement is database-backed filtered row pagination like Members, with explicit mixed-member/visitor name sorting and summary-count validation. This work does not claim those full-history loaders are bounded to ten database rows.

A brief cached display is not permission authority. Every server read/action keeps existing authentication/scope checks; session metadata is never a client-side grant. Router Cache is lost on document refresh/sign-in. Next currently may invalidate more browser state internally for revalidatePath than the logical path/tag dependencies request. No cache records are persisted in browser storage or an offline service-worker cache.


Final checks: `npm run lint`, `npm run build`, TypeScript, and 467 tests passed (including the local PostgreSQL suites, no skips). The browser sign-in/sign-out check reached protected Reports, received 401 JSON from the guard after logout, and confirmed browser Back could not restore the Members view. Repeated first-login timing varied with the hosted connection; it is not presented as a guaranteed speedup. No hosted domain records or schema were changed, and nothing was deployed by this task.
