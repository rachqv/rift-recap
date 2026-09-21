import Link from "next/link";
import Background from "@/components/Background";
import styles from "./forms.module.css";

/** Full-page frame for the squad and head-to-head setup forms, on the same backdrop as the home page. */
export default function SetupShell({ children }) {
  return (
    <>
      <Background />
      <nav aria-label="Rift Recap">
        <Link href="/" className={styles.brand}>
          Rift Recap
        </Link>
      </nav>
      <main className={styles.shell}>
        <div className={styles.card}>{children}</div>
      </main>
    </>
  );
}
