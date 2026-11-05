# UPC Connect local demo data

The local setup is now schema baseline ? captured reference bootstrap ? demo
seed ? local Auth accounts. See [LOCAL_SUPABASE.md](LOCAL_SUPABASE.md) for keys,
Docker prerequisites and environment switching.

```powershell
npm run db:local:start
npm run db:local:reset
npm run db:local:status
# Put local credentials and UPC_LOCAL_TEST_PASSWORD in ignored .env.supabase.local.
npm run db:local:auth
npm run dev:local
```

The reset is destructive to the disposable local database only. CLI 3.0.0 resets
locally by default; the fixed wrappers accept no remote-target arguments.
Reference bootstrap runs before demo seed and preserves the captured current
RBAC matrix. It does not restore historical migration defaults.

The seed creates **2 branches, 30 members, 19 services, 47 attendance records,
10 follow-ups, 23 contributions, 10 baptisms, 8 demo departments, and 1 inactive
historical service type**. There are also 4 captured departments and 5 captured
service types, giving totals of 12 and 6 respectively. The seed itself creates
no Auth users or grants.

For a demo-only refresh use `npm run db:local:reseed`. It refreshes relative
Manila dates and scenario fields, retaining linked member account status/email.
It does not erase QA-created operational records. Use a full reset for exact
fixture counts; rerun Auth setup after reset.

## Local Auth and staff setup

`npm run db:local:auth` creates confirmed local-only users through the Admin API
and verifies profiles created by the real Auth trigger. Passwords come from
UPC_LOCAL_TEST_PASSWORD, not committed defaults. Reruns preserve existing passwords.
The script links Bagong to demo.member@example.com and sets connected lifecycle
fields consistently. No raw auth.users inserts or role-permission edits occur.

| Email | Role | Branch scope |
| --- | --- | --- |
| demo.admin@example.com | system_admin | System-wide |
| demo.pastor@example.com | pastor | North and South |
| demo.accounting@example.com | accounting_officer | North |
| demo.evangelism@example.com | evangelism_officer | North and South |
| demo.ministry@example.com | spiritual_ministry_officer | South |
| demo.usher@example.com | usher | North |
| demo.member@example.com | member | Linked self-service |

Role permissions are the captured hosted configuration. In particular,
evangelism/ministry do not receive inactivity or follow-up permissions.

## Scenario members

The weekly inactivity calculator uses Manila calendar dates, counts only prior Monday–Sunday weeks with at least one completed service, starts monitoring on the first Monday on or after registration, ignores pre-registration attendance, and treats `present`/`late` as physical attendance. `excused` does not reset an absence streak. Current-week services are included for service lifecycle display but are not completed historical eligibility weeks.

| Member | Scenario | Expected result |
| --- | --- | --- |
| Bagong A. Dela Cruz | Recently registered, no attendance | Monitoring; no inherited absences |
| Mila B. Reyes | First Attendance Date years ago, UPC Connect registration midweek | Only post-registration eligible weeks count; remains below threshold |
| Lino C. Santos | North member attends North and South in latest finished week | Monitoring; zero-week streak; one attended week |
| Nena D. Garcia | North, exactly three latest eligible absences | Needs Follow-up; Member Status remains Active |
| Ramil E. Mendoza | North, more than three consecutive absences | Needs Follow-up |
| Celia F. Navarro | Flagged with open follow-up history | Needs Follow-up; follow-up does not change Member Status |
| Tomas G. Villanueva | Flagged with a resolved follow-up | Still Needs Follow-up while Member Status remains Active |
| Rosa H. Bautista | Human-marked Inactive with earlier attendance/follow-up | Inactive status is separate; historical records remain |
| Dario I. Flores | Present in the latest completed week after prior absences | Streak resets |
| Elena J. Ramos | Excused in the latest completed week | Excused is not physical attendance and does not reset the streak |
| Noel K. Aquino | Registered on Monday three weeks ago | Monday registration week is eligible; demonstrates the Monday boundary |
| Luz L. Castillo | Registered Wednesday three weeks ago | Partial week ignored; monitoring starts the following Monday |
| Pio M. Domingo | Registered Sunday three weeks ago | Partial week ignored; monitoring starts the following Monday |
| Sinta N. Mercado | `created_at` is NULL and First Attendance Date is NULL | Eligibility Unknown |
| Belen O. Salazar | Archived with completed-service attendance history; assigned to inactive department | Archive state is independent and history remains linked |
| Isko P. Manalo | Archived with attendance and follow-up history | Historical records remain linked |
| Amihan Q. Dizon | South branch, four latest eligible weeks absent | Needs Follow-up at the 4-week threshold |
| Benjie R. Lacson | South member attends North in latest finished week | Monitoring; zero-week streak while Amihan still reaches the South threshold |
| Nardo D. Valdez | Inactive and archived with earlier attendance/follow-up | Historical data remains; no status is derived from attendance |

The cancelled-only week is six weeks back and has no completed service, so the inactivity calculator must skip it. Each branch also has an older completed service using the inactive `UPC Demo Legacy Gathering` type; that row remains valid for historical display. This is a development reference row with a namespaced key and does not alter the managed production types.

Other seeded members provide normal branch attendance histories. The service rows include active managed types (`sunday_morning`, `sunday_evening`, `prayer_meeting`), plus scheduled, ongoing, and cancelled current-week records. Contributions use PHP numeric amounts, supported types/payment methods, member-linked and anonymous examples, and branch-consistent services. Baptisms cover water and Holy Ghost types, both types for one member, and an unknown nullable date.

## Manual QA matrix

| Area | Check | Seed / action |
| --- | --- | --- |
| Inactivity | Monitoring, Needs Follow-up, Unknown | Compare Lino, Nena, and Sinta in Inactivity |
| Inactivity | Branch thresholds | Compare Nena (North, 3 weeks) and Amihan (South, 4 weeks) |
| Inactivity | Monday vs midweek registration | Compare Noel, Luz, and Pio |
| Inactivity | Historical First Attendance and NULL First Attendance | Compare Mila and Sinta; verify `created_at` controls monitoring |
| Inactivity | First week and cancelled-only week are ignored | Check recent eligible week count for Luz/Pio and the older cancelled-only week |
| Inactivity | Attendance resets the streak | Check Dario after his latest completed service |
| Inactivity | Excused does not count as physical attendance | Check Elena |
| Follow-ups | Record from Inactivity and inspect latest history | Add a follow-up for Nena or Celia; confirm it appears in member history |
| Follow-ups | No automatic Member Status change | Compare Nena, Tomas, Rosa before/after follow-up actions |
| Follow-ups | Review Member Status path | Manually mark a test member inactive, then verify follow-up and attendance history remain |
| Administration | Departments | Check active list, `UPC Demo - Legacy Fellowship`, and Belen's retained assignment |
| Administration | Service Types | Check the inactive historical type remains visible on its older service |
| Administration | Profile Fields and Roles | Sign in as the local admin and review existing configuration; no seed edits are made |
| Services | Scheduled / ongoing / completed / cancelled | Filter the two branches' service lists by status |
| Services | Historical inactive Service Type | Open `Legacy Fellowship Gathering` |
| Members | Active / inactive / archived | Review Rosa, Belen, and Nardo; confirm archive history links remain |
| Members | Inactive Department assignment | Open Belen and verify the historical department remains assigned |
| Accounts | Member account link | Auth setup links Bagong; inspect the link using Accounts and leave other records unlinked |

## Validation

See [LOCAL_SUPABASE_VALIDATION.md](LOCAL_SUPABASE_VALIDATION.md) for the actual
clean rebuild, Auth, fixture, authorization and application checks performed.
Raw fixture SQL has no reliable way to identify its host; always use the fixed
local wrappers, never a hosted SQL editor or hosted connection.

## Phase 2L cross-branch scenarios

| Scenario | Fixture and expected result |
| --- | --- |
| A: North Member attends South | Lino Santos, latest finished South service: Late; recorded under South Service. |
| B: South Member attends North | Benjie Lacson, latest finished North service: Present; recorded under North Service. |
| C: Cross-branch attendance prevents absence | Benjie has zero consecutive absent weeks, despite missing South. Home branch eligibility and four-week threshold remain South's. |
| D: Multiple branches in one week | Lino also attends North in the same week; this is one attended monitoring week, with two legitimate service check-ins. |
| E: North Member gives at South | Lino gives 500.00 tithe; South receives the amount. |
| F: South Member gives at North | Benjie gives 250.00 love offering; North receives the amount. |
| G: Visitor contribution | Maria Santos gives 300.00 at South; name is searchable and stored on the contribution; no Member created. |
| H: Anonymous contribution | Existing 75.00 North gift has no Member or visitor name. |
| I: Host Service link | Both cross-branch Member gifts link to their receiving branch's latest finished Service. |
| J: Transfer preservation | Covered by historical correction/transfer regression tests rather than permanently transferring these fixture Members. Original Service and receiving branch remain unchanged. |

The 23 contributions contain 21 Member, one Visitor and one Anonymous record.
New attendance still excludes archived and stored-inactive Members; new Member
contributions exclude archived Members but allow stored-inactive Members.
See [PHASE_2L_CROSS_BRANCH.md](PHASE_2L_CROSS_BRANCH.md) for implementation and validation.
