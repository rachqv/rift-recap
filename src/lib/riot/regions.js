// Riot has two routing layers:
//  - platform hosts (na1, euw1, ...) for per-server endpoints like summoner/league/mastery
//  - regional hosts (americas, europe, asia, sea) for account-v1 and match-v5
export const PLATFORMS = {
  na1: { label: "North America", cluster: "americas" },
  br1: { label: "Brazil", cluster: "americas" },
  la1: { label: "LAN", cluster: "americas" },
  la2: { label: "LAS", cluster: "americas" },
  euw1: { label: "EU West", cluster: "europe" },
  eun1: { label: "EU Nordic & East", cluster: "europe" },
  tr1: { label: "Turkey", cluster: "europe" },
  ru: { label: "Russia", cluster: "europe" },
  me1: { label: "Middle East", cluster: "europe" },
  kr: { label: "Korea", cluster: "asia" },
  jp1: { label: "Japan", cluster: "asia" },
  oc1: { label: "Oceania", cluster: "sea" },
  ph2: { label: "Philippines", cluster: "sea" },
  sg2: { label: "Singapore", cluster: "sea" },
  th2: { label: "Thailand", cluster: "sea" },
  tw2: { label: "Taiwan", cluster: "sea" },
  vn2: { label: "Vietnam", cluster: "sea" },
};

// The server picker's options, labelled in the reader's language by the `t` from useT().
export function regionOptions(t) {
  return Object.keys(PLATFORMS).map((id) => ({ value: id, label: t(`common.regions.${id}`) }));
}

export function isPlatform(value) {
  return Object.hasOwn(PLATFORMS, value);
}

export function clusterFor(platform) {
  return PLATFORMS[platform].cluster;
}

// account-v1 is only served from americas/asia/europe, not sea.
export function accountHostFor(platform) {
  const cluster = clusterFor(platform);
  return cluster === "sea" ? "asia" : cluster;
}
