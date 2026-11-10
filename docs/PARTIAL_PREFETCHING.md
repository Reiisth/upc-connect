# Portal partial prefetching

Next.js 16.3.3 supports the `prefetch = "partial"` page/layout export with Cache Components. The installed route-segment prefetch and adoption guides were checked before implementation.

The warning originated in navigation intent changing Link prefetch to `true`. This forced full route prefetches for authenticated Inactivity content: cookies/session lookup, permission and branch checks, search parameters, and database-backed weekly attendance analysis. These dependencies must remain request/user specific. Inactivity already streams its content beneath Suspense; no analysis was moved into the persistent portal layout.

## Decision

Use portal-only Partial Prefetching and Next's default prefetch mode, activated on intent. ActiveNavigationLink reuses the shared IntentLink. That component uses false before intent and null afterwards, never true. This preserves focus/touch support and avoids duplicated event logic. The layout continues to own the sidebar, header, navigation, runtime provider, and children.

Option A alone retains forced full prefetches. Option B alone does not adopt the portal App Shell model. The combination is appropriate, but an additional application-query prefetch mechanism is unnecessary: this application uses private Next caches, not a separate client query cache.

Unrestricted viewport Link defaults were tested first. They caused 174 Supabase requests during initial Reports entry, including other modules' reads. Intent-gated defaults reduced that to 40 in the same probe. Thus we retain the request budget instead of eagerly warming every navigation item.

## Route preparation versus data caching

Next Link and the existing bounded, permission-filtered `router.prefetch` warmup prepare routes. They may execute cacheable private work as part of route preparation; partial prefetching does not guarantee zero database work. No custom data-prefetch function is attached to navigation. Existing private cache lifetimes, per-user session checks, targeted invalidation, pagination, and scoped server loaders remain intact.

Adoption is only at `app/portal/layout.tsx`; no global partialPrefetching flag or instant=false exemption was added. Authenticated portal content, including Inactivity, remains dynamic/private. Login and other non-portal routes retain their existing behavior.

## Verification

- All 470 tests passed, no skips.
- ESLint and `npx tsc --noEmit` passed.
- Production build completed. Next emits the existing parent-directory package-lock warning; no dynamic-prefetch warning appeared in the build output.
- Headless Chrome against the production build: cached Members returns 264/280 ms, Reports 327 ms (each includes 200 ms settle); first Members 3136 ms and Inactivity 5159 ms. Initial Reports 9885 ms. These are single-run measurements, not latency guarantees.
- Segment/route-discovery RSC requests still occur. They are not equivalent to duplicate database queries; cached return clicks generated no new document reloads.
- Member direct Inactivity access redirected to access-denied without monitoring content.
- Sign-in succeeded; logout returned session 401; Back could not restore private member content.
- Development-console verification remains outstanding: the existing dev server uses a different auth target, and Next rejected a second development server for this project. It was left running and unmodified. Hover Inactivity after restarting that server to verify the development warning interactively.

Files changed for this correction: portal layout, ActiveNavigationLink, shared IntentLink, a clarifying PortalRuntime comment, regression tests, and this note. Other working-tree performance changes predate this correction.
`nRuntime limitation: the production server logged "Unexpected cache miss after cache warming phase during prerendering" during the browser probes. Navigation completed, but this separate private-cache/prerender issue has not been diagnosed; the result must not be described as warning-free.

Follow-up: the runtime clock and warming diagnostics above were investigated and corrected. See [PRERENDER_TIME_AUDIT.md](./PRERENDER_TIME_AUDIT.md) for sources, fixes, clean development checks, and final measurements.
