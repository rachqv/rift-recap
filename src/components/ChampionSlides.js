import Image from "next/image";
import { getLocale } from "@/lib/i18n/server";
import { getChampionIndex } from "@/lib/riot/ddragon";
import { pickSplashes } from "@/lib/riot/skins";
import styles from "./ChampionSlides.module.css";

// `id` is the Data Dragon champion key (not always the display name, e.g. Kaisa).
// Keep this at 5 entries: the keyframes in the CSS are timed for a 5-slide cycle.
const CHAMPIONS = ["Jinx", "Ahri", "Yasuo", "Ekko", "Kaisa"];

const SLIDE_SECONDS = 8;

// Server component: each champion shows a different skin every day, so the page stays fresh on repeat visits.
export default async function ChampionSlides() {
  const index = await getChampionIndex(await getLocale());
  const day = new Date().toISOString().slice(0, 10);
  const skins = await Promise.all(
    CHAMPIONS.map((id) => pickSplashes(index, id, { seed: `home:${day}` }).then(([skin]) => skin)),
  );

  return (
    <>
      <div className={styles.slides}>
        {CHAMPIONS.map((id, i) => (
          <div key={id} className={styles.slide} style={{ animationDelay: `${i * SLIDE_SECONDS}s` }}>
            <div className={styles.zoom} style={{ animationDelay: `${i * SLIDE_SECONDS}s` }}>
              <Image
                src={skins[i].url}
                alt=""
                fill
                sizes="100vw"
                quality={90}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                className={styles.img}
              />
            </div>
          </div>
        ))}
        <div className={styles.shade} />
        <div className="grain" />
      </div>

      <div className={styles.captions}>
        {CHAMPIONS.map((id, i) => (
          <p key={id} className={styles.caption} style={{ animationDelay: `${i * SLIDE_SECONDS}s` }}>
            <span className={styles.captionName}>{index.byId[id]?.name ?? id}</span>
            <span className={styles.captionTitle}>{index.byId[id]?.title}</span>
            {skins[i].name && <span className={styles.captionSkin}>{skins[i].name}</span>}
          </p>
        ))}
      </div>
    </>
  );
}
