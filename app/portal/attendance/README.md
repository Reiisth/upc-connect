# Service attendance integrity (Phase 1C)

## Current eligibility versus recorded history

New manual/QR attendance requires an active, non-archived member currently in the
service branch. Historical attendance is anchored to the recorded service/member
pair, not today's member roster. The detail loader reads all service records,
then merges their member identities with the current eligible roster. A person
appears once. Transfers, archive and stored member-status changes cannot remove
recorded rows or change Present/Late/Excused/physical-check-in totals.

Historical member lookups fetch identification/status only for recorded member
IDs. No contacts or unrelated branch rosters are loaded. Missing member identities
use the stored member ID as a fallback. Unsupported stored attendance statuses
fail explicitly rather than disappearing or becoming inferred absence. Internal
batched reads exhaust recorded results; no UI pagination is introduced.

Currently Eligible and No Record (Current Roster) describe today's population,
not a historical eligibility denominator or proof of absence at an old service.
Physical Check-ins = Present + Late. Excused is recorded but non-physical.

## Lifecycle and corrections

| Service status | New manual/QR | Existing-record correction |
| --- | --- | --- |
| scheduled | Allowed, preserving existing early check-in | Allowed with attendance.correct |
| ongoing | Allowed | Allowed with attendance.correct |
| completed | Blocked | Allowed with attendance.correct |
| cancelled | Blocked | Blocked; history remains readable |

Both write paths use `services/lifecycle.ts`. Page capabilities are presentation
only; each action rechecks active account, exact operation permission, service
branch scope and lifecycle. Correction is authorized against an existing record
in the accessible service, without requiring today's member branch/status/archive
eligibility. It never changes service_id or member_id. The form includes the
record ID to reject stale/tampered corrections instead of inserting replacements.

The unique(service_id, member_id) constraint remains unchanged. QR duplicates,
including concurrent insert conflicts, return the existing record without a
write. Manual saves targeting an existing pair are corrections. The existing
manual conflict-recovery behavior remains: re-read the winning record, require
attendance.correct, recheck service scope/status, then update that record. A
record-only actor cannot overwrite a concurrent winner.

Cancelled services with recorded attendance show a warning and retain all rows;
they remain excluded by existing Reports/Inactivity completed-service rules.
No automatic deletion or lifecycle reopening occurs.

## Time conventions confirmed from live column metadata

- services.service_date: PostgreSQL DATE, a Manila calendar date. Keep the
  YYYY-MM-DD value unchanged for storage, filters and reporting.
- services.start_time: TIME WITHOUT TIME ZONE, Manila local wall time.
- attendance_records.check_in_time and created_at: TIMESTAMPTZ, absolute instants.
- services.created_at/updated_at: TIMESTAMPTZ.

`lib/manila-time.ts` interprets datetime-local inputs with explicit UTC+08:00
(the modern Asia/Manila convention), validates calendar/time round trips and
stores UTC ISO instants. No host-local parsing is used. Timestamp displays use
Asia/Manila; edit controls use Manila wall time with seconds. Unchanged correction
times preserve the original subsecond value. Blank input retains the established
default: server current instant for Present/Late, null for Excused. Service-list
sorting combines DATE/TIME with explicit +08:00 only when an instant is needed.
No attendance timestamp is rewritten by editing a service.

## Compatibility and remaining limits

Reports already aggregates physical attendance from stored service/member pairs,
with no current member branch/status/archive filter. Its SQL and DTO definitions
are unchanged. Inactivity's weekly algorithm is unchanged: completed service
dates, current member branch and first_attendance_date remain authoritative.
There is still no transfer-effective-date or historical eligibility roster.
Restoring historical visibility does not invent either.

Existing active-branch access rules remain: this phase does not add access to
services in inactive branches. Member names are current identity data, not an
immutable name-at-attendance snapshot. Pre-1990 historical Philippine daylight
saving rules are not modeled by the fixed-offset datetime input convention.

The application uses separate database requests. Service writes compare the
previous branch/date/status to reject stale metadata edits; attendance conflict
recovery rechecks scope/status. These checks are not a database transaction with
new attendance/contribution inserts or member transfers. Strict concurrent-write
and direct-database enforcement would require a narrow locking RPC/trigger, left
as an explicit deployment/product decision rather than silently adding schema.

Before Phase 1D, decide whether a dedicated audited workflow should support
missed attendance insertion after completion, reopening/cancelling completed
services, and correction of cancelled-service anomalies. Normal actions currently
block these operations. This phase adds no schema or RLS changes.
