"use client";

import Form from "next/form";
import Link from "next/link";
import { useState } from "react";
import RangeSwitch from "@/components/RangeSwitch";
import Select from "@/components/Select";
import { useT } from "@/lib/i18n/client";
import { useLastRegion } from "@/lib/recentPlayers";
import { regionOptions } from "@/lib/riot/regions";
import PlayerField from "./PlayerField";
import styles from "./forms.module.css";

function Slot({ id, label, region, onRegion, value, onValue, other }) {
  const t = useT();
  return (
    <div>
      <span className={styles.slotLabel}>{label}</span>
      <div className={styles.slot}>
        <Select name={`r${id}`} value={region} onChange={onRegion} options={regionOptions(t)} ariaLabel={t("forms.versus.serverAria", { label })} />
        <PlayerField
          name={`i${id}`}
          value={value}
          onChange={onValue}
          onPick={(player) => {
            onValue(`${player.gameName}#${player.tagLine}`);
            onRegion(player.region);
          }}
          exclude={other ? [other] : []}
          placeholder={t("forms.versus.riotId")}
          ariaLabel={t("forms.versus.riotIdAria", { label })}
          required
        />
      </div>
    </div>
  );
}

/**
 * Plain GET form (works without JavaScript). The page turns the submission into a shareable `?a=&b=` link. Each Riot ID
 * box suggests players this browser looked up before; picking one fills the box and that player's server.
 */
export default function VersusForm({ a = {}, b = {}, error, ranges }) {
  const t = useT();
  const lastRegion = useLastRegion();
  // Until a server is picked (or a player is), player 1 starts on the one used last, and player 2 on player 1's.
  const [pickedA, setRegionA] = useState(a.region);
  const [pickedB, setRegionB] = useState(b.region);
  const regionA = pickedA ?? lastRegion;
  const regionB = pickedB ?? regionA;
  const [valueA, setValueA] = useState(a.id ?? "");
  const [valueB, setValueB] = useState(b.id ?? "");

  return (
    <Form action="/versus" className={styles.form}>
      <h1 className={styles.title}>{t("forms.versus.title")}</h1>
      <p className={styles.lead}>
        {t("forms.versus.lead")}
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
      <Slot id="a" label={t("forms.versus.player1")} region={regionA} onRegion={setRegionA} value={valueA} onValue={setValueA} other={valueB} />
      <Slot id="b" label={t("forms.versus.player2")} region={regionB} onRegion={setRegionB} value={valueB} onValue={setValueB} other={valueA} />
      <button type="submit" className={styles.button}>
        {t("forms.versus.submit")}
      </button>
      <p className={styles.fine}>
        {t.rich("forms.versus.fine", { link: (chunks) => <Link href="/versus?demo=1">{chunks}</Link> })}
      </p>
    </Form>
  );
}
