# Phase 2L: cross-branch participation and contributors

Implemented and validated locally on 2026-11-05. Hosted Supabase was not targeted.

## Attendance and authorization

Previously, new manual/QR Attendance required the Member's current home branch
to match the Service branch. It now accepts an active, non-archived Member from
any home branch. Recording still requires `attendance.record`, an active account,
access to the host Service branch, and the existing Service lifecycle checks.
Home-branch access is not required. Neither recording path changes the Member.

The manual form has a church-wide identity search, authorized against its host
Service before querying. It requires two search characters, caps results at 30,
and returns only ID, name, home branch and eligibility flags. QR uses the same
minimal identity context. Full Member Detail still requires its existing
`members.view` and branch checks. No permission, grant or RLS policy was widened.

`Visiting Member` is derived from current home branch versus Service branch.
It appears in selection, recorded attendance and QR feedback; no boolean is
persisted. Unrecorded search results do not become absent host-roster entries.
Recorded foreign Members appear once alongside historical attendance. Existing
service/member uniqueness and host-Service historical correction rules remain.
Later transfer/archive/status changes do not rewrite recorded Service ownership.

## Inactivity and Reports

Eligible monitoring weeks still come from completed HOME-branch Services, with
the first Monday on/after Manila registration date and the home branch threshold.
Present/Late attendance at any completed Service during an eligible week now
prevents absence. Multiple Services/branches in one week count as one attended
monitoring week. Excused, unfinished-week and pre-registration behavior remain.
Member Status is never changed automatically.

Both the operational inactivity loader and Reports' current inactivity inputs
use the shared `lib/inactivity/participation.ts`. It reads participation facts
only for Member IDs already selected through authorized home-branch scope,
batching 100 IDs and paginating 500 rows. It loads neither foreign rosters nor
personal fields. Branch-only users therefore see accurate home-member flags
without gaining foreign Member Detail access.

Attendance Reports still attribute physical check-ins to the host Service branch.
Contribution Reports still attribute money to the receiving financial branch.
The existing RPC already uses these rules without a current Member join; its
architecture and SQL remain unchanged. There was no Member/Anonymous breakdown
to expand. Member, Visitor and Anonymous amounts all enter the existing exact
NUMERIC aggregates. Reports copy and Gemini aggregate terminology now mention
all three categories. Visitor names are excluded by the existing nested AI input
allowlist, with a regression test. No donor identities are sent to Gemini.

There is currently no dedicated Member attendance/contribution history view in
Member Detail/Profile to update. Existing Service and Contribution history keeps
its stored Member link and activity branch independently of home branch.

## Contributions and migration

Previously, new/replacement Member contributors had to belong to the receiving
branch. They may now come from any home branch without home-branch access.
`contributions.create`/`contributions.update` and receiving-branch scope remain
mandatory. The focused options query returns only non-archived Member identity
and home-branch context, after page permission and active receiving scope checks.
It is not used to grant general Member visibility.

New additive migration:
`supabase/migrations/20261105090000_cross_branch_contributors.sql`.
The current-state baseline and captured reference bootstrap remain unchanged.

| Contributor type | Required identity |
| --- | --- |
| `member` | Non-null `member_id`; null `visitor_name` |
| `visitor` | Null `member_id`; trimmed historical name, 1–160 characters |
| `anonymous` | Null `member_id` and `visitor_name` |

Existing Member-linked rows backfill as `member`; existing null-Member rows as
`anonymous`. No names are guessed. A NOT NULL type and database CHECK enforce the
three exclusive combinations. No Visitor table, account, identity matching or
automatic Member creation is introduced. Duplicate visitor names remain separate
historical contribution entries.

Create/edit forms explicitly offer all three categories. Member selection shows
home branch and derived Visiting Member context; Visitor shows a name input;
Anonymous shows neither identity input. The list uses Contributor, displays
category/home context and searches visitor names. No unnecessary filter was added.

Existing correction semantics already allowed replacing/removing a Member link,
so category corrections are allowed with update permission and stored-branch
scope. New Member links must pass current non-archived eligibility; unchanged
historical links survive transfer/archive/status changes. The receiving branch
and original recorder remain immutable under the existing rules. New Service
links must match the receiving branch and be non-cancelled; unchanged historical
Service links remain valid. Exact money validation/storage is preserved.

The schema/policy audit found no same-home-branch database restriction to remove.
Attendance uniqueness, existing financial constraints, FKs and RLS remain intact.

## Demo data and validation

See [DEMO_DATA.md](DEMO_DATA.md) for scenarios A–J. Added Lino at South (Late),
Benjie at North (Present), Lino also at North in the same week, two cross-branch
Member gifts linked to host Services, and Maria Santos' named Visitor gift.
The existing Anonymous gift remains. Lino/Benjie now have zero absence streaks.

- Clean local reset applied baseline plus additive migration, reference bootstrap
  and seed successfully; local Auth setup recreated seven fictional accounts.
- Final clean verification passed: 30 Members, 19 Services, 47 Attendance records,
  23 Contributions (21 Member, one Visitor, one Anonymous), 10 Follow-ups and
  10 Baptisms. All 70 captured role-permission assignments were unchanged.
- Full test suite with disposable local PostgreSQL databases: **344 passed,
  zero failed, zero skipped**. Includes contributor migration/backfill/constraint
  checks, exact receiving totals, host-only recording, lookup privacy, historical
  correction/transfer, any-branch inactivity and AI name exclusion.
- `npm run build`, `tsc --noEmit`, targeted ESLint and `git diff --check`: passed.
  Build retained Cache Components/Suspense behavior. It printed the existing
  warning about the parent-directory package-lock outside the Git repository.
- Real Chrome against the LAN origin: North-only usher recorded Benjie from
  South; mobile viewport showed Visiting Member. North-only accounting created
  Member, Visitor and Anonymous gifts; visitor search retained the entered name.
  South inactivity showed Benjie Monitoring after attendance at North.
- Reports UI totals matched receiving-branch records: North **8,423.53**, South
  **7,960.00**, including temporary browser QA gifts. Browser QA writes were then
  removed by another clean local reset; Auth and fixture verification passed again.
- Screenshots and temporary browser scripts remain ignored under `supabase/.temp`.
  Mobile viewport/LAN testing used desktop Chrome, not physical phone hardware.

## Files changed and remaining decisions

Changed files are the Attendance actions/data/types/form/page/QR view and README;
Contribution actions/data/types/form/list/new/edit pages; Reports display and AI
prompt; inactivity calculator/server/shared participation loader; analytics server
and README; additive migration, seed and local verifier; focused attendance,
inactivity, contribution, PostgreSQL, AI, baseline and seed tests/harness; demo and
historical integrity documentation; and this report. No dependencies were added.

Archived Members remain excluded from new Attendance and Member Contributions.
Administratively inactive Members remain excluded from new Attendance, but are
allowed for Member Contributions. Whether returning inactive Members should be
recordable needs a separate product decision; this phase preserves that rule.
Historical records remain readable/correctable under existing operation rules.

Existing limitations remain: home-branch eligibility cannot reconstruct transfer
effective dates; displayed Member names/home branches are current identity data;
application relationship/lifecycle checks are separate requests rather than a
new locking transaction. No new financial audit ledger or history engine was added.
