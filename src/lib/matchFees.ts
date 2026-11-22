/** Entry fee charged to each player when they create or join a match (5% of stake, rounded up). Mirrors public.game_entry_fee. */
export const entryFee = (stake: number) => (stake > 0 ? Math.ceil(stake * 0.05) : 0);
/** The winner receives both stakes in full; fees were already taken at entry. */
export const winnerPayout = (stake: number) => stake * 2;
