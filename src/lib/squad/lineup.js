// The squad's best lineup on paper: which role each member should play, going by how they did in each role in the games the squad
// played together. Each member takes a different role (only one can play each in a game), and the lineup with the highest combined win
// rate wins. A role with a couple of games behind it is mostly luck, so win rates are pulled toward 50% by `PRIOR_GAMES` games of
// 50%, and a role needs `MIN_ROLE_GAMES` shared games before anyone is put in it.

const PRIOR_GAMES = 6;
const MIN_ROLE_GAMES = 3;
const MIN_MEMBERS = 3;
const MIN_GAIN = 0.04; // how much better each member does on average (in win rate, pulled toward 50%) before a swap is worth suggesting

const shrunk = ({ games, wins }) => (wins + PRIOR_GAMES * 0.5) / (games + PRIOR_GAMES);

/**
 * @param members squad stats' `members`: each `{ index, games, roles: [{ role, games, wins }] }`, `roles` most played first
 * @returns null when there is nothing to say (fewer than three members who played together, or one has no role with enough games),
 * else `{ mood, gain, rows }`. `rows` is `[{ index, role, usual, changed, games, winRate }]`, one per member: the role to play, the role
 * they play most, whether those differ, and the games and raw win rate in `role`. `mood` is "swap" when the best lineup is different
 * from everyone's usual (or two members usually play the same role, which can't be a lineup), else "settled". `gain` is how much better
 * the best lineup is, per member, than everyone in their usual role (0 or more).
 */
export function getLineup(members) {
  const present = members.filter((m) => m.games > 0);
  if (present.length < MIN_MEMBERS) return null;

  const options = present.map((m) => {
    const known = (m.roles ?? []).filter((r) => r.games >= MIN_ROLE_GAMES);
    return { member: m, usual: m.roles?.[0], known };
  });
  if (options.some((o) => !o.usual || o.usual.games < MIN_ROLE_GAMES)) return null;

  // Every way to give each member a different role from the ones they have played enough. At most five members and five roles.
  let best = null;
  const walk = (i, taken, chosen, total) => {
    if (i === options.length) {
      // A tie goes to the lineup with fewer changes from what people play now.
      const changes = chosen.filter((role, j) => role.role !== options[j].usual.role).length;
      if (!best || total > best.total + 1e-9 || (Math.abs(total - best.total) <= 1e-9 && changes < best.changes)) best = { chosen: [...chosen], total, changes };
      return;
    }
    for (const role of options[i].known) {
      if (taken.has(role.role)) continue;
      taken.add(role.role);
      chosen.push(role);
      walk(i + 1, taken, chosen, total + shrunk(role));
      chosen.pop();
      taken.delete(role.role);
    }
  };
  walk(0, new Set(), [], 0);
  if (!best) return null; // nobody can all be in different roles they know

  const usualRoles = options.map((o) => o.usual.role);
  const conflict = new Set(usualRoles).size < usualRoles.length;
  const usualTotal = options.reduce((total, o) => total + shrunk(o.usual), 0);
  const gain = Math.max(0, (best.total - usualTotal) / options.length);
  const changed = best.changes > 0;
  const swap = changed && (conflict || gain >= MIN_GAIN);

  // "Settled" shows what everyone plays now, not a lineup nobody asked for.
  const rows = options.map((o, i) => {
    const role = swap ? best.chosen[i] : o.usual;
    return { index: o.member.index, role: role.role, usual: o.usual.role, changed: swap && role.role !== o.usual.role, games: role.games, winRate: role.wins / role.games };
  });
  return { mood: swap ? "swap" : "settled", gain: swap ? gain : 0, rows };
}
