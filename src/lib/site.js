// Absolute base of the site: link-preview images, the sitemap and robots.txt need full URLs. Set SITE_URL in production.
export const SITE_URL =
  process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
