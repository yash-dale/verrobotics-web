import { useTranslations } from "next-intl";
import styles from "./Hero.module.css";
import { CarrierBot, SprayerBot, SproutIcon } from "./illustrations/Bots";
import Marquee from "./Marquee";
import { site } from "@/lib/site";

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
  const t = useTranslations("hero");
  return (
    <section id="top" className={styles.hero}>
      <div className={styles.sky} aria-hidden="true" />
      <div className={styles.field} aria-hidden="true">
        <div className={styles.plane} />
      </div>

      <div className={`container ${styles.content}`}>
        <p className={styles.badge}>
          <i /> {t("badge")}
        </p>

        <h1 className={styles.title} aria-label={site.name} lang="en">
          <span className={styles.versor} aria-hidden="true">
            <Letters text={VERSOR} />
          </span>
          <span className={styles.robotics} aria-hidden="true">
            <Letters text={ROBOTICS} offset={4} />
          </span>
        </h1>

        <p className={styles.lede}>
          {t("lede")}
        </p>

        <div className={styles.ctas}>
          <a href="#products" className="btn btn--amber">
            {t("ctaMachines")}
          </a>
          <a href="#vision" className="btn btn--ghost">
            {t("ctaVision")}
          </a>
        </div>
      </div>

      <div className={styles.fleet} aria-hidden="true">
        <div className={`${styles.bot} rv-hover`} style={{ ["--d" as string]: "0s" }}>
          <CarrierBot className={styles.botSvg} />
        </div>
        <div className={styles.bot} style={{ ["--d" as string]: "-1.1s" }}>
          <SproutIcon className={styles.sproutSvg} />
        </div>
        <div className={`${styles.bot} rv-hover`} style={{ ["--d" as string]: "-2.2s" }}>
          <SprayerBot className={styles.botSvg} />
        </div>
      </div>

      <Marquee />
    </section>
  );
}
