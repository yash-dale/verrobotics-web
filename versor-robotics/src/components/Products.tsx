import { Check } from "lucide-react";
import Chapter from "./Chapter";
import Reveal from "./Reveal";
import { CarrierBot, SprayerBot } from "./illustrations/Bots";
import styles from "./Products.module.css";
import { C } from "@/lib/palette";
import { products } from "@/lib/site";

const art = {
  carrier: { Bot: CarrierBot, screen: C.sproutDark },
  spray: { Bot: SprayerBot, screen: "#3b6676" },
} as const;

export default function Products() {
  return (
    <Chapter id="products" prev={C.deep} bg={C.ink}>
      <div className="container">
        <p className="kicker">03 / Products</p>
        <h2 className="title">
          Pick your player<span className="dot">.</span>
        </h2>
        <p className="lede">Two machines, one fleet. Slot them into your season like cartridges into a cabinet.</p>

        <div className={styles.grid}>
          {products.map((p, i) => {
            const { Bot, screen } = art[p.id];
            return (
              <Reveal key={p.id} delay={i * 140}>
                <article className={`${styles.card} rv-hover`}>
                  <div className={styles.cab}>
                    <div className={styles.plate}>{p.code}</div>
                    <div className={styles.screen} style={{ background: screen }}>
                      <div className={styles.rows} aria-hidden="true" />
                      <Bot className={styles.bot} title={p.kind} />
                      <div className={styles.scan} aria-hidden="true" />
                    </div>
                    <div className={styles.ctrl} aria-hidden="true">
                      <i className={styles.red} />
                      <i className={styles.yellow} />
                      <b />
                    </div>
                  </div>

                  <div className={styles.meta}>
                    <p className={styles.sub}>
                      {p.index} / {p.kind}
                    </p>
                    <h3>{p.name}</h3>
                    <p className={styles.tagline}>{p.tagline}</p>
                    <ul>
                      {p.points.map((pt) => (
                        <li key={pt}>
                          <Check size={16} strokeWidth={3} aria-hidden="true" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <a href="#contact" className="btn btn--amber">
                      Request a demo
                    </a>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </Chapter>
  );
}
