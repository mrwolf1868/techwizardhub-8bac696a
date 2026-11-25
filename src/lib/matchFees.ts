/** Entry fee charged to each player when they create or join a match (5% of stake, rounded up). Mirrors public.game_entry_fee. */
export const entryFee = (stake: number) => (stake > 0 ? Math.ceil(stake * 0.05) : 0);
/** The entry charge includes the full stake plus that player's fee. */
export const entryCost = (stake: number) => stake + entryFee(stake);
/** The winner receives both stakes in full; fees were already taken at entry. */
export const winnerPayout = (stake: number) => stake * 2;
/** Outstanding admin profit is earned fees less completed withdrawals. */
export const availableProfit = (earnedFees: number, withdrawn: number) => Math.max(0, earnedFees - withdrawn);
export const canWithdrawProfit = (amount: number, available: number) =>
  Number.isInteger(amount) && amount > 0 && amount <= available;
/** Withdrawal fee: 2% of the amount, rounded up. Mirrors public.withdrawal_fee. */
export const withdrawalFee = (amount: number) => (amount > 0 ? Math.ceil(amount * 0.02) : 0);
/** A withdrawal takes the amount plus its fee from the balance. */
export const withdrawalTotal = (amount: number) => amount + withdrawalFee(amount);
