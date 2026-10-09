import { useTranslations } from "next-intl";
import Chapter from "./Chapter";
import VideoPlayer from "./VideoPlayer";
import { kicker, rich } from "@/i18n/rich";
import { C } from "@/lib/palette";

export default function VideoSection() {
  const t = useTranslations("video");
  const tn = useTranslations("nav");
  return (
    <Chapter id="video" label={tn("video")} prev={C.tomato} bg={C.deep}>
      <div className="container" style={{ display: "flex", flexDirection: "column", gap: "clamp(24px, 4vh, 40px)" }}>
        <div>
          <p className="kicker">{kicker(2, tn("video"))}</p>
          <h2 className="title" style={{ fontSize: "clamp(2.1rem, 5vw, 3.9rem)" }}>
            {t.rich("title", rich)}
          </h2>
        </div>
        <VideoPlayer />
      </div>
    </Chapter>
  );
}
