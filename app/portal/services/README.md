# Service lifecycle and historical relationships (Phase 1C)

Service updates require services.update, an active account, and access to both
the existing and resulting active branches. The lifecycle is forward-only:

- scheduled -> scheduled / ongoing / completed / cancelled
- ongoing -> ongoing / completed / cancelled
- completed -> completed
- cancelled -> cancelled

Repeated saves of the same state allow metadata corrections. Completed and
Cancelled are terminal; normal editing cannot reopen them. Creating a service
still accepts any of the existing four valid initial statuses, including empty
historical Completed records; creation does not insert attendance.

Branch changes are rejected if either attendance_records.service_id or
financial_contributions.service_id references the service. The client supplied
live foreign-key metadata confirms these are the two referencing tables. Date
changes are rejected after attendance exists because service_date determines
historical attendance reporting and inactivity weeks. Dependency-query failures
fail closed. These are server-action checks, not merely form restrictions.

Without dependencies, branch changes remain allowed after old/new scope checks.
Name, type, time, notes and permitted status transitions remain editable; type
corrections intentionally change future grouped report reads. Service updates
never rewrite attendance timestamps or contribution fields.

A contribution alone locks branch but not service date. Contributions retain
their own contribution_date, and financial analytics use that date rather than
the linked service date. Moving a service date can change displayed service
context, not the contribution's stored accounting date/amount/branch. Whether
to lock service dates for accounting-event reconciliation is a future product
decision; no Contribution edit behavior is changed here.

DATE/TIME and TIMESTAMPTZ conventions, attendance lifecycle, correction rules,
historical limitations and concurrent-write boundaries are documented in
`../attendance/README.md`. No membership transfer history, snapshots, RPCs or
triggers are added. Navigation and page structure remain unchanged.

Validation: `node --test tests/services-attendance.test.cjs`, full `tests/*.test.cjs`,
TypeScript, targeted ESLint, production build and `git diff --check`.
