import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

/** @type {import('@storybook/nextjs-vite').StorybookConfig} */
const config = {
  stories: ["../src/**/*.stories.@(js|jsx)"],
  framework: "@storybook/nextjs-vite",
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: [
          // Components import server-only modules (the Riot client, Data Dragon helpers). The real package throws outside a
          // React Server Component, so stories get an empty stand-in. Only the pure helpers those modules export are used.
          { find: /^server-only$/, replacement: here("./stubs/server-only.js") },
          // The "@/..." import alias from jsconfig.json.
          { find: /^@\//, replacement: `${here("../src")}/` },
        ],
      },
    }),
};

export default config;
