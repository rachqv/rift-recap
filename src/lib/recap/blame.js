// "Was it you?": in the games you lost, did you carry, or was it you dragging the team down? Compares you with your own
// four teammates in each loss: your share of the team's damage, your share of its deaths, and how often you dealt the
// most damage. With five players a share of 20% is exactly average, and being top damage 1 game in 5 is chance.

import { defaultT } from "@/lib/i18n/en";

const MIN_LOSSES = 8;
const CARRY_TOP_RATE = 0.35; // top damage in at least this share of your losses
const CARRY_MAX_DEATH_SHARE = 0.28;
const WEAK_MIN_RANK = 3.3; // average damage rank, 1 is best and 3 is middle
const WEAK_MIN_DEATH_SHARE = 0.25;

/**
 * @param recap a `buildRecap` result
 * @returns null with too few losses (or no team data); otherwise
 * `{ verdict, loss, win, topRate, line }` where `verdict` is "carry", "weak" or "team", `loss` and `win` are
 * `{ games, damageShare, deathShare, top, rank }` (`win` may be null), and `topRate` is the share of losses where you
 * dealt the most damage. `t` writes the line (English by default).
 */
export function getBlame(recap, t = defaultT) {
  const loss = recap.blame?.loss;
  if (!loss || loss.games < MIN_LOSSES) return null;

  const topRate = loss.top / loss.games;
  const deathShare = loss.deathShare ?? 0.2;
  const verdict =
    topRate >= CARRY_TOP_RATE && deathShare <= CARRY_MAX_DEATH_SHARE ? "carry" : loss.rank >= WEAK_MIN_RANK && deathShare >= WEAK_MIN_DEATH_SHARE ? "weak" : "team";

  const line = t(`insights.blame.${verdict}`, { topRate: t.percent(topRate), deathShare: t.percent(deathShare), damageShare: t.percent(loss.damageShare) });

  return { verdict, loss, win: recap.blame.win ?? null, topRate, line };
}
