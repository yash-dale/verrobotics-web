import { Footprints, Mic, SprayCan, Waypoints } from "lucide-react";
import Chapter from "./Chapter";
import Reveal from "./Reveal";
import { AsrDiagram, FollowMeDiagram, SprayDiagram, WaypointDiagram } from "./illustrations/FeatureDiagrams";
import styles from "./Features.module.css";
import { C } from "@/lib/palette";
import { features } from "@/lib/site";

const art = {
  follow: { Icon: Footprints, Diagram: FollowMeDiagram },
  spray: { Icon: SprayCan, Diagram: SprayDiagram },
  asr: { Icon: Mic, Diagram: AsrDiagram },
  waypoint: { Icon: Waypoints, Diagram: WaypointDiagram },
} as const;

export default function Features() {
  return (
    <Chapter id="features" prev={C.ink} bg={C.sprout} fg={C.ink} dot="rgba(0,0,0,0.07)">
      <div className="container">
        <p className="kicker" style={{ color: C.ink }}>
          04 / Features
        </p>
        <h2 className="title">
          Power-ups, built in<span style={{ color: C.cream }}>.</span>
        </h2>
        <p className="lede" style={{ color: "rgba(19,31,29,0.8)" }}>
          Four capabilities that make a Versor robot feel less like a machine and more like a crew member.
        </p>

        <div className={styles.grid}>
          {features.map((f, i) => {
            const { Icon, Diagram } = art[f.id];
            return (
              <Reveal key={f.id} delay={(i % 2) * 120}>
                <article className={styles.card}>
                  <div className={styles.diagram}>
                    <Diagram />
                  </div>
                  <div className={styles.body}>
                    <div className={styles.head}>
                      <span className={styles.icon}>
                        <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
                      </span>
                      <h3>{f.title}</h3>
                    </div>
                    <p>{f.text}</p>
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
