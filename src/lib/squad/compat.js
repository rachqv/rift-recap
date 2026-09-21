import { defaultT } from "@/lib/i18n/en";

// A single "chemistry" percentage for two people who play together. It is a light-hearted summary, not a prediction, and
// it leans on what actually predicts a good duo: winning together (shrunk towards 50% for small samples), whether both
// pull their weight in damage, and whether each wins more together than apart.

// A pair's win rate is pulled towards 50% as if they had this many extra 50/50 games, so 2 wins in 2 doesn't score 100%.
const PRIOR_GAMES = 10;
const WEIGHTS = { winRate: 0.55, balance: 0.2, lift: 0.25 };

// The label for each score band is the `squad.chemistry.<key>` message.
const CHEMISTRY_LABELS = [
  { min: 75, key: "destiny" },
  { min: 62, key: "great" },
  { min: 50, key: "solid" },
  { min: 40, key: "awkward" },
  { min: 0, key: "apart" },
];

/**
 * @param wins, games their record in the games they played as teammates
 * @param damageA, damageB (optional) each player's damage a minute in those games
 * @param lifts (optional) each player's win rate together minus apart, as numbers like 0.12; nulls are skipped
 * @returns `{ score, label, parts }` where `score` is 0 to 100 and `parts` are the three pieces (each 0 to 1)
 */
export function pairChemistry({ wins, games, damageA, damageB, lifts = [] }, t = defaultT) {
  const winRate = (wins + PRIOR_GAMES / 2) / (games + PRIOR_GAMES);
  const balance = damageA > 0 && damageB > 0 ? Math.min(damageA, damageB) / Math.max(damageA, damageB) : 0.5;
  const known = lifts.filter((x) => x != null && Number.isFinite(x));
  // A lift of +25 points or more is a full score; -25 or worse is zero.
  const lift = known.length > 0 ? Math.min(1, Math.max(0, 0.5 + known.reduce((a, b) => a + b, 0) / known.length / 0.5)) : 0.5;

  const score = Math.round(100 * (WEIGHTS.winRate * winRate + WEIGHTS.balance * balance + WEIGHTS.lift * lift));
  return { score, label: t(`squad.chemistry.${CHEMISTRY_LABELS.find((l) => score >= l.min).key}`), parts: { winRate, balance, lift } };
}
