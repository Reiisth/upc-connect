# Weekly inactivity calculation

Call `getBranchMemberInactivity(branchId)` from request-scoped server code.
It requires `inactivity.view` and the authenticated user's existing branch
scope, including the existing system administrator scope resolution. It loads
all non-archived members assigned to the requested active branch, regardless of
stored `member_status`. A usable `first_attendance_date` permits calculation;
members without one remain visible with an explicit unknown result for data
cleanup. Derived values are never persisted.

## Monitoring page and settings

`/portal/inactivity` uses the same loader and summaries, enriched with member
names from the existing batched member query. Navigation and default portal
routing require `inactivity.view`. Branch options are limited to the current
account's existing scope and active branches. Users can search, filter derived
status or minimum absent weeks, and see unknown members that need data cleanup.
Summary cards always describe the whole selected branch, regardless of table
filters. Inactive members sort first, followed by active members in descending
absence order, then unknown members. Rates have no warning thresholds or colors.

The dedicated `updateInactivityThreshold` server action independently requires
`inactivity.manage_settings`, resolves the current user's branch scope, validates
an integer from 1 to 52, and writes only `inactivity_threshold_weeks` on an active
accessible branch. It uses the existing secured admin-client pattern after those
checks; branch RLS is not widened. There is no implicit settings permission for
any role, including system administrators. Custom roles work through their keys.
`revalidatePath('/portal/inactivity')` refreshes the current page after a save so
statuses are recalculated from source data and the new threshold. No member,
service or attendance rows are written by this workflow.

`calculateWeeklyInactivity` is the deterministic calculation core. It accepts
minimal input records and a local reporting date; it does not authorize data
access. Use the server entry point when loading application data.

## Calendar and attendance rules

- Service dates are local `YYYY-MM-DD` dates, not UTC instants. The server
  resolves today's date in Asia/Manila.
- Weeks run Monday through Sunday. Only weeks strictly before the current
  Monday are evaluated for the absence streak and attendance rate.
- A branch week is eligible only when it contains a completed service.
  Scheduled, ongoing, cancelled and future-dated services are excluded.
- Present and late records count as physical attendance. Excused records do
  not. QR and manual methods have identical weight.
- One or more qualifying attendances in a week mean one present week. Multiple
  missed services mean one absent week. No-service weeks are omitted entirely.
- Starting with the latest eligible week, count absent weeks until a present
  week. Compare that count directly with the branch threshold. Remaining weeks
  are clamped to zero. No attendance rate participates in that decision.
- The percentage uses the most recent eight eligible finished weeks, or fewer
  if less history exists. An empty denominator yields null.
- Last attendance may include this unfinished week's completed services. It
  uses the service date, not check-in time; same-date ties use service ID for
  deterministic results. Current-week attendance does not reset the finished-
  week streak until that week finishes.

## Eligibility and known limitations

Members have a current `church_branch_id` and nullable `first_attendance_date`.
The latter is the only attendance-specific start date found in the application.
`created_at` dates record creation; `accepted_at` dates account acceptance and
can be cleared on disconnection. Neither is an eligibility fallback.

Missing or invalid first attendance dates return `eligibility_unknown`, with
null streak, inactive flag, and remaining weeks. Do not display these members
as active or inactive based on this result. A valid future start has no eligible
history yet. No weeks are evaluated before eligibility; the initial partial
week is excluded conservatively, unless eligibility itself falls on Monday.
Attendance on/after eligibility in that partial week can still be the latest
attendance.

Historical branch-transfer and reactivation effective dates are not currently
stored. The loader uses current `members.church_branch_id` and declared
`first_attendance_date`, so transferred members' historical inactivity may be
imperfect: the system cannot know exactly when they became eligible in the
current branch. This is a known future enhancement, not a blocker for the first
version, and no schema is introduced here. The pure core supports a branch-specific
`eligibilityDate` once a reliable source is available. Profile and account
completion do not control monitoring inclusion. Stored `member_status` never
controls inclusion or the derived `isInactive` result, and is never updated.

## Data loading and verification

The server loads members, completed services and qualifying attendance in three
parallel paginated streams, ordered by ID, in pages of 500. There is no query
per member and no fixed eight-week history truncation: long absence streaks
remain accurate. Services are grouped by branch/week once; attendance is indexed
by member/week. The rate uses a separate eight-week slice.

Results are not cached or stored, so later reads reflect attendance corrections.
The API reads do not share a database snapshot: a concurrent correction or service
edit during pagination can require a fresh read. For a future high-volume or
snapshot-consistent reporting requirement, consider a database aggregation RPC.
Live schema/RLS were not inspected; source columns and joins match repository
usage, and the privileged client is used only after permission/scope checks.

Run the inactivity tests with `node --test tests/inactivity*.test.cjs` on a Node
version with native TypeScript support (validated on Node 26). Tests cover the
requested service/week, eligibility, boundary, correction and rate scenarios.
Loader regression tests execute the actual server module with in-memory query
fixtures, verifying stored-status independence, archive/branch exclusion, and
explicit unknown results for missing or invalid dates.
Action tests verify authentication, permission/scope checks, threshold bounds,
narrow writes and revalidation. Server-rendered UI tests exercise the real page,
table and editor, including navigation, derived statuses, branch choices, missing
dates, rate formatting and read-only settings. An authenticated live browser
session is still needed for an end-to-end check against deployed Supabase data.
