import { describe, expect, it } from "vitest";
import { cleanRiotIdText, clashPath, parseClashParams, parseProfileLink, parseRiotId, readRiotIdInput } from "./parse";

describe("parseRiotId", () => {
  it("splits on the last #, and trims around it", () => {
    expect(parseRiotId("Hide on bush#KR1")).toEqual({ gameName: "Hide on bush", tagLine: "KR1" });
    expect(parseRiotId("  Faker  #  EUW ")).toEqual({ gameName: "Faker", tagLine: "EUW" });
  });

  it("rejects a missing name or tag", () => {
    for (const text of ["", "Faker", "#EUW", "Faker#", "Faker# "]) expect(parseRiotId(text)).toBeNull();
  });

  it("copes with invisible marks, odd spaces and a full-width ＃", () => {
    expect(parseRiotId("‎Faker​#EUW⁩")).toEqual({ gameName: "Faker", tagLine: "EUW" });
    expect(parseRiotId("Hide on　bush#KR1")).toEqual({ gameName: "Hide on bush", tagLine: "KR1" });
    expect(parseRiotId("Faker＃EUW")).toEqual({ gameName: "Faker", tagLine: "EUW" });
    expect(cleanRiotIdText(null)).toBe("");
  });
});

describe("parseProfileLink", () => {
  const faker = { region: "euw1", gameName: "Faker", tagLine: "EUW" };

  it("reads op.gg, u.gg and leagueofgraphs profile links", () => {
    expect(parseProfileLink("https://www.op.gg/summoners/euw/Faker-EUW")).toEqual(faker);
    expect(parseProfileLink("https://www.op.gg/lol/summoners/euw/Faker-EUW?queue_type=SOLORANKED")).toEqual(faker);
    expect(parseProfileLink("https://u.gg/lol/profile/euw1/faker-euw/overview")).toEqual({ ...faker, gameName: "faker", tagLine: "euw" });
    expect(parseProfileLink("https://euw.leagueofgraphs.com/summoner/euw/Faker-EUW#championsData")).toEqual(faker);
  });

  it("maps each site's short server names to Riot's platform ids", () => {
    expect(parseProfileLink("op.gg/summoners/na/Name-NA1")?.region).toBe("na1");
    expect(parseProfileLink("op.gg/summoners/eune/Name-EUNE")?.region).toBe("eun1");
    expect(parseProfileLink("op.gg/summoners/oce/Name-OCE")?.region).toBe("oc1");
    expect(parseProfileLink("op.gg/summoners/kr/Name-KR1")?.region).toBe("kr");
  });

  it("decodes spaces, and splits names with hyphens on the last one", () => {
    expect(parseProfileLink("https://www.op.gg/summoners/kr/Hide%20on%20bush-KR1")).toEqual({ region: "kr", gameName: "Hide on bush", tagLine: "KR1" });
    expect(parseProfileLink("https://www.leagueofgraphs.com/summoner/kr/Hide+on+bush-KR1")).toEqual({ region: "kr", gameName: "Hide on bush", tagLine: "KR1" });
    expect(parseProfileLink("https://www.op.gg/summoners/euw/Mr-Pink-EUW")).toEqual({ region: "euw1", gameName: "Mr-Pink", tagLine: "EUW" });
  });

  it("ignores everything that is not a profile link", () => {
    for (const text of ["Faker#EUW", "", "https://example.com/summoners/euw/Faker-EUW", "https://www.op.gg/champions/ahri", "https://www.op.gg/summoners/euw/", "https://www.op.gg/summoners/xx/Faker-EUW", "not a link/at all"]) {
      expect(parseProfileLink(text)).toBeNull();
    }
  });

  it("does not throw on malformed links", () => {
    expect(parseProfileLink("https://www.op.gg/summoners/euw/%E0%A4%A-EUW")).toEqual({ region: "euw1", gameName: "%E0%A4%A", tagLine: "EUW" });
    expect(parseProfileLink("http://")).toBeNull();
  });
});

describe("readRiotIdInput", () => {
  it("takes a link or a plain Riot ID", () => {
    expect(readRiotIdInput("https://www.op.gg/summoners/euw/Faker-EUW")).toEqual({ region: "euw1", gameName: "Faker", tagLine: "EUW" });
    expect(readRiotIdInput("Faker#EUW")).toEqual({ gameName: "Faker", tagLine: "EUW" });
    expect(readRiotIdInput("nope")).toBeNull();
  });
});

describe("parseClashParams", () => {
  it("reads two squads on one server", () => {
    const parsed = parseClashParams({ region: "euw1", a: ["One#EUW", "Two#EUW"], b: ["Three#EUW", "Four#EUW"] });
    expect(parsed.regionValid).toBe(true);
    expect(parsed.a.map((p) => p.gameName)).toEqual(["One", "Two"]);
    expect(parsed.b.map((p) => p.gameName)).toEqual(["Three", "Four"]);
    expect(parsed.overlap).toEqual([]);
    expect(parsed.tooMany).toBe(false);
  });

  it("drops duplicates within a squad, and reports unreadable entries and players on both squads", () => {
    const parsed = parseClashParams({ region: "na1", a: ["One#NA", "one#na", "Two#NA"], b: ["Two#NA", "broken", "Three#NA"] });
    expect(parsed.a).toHaveLength(2);
    expect(parsed.invalid).toEqual(["broken"]);
    expect(parsed.overlap.map((p) => p.gameName)).toEqual(["Two"]);
  });

  it("says when a squad has more than five, or the server is not real", () => {
    const six = Array.from({ length: 6 }, (_, i) => `P${i}#EUW`);
    expect(parseClashParams({ region: "euw1", a: six, b: ["X#EUW"] }).tooMany).toBe(true);
    expect(parseClashParams({ region: "nope", a: ["A#B"], b: ["C#D"] }).regionValid).toBe(false);
  });

  it("makes a link that reads back the same", () => {
    const a = [{ gameName: "Some One", tagLine: "EUW" }, { gameName: "Two", tagLine: "1" }];
    const b = [{ gameName: "Three", tagLine: "X" }, { gameName: "Four", tagLine: "Y" }];
    const query = Object.fromEntries([...new URLSearchParams(clashPath("euw1", a, b).split("?")[1])].map(([k], _, all) => [k, all.filter(([key]) => key === k).map(([, v]) => v)]));
    const parsed = parseClashParams(query);
    expect(parsed.a).toEqual(a);
    expect(parsed.b).toEqual(b);
  });
});
