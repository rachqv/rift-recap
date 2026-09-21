import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import SiteSound from "./SiteSound";

export default {
  title: "Site/Sound",
  component: SiteSound,
  parameters: { layout: "centered" },
};

// The sound switch and the volume live in local storage. Each story starts from a clean slate and restores what was there.
const KEYS = ["rift-recap:music", "rift-recap:volume"];
const cleanSoundSettings = () => {
  const before = KEYS.map((key) => [key, window.localStorage.getItem(key)]);
  KEYS.forEach((key) => window.localStorage.removeItem(key));
  return () => before.forEach(([key, value]) => (value == null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, value)));
};

/** Sound starts muted; the speaker toggles it, and the setting is remembered. */
export const SpeakerMutesAndUnmutes = {
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
