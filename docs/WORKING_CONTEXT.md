# Working context

Operational list selections now live in the current URL rather than disappearing
when a table unmounts. Services, Attendance, Contributions, Baptisms, Follow-ups,
Inactivity Monitoring and Member Accounts use `useListState`. Members and the
migration register retain their existing server-side query filters.

- Search, branch, column filters, sort and pagination are preserved where those
  controls exist. Date controls retain both draft inputs and the applied range;
  restoring a draft does not apply it automatically.
- Native `replaceState` updates the current history entry without reloading or
  adding an entry for every keystroke. Refresh, copied URLs and browser Back
  restore selections. Defaults are omitted from the URL. Malformed values fall
  back to the expected state shape. No records or permission data enter this
  state.
- Context-aware links carry the source URL in `returnTo`. Member details,
  migration history and other member histories preserve filtered return paths;
  history pagination carries that source forward. Member Accounts returns to
  its own filtered list instead of the general Accounts screen.
- PageHeader Back links and form Cancel links restore source filters only for
  their intended destination. Service, Contribution and Baptism forms submit a
  hidden destination that the server validates again before redirecting after a
  successful save. Follow-up and member church edits also retain known source
  screens, including Inactivity Monitoring and member history.
- Restored Contribution/Baptism ranges reload analytics through the existing
  authorized actions. A loading message replaces analytics from a different
  period until the requested summary arrives; failures offer an Apply retry.
- Return destinations are restricted to known portal paths. Existing mutation
  permissions, branch checks, history integrity and Suspense boundaries remain
  in force. Opening a normal module navigation link starts with its defaults.

Regression tests exercise restoration, browser Back, independent updates,
functional state updates, malformed query values, live return links, nested
history pagination, successful save destinations and restored analytics.
Real-browser interaction and mobile layout checks remain a release follow-up.
