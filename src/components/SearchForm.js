"use client";

import { useRouter } from "next/navigation";
import { Fragment, useId, useMemo, useState, useSyncExternalStore } from "react";
import { searchPlayer } from "@/app/actions";
import PinIcon from "@/components/PinIcon";
import {
  DEFAULT_REGION,
  clearUnpinnedPlayers,
  getRecentPlayersSnapshot,
  getServerRecentPlayersSnapshot,
  parseRecentPlayers,
  subscribeRecentPlayers,
} from "@/lib/recentPlayers";
import Select from "@/components/Select";
import { useT } from "@/lib/i18n/client";
import { regionOptions } from "@/lib/riot/regions";
import { formatRiotId, parseProfileLink } from "@/lib/squad/parse";
import { getSuggestions, splitMatch } from "@/lib/suggestions";
import styles from "./SearchForm.module.css";

function Highlighted({ text, query }) {
  const { before, match, after } = splitMatch(text, query);
  return (
    <>
      {before}
      {match && <mark className={styles.mark}>{match}</mark>}
      {after}
    </>
  );
}

/** The suggestion list, grouped under a heading per group (`items` arrive grouped). */
function SuggestionList({ listId, items, active, query, onChoose, onHover }) {
  const t = useT();
  return (
    <ul id={listId} role="listbox" aria-label={t("search.suggestions")} className={styles.list}>
      {items.map((item, i) => (
        <Fragment key={item.id}>
          {item.group !== items[i - 1]?.group && (
            <li role="presentation" className={styles.heading}>
              {t(`search.heading.${item.group}`)}
            </li>
          )}
          <li
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={styles.option}
            onClick={() => onChoose(item)}
            onMouseMove={() => active !== i && onHover(i)}
          >
            <span className={styles.icon} aria-hidden="true">
              {item.group === "recent" ? item.pinned ? <PinIcon filled /> : "↺" : "★"}
            </span>
            <span className={styles.label}>
              <Highlighted text={`${item.gameName}#${item.tagLine}`} query={query} />
            </span>
            <span className={styles.badge}>{item.region ? item.region.toUpperCase() : t("search.sample")}</span>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

/** The panel under the input: the suggestions, or a note that there are none, and a button to forget unpinned players. */
function SuggestionPanel({ listId, items, recents, showList, active, query, onChoose, onHover }) {
  const t = useT();
  return (
    // Keep focus in the input while the pointer is on the panel, so clicks don't trigger a blur first.
    <div className={styles.panel} onMouseDown={(event) => event.preventDefault()}>
      {showList && <SuggestionList listId={listId} items={items} active={active} query={query} onChoose={onChoose} onHover={onHover} />}

      {items.length === 0 && (
        <p className={styles.empty}>
          {t.rich("search.empty", { query: query.trim(), strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      )}

      {recents.some((player) => !player.pinned) && (
        <button type="button" className={styles.clear} onClick={clearUnpinnedPlayers}>
          {t("search.clear")}
        </button>
      )}
    </div>
  );
}

/**
 * Riot ID search with a suggestion dropdown (ARIA combobox). Suggestions come from players this browser has
 * already looked up, plus sample players; Riot has no search API, so an unseen player needs the full Riot ID.
 */
export default function SearchForm({ samples = [], initialQuery = "", initialRegion }) {
  const t = useT();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [picked, setRegion] = useState(initialRegion);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const snapshot = useSyncExternalStore(subscribeRecentPlayers, getRecentPlayersSnapshot, getServerRecentPlayersSnapshot);
  const recents = useMemo(() => parseRecentPlayers(snapshot), [snapshot]);
  // Until a server is picked (or a suggestion is), the form starts on the one of the player looked up last.
  const region = picked ?? recents[0]?.region ?? DEFAULT_REGION;
  const items = useMemo(() => getSuggestions(query, recents, samples), [query, recents, samples]);

  const hasQuery = query.trim().length > 0;
  const showList = open && items.length > 0;
  const showPanel = showList || (open && hasQuery);

  function choose(item) {
    if (item.group === "recent") {
      setQuery(`${item.gameName}#${item.tagLine}`);
      setRegion(item.region);
    }
    setOpen(false);
    setActive(-1);
    router.push(item.href);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (items.length === 0) return;
      event.preventDefault();
      setOpen(true);
      // Down moves forward and wraps to the top; up moves back and wraps to the bottom.
      setActive((current) =>
        event.key === "ArrowDown" ? (current + 1) % items.length : current <= 0 ? items.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && showList && active >= 0) {
      event.preventDefault(); // pick the highlighted suggestion instead of submitting the typed text
      choose(items[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    // Clicking or tabbing outside the whole widget closes the panel; moving within it does not.
    <div
      className={styles.wrap}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <form action={searchPlayer} className={styles.form} onSubmit={() => setOpen(false)}>
        <input
          name="riotId"
          value={query}
          onChange={(event) => {
            setActive(-1);
            // A pasted profile link turns into the Riot ID and server it names, ready to submit.
            const link = parseProfileLink(event.target.value);
            if (link) {
              setQuery(formatRiotId(link));
              setRegion(link.region);
              setOpen(false);
              return;
            }
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("search.placeholder")}
          autoComplete="off"
          spellCheck={false}
          required
          className={styles.input}
          role="combobox"
          aria-label={t("search.riotId")}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        />
        <Select
          variant="inline"
          align="end"
          name="region"
          value={region}
          onChange={setRegion}
          onOpen={() => {
            // One popup at a time: the suggestions make way for the server list.
            setOpen(false);
            setActive(-1);
          }}
          options={regionOptions(t)}
          ariaLabel={t("search.region")}
        />
        <button type="submit" className={styles.button}>
          {t("search.submit")}
        </button>
      </form>

      {showPanel && (
        <SuggestionPanel listId={listId} items={items} recents={recents} showList={showList} active={active} query={query} onChoose={choose} onHover={setActive} />
      )}

      <p className={styles.srOnly} aria-live="polite">
        {showList ? t("search.count", { count: items.length }) : ""}
      </p>
    </div>
  );
}
