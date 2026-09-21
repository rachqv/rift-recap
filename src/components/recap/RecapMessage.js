import Link from "next/link";
import Background from "@/components/Background";
import { defaultT } from "@/lib/i18n/en";
import { PLATFORMS } from "@/lib/riot/regions";
import { MessageCard, MessageScreen } from "./MessageCard";
import styles from "./RecapMessage.module.css";

export { MessageCard };

/**
 * "Maybe another server?": links to the same player on the servers that could hold the games. A player's games live on the
 * regional cluster of the server they play on, so an empty history usually means the wrong cluster; a server in the same
 * cluster would show the same games, so only the others are offered. `hrefFor(id)` is the link for a server id.
 */
export function OtherServers({ region, hrefFor, t = defaultT }) {
  const cluster = PLATFORMS[region]?.cluster;
  const others = Object.keys(PLATFORMS).filter((id) => PLATFORMS[id].cluster !== cluster);
  return (
    <details className={styles.servers}>
      <summary>{t("common.message.tryServer")}</summary>
      <ul className={styles.serverList}>
        {others.map((id) => (
          <li key={id}>
            <Link href={hrefFor(id)} className={styles.server}>
              {t(`common.regions.${id}`)}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Full-screen message for errors and empty results, on the same backdrop as the home page. */
export default function RecapMessage(props) {
  return <MessageScreen backdrop={<Background />} {...props} />;
}
