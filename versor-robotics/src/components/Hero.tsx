import styles from "./Hero.module.css";
import { CarrierBot, SprayerBot, SproutIcon } from "./illustrations/Bots";
import Marquee from "./Marquee";

const VERSOR = "VERSOR".split("");
const ROBOTICS = "ROBOTICS".split("");

const Letters = ({ text, offset = 0 }: { text: string[]; offset?: number }) => (
  <>
    {text.map((c, i) => (
      <span key={i} className={styles.mask}>
        <span className={styles.letter} style={{ ["--i" as string]: i + offset }}>
          {c}
        </span>
      </span>
    ))}
  </>
);

export default function Hero() {
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.sky} aria-hidden="true" />
      <div className={styles.field} aria-hidden="true">
        <div className={styles.plane} />
      </div>

      <div className={`container ${styles.content}`}>
        <p className={styles.badge}>
          <i /> Field systems online
        </p>

        <h1 className={styles.title} aria-label="Versor Robotics">
          <span className={styles.versor} aria-hidden="true">
            <Letters text={VERSOR} />
          </span>
          <span className={styles.robotics} aria-hidden="true">
            <Letters text={ROBOTICS} offset={4} />
          </span>
        </h1>

        <p className={styles.lede}>
          Autonomous machines for the fields of tomorrow. We build farm robots with the soul of an arcade cabinet:
          rugged, precise, and quietly relentless.
        </p>

        <div className={styles.ctas}>
          <a href="#products" className="btn btn--amber">
            See the machines
          </a>
          <a href="#vision" className="btn btn--ghost">
            Read the vision
          </a>
        </div>
      </div>

      <div className={styles.fleet} aria-hidden="true">
        <div className={`${styles.bot} rv-hover`} style={{ ["--d" as string]: "0s" }}>
          <CarrierBot className={styles.botSvg} title="" />
        </div>
        <div className={styles.bot} style={{ ["--d" as string]: "-1.1s" }}>
          <SproutIcon className={styles.sproutSvg} title="" />
        </div>
        <div className={`${styles.bot} rv-hover`} style={{ ["--d" as string]: "-2.2s" }}>
          <SprayerBot className={styles.botSvg} title="" />
        </div>
      </div>

      <Marquee />
    </section>
  );
}
