import { Footprints, Mic, SprayCan, Waypoints } from "lucide-react";
import { useTranslations } from "next-intl";
import Chapter from "./Chapter";
import Reveal from "./Reveal";
import { AsrDiagram, FollowMeDiagram, SprayDiagram, WaypointDiagram } from "./illustrations/FeatureDiagrams";
import styles from "./Features.module.css";
import { kicker } from "@/i18n/rich";
import { C } from "@/lib/palette";
import { features } from "@/lib/site";

const art = {
  follow: { Icon: Footprints, Diagram: FollowMeDiagram },
  spray: { Icon: SprayCan, Diagram: SprayDiagram },
  asr: { Icon: Mic, Diagram: AsrDiagram },
  waypoint: { Icon: Waypoints, Diagram: WaypointDiagram },
} as const;

export default function Features() {
  const t = useTranslations("features");
  const tn = useTranslations("nav");
  return (
    <Chapter id="features" label={tn("features")} prev={C.ink} bg={C.sprout} fg={C.ink} dot="rgba(0,0,0,0.07)">
      <div className="container">
        <p className="kicker" style={{ color: C.ink }}>
          {kicker(4, tn("features"))}
        </p>
        <h2 className="title">
          {t.rich("title", { dot: (c) => <span style={{ color: C.cream }}>{c}</span> })}
        </h2>
        <p className="lede" style={{ color: "rgba(19,31,29,0.8)" }}>
          {t("lede")}
        </p>

        <div className={styles.grid}>
          {features.map((id, i) => {
            const { Icon, Diagram } = art[id];
            return (
              <Reveal key={id} delay={(i % 2) * 120}>
                <article className={styles.card}>
                  <div className={styles.diagram}>
                    <Diagram
                      label={t(`items.${id}.diagram`)}
                      text={
                        id === "follow"
                          ? { status: t("items.follow.status") }
                          : id === "asr"
                            ? { command: t("items.asr.command"), reply: t("items.asr.reply") }
                            : {}
                      }
                    />
                  </div>
                  <div className={styles.body}>
                    <div className={styles.head}>
                      <span className={styles.icon}>
                        <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
                      </span>
                      <h3>{t(`items.${id}.title`)}</h3>
                    </div>
                    <p>{t(`items.${id}.text`)}</p>
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
