# Weekly inactivity monitoring

Flags use consecutive absent eligible Monday-Sunday weeks, not a count of missing
Present rows. Only finished weeks with completed home-branch services after the
registration eligibility boundary count. Several missed services in one week add
only one absent week. Missing attendance in such a week still represents absence;
completion normally finalizes missing eligible members as Absent.

Present at any completed service (including a visiting service) resets the streak.
A home-branch Excused record exempts that week: skip it without adding an absence
or resetting the prior streak. Present takes precedence if both exist in a week.
Foreign-branch excuses do not exempt home-branch obligations. Excused never updates
last physical attendance or the physical attendance numerator; excused-only weeks
are excluded from the recent rate denominator. Current unfinished weeks and weeks
without completed home services never add an absence. Rates use up to eight
eligible weeks; the absence streak itself is not capped at eight weeks.

The selected branch threshold is prominent above the results. Administrative
Member Status remains independent: authorized viewers see a green Active or grey
Inactive dot with a styled hover/focus tooltip beside the name, with the calculated attendance
flag below it. Results show ten members per page; search, flag and absence filters
reset pagination. Changing monitoring flags never writes Member Status.

The shared inactivity loader also feeds Reports' current inactivity summaries so
those flags remain consistent. Physical attendance report totals remain unchanged.
