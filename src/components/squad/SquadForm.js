"use client";

import Link from "next/link";
import { useState } from "react";
import RangeSwitch from "@/components/RangeSwitch";
import Select from "@/components/Select";
import { useT } from "@/lib/i18n/client";
import { useLastRegion } from "@/lib/recentPlayers";
import { regionOptions } from "@/lib/riot/regions";
import { MAX_SQUAD } from "@/lib/squad/parse";
import PlayerField from "./PlayerField";
import styles from "./forms.module.css";

/**
 * Plain GET form (works without JavaScript). Submits `region` plus one `p` per Riot ID to `/squad`. Each Riot ID box
 * suggests players this browser looked up before; picking one fills the box and switches to that player's server.
 */
export default function SquadForm({ region: initialRegion, values: initialValues = [], error, ranges }) {
  const t = useT();
  const lastRegion = useLastRegion();
  // Until the server is picked (or a player is), the form starts on the one used last.
  const [picked, setRegion] = useState(initialRegion);
  const region = picked ?? lastRegion;
  const [values, setValues] = useState(() => Array.from({ length: MAX_SQUAD }, (_, i) => initialValues[i] ?? ""));

  const setValue = (index, value) => setValues((current) => current.map((v, i) => (i === index ? value : v)));

  return (
    <form action="/squad" className={styles.form}>
      <h1 className={styles.title}>{t("forms.squad.title")}</h1>
      <p className={styles.lead}>
        {t.rich("forms.squad.lead", { em: (chunks) => <em>{chunks}</em> })}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {error && ranges && (
        <div className={styles.rangeHint}>
          <span>{t("forms.tryRange")}</span>
          <RangeSwitch links={ranges} label={t("common.range.label")} />
        </div>
      )}

      <div className={styles.field}>
        <span>{t("forms.squad.server")}</span>
        <Select name="region" value={region} onChange={setRegion} options={regionOptions(t)} ariaLabel={t("forms.squad.server")} />
      </div>

      {values.map((value, i) => (
        <PlayerField
          key={i}
          name="p"
          value={value}
          onChange={(next) => setValue(i, next)}
          onPick={(player) => {
            setValue(i, `${player.gameName}#${player.tagLine}`);
            setRegion(player.region);
          }}
          exclude={values.filter((_, j) => j !== i && values[j])}
          placeholder={t(i < 2 ? "forms.squad.player" : "forms.squad.playerOptional", { n: i + 1 })}
          ariaLabel={t("forms.squad.playerAria", { n: i + 1 })}
          required={i < 2}
        />
      ))}

      <button type="submit" className={styles.button}>
        {t("forms.squad.submit")}
      </button>
      <p className={styles.fine}>
        {t.rich("forms.squad.fine", { link: (chunks) => <Link href="/squad?demo=1">{chunks}</Link> })}
      </p>
    </form>
  );
}
