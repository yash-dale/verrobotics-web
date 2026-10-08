import Chapter from "./Chapter";
import VideoPlayer from "./VideoPlayer";
import { C } from "@/lib/palette";

export default function VideoSection() {
  return (
    <Chapter id="video" prev={C.tomato} bg={C.deep}>
      <div className="container" style={{ display: "flex", flexDirection: "column", gap: "clamp(24px, 4vh, 40px)" }}>
        <div>
          <p className="kicker">02 / Video</p>
          <h2 className="title" style={{ fontSize: "clamp(2.1rem, 5vw, 3.9rem)" }}>
            See it in the field<span className="dot">.</span>
          </h2>
        </div>
        <VideoPlayer />
      </div>
    </Chapter>
  );
}
