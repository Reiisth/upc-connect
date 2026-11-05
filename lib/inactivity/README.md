# Attendance monitoring calculation

Call `getBranchMemberInactivity(branchId)` from request-scoped server code. It
requires `inactivity.view` and the authenticated user's existing branch scope,
including the system administrator scope resolver. It loads non-archived members
assigned to the active branch, regardless of stored `member_status`. The pure
calculation uses system registration time, not `first_attendance_date`. Derived
attendance flags are never persisted.

## Monitoring page and settings

`/portal/inactivity` uses the same server loader and calculator. Users can search,
filter by Attendance Flag or minimum absent weeks, and review members whose
registration timestamp is missing or invalid. Needs Follow-up rows sort first,
then Monitoring rows by descending absence streak, then Unknown rows.

The settings action requires `inactivity.manage_settings`, checks existing branch
scope, validates a threshold from 1 to 52, and writes only
`inactivity_threshold_weeks`. It does not write Member Status, service, or
attendance records. The page calls this setting the Absence Follow-up Threshold.

## Registration date and eligibility

`members.created_at` is the UPC Connect registration timestamp. The existing
Reports migration verifies it is `timestamptz`; the live schema uses a `now()`
default. The server converts the instant to its Asia/Manila calendar date before
week calculations. No new database column is needed.

`members.first_attendance_date` answers when the person first attended church.
It remains historical reference information and is not an attendance eligibility
input. UPC Connect is not importing handwritten attendance history, so missing
digital attendance before registration cannot be treated as absence.

Monitoring starts at the first Monday on or after the Manila registration date:

- Monday registration can make that Monday-Sunday week eligible.
- Tuesday through Sunday registration starts the following Monday; the partial
  registration week is excluded from absence streaks and recent attendance rate.
- Present and late records before the registration date are ignored.
- Only completed-service weeks on or after the monitoring start can contribute
  to absence streaks, rates, Needs Follow-up, or approaching-threshold counts.
- A future registration date remains calculable with no eligible weeks yet.

Missing or invalid `created_at` returns `eligibility_unknown`. A missing, old, or
future `first_attendance_date` does not make the Attendance Flag Unknown. Invalid
reporting dates, thresholds, service dates, and recent-window sizes throw instead
of returning a flag.

Historical branch-transfer effective dates are not stored. The loader uses the
current `members.church_branch_id`, so it cannot reconstruct exactly when a
transferred Member entered the current branch. This limitation remains. Editing
`first_attendance_date`, profile completion, or account connection does not reset
monitoring. Member Status stays an independent human decision and is never
changed by attendance calculations or follow-up outcomes.

## Calendar and attendance rules

- Service dates are local `YYYY-MM-DD` values. The server's current date uses
  Asia/Manila.
- Weeks run Monday through Sunday. Only weeks strictly before the current Monday
  are evaluated for absence and recent-rate calculations.
- A home-branch week is eligible only if it contains a completed service. Scheduled,
  ongoing, cancelled, future, and no-service weeks do not count.
- Present and late records at ANY branch count as physical attendance. Excused records do not.
  QR and manual methods have identical weight.
- One or more qualifying attendances make a week present. Multiple missed
  services make one absent week. A present week stops the consecutive streak.
- The informational rate uses up to the most recent eight eligible finished
  weeks, or fewer if less history exists. An empty denominator yields null.
- Last attendance can include an unfinished week's service and attendance. It
  does not reset the finished-week streak until the week is complete.

## Data loading and verification

The loader reads members first, then home-branch completed services and qualifying
physical participation from the oldest valid registration date. The shared
participation loader batches authorized home-member IDs (100 per batch) and
paginates 500 rows, including attended foreign Services without loading foreign
rosters or profiles. Service reads also paginate 500 rows. It does not query per member or truncate old
post-registration absence history. The calculator groups services by branch/week
and indexes attendance by member/week.

Results are not cached or stored, so later reads reflect attendance corrections.
The API reads do not share a database snapshot; a concurrent edit during
pagination can require a fresh read. The privileged client is used only after
permission and branch-scope checks.

Run `node --test tests/inactivity*.test.cjs` on a Node version with native
TypeScript support. Tests cover registration boundaries, week eligibility,
thresholds, corrections, attendance-rate windows, and Manila date conversion.
Loader tests check that `created_at` controls eligibility and that first
attendance history does not. Action tests check authorization, threshold bounds,
narrow writes, and revalidation.

## Human review boundary

Attendance Flags are Monitoring, Needs Follow-up, and Unknown. Needs Follow-up
asks staff to review a Member. It never changes administrative Member Status.
The separate Review Member Status link uses the existing `members.update` and
branch-scoped Member edit workflow.