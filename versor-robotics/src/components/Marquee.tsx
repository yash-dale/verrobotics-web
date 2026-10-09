import styles from "./Marquee.module.css";

const WORDS = ["Plant", "Spray", "Scan", "Carry", "Repeat"];

const Sprout = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.icon}>
    <path d="M12 21V11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M12 13C7 13 4 10 4 5c5 0 8 3 8 8z" fill="currentColor" />
    <path d="M12 11c0-4 2.6-7 8-7 0 4.6-3 7-8 7z" fill="currentColor" opacity="0.7" />
  </svg>
);

/** Endless ticker strip. Content is duplicated so the loop is seamless. */
export default function Marquee() {
  const row = (hidden: boolean) => (
    <div className={styles.row} aria-hidden={hidden || undefined}>
      {[...WORDS, ...WORDS, ...WORDS, ...WORDS].map((w, i) => (
        <span key={i} className={styles.item}>
          {w}
          <Sprout />
        </span>
      ))}
    </div>
  );
  return (
    <div className={styles.strip} role="presentation">
      <div className={styles.track}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
