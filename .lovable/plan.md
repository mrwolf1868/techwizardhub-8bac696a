# Plan: Professional Chess/Draughts Matches and Real M-Pesa Payouts

## What will change

1. **Make both games’ pieces unmistakably black and cream.** Replace the inconsistent chess text symbols and draughts styling with one dependable piece treatment, then check both boards on desktop and mobile.
2. **Keep searching matches free until someone joins.** A waiting search will not deduct coins. Show an in-app invitation to every online player with the game, stake, and a Join button. When someone accepts, one protected action will check both balances, charge each stake plus the existing 5% entry fee, and start the match together. Declines or confirmed search cancellation cost nothing.
3. **Protect players during search and play.** Ask before leaving an active search and cancel it only after confirmation. Before quitting an active match, clearly warn that the opponent receives both stakes; settle only after the player confirms.
4. **Give chess and draughts a polished, inviting play screen.** Use a clear board, player/opponent details, stake and prize information, and restrained styling consistent with the existing site. Keep the current navigation and other pages intact.
5. **Send withdrawals through M-Pesa for real.** Add protected payout processing for player withdrawals and admin profit withdrawals. Require a confirmed M-Pesa success response before marking a payout complete or counting admin profit as withdrawn. On failure, return any reserved player balance. If payout credentials are missing, refuse the payout without changing balances.
6. **Keep M-Pesa credentials private.** The current admin settings table can be read by signed-in users, so payment keys must not be saved there. The admin screen will show whether payout setup is ready; credentials must be held in Lovable Cloud’s secure secret storage, not exposed in an admin form or browser cookies. The existing deposit credentials are present, but the additional payout credentials are not, so live withdrawals will remain unavailable until those are securely supplied.

## Technical details

- Update the protected match-creation/join flow so only acceptance charges either player; retain existing fee, draw, and winner rules.
- Use the existing shared online presence room for invitations, and validate every acceptance and payout on the server side.
- Add M-Pesa B2C payout and result-callback handling, with duplicate-callback protection and explicit pending, success, and failure outcomes.
- Replace manual “mark paid” behavior with confirmed provider outcomes for player and admin payouts. Keep admin profit totals accurate and prevent spending the same pending amount twice.
- Remove payment secrets from the broadly readable settings rows and have payment functions read credentials only from secure runtime secrets. Do not store credentials or wallet data in cookies.
- Verify fee/charge timing and payout failure rules with focused tests; check the finished game and matching screens at desktop and mobile sizes. Do not send a live-money payout during testing.

## Confirmed current behavior

- Match creation currently charges before an opponent joins; online challenges currently target one selected player.
- Player withdrawals and admin profit withdrawals are currently handled as manual payouts.
- Payment keys saved in the current admin settings are readable by signed-in users, so the payout-key form must use secure storage instead.