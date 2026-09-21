"use client";

import { Fragment, useId, useMemo, useState, useSyncExternalStore } from "react";
import PinIcon from "@/components/PinIcon";
import {
  clearUnpinnedPlayers,
  getRecentPlayersSnapshot,
  getServerRecentPlayersSnapshot,
  parseRecentPlayers,
  subscribeRecentPlayers,
} from "@/lib/recentPlayers";
import { useT } from "@/lib/i18n/client";
import { parseProfileLink } from "@/lib/squad/parse";
import { getSuggestions, splitMatch } from "@/lib/suggestions";
import search from "../SearchForm.module.css";
import styles from "./forms.module.css";

const idOf = (player) => `${player.gameName}#${player.tagLine}`.toLowerCase();

function Highlighted({ text, query }) {
  const { before, match, after } = splitMatch(text, query);
  return (
    <>
      {before}
      {match && <mark className={search.mark}>{match}</mark>}
      {after}
    </>
  );
}

/**
 * A Riot ID input that suggests players this browser looked up before (the same list the home page search uses), as
 * an ARIA combobox. Picking one calls `onPick({ gameName, tagLine, region })`; typing a new ID still works, since Riot
 * has no search API. `exclude` is Riot IDs already used elsewhere in the form, which are left out of the list.
 * Without JavaScript it is an ordinary input.
 */
export default function PlayerField({ name, value, onChange, onPick, exclude = [], placeholder, ariaLabel, required }) {
  const t = useT();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const snapshot = useSyncExternalStore(subscribeRecentPlayers, getRecentPlayersSnapshot, getServerRecentPlayersSnapshot);
  const recents = useMemo(() => parseRecentPlayers(snapshot), [snapshot]);
  const items = useMemo(() => {
    const used = new Set(exclude.map((id) => id.toLowerCase()));
    return getSuggestions(value, recents, []).filter((item) => !used.has(idOf(item)));
  }, [value, recents, exclude]);

  const showList = open && items.length > 0;

  function choose(item) {
    onPick({ gameName: item.gameName, tagLine: item.tagLine, region: item.region });
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (items.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActive((current) => (event.key === "ArrowDown" ? (current + 1) % items.length : current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === "Enter" && showList && active >= 0) {
      event.preventDefault(); // pick the highlighted suggestion instead of submitting the form
      choose(items[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div
      className={styles.playerField}
      // Above the fields that follow while its list is open, so the dropdown overlays them.
      style={open ? { zIndex: 30 } : undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <input
        name={name}
        value={value}
        onChange={(event) => {
          setActive(-1);
          // A pasted profile link fills in the Riot ID and the server it names, like picking a suggestion does.
          const link = parseProfileLink(event.target.value);
          if (link) {
            onPick(link);
            setOpen(false);
            return;
          }
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        required={required}
        autoComplete="off"
        spellCheck={false}
        className={styles.input}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      />

      {showList && (
        // Keep focus in the input while the pointer is on the list, so clicks don't blur it first.
        <div className={search.panel} onMouseDown={(event) => event.preventDefault()}>
          <ul id={listId} role="listbox" aria-label={t("forms.field.recent")} className={search.list}>
            {items.map((item, i) => (
              <Fragment key={item.id}>
                {i === 0 && (
                  <li role="presentation" className={search.heading}>
                    {t("search.heading.recent")}
                  </li>
                )}
                <li
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={search.option}
                  onClick={() => choose(item)}
                  onMouseMove={() => active !== i && setActive(i)}
                >
                  <span className={search.icon} aria-hidden="true">
                    {item.pinned ? <PinIcon filled /> : "↺"}
                  </span>
                  <span className={search.label}>
                    <Highlighted text={`${item.gameName}#${item.tagLine}`} query={value} />
                  </span>
                  <span className={search.badge}>{item.region.toUpperCase()}</span>
                </li>
              </Fragment>
            ))}
          </ul>
          {recents.some((player) => !player.pinned) && (
            <button type="button" className={search.clear} onClick={clearUnpinnedPlayers}>
              {t("search.clear")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
