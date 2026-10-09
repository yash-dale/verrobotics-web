"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./Chapter.module.css";
import { rowPx, washPolygon, washProgress } from "@/lib/wash";
import { WaterFx } from "@/lib/waterFx";

type Props = {
  /** anchor id used by the nav (#vision, #products …) */
  id: string;
  /** accessible name of the section (its nav label) */
  label: string;
  /** background colour of the previous section: what the spray washes away */
  prev: string;
  /** this section's background colour */
  bg: string;
  /** text colour inside the section */
  fg?: string;
  /** colour of the dot texture */
  dot?: string;
  children: ReactNode;
};

/**
 * A page section that is revealed by a row of spray nozzles sweeping left → right.
 * The sweep is tied to scroll position (no scroll-jacking: the page scrolls normally,
 * the section just sticks for a moment while the boom passes).
 */
export default function Chapter({ id, label, prev, bg, fg = "#f3e9d8", dot = "rgba(255,255,255,0.045)", children }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const next = nextRef.current;
    const canvas = canvasRef.current;
    if (!track || !stage || !next || !canvas) return;

    // Respect reduced motion: show the finished section, no sweep.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      next.style.clipPath = "none";
      return;
    }

    const fx = new WaterFx(canvas);
    let W = 0;
    let H = 0; // stage height (can be taller than the viewport)
    let CH = 0; // canvas height (viewport portion only)
    let rowH = 70;
    let visible = false;
    let raf = 0;
    let last = 0;
    let clipState: "none" | "hidden" | "poly" | "" = "";
    let linger = 0; // seconds of run-off to keep drawing after the boom has gone

    const setClip = (np: number, t: number) => {
      if (np >= 1) {
        if (clipState !== "none") next.style.clipPath = "none";
        clipState = "none";
      } else if (np <= 0) {
        if (clipState !== "hidden") next.style.clipPath = "inset(0 100% 0 0)";
        clipState = "hidden";
      } else {
        next.style.clipPath = washPolygon(np, W, H, rowH, t);
        clipState = "poly";
      }
    };

    const measure = () => {
      const r = stage.getBoundingClientRect();
      W = r.width;
      H = r.height;
      const vh = window.innerHeight;
      rowH = rowPx(vh);
      CH = Math.min(H, vh);
      if (visible) {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(CH * dpr);
        canvas.style.height = `${CH}px`;
        fx.setSize(W, CH, dpr);
      }
      setClip(washProgress(track.getBoundingClientRect().top, vh), performance.now() / 1000);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible) return;
      const t = now / 1000;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const np = washProgress(track.getBoundingClientRect().top, window.innerHeight);
      setClip(np, t);

      if (np > 0 && np < 1) {
        fx.draw(np, t, dt, rowH, true);
        linger = 2.2;
      } else if (np >= 1 && (linger > 0 || fx.busy)) {
        // the boom has gone; let the last drips run down the screen and fade
        linger -= dt;
        fx.draw(1, t, dt, rowH, false);
        if (linger <= 0 && !fx.busy) {
          fx.reset();
          return;
        }
      } else {
        fx.reset();
        return; // idle: restarted by the next scroll
      }
      raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    // Only keep a canvas backing store while the section is on screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          measure();
          kick();
        } else {
          canvas.width = 0;
          canvas.height = 0;
          fx.reset();
          linger = 0;
        }
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(stage);

    const ro = new ResizeObserver(() => measure());
    ro.observe(stage);

    measure();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", measure);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const vars = {
    "--prev": prev,
    "--bg": bg,
    "--fg": fg,
    "--dot": dot,
  } as CSSProperties;

  return (
    <section className={styles.chapter} style={vars} aria-label={label}>
      <div ref={trackRef} className={styles.track} data-chapter="">
        <span id={id} className={styles.anchor} aria-hidden="true" />
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.prev} />
          <div ref={nextRef} className={styles.next}>
            {children}
          </div>
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        </div>
        {/* scroll runway: real content (not padding) so the stage can stay stuck while it is scrolled through */}
        <div className={styles.runway} aria-hidden="true" />
      </div>
    </section>
  );
}
