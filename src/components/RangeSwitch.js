import Link from "next/link";
import styles from "./RangeSwitch.module.css";

/**
 * Three links that switch how far back a page looks. `links` is from `rangeLinks`; renders nothing without them. `label` names
 * the group for screen readers (`common.range.label`).
 */
export default function RangeSwitch({ links, label = "Time range" }) {
  if (!links) return null;
  return (
    <nav className={styles.switch} aria-label={label}>
      {links.map((link) => (
        <Link key={link.key} href={link.href} className={styles.option} aria-current={link.current ? "true" : undefined} scroll={false}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
