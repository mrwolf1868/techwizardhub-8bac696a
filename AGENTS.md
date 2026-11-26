# Architecture rules
- Reuse the uploaded frontend's layout and asset pointers while keeping this project's managed client, authentication, wallet, and match APIs; the archive uses a different backend schema.
- Share game and service catalog cards between Home and their dedicated pages to keep layout and navigation consistent.
- Admin reporting reads live application records under the existing admin role policies; never manufacture balances, matches, or elevated roles on the client.
- Keep match charging, settlement, withdrawal reservations, and payout completion in protected database functions; clients must never change financial balances or ledgers directly.
- Charge match entries only when an opponent joins; searches stay free so cancelled or unanswered searches never move money.
- Payouts run through the mpesa-payout function using the Mullahc payout API with keys from admin-only settings (falling back to secure secrets); it refuses before reserving balance when keys are missing, and only provider-confirmed results (signed webhook re-checked against the status endpoint, or a status poll) mark payouts paid.
- Withdrawal fees are stored on the withdrawal row and are credited to the admin wallet (plus a house_fee ledger entry) only when the payout succeeds; match fees credit the admin wallet at join, admin withdrawals debit that wallet with no fee, and the house_fee ledger is reporting only, so profit is never withdrawable twice.
- Rules-helper answers are cached per game and normalized question in a server-only table so repeated questions never call the AI again.
- wrangler.jsonc is a user-owned Cloudflare deploy config: never edit it.
- Store match mode, friend codes, and targeted opponents on the match record, while online presence uses one shared Realtime room.
- Admin game and wallet rules (locked games, stake limits, deposit/withdraw limits, site announcement) live in non-secret admin_settings rows that players can read; database functions and payment functions enforce the same values, the UI only mirrors them.
- Game chat uses one table keyed by room ("lobby:<game>" or "match:<id>"); a security-definer room-access check decides who reads and posts, so match chat stays private to the two players and admins.
- Draw the black parts of game pieces as masked backgrounds and cream parts as vector fills, because phone browsers with forced dark mode invert dark vector fills to white.
- Simple grid games (Tic-Tac-Toe, Connect Four) reuse the match record: the board is a string of "." / "w" (creator, cream) / "b" (opponent, black), and moves go through the same protected move function.
- Only public, non-personal queries (site settings, service catalog) are persisted to localStorage for faster loads; never persist balances, messages or admin data.

- Coin Trade prices are generated server-side by coin_sync, which catches up missed time in capped batches on each feed call and keeps numbers rounded; the chart only renders coin_feed candles, so the market is identical for everyone and never depends on player positions.
