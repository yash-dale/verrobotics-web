import styles from "./Footer.module.css";
import { RoverBot } from "./illustrations/Bots";
import { nav, site } from "@/lib/site";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <a href="#top" className={styles.brand} aria-label="Back to top">
          <RoverBot className={styles.bot} title="" />
          <span>Versor Robotics</span>
        </a>
        <nav aria-label="Footer" className={styles.links}>
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`}>
              {n.label}
            </a>
          ))}
        </nav>
        <p className={styles.copy}>&copy; {new Date().getFullYear()} {site.name}. Grown, not mined.</p>
      </div>
    </footer>
  );
}
