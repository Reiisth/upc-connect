# Mobile workflows and visual design

The portal keeps its light background, blue brand gradient and existing data
and permission rules. This pass improves shared layout rather than introducing
an independent mobile application.

## Records and filters

`Table mobileCards` stacks one existing table into labeled records below 768px.
The original table, header relationships, values and action handlers remain in
the DOM; separate mobile copies cannot drift out of sync. Explicit table roles
retain semantics when the CSS display changes. `data-label` supplies the visual
field labels. Tables remain conventional tables on wider screens.

Enabled for Members, Services, Attendance services, service Attendance records,
Contributions, Baptisms, Follow-ups, Inactivity, Member Accounts and migration
history/register records. All fields and permission-gated actions remain present.
Header filters become labeled touch controls above the mobile records, including
the current selection. Empty results retain the filters.

## Navigation and attendance

The bottom bar shows up to four allowed destinations. With more destinations,
Members, Attendance and Services take priority where permitted; More opens a
grouped native modal sheet. Secondary destinations retain an active indicator.
The sheet supports explicit Close, Escape, backdrop dismissal, initial focus,
background scroll locking and focus restoration. It closes on navigation and
when resized to desktop. Only server-filtered routes enter the client island.

The viewport allows zoom and safe-area insets. Header, content and bottom bar
respect phone cutouts and the home indicator. Main content clears the bottom
bar. Navigation labels wrap rather than truncate.

Attendance offers a direct link to the entry form above its compact summary.
Record/Correct fills the existing form, scrolls to it and focuses Status without
submitting. Member suggestions prevent pointer-driven focus loss until a
deliberate selection, while retaining keyboard behavior. Service detail actions
have visible text. Camera startup and QR recording logic are unchanged.

## Shared visual rules

- Mobile controls and row actions have at least 44px standard targets. Long
  button labels wrap. Dropdown options and clear-filter controls share the
  larger touch sizing.
- Input text is 16px on phones, with 14px desktop text. Date-range controls stack
  on narrow screens, and form fields can shrink without forcing page overflow.
- Page titles, section titles, cards and empty states use Radio Canada with
  consistent spacing. Headers have a quiet divider and clearer description text.
- Mobile cards/forms use 16px padding; desktop sections keep 24px. Page padding
  is owned by the portal shell, avoiding nested horizontal padding.
- Summary cards use compact two-column mobile grids where appropriate. Forms
  have full-width actions and larger close buttons. Reduced-motion preferences
  suppress nonessential transitions and animations.

## Verification

Regression coverage includes record/field/action parity, table semantics,
permission-filtered navigation, modal open/close behavior, attendance editor
navigation and touch suggestion selection. The existing filter, authorization
and mutation tests remain in place.

The computer-use browser connection failed to initialize. Real-device visual
and interaction checks are still required at 320/390/768px, landscape, 200% zoom,
with an on-screen keyboard, and with long member/branch names. Check stacked
records and filters, More dismissal/focus, date entry, suggestion scrolling,
attendance corrections and camera controls without recording test attendance
against real members.
