import { SITE_URL } from "@/lib/site";

// Only the pages that don't depend on a player: the home page, the sample recap and the two setup forms.
const PATHS = [
  { path: "/", priority: 1 },
  { path: "/demo", priority: 0.8 },
  { path: "/versus", priority: 0.6 },
  { path: "/squad", priority: 0.6 },
];

export default function sitemap() {
  return PATHS.map(({ path, priority }) => ({ url: `${SITE_URL}${path}`, changeFrequency: "monthly", priority }));
}
