/** @type {import('next').NextConfig} */
// Headers that are safe on every page. A full Content-Security-Policy with `script-src` needs a nonce per request for Next's inline
// scripts, so only the directives that need no allow-list are set: nobody can frame the site or swap its base URL.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Required in Next 16: the only qualities `next/image` may request. Splash art uses 90 to keep detail.
    qualities: [75, 90],
    // Champion splash art from Riot's Data Dragon CDN. Icons are rendered `unoptimized`, so they need no pattern.
    remotePatterns: [
      { protocol: "https", hostname: "ddragon.leagueoflegends.com", pathname: "/cdn/img/champion/splash/**", search: "" },
      // Ranked tier emblems.
      {
        protocol: "https",
        hostname: "raw.communitydragon.org",
        pathname: "/latest/plugins/rcp-fe-lol-shared-components/global/default/*",
        search: "",
      },
    ],
  },
};

export default nextConfig;
