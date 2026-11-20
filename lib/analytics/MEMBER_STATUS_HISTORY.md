# Member status history

Apply `supabase/migrations/20261118090000_member_status_history.sql` with the
application deployment. The Inactive Members card reads current explicit
`member_status = 'inactive'` counts independently of the historical RPC.

The migration locks member writes while capturing a per-branch baseline, then
records aggregate active/inactive deltas transactionally on member insertion,
status/branch changes, archiving/restoration and deletion. No member identities
are copied. Null statuses and archived members contribute to neither count.
Transfers subtract from the source and add to the destination at one timestamp;
the aggregate across both branches remains unchanged unless status changes too.

`get_member_status_history` requires a server-supplied actor with `reports.view`
and access to every requested branch. Only the service role can execute it;
browser roles cannot read the underlying tables, and the service role cannot
modify them directly. The application uses the global branch context and the
dashboard date/grouping filters.

Points represent counts at the end of each Manila day/week/month, clipped to
the requested range and today. Empty periods carry counts forward. Dates before
the baseline return null, not invented zero counts; future periods are omitted.
Today's point reflects committed updates visible when queried. Active/Inactive cards and the status donut use the selected closing snapshot.
Their tickers compare that snapshot with the day before the selected range
(the previous period closing count). Unknown historical values remain unavailable;
only a current-date view may fall back to current stored counts if history fails.
Other member totals retain their current definitions. These are administrative
member statuses, separate from attendance-derived follow-up flags. The featured
Total Members registration-based metric retains its existing definition.

History is optional in page loading: an unavailable RPC displays a controlled
message without preventing other dashboard sections from loading. No history is
reconstructed from present-day statuses or old registration dates.

Validation: `UPC_MIGRATION_TEST_PG_PORT=<disposable local PostgreSQL port>` with
`node --test tests/member-status-history-postgres.test.cjs` creates and drops its
own test database. It must never point to the hosted application database.
