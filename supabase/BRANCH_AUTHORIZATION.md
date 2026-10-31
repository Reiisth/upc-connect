# Role and branch authorization hardening

Migration: `migrations/20261031090000_harden_branch_authorization.sql`.
This additive, transactional migration is prepared for normal deployment; creating
and testing it does not apply it to live Supabase.

## Verified live baseline

The client supplied `pg_get_functiondef`, function ownership/ACLs, table columns,
all four branch-assignment policies, and helper-dependent policy metadata on
2026-10-31. The repository did not previously version these baseline definitions.
`tests/fixtures/branch-authorization.sql` reproduces the relevant definitions and
RLS restrictions in an isolated database, not a full production schema.

- `has_role(role_name text)` and `has_any_role(role_names text[])` joined
  user_roles to roles, comparing `roles.name` without role activity or profile
  archive checks.
- `has_branch_access(branch_id uuid)` returned `has_role('system_admin') OR`
  explicit user_branch_access membership, without an active-profile check.
- All three were SQL, STABLE, SECURITY DEFINER, owned by postgres, with
  `search_path = public, pg_temp`; execution was granted to postgres, anon,
  authenticated and service_role, with no PUBLIC grant.
- The SELECT-all, INSERT and DELETE system-admin policies repeated the legacy
  name-only role join. The own-SELECT policy was `user_id = auth.uid()`.
- Profiles RLS has no ordinary policy, user_roles has self SELECT, roles has
  authenticated SELECT. Source metadata columns match the UUID/text/boolean/
  timestamp projections in the fixture.

## New contract

Both role helpers require an authenticated subject with an existing profile,
`profiles.archived_at IS NULL`, an assigned active role and a matching **role key**.
Names/display names are presentation metadata. Empty/null/no-match role inputs
return false. There is no arbitrary-user argument or role/permission bypass.

Branch scope requires an existing non-archived profile. An active system_admin
key grants the existing global branch scope; otherwise only explicit assignments
count. A deactivated admin role can no longer grant global scope, but an active
account retains explicit assignments. An archived/missing account has no branch
capability even for an explicit assignment. Restore/reactivation works from
preserved rows on the next statement.

The helper intentionally does not validate branch existence/activity for global
administrators, matching the original branch-scope rule. Operational policies
continue to enforce permissions and active-branch write checks separately.

Only the three named system-admin branch-assignment policies are altered, using
`has_role('system_admin')`. Command, target roles, permissiveness and own-SELECT
remain unchanged. No configurable custom-administrator write policy is added.
Own-SELECT intentionally still exposes one's own assignment rows while archived;
reading those rows is distinct from authorization through has_branch_access.

## Definer safety and grants

CREATE OR REPLACE preserves function signatures, argument names, OIDs, ownership
and policy dependencies. SQL is static, source tables are schema-qualified and
search_path is pinned to public, pg_temp. Definer ownership avoids recursive
user_branch_access RLS and does not require ordinary profile SELECT policies.
Preflight rejects missing helpers, unexpected return types/policy commands and
owners unable to bypass relevant source-table RLS. Failure rolls back everything.

PUBLIC and anon execution are revoked. Authenticated and service_role execution
remain explicitly granted, as does the owner's access. The verified dependency
inventory has only authenticated policy callers, so anon is not required. A
service_role call without an authenticated subject does not invent admin scope.
Service-role table RLS bypass remains an independent trusted-server boundary.

## Compatibility and remaining scope

The supplied live dependency query found SELECT/INSERT/UPDATE policies for
Services, Attendance, Contributions, Baptisms and Follow-ups using
`has_permission(...) AND has_branch_access(...)`, including the nested Services
checks in Attendance. It found no other public function callers. These policies
are unchanged; branch hardening does not bypass their permission predicates.

Inactivity, Reports and Accounts/Administration use the Phase 1A/B server guards
and privileged reads; their application code is unchanged. Reports' aggregation
RPC remains restricted to service_role. Own branch-assignment SELECT still
supports the application's ordinary branch resolver.

This is not a complete database authorization rewrite: `has_permission`, other
table policies, grants, role-key immutability constraints and direct Auth-provider
operations are not changed. The legacy application's uncalled role-name helpers
remain. Key immutability is enforced by existing application role editing, not
introduced as a database constraint here. Catalog source-text scanning is not a
proof that external SQL, views or dynamically constructed calls do not exist.

## Validation

Use an isolated local PostgreSQL server, never production. The opt-in test creates
and drops a uniquely named disposable database and creates conventional test
database roles if missing, so use an isolated cluster as well. It reproduces the
old bypass, applies the actual migration, executes helpers/RLS as authenticated,
tests role keys/activity/archive/restore, SELECT/INSERT/DELETE, exact data and
own-policy preservation, ACLs, pinned search_path, no profile-read policy,
permission/branch independence, repeatability and preflight rollback.

PowerShell:

```powershell
$env:UPC_AUTHZ_TEST_PG_PORT = '55471'
node --test tests/branch-authorization-postgres.test.cjs
```

Optional overrides: `UPC_AUTHZ_TEST_PG_HOST`, `UPC_AUTHZ_TEST_PG_USER`,
`UPC_AUTHZ_PSQL`. Without a port the integration test is skipped. No application
secrets are loaded or live network requests made by this test.
