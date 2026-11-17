# Portal navigation and branch context

The portal uses a collapsible desktop sidebar and a shared responsive top bar.
The top bar shows the current section, branch context, and account menu (name,
roles, My Account, and logout). Mobile retains its bottom navigation.

Sidebar collapse is remembered per user in local storage. Icon links retain
accessible names and hover titles when labels are hidden.

## Shared branch selection

- `lib/portal-branch-server.ts` resolves the branch from a user-bound, HTTP-only
  cookie and authorized branch options. Invalid, removed, or another user's
  saved selection falls back to All branches.
- `app/portal/actions.ts` validates selections before setting the cookie. Logout
  removes the cookie.
- `PortalFrame` refreshes server content, clears old branch and pagination URL
  state, and remounts page controls after switching. Other filters remain.
- Members, services, attendance, historical contributions/baptisms, follow-ups,
  inactivity, account directories, branch administration, and report analytics
  use this view context. Cards and tables share the same selection.
- Reports use the selection for current and previous periods, migration
  analytics, generated insights, and saved-report lists. Date/grouping filters
  remain local. Chart node highlighting remains a chart interaction.

The selected branch is a read/view filter, never an authorization scope.
Existing permission checks, branch authorization, target coverage, and transfer
source/destination checks continue to use full authorized scope. All branches
always means branches the account can access.

Branch assignment, transfer destination, and visiting-member lookup fields stay
in their record workflows. They are not duplicate page view filters. Personal
account/profile ownership and system-wide configuration catalogs retain their
existing behavior.

Regression coverage includes `tests/portal-branch.test.cjs` and the member,
report, inactivity, pagination, and shared-filter suites. No database migration
is required.
