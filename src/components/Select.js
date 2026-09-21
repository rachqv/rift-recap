"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./Select.module.css";

const TYPEAHEAD_MS = 600;
const OPENING_KEYS = ["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"]; // keys that open a closed list

/**
 * A dropdown with its own styling, in place of the browser's `<select>` (whose open list can't be themed). Follows the
 * ARIA "select-only combobox" pattern: the trigger keeps focus, arrows/Home/End move a highlight through the list,
 * Enter or Space picks, Escape closes, and typing jumps to a matching option.
 *
 * It still works inside a plain `<form>`: give it a `name` and the chosen value is submitted through a hidden input.
 * Control it with `value` + `onChange(value)`, or leave it uncontrolled with `defaultValue`. `onOpen` fires when the list
 * opens, for a neighbour that should get out of its way.
 *
 * - `options`: `[{ value, label, lang? }]`
 * - `variant`: `"field"` (a form input), `"inline"` (a segment inside a bar), `"pill"` (a small badge), `"compact"`
 * - `placement`: which side the list opens on; `align`: which edge of the trigger it lines up with
 * - `icon` and `display` dress up the trigger (a leading icon; text to show instead of the selected label)
 */
export default function Select({
  options,
  name,
  value,
  defaultValue,
  onChange,
  onOpen,
  id,
  ariaLabel,
  variant = "field",
  placement = "bottom",
  align = "start",
  icon,
  display,
  disabled,
  className,
}) {
  const listId = useId();
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef({ text: "", timer: 0 });

  const current = value ?? inner;
  const selectedIndex = options.findIndex((option) => option.value === current);
  const selected = options[selectedIndex];

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  // Keep the highlighted option visible in a long list.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function openList(index = selectedIndex) {
    setActive(index >= 0 ? index : 0);
    setOpen(true);
    onOpen?.();
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function choose(index) {
    const next = options[index];
    if (next && next.value !== current) {
      setInner(next.value);
      onChange?.(next.value);
    }
    close();
  }

  function typeahead(char) {
    const buffer = typed.current;
    clearTimeout(buffer.timer);
    buffer.text += char.toLowerCase();
    buffer.timer = setTimeout(() => (buffer.text = ""), TYPEAHEAD_MS);
    // One letter cycles through the matches after the highlight; more letters narrow down from the highlight itself.
    const start = buffer.text.length === 1 ? active + 1 : Math.max(active, 0);
    for (let step = 0; step < options.length; step++) {
      const index = (start + step) % options.length;
      if (options[index].label.toLowerCase().startsWith(buffer.text)) {
        if (open) setActive(index);
        else openList(index);
        return;
      }
    }
  }

  function onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (open) onOpenKey(event);
    else onClosedKey(event);
  }

  function onClosedKey(event) {
    if (OPENING_KEYS.includes(event.key)) {
      event.preventDefault();
      openList(event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : selectedIndex);
    } else if (event.key.length === 1) {
      typeahead(event.key);
    }
  }

  function onOpenKey(event) {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        close();
        break;
      default:
        if (event.key.length === 1) typeahead(event.key);
    }
  }

  return (
    // Focus leaving the whole widget closes the list; moving within it does not.
    <div
      className={[styles.root, styles[variant], className].filter(Boolean).join(" ")}
      data-open={open || undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      {name && <input type="hidden" name={name} value={current ?? ""} disabled={disabled} />}
      <button
        type="button"
        id={id}
        role="combobox"
        className={styles.trigger}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        {icon}
        <span className={styles.value}>{display ?? selected?.label}</span>
        <svg className={styles.chevron} viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 4.5 6 8.5 10 4.5" />
        </svg>
      </button>

      {open && (
        <OptionList listId={listId} ariaLabel={ariaLabel} placement={placement} align={align} options={options} current={current} active={active} onChoose={choose} onHover={setActive} />
      )}
    </div>
  );
}

function OptionList({ listId, ariaLabel, placement, align, options, current, active, onChoose, onHover }) {
  return (
    // Keep focus on the trigger while the pointer is on the list, so clicks don't trigger a blur first.
    <ul
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      className={styles.list}
      data-placement={placement}
      data-align={align}
      onMouseDown={(event) => event.preventDefault()}
    >
      {options.map((option, i) => (
        <li
          key={option.value}
          id={`${listId}-${i}`}
          role="option"
          lang={option.lang}
          aria-selected={option.value === current}
          data-active={i === active || undefined}
          className={styles.option}
          onClick={() => onChoose(i)}
          onMouseMove={() => active !== i && onHover(i)}
        >
          <span className={styles.label}>{option.label}</span>
          <svg className={styles.check} viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 6.5 5 9.5 10 3" />
          </svg>
        </li>
      ))}
    </ul>
  );
}
