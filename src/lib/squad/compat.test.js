import { describe, expect, it } from "vitest";
import { pairChemistry } from "./compat";
import { buildQuiz, quizVerdict } from "./quiz";

describe("pairChemistry", () => {
  it("pulls a tiny sample towards the middle, so 2 wins in 2 isn't a perfect duo", () => {
    const tiny = pairChemistry({ wins: 2, games: 2, damageA: 700, damageB: 700 });
    const big = pairChemistry({ wins: 30, games: 40, damageA: 700, damageB: 700 });
    expect(tiny.score).toBeLessThan(big.score);
    expect(tiny.score).toBeLessThan(75);
  });

  it("rewards winning together, balanced damage and a lift from playing together", () => {
    const strong = pairChemistry({ wins: 30, games: 40, damageA: 800, damageB: 780, lifts: [0.2, 0.15] });
    const weak = pairChemistry({ wins: 10, games: 40, damageA: 900, damageB: 300, lifts: [-0.2, -0.15] });
    expect(strong.score).toBeGreaterThan(75);
    expect(strong.label).toBe("Duo of destiny");
    expect(weak.score).toBeLessThan(40);
    expect(weak.label).toBe("Better apart");
  });

  it("stays on the middle for what it doesn't know", () => {
    const { parts, score } = pairChemistry({ wins: 5, games: 10 });
    expect(parts.balance).toBe(0.5);
    expect(parts.lift).toBe(0.5);
    expect(score).toBe(50);
  });

  it("keeps the score between 0 and 100 whatever it is given", () => {
    for (const lifts of [[5], [-5], [null, null]]) {
      const { score } = pairChemistry({ wins: 40, games: 40, damageA: 1, damageB: 1, lifts });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("buildQuiz", () => {
  const member = (index, games = 10) => ({ index, gameName: `P${index}`, profileIcon: index, games });
  const award = (title, winner) => ({ title, tagline: `${title} tagline`, icon: "x", winner, display: "5", line: "line" });

  it("makes a round per award, up to four", () => {
    const awards = ["a", "b", "c", "d", "e"].map((t, i) => award(t, i % 3));
    const quiz = buildQuiz(awards, [member(0), member(1), member(2)]);
    expect(quiz.rounds).toHaveLength(4);
    expect(quiz.rounds[0]).toMatchObject({ title: "a", answer: 0 });
    expect(quiz.players.map((p) => p.gameName)).toEqual(["P0", "P1", "P2"]);
  });

  it("needs three players and at least two usable awards", () => {
    expect(buildQuiz([award("a", 0), award("b", 1)], [member(0), member(1)])).toBeNull();
    expect(buildQuiz([award("a", 0)], [member(0), member(1), member(2)])).toBeNull();
  });

  it("skips awards won by someone who can't be guessed", () => {
    const quiz = buildQuiz([award("a", 3), award("b", 0), award("c", 1)], [member(0), member(1), member(2), member(3, 0)]);
    expect(quiz.rounds.map((r) => r.title)).toEqual(["b", "c"]);
    expect(quiz.players).toHaveLength(3);
  });

  it("has a line for every score", () => {
    expect(quizVerdict(4, 4)).toMatch(/better than the squad/);
    expect(quizVerdict(2, 4)).toMatch(/Not bad/);
    expect(quizVerdict(0, 4)).toMatch(/more time/);
  });
});
