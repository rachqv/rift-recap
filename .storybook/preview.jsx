import "../src/app/globals.css";
import ActiveSlides from "./ActiveSlides";
import I18n from "./I18n";

/** @type {import('@storybook/nextjs-vite').Preview} */
const preview = {
  parameters: {
    layout: "fullscreen",
    // The app is App Router based: this turns on the mocked next/navigation.
    nextjs: { appDirectory: true },
    backgrounds: { options: { rift: { name: "Rift", value: "#050b18" } } },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  initialGlobals: { backgrounds: { value: "rift" } },
  decorators: [
    // The app loads Cinzel and Inter through next/font, which sets these variables. Storybook doesn't, so the same names
    // are given system fallbacks and the layout matches without a network request for fonts.
    (Story) => (
      <div style={{ "--font-display": "Georgia, serif", "--font-body": "system-ui, sans-serif", fontFamily: "system-ui, sans-serif" }}>
        <I18n>
          <ActiveSlides>
            <Story />
          </ActiveSlides>
        </I18n>
      </div>
    ),
  ],
};

export default preview;
