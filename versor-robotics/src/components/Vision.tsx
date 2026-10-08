import { Cpu, Eye, Leaf } from "lucide-react";
import Chapter from "./Chapter";
import Reveal from "./Reveal";
import { RoverBot } from "./illustrations/Bots";
import styles from "./Vision.module.css";
import { C } from "@/lib/palette";

const values = [
  {
    icon: Leaf,
    title: "Soil first",
    text: "Every machine we ship is judged by one metric: healthier soil at season end. No compaction, no blanket chemistry, no waste.",
  },
  {
    icon: Cpu,
    title: "Edge intelligence",
    text: "Our robots see, decide and act in the field. No cloud round-trips, no dead zones, so a row of crops is handled where it grows.",
  },
  {
    icon: Eye,
    title: "Radical transparency",
    text: "Open field logs, open repair manuals. A farmer should always know what the robot did last night and why.",
  },
];

export default function Vision() {
  return (
    <Chapter id="vision" prev={C.ink} bg={C.tomato} dot="rgba(0,0,0,0.08)">
      <div className={styles.rays} aria-hidden="true" />
      <div className={`container ${styles.wrap}`}>
        <div className={styles.head}>
          <div>
            <p className="kicker" style={{ color: C.cream }}>
              01 / Vision
            </p>
            <h2 className="title">
              Agriculture,
              <br />
              played on
              <br />
              <span className={styles.ink}>easy mode.</span>
            </h2>
            <p className={`lede ${styles.lede}`}>
              Versor Robotics exists to make small farms mighty. We believe the next green revolution is not bigger
              tractors. It is fleets of tireless, respectful machines that treat every plant as an individual and
              every field as a living system.
            </p>
          </div>

          <figure className={styles.unit}>
            <RoverBot className={styles.unitBot} title="Versor rover, unit 07" />
            <figcaption>Unit-07</figcaption>
          </figure>
        </div>

        <ul className={styles.values}>
          {values.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal delay={i * 110} className={styles.cardWrap}>
                <article className={styles.card}>
                  <Icon size={26} strokeWidth={2.2} className={styles.icon} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </Chapter>
  );
}
