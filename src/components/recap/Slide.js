import Image from "next/image";
import styles from "./Slide.module.css";

// Cycling skins: each one is shown for this long. The keyframes in Slide.module.css are timed for 2 to 4 skins.
const SKIN_SECONDS = 6;
const MAX_SKINS = 4;

/**
 * Fades and rises into place when its slide becomes the active one. `i` staggers the entrance. Any other props (`role`,
 * `aria-label`, ...) go to the element, so a chart can be labelled for screen readers.
 */
export function Reveal({ i = 0, as: Tag = "div", className = "", style, children, ...rest }) {
  return (
    <Tag className={`${styles.reveal} ${className}`} data-reveal style={{ "--i": i, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * One full-screen story slide. `art` is an optional backdrop: a splash URL, a `{ url, name }` skin, or an
 * array of them (2 to 4), which crossfade and show each skin's name. `strength` ("soft" | "hero") sets how
 * much of it shows through. `accent` overrides the theme color. `backdrop` is any custom full-slide background
 * (for layouts the single-image `art` can't do, like a split screen). `dwell` is how many seconds the slideshow stays
 * on this slide (the story's default is 7): more for dense slides, and for ones you play with.
 */
export default function Slide({ art, backdrop, strength = "soft", accent, eager = false, dwell, children }) {
  const skins = (Array.isArray(art) ? art : art ? [art] : [])
    .map((skin) => (typeof skin === "string" ? { url: skin } : skin))
    .slice(0, MAX_SKINS);
  const cycling = skins.length > 1;
  const showsNames = cycling && skins.some((skin) => skin.name);

  return (
    <section className={styles.slide} data-slide data-skin-names={showsNames || undefined} data-dwell={dwell} style={accent ? { "--tone": accent } : undefined}>
      {skins.length > 0 && (
        <div className={styles.art} data-strength={strength} aria-hidden="true">
          {skins.map((skin, i) => (
            <div
              key={skin.url}
              className={cycling ? `${styles.frame} ${styles[`cycle${skins.length}`]}` : styles.frame}
              style={cycling ? { animationDelay: `${i * SKIN_SECONDS}s` } : undefined}
            >
              <div className={styles.zoom}>
                <Image
                  src={skin.url}
                  alt=""
                  fill
                  sizes="100vw"
                  quality={90}
                  loading={eager && i === 0 ? "eager" : "lazy"}
                  fetchPriority={eager && i === 0 ? "high" : "auto"}
                  className={styles.img}
                />
              </div>
            </div>
          ))}
          <div className={styles.shade} />
          <div className="grain" />
        </div>
      )}
      {backdrop && (
        <div className={styles.backdrop} aria-hidden="true">
          {backdrop}
        </div>
      )}
      {showsNames && (
        <div className={styles.skinNames} aria-hidden="true">
          {skins.map((skin, i) => (
            <p
              key={skin.url}
              className={`${styles.skinName} ${styles[`cycle${skins.length}`]}`}
              style={{ animationDelay: `${i * SKIN_SECONDS}s` }}
            >
              {skin.name ?? ""}
            </p>
          ))}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
