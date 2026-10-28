# UPC Connect Development Instructions

## Project

UPC Connect is a church management system built with:

- Next.js 16.3 App Router
- TypeScript
- Supabase Auth + PostgreSQL + RLS + Storage
- Tailwind CSS
- PWA

## Architecture

The application uses one unified portal:

/portal

Users may have multiple roles.

Roles:

- system_admin
- pastor
- accounting_officer
- evangelism_officer
- spiritual_ministry_officer
- usher
- member

Role access must be enforced using the existing RBAC helpers.

Use:

- `requirePortalTab()` for protected portal pages
- existing Supabase server/client/admin helpers
- existing RLS policies

Do not reintroduce the old `/staff` architecture.

## Important Next.js rule

This project uses:

`cacheComponents: true`

Runtime data such as authentication, search params, and other request-dependent
data must remain underneath appropriate Suspense boundaries.

Do not remove Suspense boundaries simply to silence errors.

## UI Design System

Reuse components from:

`components/ui`

Prefer existing shared components over creating page-specific duplicates.

Important components include:

- PageContainer
- PageHeader
- Button
- Card
- Input
- Select
- Textarea
- FormField
- FormSection
- FormActions
- Table
- TableActionButton
- TableActionSubmit
- StatusBadge
- EmptyState
- ConfirmActionModal
- Skeleton

Design rules:

- Page titles use Radio Canada.
- Brand gradient: #5D94E8 → #203264
- Background: #EEF3FB
- Use light mode only, regardless of system or saved theme preferences.
- Main portal pages do not show a back button.
- Nested pages use PageHeader back navigation.
- Table headers are uppercase.
- Table actions should be small icon + text actions, not boxed buttons.
- Use shared loading skeletons/styles.

## Member Management

Management users should not edit personal member information unless the feature
specifically permits it.

Personal information is primarily maintained by the member/account owner.

Member management should focus on church-related information.

## Account Management

Member accounts may link to multiple member profiles.

Do not hard-delete accounts by default.

Prefer archiving where historical relationships must be preserved.

## Multi-branch

The system supports multiple church branches.

Respect existing:

- `church_branches`
- `user_branch_access`
- branch-aware RBAC behavior

Do not assume all staff can access all branches.

System administrators can access all active branches.

## Development Workflow

Before modifying a feature:

1. Inspect the relevant existing files.
2. Identify existing patterns/components that should be reused.
3. Explain briefly what will change.
4. Make the smallest coherent change.
5. Run TypeScript/build checks.
6. Fix errors caused by the change.
7. Summarize changed files.

Do not perform unrelated refactors.

Do not redesign database architecture without explaining it first.

Do not remove existing working behavior unless explicitly requested.
