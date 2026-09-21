import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import Slide, { Reveal } from "./Slide";
import Story from "./Story";

export default {
  title: "Recap/Story",
  component: Story,
  parameters: { layout: "fullscreen" },
};

// Three simple slides are enough to exercise the container: the rail, the keyboard, the slideshow and the sound controls.
const slides = ["First", "Second", "Third"].map((title) => (
  <Slide key={title}>
    <Reveal i={0}>
      <h2>{title} slide</h2>
    </Reveal>
  </Slide>
));
const args = { labels: ["First", "Second", "Third"], children: slides };

// The sound switch and the volume live in local storage. Each story starts from a clean slate and restores what was there.
const KEYS = ["rift-recap:music", "rift-recap:volume"];
const cleanSoundSettings = () => {
  const before = KEYS.map((key) => [key, window.localStorage.getItem(key)]);
  KEYS.forEach((key) => window.localStorage.removeItem(key));
  return () => before.forEach(([key, value]) => (value == null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, value)));
};

const current = (canvas) => canvas.getAllByRole("button").filter((b) => b.getAttribute("aria-current") === "true").map((b) => b.getAttribute("aria-label"));

/** The rail marks the slide in view, and arrow keys, Home and End move between slides from the moment the page loads. */
export const KeyboardNavigation = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(current(canvas)).toEqual(["First"]));

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(current(canvas)).toEqual(["Second"]), { timeout: 4000 });
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(current(canvas)).toEqual(["Third"]), { timeout: 4000 });
    await userEvent.keyboard("{ArrowUp}");
    await waitFor(() => expect(current(canvas)).toEqual(["Second"]), { timeout: 4000 });
    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(current(canvas)).toEqual(["First"]), { timeout: 4000 });
  },
};

/** The previous and next buttons step one slide at a time, and are dimmed at either end, where there is nowhere to go. */
export const StepButtons = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [previous, next] = [canvas.getByRole("button", { name: "Previous slide" }), canvas.getByRole("button", { name: "Next slide" })];
    await waitFor(() => expect(current(canvas)).toEqual(["First"]));
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();

    await userEvent.click(next);
    await waitFor(() => expect(current(canvas)).toEqual(["Second"]), { timeout: 4000 });
    await expect(previous).toBeEnabled();

    await userEvent.click(next);
    await waitFor(() => expect(current(canvas)).toEqual(["Third"]), { timeout: 4000 });
    await expect(next).toBeDisabled();

    await userEvent.click(previous);
    await waitFor(() => expect(current(canvas)).toEqual(["Second"]), { timeout: 4000 });
  },
};

/** Stepping by hand pauses a running slideshow, like the rail does, so it never fights the viewer. */
export const StepPausesSlideshow = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Play slideshow/ }));
    await expect(canvas.getByRole("button", { name: /Pause/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next slide" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: /Resume/ })).toBeInTheDocument());
  },
};

/**
 * With slide names (`ids`), a button copies the link to the slide in view: the plain page link on the first slide, and the page
 * link with `#name` on the others. It says when it worked.
 */
export const CopySlideLink = {
  args: { ...args, ids: ["first", "second", "third"] },
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const copies = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => copies.push(text) }, configurable: true });
    const canvas = within(canvasElement);
    const copy = canvas.getByRole("button", { name: "Copy link to this slide" });

    await userEvent.click(copy);
    await waitFor(() => expect(copies).toHaveLength(1));
    await expect(copies[0]).not.toContain("#");
    await expect(canvas.getByText("Link copied")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Next slide" }));
    await waitFor(() => expect(current(canvas)).toEqual(["Second"]), { timeout: 4000 });
    await userEvent.click(copy);
    await waitFor(() => expect(copies).toHaveLength(2));
    await expect(copies[1].endsWith("#second")).toBe(true);
  },
};

/** Without slide names there are no links to copy, so the button is not shown. */
export const NoCopyWithoutNames = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Copy link to this slide" })).toBeNull();
  },
};

/** Clicking a dot in the rail jumps to that slide. */
export const RailNavigation = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Third" }));
    await waitFor(() => expect(current(canvas)).toEqual(["Third"]), { timeout: 4000 });
  },
};

/** The slideshow only starts when its button is pressed, and can be paused, resumed and stopped. */
export const SlideshowControls = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Nothing plays by itself: no pause button, no progress bar.
    await expect(canvas.queryByRole("button", { name: /Pause/ })).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /Play slideshow/ }));
    await expect(canvas.getByRole("button", { name: /Pause/ })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /Play slideshow/ })).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /Pause/ }));
    await expect(canvas.getByRole("button", { name: /Resume/ })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Stop slideshow" }));
    await expect(canvas.queryByRole("button", { name: /Resume/ })).toBeNull();
    await expect(canvas.getByRole("button", { name: /Play slideshow/ })).toBeInTheDocument();
  },
};

/** Sound starts muted; the speaker toggles it, and the setting is remembered. */
export const SpeakerMutesAndUnmutes = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Mute" })).toBeInTheDocument());
    await expect(window.localStorage.getItem("rift-recap:music")).toBe("on");

    await userEvent.click(canvas.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Unmute" })).toBeInTheDocument());
    await expect(window.localStorage.getItem("rift-recap:music")).toBe("off");
  },
};

/** The volume slider starts at 75%, stores what you pick, and moving it while muted unmutes. */
export const VolumeSlider = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slider = canvas.getByRole("slider", { name: "Volume" });
    await expect(slider).toHaveValue("75");
    await expect(canvas.getByRole("button", { name: "Unmute" })).toBeInTheDocument();

    await fireEvent.change(slider, { target: { value: "40" } });
    await waitFor(() => expect(slider).toHaveValue("40"));
    await expect(window.localStorage.getItem("rift-recap:volume")).toBe("0.4");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Mute" })).toBeInTheDocument()); // it unmuted

    // Dragging to zero counts as muted, and the speaker then restores a usable volume instead of staying silent.
    await fireEvent.change(slider, { target: { value: "0" } });
    await waitFor(() => expect(canvas.getByRole("button", { name: "Unmute" })).toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(slider).toHaveValue("75"));
  },
};

/** Arrow keys on the slider adjust the volume; they must not also change slides. */
export const SliderKeysDontChangeSlides = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("slider", { name: "Volume" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await new Promise((resolve) => setTimeout(resolve, 800));
    await expect(current(canvas)).toEqual(["First"]);
  },
};

/** Tapping "next" twice in a row moves two slides, even before the first scroll has finished. */
export const QuickSteps = {
  args,
  beforeEach: cleanSoundSettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole("button", { name: "Next slide" });
    await fireEvent.click(next);
    await fireEvent.click(next);
    await waitFor(() => expect(current(canvas)).toEqual(["Third"]), { timeout: 4000 });
  },
};
