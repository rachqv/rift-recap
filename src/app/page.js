import Link from "next/link";
import Background from "@/components/Background";
import SampleCards from "@/components/SampleCards";
import SearchForm from "@/components/SearchForm";
import { getT } from "@/lib/i18n/server";
import { DEMO_PLAYERS } from "@/lib/recap/demo";
import { isPlatform } from "@/lib/riot/regions";
import styles from "./page.module.css";

// Sample players offered as search suggestions, so the dropdown is useful on a first visit.
const SAMPLES = DEMO_PLAYERS.map(({ key, gameName, tagLine }) => ({ key, gameName, tagLine }));

const FEATURES = [
  { icon: "⚔️", key: "champions" },
  { icon: "📈", key: "climb" },
  { icon: "⏳", key: "time" },
];

export default async function Page({ searchParams }) {
  const { error, id, region } = await searchParams;
  const t = await getT();
  // After a rejected search the form gets back what was typed (see `searchPlayer`).
  const typed = error && typeof id === "string" ? id.slice(0, 64) : "";
  const typedRegion = error && isPlatform(region) ? region : undefined;

  return (
    <>
      <Background />
      <main className={styles.main}>
        <section className={styles.hero}>
          <span className={styles.badge}>
            <span className={styles.dot} /> {t("home.badge")}
          </span>
          <h1 className={styles.title}>
            {t("home.title.line1")}
            <br />
            <span className={styles.shimmer}>{t("home.title.line2")}</span>
          </h1>
          <p className={styles.subtitle}>
            {t("home.subtitle")}
          </p>

          <SearchForm samples={SAMPLES} initialQuery={typed} initialRegion={typedRegion} />
          {error ? (
            <p className={styles.error} role="alert">
              {t("home.error")}
            </p>
          ) : (
            <p className={styles.hint}>
              {t.rich("home.hint", { link: (chunks) => <Link href="/demo">{chunks}</Link> })}
            </p>
          )}
          <p className={styles.modes}>
            <Link href="/squad" className={styles.mode}>
              {t("home.modes.squad")}
            </Link>
            <Link href="/versus" className={styles.mode}>
              {t("home.modes.versus")}
            </Link>
            <Link href="/clash" className={styles.mode}>
              {t("home.modes.clash")}
            </Link>
            <Link href="/players" className={styles.mode}>
              {t("home.modes.players")}
            </Link>
          </p>
        </section>

        <section className={styles.showcase}>
          <SampleCards t={t} />
        </section>

        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>{t("home.features.title")}</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <article key={f.key} className={styles.feature}>
                <span className={styles.icon}>{f.icon}</span>
                <h3>{t(`home.features.${f.key}.title`)}</h3>
                <p>{t(`home.features.${f.key}.text`)}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>{t("home.footer")}</footer>
      </main>
    </>
  );
}
