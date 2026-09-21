import { getJestConfig } from "@storybook/test-runner";

// The Jest configuration for `npm run test:stories`, which runs every story's `play` function in a real browser.
// The defaults come from @storybook/test-runner; only the browser window is changed.
const testRunnerConfig = getJestConfig();

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  ...testRunnerConfig,
  testEnvironmentOptions: {
    ...testRunnerConfig.testEnvironmentOptions,
    "jest-playwright": {
      ...testRunnerConfig.testEnvironmentOptions?.["jest-playwright"],
      // The runner's default window is 1280x720. Several slides deliberately drop decoration on screens that short (see the
      // `max-height` media queries), which would hide things the tests look for. 1280x900 is the desktop the slides are
      // designed around.
      contextOptions: { viewport: { width: 1280, height: 900 } },
    },
  },
};

export default config;
