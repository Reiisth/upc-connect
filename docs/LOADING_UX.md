# Loading feedback

The portal shell uses `PortalLoading`: a spinner immediately, then a static message after three seconds. Messages change every four seconds and repeat. Timers are cleared when the shell loads or unmounts. Successful responses are never delayed to keep the indicator visible.

Route `loading.tsx` files and in-page Suspense boundaries use the same `PageSkeleton` shape. Tables, dashboards, grouped profile forms, read-only details, histories, profile selection, scanner, field settings and authentication have separate layouts. These placeholders contain no member data. Request-dependent content remains inside Suspense and authorization checks remain unchanged.

Shared `Button` automatically disables explicit submit buttons and shows a spinner while their enclosing React form action is pending. Client handlers using `onSubmit` or `onClick` must pass `loading={requestPending}` (and may pass `pendingLabel`). Existing pending labels remain visible. Existing spinner children are retained without adding a second spinner. `TableActionSubmit` also shows a pending spinner and label.

Loading indicators respect reduced-motion preferences. Status regions and button busy state are exposed to assistive technology.

Verification: timer/message cycling and cleanup, form pending state, manually managed loading, and distinct skeleton layouts are covered by `tests/loading-feedback.test.cjs`.
