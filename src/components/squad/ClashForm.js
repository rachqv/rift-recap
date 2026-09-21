"use client";

import Form from "next/form";
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

const blanks = (values) => Array.from({ length: MAX_SQUAD }, (_, i) => values[i] ?? "");

/**
 * Plain GET form (works without JavaScript). Submits `region` plus one `a` per Riot ID of the first squad and one `b` per Riot ID
 * of the second to `/clash`. Picking a suggested player fills the box and switches to that player's server.
 */
export default function ClashForm({ region: initialRegion, a: initialA = [], b: initialB = [], error, ranges }) {
  const t = useT();
  const lastRegion = useLastRegion();
  const [picked, setRegion] = useState(initialRegion);
  const region = picked ?? lastRegion;
  const [sides, setSides] = useState(() => ({ a: blanks(initialA), b: blanks(initialB) }));

  const setValue = (side, index, value) => setSides((current) => ({ ...current, [side]: current[side].map((v, i) => (i === index ? value : v)) }));
  const everyone = [...sides.a, ...sides.b].filter(Boolean);

  return (
    <Form action="/clash" className={styles.form}>
      <h1 className={styles.title}>{t("forms.clash.title")}</h1>
      <p className={styles.lead}>{t.rich("forms.clash.lead", { em: (chunks) => <em>{chunks}</em> })}</p>
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
        <span>{t("forms.clash.server")}</span>
        <Select name="region" value={region} onChange={setRegion} options={regionOptions(t)} ariaLabel={t("forms.clash.server")} />
      </div>

      {["a", "b"].map((side) => {
        const label = t(side === "a" ? "forms.clash.sideA" : "forms.clash.sideB");
        return (
          <div key={side} className={styles.squadGroup}>
            <span className={styles.slotLabel}>{label}</span>
            {sides[side].map((value, i) => (
              <PlayerField
                key={i}
                name={side}
                value={value}
                onChange={(next) => setValue(side, i, next)}
                onPick={(player) => {
                  setValue(side, i, `${player.gameName}#${player.tagLine}`);
                  setRegion(player.region);
                }}
                exclude={everyone.filter((v) => v !== value)}
                placeholder={t(i < 2 ? "forms.clash.player" : "forms.clash.playerOptional", { side: label, n: i + 1 })}
                ariaLabel={t("forms.clash.playerAria", { side: label, n: i + 1 })}
                required={i < 2}
              />
            ))}
          </div>
        );
      })}

      <button type="submit" className={styles.button}>
        {t("forms.clash.submit")}
      </button>
      <p className={styles.fine}>{t.rich("forms.clash.fine", { link: (chunks) => <Link href="/clash?demo=1">{chunks}</Link> })}</p>
    </Form>
  );
}
