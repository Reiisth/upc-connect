# Accessibility and action clarity

This pass updates shared interaction behavior without changing permissions,
database operations, list filtering, or navigation destinations.

- Confirmations, member cards and Add Custom Field use a shared native modal
  dialog. `showModal()` supplies top-layer rendering and an inert background.
  The component locks body scrolling, focuses an intentional first control,
  handles Escape/backdrop dismissal and restores focus to the trigger. If a
  successful operation removes the trigger, focus returns to the page heading.
  Confirmation dialogs start on Cancel. Close, Escape, backdrop, Cancel and
  Confirm are blocked while an operation is pending; the dialog announces busy.
- Service status is always visible, noninteractive information. Completion and
  cancellation have separately named controls and retain server authorization,
  attendance preview and confirmation. Cancellation is visually destructive.
- Member status has permanent text and a contrasting dot, with no extra tab stop
  or hover-dependent expansion. Church/account edit and member-card controls
  have visible action text. Row actions have larger targets and focus outlines.
- FormField links labels, hints and errors to shared Input, Select, Textarea and
  Checkbox controls through context. Existing descriptions are preserved. Native
  configured controls are associated directly; hidden inputs are left alone.
  Errors set aria-invalid and required fields set aria-required.
- Password requirements appear before submission. Validation identifies all
  invalid fields, offers error-summary links, focuses the first invalid field,
  and calls the server only after local checks pass. Password visibility controls
  name their individual field and expose their pressed state. Reauthentication
  remains unchanged. Profile validation also focuses invalid optional fields.
- Small brand-blue text now uses #365FA6. Primary action backgrounds use the
  darker blue with white text. The #5D94E8 → #203264 decorative brand gradient is
  retained. Member/service status text uses dark text on pale backgrounds.
- A keyboard-visible Skip to main content link bypasses portal navigation.

## Validation and browser follow-up

Regression coverage includes error associations, native modal lifecycle,
focus/scroll restoration, pending dismissal restrictions, password validation,
service action confirmation and measured color-pair contrast. Automated checks
do not establish full WCAG conformance.

The browser automation runtimes were unavailable during this pass. Before
release, manually check:

1. Open each dialog by keyboard: focus enters it, Tab/Shift+Tab stay within it,
   Escape closes it and focus returns to its trigger. During a save, all dismissal
   methods stay blocked. Verify long content at mobile width and 200% zoom.
2. Confirm status labels are visible on touch screens; status itself performs no
   action. Check completion preview and cancellation without changing real data.
3. Submit invalid password/profile forms: error fields receive focus and screen
   readers announce their labels, requirements and associated messages. Never
   use a real password-change submission solely as a UI test.
4. Check skip navigation, error-summary links, focus outlines and contrast in the
   rendered application, including screens with long names and translated text.
