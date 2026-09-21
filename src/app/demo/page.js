import Link from "next/link";
import RecapView from "@/components/recap/RecapView";
import Select from "@/components/Select";
import { DEMO_PLAYERS, DEMO_STYLES, getDemoData } from "@/lib/recap/demo";
import { readRecapSnapshot } from "@/lib/recap/progress";
import { getLocale, getT } from "@/lib/i18n/server";
import { getChampionIndex } from "@/lib/riot/ddragon";
import { decodeSnapshot } from "@/lib/snapshot";
import styles from "./demo.module.css";

export async function generateMetadata() {
  return { title: (await getT())("demo.meta.title") };
}

// Previews the recap with generated sample players, so no Riot API key is needed.
// Each sample player is tuned to show a different archetype.
export default async function DemoPage({ searchParams }) {
  const { style, since } = await searchParams;
  const current = DEMO_STYLES.includes(style) ? style : "slayer";
  const position = DEMO_STYLES.indexOf(current);
  const previous = DEMO_STYLES[(position - 1 + DEMO_STYLES.length) % DEMO_STYLES.length];
  const next = DEMO_STYLES[(position + 1) % DEMO_STYLES.length];
  const [locale, t] = [await getLocale(), await getT()];
  const index = await getChampionIndex(locale);

  return (
    <>
      <RecapView {...getDemoData(current)} index={index} share={{ cardUrl: `/demo/card?style=${current}` }} championHref={(id) => `/demo/champion/${encodeURIComponent(id)}?style=${current}`} saved={readRecapSnapshot(decodeSnapshot(since))} t={t} />
      <form className={styles.switcher} action="/demo" aria-label={t("demo.switcher.label")}>
        <Link href={`/demo?style=${previous}`} aria-label={t("demo.switcher.previous")} scroll={false}>
          ‹
        </Link>
        <label htmlFor="sample-player">{t("demo.switcher.player")}</label>
        <Select
          variant="compact"
          placement="top"
          id="sample-player"
          name="style"
          defaultValue={current}
          options={DEMO_PLAYERS.map(({ key }) => ({ value: key, label: t(`demo.players.${key}`) }))}
        />
        <button type="submit">{t("demo.switcher.show")}</button>
        <Link href={`/demo?style=${next}`} aria-label={t("demo.switcher.next")} scroll={false}>
          ›
        </Link>
      </form>
    </>
  );
}
