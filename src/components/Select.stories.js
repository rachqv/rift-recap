import { expect, fn, userEvent, within } from "storybook/test";
import Select from "./Select";

const REGIONS = [
  { value: "na1", label: "North America" },
  { value: "euw1", label: "EU West" },
  { value: "kr", label: "Korea" },
  { value: "jp1", label: "Japan" },
];

export default {
  title: "Components/Select",
  component: Select,
  parameters: { layout: "centered" },
  args: { options: REGIONS, defaultValue: "na1", ariaLabel: "Server", onChange: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: "16rem", minHeight: "14rem" }}>
        <Story />
      </div>
    ),
  ],
};

/** Closed, it shows the chosen option; a click opens the themed list and picking one closes it and reports the value. */
export const Field = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Server" });
    await expect(trigger).toHaveTextContent("North America");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getAllByRole("option")).toHaveLength(4);
    await expect(canvas.getByRole("option", { name: "North America" })).toHaveAttribute("aria-selected", "true");

    await userEvent.click(canvas.getByRole("option", { name: "Korea" }));
    await expect(args.onChange).toHaveBeenCalledWith("kr");
    await expect(trigger).toHaveTextContent("Korea");
    await expect(canvas.queryByRole("listbox")).toBeNull();
  },
};

/**
 * The keyboard works without a pointer: arrows move, Enter picks, Escape closes without changing anything. On a closed list
 * the first arrow only opens it, on the option that is already chosen (the ARIA select-only combobox pattern); the next ones move.
 */
export const Keyboard = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Server" });
    trigger.focus();

    await userEvent.keyboard("{ArrowDown}");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByRole("option", { name: "North America" })).toHaveAttribute("data-active", "true");
    await expect(args.onChange).not.toHaveBeenCalled();

    await userEvent.keyboard("{ArrowDown}{ArrowDown}"); // EU West, then Korea
    await userEvent.keyboard("{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith("kr");
    await expect(trigger).toHaveTextContent("Korea");

    await userEvent.keyboard("{Enter}{Home}{Escape}");
    await expect(canvas.queryByRole("listbox")).toBeNull();
    await expect(trigger).toHaveTextContent("Korea");
  },
};

/** Typing a few letters jumps to the option that starts with them. */
export const Typeahead = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("combobox", { name: "Server" }).focus();
    await userEvent.keyboard("j{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith("jp1");
  },
};

/** Inside a plain form the chosen value is submitted under `name`, through a hidden input. */
export const InForm = {
  args: { name: "region" },
  play: async ({ canvasElement }) => {
    const hidden = canvasElement.querySelector('input[type="hidden"][name="region"]');
    await expect(hidden).toHaveValue("na1");
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Server" }));
    await userEvent.click(canvas.getByRole("option", { name: "EU West" }));
    await expect(hidden).toHaveValue("euw1");
  },
};

/** The small badge used for the language switch, opening toward its right edge. */
export const Pill = {
  args: {
    variant: "pill",
    align: "end",
    display: "en",
    ariaLabel: "Language",
    options: [
      { value: "en", label: "English" },
      { value: "es", label: "Español", lang: "es" },
    ],
    defaultValue: "en",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("combobox", { name: "Language" })).toHaveTextContent("en");
  },
};
