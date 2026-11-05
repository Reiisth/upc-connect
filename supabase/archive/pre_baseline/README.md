# Pre-baseline migrations

These nine original files are preserved unchanged for historical context. They
are not a complete replayable schema history: the foundational schema was never
tracked here. The wedding create/remove sequence is ambiguous from final state.
Old default role grants are not authoritative; current hosted UI-edited
configuration is the approved source of truth.

Active migrations now begin with the current-state checkpoint. Do not replay
these files after it. Their original byte hashes are in
`../../captures/manifest.json`. Business-rule tests can still exercise these
historical implementations in isolated test databases.

No hosted migration history has been reconciled. Before any future deployment,
review the baseline strategy against production separately; never apply this
creation baseline to the existing hosted schema.
