import { SITE_URL } from "@/lib/site";

// Link-preview bots (Twitter, Discord...) obey robots.txt, so player pages and cards stay crawlable for them; the recap pages
// say `noindex` in their own metadata instead. Only the per-device players list has nothing worth crawling.
export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/players" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
