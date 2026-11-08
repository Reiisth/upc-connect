import { demoMemberName } from './hosted-demo-names.mjs';
export const fixtureId = (kind, n) => `d8${String(kind).padStart(2, '0')}0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const day = (date, offset = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
export function todayManila() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export const ACCOUNTS = [
  ['admin', 'system_admin', [1, 2]], ['pastor', 'pastor', [1, 2]],
  ['accounting', 'accounting_officer', [1]], ['evangelism', 'evangelism_officer', [1, 2]],
  ['ministry', 'spiritual_ministry_officer', [2]], ['usher', 'usher', [1]], ['member', 'member', []],
].map(([name, role, branches]) => ({ name, role, email: `demo.${name}@example.com`, branches }));
const monthDate = (anchor, offset, date = 1) => {
  const d = new Date(`${anchor}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, date)).toISOString().slice(0, 10);
};
export function generateDemo(anchor, departments) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || day(anchor) !== anchor || departments.length !== 4) throw new Error('Valid anchor and four preserved departments required.');
  const start = monthDate(anchor, -10);
  const dow = new Date(`${anchor}T00:00:00Z`).getUTCDay();
  const monday = day(anchor, -((dow + 6) % 7));
  const branches = ['Batangas City', 'Bauan'].map((name, i) => ({ id: fixtureId(0, i + 1), name, code: i ? 'BAUAN' : 'BATANGAS_CITY', city: name, province: 'Batangas', country: 'Philippines', is_active: true, inactivity_threshold_weeks: 3 }));
  const members = Array.from({ length: 180 }, (_, i) => {
    const local = i % 90 + 1;
    const branch = Math.floor(i / 90);
    const registration = local <= 40 ? day(start, -45 + local % 20) : local === 90 ? anchor : local === 89 ? day(anchor, -3) : monthDate(start, Math.floor((local - 41) / 5), 2 + local % 12);
    const archived = local >= 81 && local <= 84;
    return { id: fixtureId(1, i + 1), ...demoMemberName(i, i % 2 ? 'female' : 'male'), birth_date: `${1980 + i % 35}-${String(1 + i % 12).padStart(2, '0')}-15`, gender: i % 2 ? 'female' : 'male',
      member_status: [3, 15, 30, 45].includes(local) ? 'inactive' : 'active', church_branch_id: branches[branch].id,
      department_id: departments[i % departments.length].id, first_attendance_date: registration, created_at: `${registration}T00:00:00+08:00`,
      is_archived: archived, archived_at: archived ? `${day(monday, -14)}T00:00:00+08:00` : null,
      account_status: 'no_account', profile_status: 'completed', city: branches[branch].name, province: 'Batangas', country: 'Philippines', civil_status: i % 3 ? 'single' : 'married' };
  });
  const services = [];
  const addService = (branch, date, type, status, name) => {
    const row = { id: fixtureId(2, services.length + 1), church_branch_id: branch.id, name, service_type: type, service_date: date, start_time: status === 'ongoing' ? '00:00:00' : type === 'prayer_meeting' ? '19:00:00' : '09:00:00', status, notes: 'Fictional hosted QA/demo fixture.' };
    services.push(row); return row;
  };
  for (let date = start; date < monday; date = day(date, 1)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (![0, 3].includes(weekday)) continue;
    for (const branch of branches) addService(branch, date, weekday === 0 ? 'sunday_morning' : 'prayer_meeting', 'completed', weekday === 0 ? 'Sunday Worship — Demo' : 'Prayer Gathering — Demo');
  }
  for (const branch of branches) {
    addService(branch, anchor, 'special_service', 'ongoing', `${branch.name} Live QR Demo`);
    addService(branch, day(anchor, 2), 'prayer_meeting', 'scheduled', 'Upcoming Prayer — Demo');
    addService(branch, day(anchor, 7), 'sunday_morning', 'scheduled', 'Upcoming Worship — Demo');
    addService(branch, day(monday, -10), 'other', 'cancelled', 'Cancelled Gathering — Demo');
  }
  const attendance = [];
  const addAttendance = (service, member, status) => attendance.push({ id: fixtureId(3, attendance.length + 1), service_id: service.id, member_id: member.id, attendance_status: status, method: 'manual', check_in_time: status === 'present' ? `${service.service_date}T09:00:00+08:00` : null });
  for (const service of services.filter(s => s.status === 'completed')) {
    const date = service.service_date;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const week = day(date, -((weekday + 6) % 7));
    const age = Math.round((Date.parse(monday) - Date.parse(week)) / 604800000);
    const monthIndex = (Number(date.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(start.slice(5, 7));
    const weekIndex = Math.floor((Date.parse(date) - Date.parse(start)) / 604800000);
    for (const member of members) {
      if (member.church_branch_id !== service.church_branch_id || member.created_at.slice(0, 10) > date || (member.archived_at && member.archived_at.slice(0, 10) <= date)) continue;
      const local = (Number(member.id.slice(-12)) - 1) % 90 + 1;
      const score = (local * 17 + weekIndex * 7 + weekday * 3) % 100;
      const percent = member.church_branch_id === branches[0].id ? 44 + monthIndex * 4 : age <= 8 ? 57 + age * 2 : 78;
      let status = score < percent ? 'present' : score < percent + 6 ? 'excused' : 'absent';
      if ([5, 6].includes(local) && age <= 4) status = 'absent';
      if ([7, 8, 9].includes(local) && age <= 3) status = age === 3 ? 'present' : local === 9 && age === 1 ? 'excused' : 'absent';
      if (local === 10 && age === 1) status = 'present';
      addAttendance(service, member, status);
    }
    // Explicit visiting participation: a foreign Present counts for that member's weekly status.
    if (service.church_branch_id === branches[0].id && weekday === 0 && weekIndex % 2 === 0) addAttendance(service, members[90], 'present');
  }
  const contributions = [];
  const factors = [100, 104, 108, 112, 115, 118, 120, 155, 65, 125];
  for (let month = 0; month < 10; month++) for (let branchIndex = 0; branchIndex < 2; branchIndex++) for (let j = 0; j < 35; j++) {
    const date = monthDate(start, month, 2 + j % 25);
    const member = j % 7 === 0 ? null : members[branchIndex * 90 + j % 35];
    const cross = j === 3 ? members[(1 - branchIndex) * 90] : member;
    const service = services.find(s => s.church_branch_id === branches[branchIndex].id && s.service_date === date && s.status === 'completed');
    const cents = (150 + (j % 8) * 75) * factors[month];
    contributions.push({ id: fixtureId(5, contributions.length + 1), member_id: cross?.id ?? null, contributor_type: cross ? 'member' : j % 2 ? 'visitor' : 'anonymous', visitor_name: !cross && j % 2 ? `Fictional Visitor Demo ${month + 1}-${branchIndex + 1}-${j}` : null, service_id: service?.id ?? null, church_branch_id: branches[branchIndex].id, contribution_date: date, amount: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`, contribution_type: ['tithe', 'love_offering', 'other'][j % 3], payment_method: ['cash', 'gcash', 'bank_transfer'][j % 3], notes: member ? (j === 3 ? 'Demo cross-branch member offering' : 'Demo member offering') : j % 2 ? 'Demo visitor offering' : 'Demo anonymous offering' });
  }
  const baptisms = [];
  for (let month = 0; month < 10; month++) for (let branchIndex = 0; branchIndex < 2; branchIndex++) {
    const count = month >= 8 ? 8 : 3;
    for (let j = 0; j < count; j++) {
      const type = j % 2 ? 'holy_ghost' : 'water';
      const ordinal = baptisms.filter(b => b.church_branch_id === branches[branchIndex].id && b.baptism_type === type).length;
      baptisms.push({ id: fixtureId(6, baptisms.length + 1), member_id: members[branchIndex * 90 + ordinal].id, church_branch_id: branches[branchIndex].id, baptism_type: type, baptism_date: monthDate(start, month, 15 + j % 6), officiated_by: 'Demo Officiant', notes: 'Fictional hosted QA/demo baptism.' });
    }
  }
  const followUps = [];
  for (let branchIndex = 0; branchIndex < 2; branchIndex++) for (let j = 0; j < 45; j++) {
    const local = j < 4 ? [5, 6, 11, 11][j] : 12 + j % 25;
    const date = day(anchor, -(j === 2 ? 25 : j === 3 ? 3 : 4 + j * 4));
    const outcome = j === 2 ? 'needs_follow_up' : j === 3 ? 'resolved' : ['needs_follow_up', 'no_response', 'contacted', 'resolved'][j % 4];
    followUps.push({ id: fixtureId(4, followUps.length + 1), church_branch_id: branches[branchIndex].id, member_id: members[branchIndex * 90 + local - 1].id, follow_up_date: date, method: ['call', 'message', 'visit', 'in_person', 'other'][j % 5], outcome, next_follow_up_date: outcome === 'resolved' ? null : day(date, 3), notes: `Fictional demo follow-up: ${outcome.replaceAll('_', ' ')}.`, created_at: `${date}T12:00:00+08:00` });
  }
  return { anchor, start, branches, members, services, attendance, contributions, baptisms, followUps,
    qr: { homeMember: members[0].id, visitingMember: members[90].id, inactiveMember: members[2].id, service: services.find(s => s.status === 'ongoing').id },
    counts: { members: members.length, services: services.length, attendance_records: attendance.length, financial_contributions: contributions.length, baptism_records: baptisms.length, member_follow_ups: followUps.length } };
}
