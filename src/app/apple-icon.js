import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The home-screen icon: the same hextech "R" as icon.svg, on a solid background (iOS rounds the corners itself).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#050b18" }}>
        <svg width="150" height="150" viewBox="0 0 64 64">
          <defs>
            <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f0e6d2" />
              <stop offset="0.5" stopColor="#c8aa6e" />
              <stop offset="1" stopColor="#785a28" />
            </linearGradient>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0f2a3d" />
              <stop offset="1" stopColor="#050b18" />
            </linearGradient>
          </defs>
          <polygon points="32,3 58,18 58,46 32,61 6,46 6,18" fill="url(#fill)" stroke="url(#rim)" strokeWidth="4" strokeLinejoin="round" />
          <path d="M24 46V18h10a8 8 0 0 1 0 16H24" fill="none" stroke="#f0e6d2" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M34 34l9 12" fill="none" stroke="#0ac8b9" strokeWidth="5.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
