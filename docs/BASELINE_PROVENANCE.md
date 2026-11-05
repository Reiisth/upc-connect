# Current-state baseline provenance

`20261104060000_current_state_baseline.sql` is a current-state checkpoint, not
reconstructed historical truth. Historical replay was abandoned because the
foundational schema was missing, wedding history was ambiguous, and role grants
were intentionally edited through the RBAC UI.

The source is the user-provided hosted schema-only `remote_schema.sql`, retained
unchanged. Its original dump command and capture time are unavailable. The
manifest records its SHA-256. Tables, constraints, indexes, function bodies,
policies and comments were extracted as complete SQL statements and reordered:
tables and keys first, then dependent functions, policies, triggers and ACLs.
No dump SET switches, blanket default privileges, owners, platform internals or
extension declarations were carried over. PostgreSQL 17 supplies built-in
`pg_catalog.gen_random_uuid()`; the baseline asserts that dependency.

The reference JSON reconstructs the exact values reported by the preceding
read-only hosted API capture on 2026-11-04, with final joined RBAC verification
at 05:20:41.401 UTC. It was not re-exported during implementation. The original
six requests were not a single transactional snapshot. Timestamps are preserved
as equivalent ISO instants. Counts: 7 roles, 48 permissions, 70 assignments,
5 service types, 4 departments, 22 field definitions. No operational or Auth
records were included. The current UI-edited matrix overrides old defaults;
system_admin has 33 grants, pastor 18, and neither evangelism nor ministry has
inactivity/follow-up grants.

The user verified and supplied `on_auth_user_created`: AFTER INSERT on
`auth.users`, FOR EACH ROW, public.handle_new_user(), origin-enabled, no WHEN
condition. Only this application-owned Auth trigger is recreated. The two public
triggers are preserved from the dump.

Explicit ACLs retain the hosted access model, including broad table grants.
Restricted RPCs are explicitly revoked from PUBLIC/anon/authenticated before
the approved grants are applied, avoiding inherited local platform defaults.
Definer functions are created by the local postgres migration owner, which must
retain source-table RLS bypass. Trigger-function PUBLIC execution is preserved.
No authorization behavior was intentionally improved or narrowed.

The nine original migrations are archived unchanged outside active replay.
Production data, schema and migration history were not modified. Local Auth
users and demo rows are fictional additions. Local fixture service type and
departments are separate from the hosted-reference subset. No production
reconciliation/repair has been performed or authorized by these scripts.
