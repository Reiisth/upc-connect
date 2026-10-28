# Member follow-up workflow

Follow-ups are historical staff actions, independent of attendance-based
inactivity. The application reads/writes the existing `member_follow_ups` table
and does not modify schema, RLS, members, attendance, or inactivity values.

## Access and routes

- `/portal/follow-ups`: `follow_ups.view`, branch-scoped history and filters.
- `/portal/follow-ups/new`: `follow_ups.create`, with validated optional
  `memberId` and `branchId` preselection.
- `/portal/follow-ups/[followUpId]/edit`: `follow_ups.update`, access to the
  historical record's stored branch and an active branch for writes.
- `/portal/follow-ups/member/[memberId]`: `follow_ups.view`; history is limited
  to accessible stored branches. After a transfer, accessible historical records
  still provide member identity even if the current branch is outside scope.

Access comes from the existing current-user permission and branch-scope helpers.
The module does not decide access using role names. Navigation requires view;
create-only and update-only capabilities are also supported through direct
routes and return to an accessible form after saving.

## Writes and historical identity

Creates validate branch scope/activity, the member's current branch, dates,
method/outcome, and performer. No member activity status is required; valid
branch members, including archived members, can have staff-recorded historical
actions. The recorder is always the authenticated account, never a form value.

On edit, member and branch are immutable. Tampered values are rejected. A member
transfer does not invalidate the original relationship. `created_by` stays
unchanged and `updated_at` is explicitly updated. Source reads and narrow
follow-up writes use the existing server/admin-client pattern after permission
and scope checks. There are no delete actions or automatic follow-up inserts.

Performers are existing non-archived profiles (`archived_at IS NULL`, the
application's account lifecycle marker) with at least one role where `is_active`
and `is_staff` are true. Additional member roles do not disqualify them. The
performer does not need permission to record a follow-up. Blank performer is
allowed by the existing nullable schema. A former performer who is now archived
or no longer eligible must be replaced with a qualifying account or cleared
before a correction can be saved. Authentication-provider bans are not a
separate profile lifecycle field in the repository.

## Dates and display

Default follow-up date and due classification use Asia/Manila calendar dates.
Overdue means next date before today, Due Today means equal, and Upcoming means
after today. Null next dates belong to none of these groups. Each historical
record is classified independently of outcome; a later resolved record does not
automatically cancel an earlier record's explicit next date. No reminders or
stored due statuses are created.

Member history may display the current inactivity summary only with
`inactivity.view` and access to the current active branch, using the existing
calculation loader. Resolved never means attendance-based Active. The inactivity
table provides permission-gated record/history links without extra per-member
queries; latest-follow-up snippets are deferred to keep the table concise.

## Loading and verification

Historical records use paginated queries with joined member, branch and performer
names, ordered by follow-up date and creation time descending. Performer choices
use active staff role metadata and batched profiles; form members are loaded by
accessible active branch. There is no per-record or per-member query loop.

Run `node --test tests/follow-ups-*.test.cjs tests/inactivity*.test.cjs` and
`npm run build`. Tests run the real actions, data loaders and rendered components
against in-memory query fixtures. Live authenticated browser checks remain a
separate deployment check. Reads/validation/writes are separate requests, so
concurrent edits use the existing last-save-wins behavior; there is no new
transaction/RPC architecture in this pass.
