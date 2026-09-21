import Image from "next/image";
import { profileIconUrl } from "@/lib/riot/ddragon";
import { MEMBER_COLORS } from "./memberColors";
import styles from "./PlayerAvatar.module.css";

export { MEMBER_COLORS };

/** A player's profile icon in a colored ring, or their initial when there is no icon. Sizes: sm, md, lg. */
export default function PlayerAvatar({ version, icon, name, size = "md", color }) {
  const src = profileIconUrl(version, icon);
  const className = `${styles.avatar} ${styles[size]}`;
  const style = color ? { "--ring": color } : undefined;

  if (!src) {
    return (
      <span className={`${className} ${styles.fallback}`} style={style}>
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  // Profile icons are 128px source images; shown well below that, so they stay sharp.
  return <Image src={src} alt="" width={96} height={96} unoptimized className={className} style={style} />;
}
