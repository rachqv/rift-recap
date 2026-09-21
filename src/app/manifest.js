// Lets phones install the site to the home screen. Colors match the page background (`--bg`) and the gold in globals.css.
export default function manifest() {
  return {
    name: "Rift Recap",
    short_name: "Rift Recap",
    description: "Your League of Legends season, wrapped.",
    start_url: "/",
    display: "standalone",
    background_color: "#050b18",
    theme_color: "#050b18",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
