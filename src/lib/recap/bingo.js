import { defaultT } from "@/lib/i18n/en";
import { getBadges } from "./badges";

// Trophy bingo: the 24 trophies on a 5x5 board with a free space in the middle. A line is a full row, column or diagonal of
// unlocked trophies (the free space counts as unlocked). The board is the same for every player: a trophy always sits on the
// same square (the order of the catalog in `badges.js`), so two cards can be compared square for square.

const BOARD_SIZE = 5;
const FREE = 12; // the middle square, in reading order

// Every line as the board positions it crosses: 5 rows, 5 columns and the 2 diagonals.
const LINES = [
  ...Array.from({ length: BOARD_SIZE }, (_, row) => Array.from({ length: BOARD_SIZE }, (_, col) => row * BOARD_SIZE + col)),
  ...Array.from({ length: BOARD_SIZE }, (_, col) => Array.from({ length: BOARD_SIZE }, (_, row) => row * BOARD_SIZE + col)),
  Array.from({ length: BOARD_SIZE }, (_, i) => i * (BOARD_SIZE + 1)),
  Array.from({ length: BOARD_SIZE }, (_, i) => (i + 1) * (BOARD_SIZE - 1)),
];

/** Where a trophy sits on the board: its place in the catalog, skipping the free space. */
const positionOf = (slot) => (slot < FREE ? slot : slot + 1);

/**
 * @param recap a `buildRecap` result
 * @returns `{ size, cells, lines, unlocked, total, next }`. `cells` are the 25 squares in reading order: the free space is
 * `{ free: true, inLine }` and every other one is a badge from `getBadges` plus `inLine` (it is part of a finished line).
 * `lines` is how many lines are finished. `next` is the locked trophy that would finish a line on its own and is closest to
 * unlocking (`{ id, name, text, progress }`), or null when no line is one trophy short.
 */
export function getBingo(recap, t = defaultT) {
  const shelf = getBadges(recap, t);
  const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, position) => (position === FREE ? { free: true } : null));
  for (const badge of shelf.badges) cells[positionOf(badge.slot)] = badge;

  const done = (position) => cells[position].free || cells[position].unlocked;
  const finished = LINES.filter((line) => line.every(done));
  const inLine = new Set(finished.flat());

  // A line one trophy short: the missing square is a candidate for "next bingo".
  const candidates = LINES.map((line) => line.filter((position) => !done(position))).filter((missing) => missing.length === 1).map(([position]) => cells[position]);
  const next = candidates.sort((a, b) => b.progress - a.progress || a.slot - b.slot)[0] ?? null;

  return {
    size: BOARD_SIZE,
    cells: cells.map((cell, position) => ({ ...cell, inLine: inLine.has(position) })),
    lines: finished.length,
    unlocked: shelf.unlocked,
    total: shelf.total,
    next: next && { id: next.id, name: next.name, text: next.text, progress: next.progress },
  };
}
