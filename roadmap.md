# Requested changes
## Premium redesign and security
- [x] Remove rocket badges, refresh screen styling, and repair missing catalog/banner media.
- [x] Restrict data access, remove frontend credential reads, secure admin entry, and retain server-only STK payments.
- [ ] Activate the prepared hash-only access-password gate — secure hash form was declined; inactive until configured.
- [ ] Email-code login and Techwolf verification — keep existing account details; use techwolfpro.online, waiting on the owner to complete sender-domain setup and DNS verification before changing the live sign-in flow.
- [x] Use standard hosted sign-in protection, leaked-password checks, and current-password verification; the owner chose these instead of a custom four-attempt / 24-hour lockout.
- [x] Automatically submit quiz answers when the timer ends and verify results (24 focused tests pass).
- [x] Remove credential-bearing README and add redacted repository/history secret checks.
- [ ] Public repository visibility, branch protection, and exposed-history cleanup — require repository-owner access and credential rotation; deployment checks intentionally refuse exposed history.
- [ ] Move legacy payment-key rows into Edge Function Secrets — server-only now, but replacing saved provider values requires secure setup; deposit settings preserved.
- [ ] Verify signed-in Home, Games, admin password entry, and live payments — automatic test sign-in failed; needs a preview session and isolated payment test.
- [ ] Enforce paid service expiration in child apps — parent cannot enforce an external service's access policy; child-service integration is required.

- [x] Pure black and cream vector pieces for chess and draughts.
- [x] Searches cost nothing; both players are charged when an opponent joins; online players get a Join notification.
- [x] Confirm before leaving a search or quitting a match, with a forfeit warning.
- [x] Real M-Pesa payouts for player and admin profit withdrawals, refused when payout keys are missing.
- [ ] Live payouts — waiting on the Mullahc public and secret keys (Admin → Settings).
- [x] Keep match fees atomic, settle both stakes correctly, and count games when a match finishes.
- [x] Add private friend codes and targeted challenges to online players, with the invited player and stake visible.
- [x] Add player M-Pesa withdrawal requests, admin review, and automatic refunds when rejected.
- [x] Track earned admin fees and subtract only recorded completed withdrawals from available profit.
- [x] Use black-and-cream game pieces, vertical service listings, and less disruptive loading.
- [x] Verify TypeScript, six focused tests, signed-in screens, and desktop/mobile layouts.
- [ ] Run a full two-player paid match and payout test — blocked because preview and live app share wallet balances; an isolated test backend is needed.
- [x] Pending match strip on every page with View and Cancel.
- [x] Black pieces stay black on phones with forced dark mode.
- [x] Admin "Back to website" button, Games panel (lock games, stake limits), chat moderation, announcement, deposit/withdraw limits.
- [x] Live lobby and match chat; View button on match alerts; Tic-Tac-Toe and Connect Four.
- [ ] Two-player test of the new games and match chat — needs two signed-in players at once.
- [ ] Set service prices — waiting on the user's list.
- [x] Add wrangler.jsonc deploy config (never modify).
- [x] Payouts through Mullahc (player + admin profit), keys in admin settings.
- [x] New users start at 0 coins.
- [x] Clear every user's balance (with backup) and let admin set any balance.
- [x] Charge 2% on withdrawals.
- [x] AI rules helper for all four games with shared cached answers.
- [x] All profit (match + withdrawal fees) goes straight to the admin wallet; admin withdrawals have no fee; admin panel shows earned/withdrawn/wallet.
- [x] Deposit and Withdraw buttons plus a unique username on the Profile page.
- [x] Withdrawals send automatically (no admin approval).
- [x] WhatsApp channel button in the top bar (link never shown).
- [x] Remember site settings and service list between visits for faster loading.
- [ ] "Clear every user and start fresh" — waiting on what to remove.
- [x] Math Quiz (staked duel + free practice vs an openly named Computer) and Coin Trade (fair TWC/KSh market, charts, drawing tools, SL/TP, house earns spread).

## GitHub Pages readiness
- [ ] Synchronize dependency lockfiles without changing declared package versions.
- [ ] Verify GitHub Actions builds and deploys the `dist` artifact on pushes to `main`.
- [ ] Confirm a clean npm install and production build succeed.
