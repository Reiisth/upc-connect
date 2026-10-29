# Analytics data foundation

Use `getAnalyticsOverview(request?)` from request-scoped server code. It returns
typed aggregate DTOs for future Reports and summarized-data consumers. It adds
no Reports UI, AI integration, export, job, operational writes or snapshots.

```ts
const overview = await getAnalyticsOverview({
  range: { preset: "custom", from: "2026-10-01", to: "2026-10-25" },
  grouping: "week",
  branchId: selectedAccessibleBranchId, // omit to include all accessible branches
});
```

## Access and deployment

The sole public server entry requires the authenticated current account's
`reports.view`, then resolves existing `getUserBranchScope`. It never uses
operational role names or treats Reports permission as global branch access.
No source-module permissions are additionally required. As a result Reports
permission intentionally grants access to aggregate financial and operational
data within the permitted scope. No individual names, contact details, notes,
performer accounts or raw source records are returned.

Apply `20261029090000_add_reports_analytics.sql` before using the entry point.
It creates the read-only, `STABLE SECURITY INVOKER` aggregation RPC
`get_reports_analytics`, callable only by `service_role`. Anonymous and
authenticated browser roles cannot supply arbitrary branch arrays to it. The
server validates every selected branch before invoking the existing privileged
client. RPC access is a trusted server boundary, not a replacement for the
server's permission/scope checks. Source table RLS and permissions are unchanged.

All branches means exactly the IDs returned by the existing scope helper.
An explicit inaccessible branch is rejected, not silently replaced. Assigned
inactive branches remain available for historical aggregates if the helper
exposes them; the existing system administrator behavior exposes active branches.
Current inactivity is calculated only for active branches. An inactive branch's
comparison result has `inactivity: null`; the overview's current inactivity
population includes active branches only.

## Dates and time series

- `last_7_days`, `last_30_days`, and `last_90_days` include today and the preceding
  6, 29, or 89 dates. `year_to_date` starts January 1. Default is last 30 days.
- Custom ranges use inclusive ISO calendar dates, with start on/before end.
  Valid future custom ranges are allowed; range metrics count source records
  dated within them rather than pretending they have all occurred already.
- The reference date `asOfDate` is today in Asia/Manila. Current inactivity and
  latest follow-up state are independent of the selected historical range.
- `day`, `week`, and `month` grouping are explicit. Weeks start Monday; source
  service/contact/contribution/baptism dates are local DATE values. Membership
  `created_at` instants are converted to Manila dates before grouping/filtering.
- A series bucket is labelled by its calendar start, which can precede the
  reporting range. Counts inside it still honor the exact inclusive range.
  Series are sorted and sparse: unoccupied periods are omitted. A future chart
  may fill count/amount gaps with zero, but must not invent participation rates.

## Metric definitions

| Metric | Source and date | Filters and meaning | Missing/unknown handling |
| --- | --- | --- | --- |
| Membership population | `members`, current state | Current member branch in scope. `nonArchivedMembers` uses `is_archived = false`; `storedActiveMembers` additionally uses `member_status = active`; `archivedMembers` uses `is_archived = true`. | Stored status is administrative and never substituted for derived inactivity. Null branch members have no scoped branch and are excluded. |
| Records added / record creation trend | `members.created_at` in Manila | Includes currently archived and non-archived records created in range, grouped by current branch. | Explicitly record creation, **not** church membership acceptance or historical branch entry. Null creation dates contribute no date-range event. |
| First-attendance trend | `members.first_attendance_date` | Counts recorded first-attendance dates in range, including currently archived records. | A separately named proxy for arrival history, not verified membership-start growth. Missing dates contribute no event. `missingFirstAttendanceDate` counts non-archived members lacking the date. |
| Completed services and physical attendance | `services.service_date` in range; `attendance_records` linked by service | Only `status = completed`; physical status is present or late, with manual/QR equivalent. Distinct `(service_id, member_id)` pairs prevent duplicate check-ins. No current member-status/archive filter rewrites historical attendance. | A service with no physical attendance contributes zero attendance and remains in the average denominator. No services means average null. |
| Attendance totals/dimensions/trends | Same as above | Total check-ins = physical member/service pairs; unique members are distinct within each aggregate, **not summed from branches or services**. Average = check-ins/completed services, rounded to two decimal places. Group by branch, service type or selected calendar period. | Zero counts and empty dimension/series arrays when no data. |
| Weekly attendance | Completed services and physical pairs, grouped Monday–Sunday | Unique members attending at least once per branch week; global weekly rollups deduplicate across selected branches. `eligibleCompletedServiceWeeks` counts distinct full finished weeks containing a completed service. No-service weeks are absent. | `isFinished` excludes the current unfinished week from eligibility; `isPartialRange` identifies clipped weeks. Current/clipped weeks may still show activity counts. `eligibleMemberCount` and `participationRatePercent` are always null until reliable historical eligibility rosters exist. |
| Current inactivity | Existing `calculateWeeklyInactivity` and minimal source inputs | Non-archived members in current active branches, regardless of stored status. Each branch uses its own threshold. The established full finished-week, initial partial-week, no-service-week, present/late reset rules remain authoritative. | Missing/invalid first attendance dates are unknown. Percentage denominator is calculable members only. No calculable members means percentage/average streak null. Known future starts or no eligible history retain the existing calculator's zero-streak result. |
| Inactivity aggregates | Existing per-member summaries | Counts calculable derived Active/Inactive/Unknown, average streak over calculable members, and members with exactly one remaining absent eligible week before threshold. | Unknown members are excluded from streak averages/threshold-distance counts; no values are written back. |
| Follow-up activity | `member_follow_ups.follow_up_date` in range | Total records, distinct members, method/outcome groups and trend; uses each record's stored branch. | Empty activity returns zero/empty arrays. No role/member-status filter changes historical action counts. |
| Current follow-up state | Same table, all accessible selected history with `follow_up_date <= asOfDate` | Latest per member ordered by follow-up date DESC, creation time DESC, ID DESC. `latestNeedsFollowUpMembers` counts only latest `needs_follow_up`; latest outcome distribution includes all outcomes. A later resolved entry supersedes earlier needs-follow-up. | There is no invented generic unresolved-case status. Scope is latest **accessible selected** history; a later action in an inaccessible/unselected branch is not consulted or leaked. Future-dated actions do not become current early. |
| Overdue latest next dates | Latest accessible follow-up per member | `next_follow_up_date < asOfDate`. Only the latest record's explicit date matters. A later null next date supersedes earlier dates. Any latest outcome may carry an explicit next date, including resolved. | Null or due-today/future dates are not overdue. Unlike the operational list's per-record due filter, this analytics metric describes latest per-member state. It is not a stored reminder/case status. |
| Contributions | `financial_contributions.contribution_date` in range | Every scoped row, including anonymous/null-member contributions. Counts, exact totals, averages, contribution-type/payment-method groups, trend and branch totals. | Empty total is `0.00`; average is null. No member join can accidentally exclude anonymous or transferred members. |
| Baptisms | `baptism_records.baptism_date` in range | Total, water, Holy Ghost, trend and branch totals use the date and `water` / `holy_ghost` types already used by the module. | Null baptism dates never enter date-range totals/trends. `undatedRecords` separately counts all scoped undated records as a current data-quality measure, independent of range. No `created_at` fallback. |

## Money precision

The contribution module stores `numeric(12,2)` amounts and exposes decimal
strings / safe integer cents through its helpers. The aggregation follows that
same exact-decimal convention: PostgreSQL computes NUMERIC SUM/AVG, rounds the
average to cents (half-up for non-negative amounts), and casts both totals and
averages to text **before JSON serialization**. TypeScript never sums or divides
money as binary floating point. It also never sends aggregate totals through
the existing single-record safe-cent parser: a valid aggregate can exceed its
safe-integer limit. Future formatters must preserve these decimal strings.

## Queries and consistency

One aggregation RPC filters all sources by the validated branch set and uses
`COUNT`, exact `SUM`/`AVG`, grouping sets and distinct attendance pairs. Global
rollups are computed separately rather than summing branch unique-member counts.
Only compact aggregates cross the API for membership, attendance reporting,
follow-ups, contributions and baptisms.

The explicit exception is existing TypeScript inactivity calculation: minimal
non-archived member inputs are paginated, then two paginated streams load
completed services and qualifying attendance across all selected active branches.
History is bounded by the earliest usable first-attendance date and today, never
by an arbitrary last-eight-week/report window. There are no queries per member
or per branch. The shared calculation function receives each branch threshold.

The RPC reads its aggregates in one database statement snapshot. Branch metadata
and inactivity inputs are separate reads and may change during a concurrent
correction/transfer/threshold edit; a subsequent request recalculates them. There
are no persisted analytics snapshots or cross-request caches.

## Ambiguities before Reports UI / AI summaries

1. The core table DDL is not fully versioned in the repository. Columns above
   were inspected in existing operational queries/types; the new RPC is verified
   in a representative isolated PostgreSQL schema, not applied to live data.
   Migration preflight checks require `members.created_at` to be `timestamptz`
   and contribution `amount` to be exact `numeric`; a differing deployed type
   fails with an explicit review message instead of silently changing semantics.
2. No reliable church membership acceptance/branch-transfer/reactivation history
   is available. Current branch allocation and current archive flags cannot
   reconstruct a net historical membership roll. Keep record creation and first
   attendance labelled separately; do not call either verified net membership growth.
3. Historical eligibility denominators need an agreed roster/start/transfer
   policy before weekly participation percentages can be populated.
4. Current follow-up state is a latest-record interpretation within selected
   scope, not case ownership or a globally synchronized resolution workflow.
5. Current metrics (`inactivity`, latest follow-ups, undated baptism quality) must
   remain visually distinct from selected-range activity in the future UI and
   in any summarized-data prompt.

## Verification

Run `node --test tests/analytics.test.cjs tests/inactivity*.test.cjs tests/follow-ups-*.test.cjs`.
Run `npm run build`, targeted ESLint on `lib/analytics`, and `git diff --check`.

The real SQL aggregation test is opt-in: set `UPC_ANALYTICS_TEST_PG_PORT` for an
isolated local PostgreSQL server and run `node --test tests/analytics-postgres.test.cjs`.
Optional host/user/psql-path overrides use the same `UPC_ANALYTICS_TEST_*` prefix
(psql path is `UPC_ANALYTICS_PSQL`). It creates and drops its own uniquely named
test database and uses only fixture records; never point it at a production server.
