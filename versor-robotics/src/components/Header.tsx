"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import styles from "./Header.module.css";
import { RoverBot } from "./illustrations/Bots";
import { nav } from "@/lib/site";

export default function Header() {
  const [active, setActive] = useState<string>("");
  const [open, setOpen] = useState(false);

  // highlight the section whose wash has finished
  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      let current = "";
      for (const { id } of nav) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= vh * 0.5) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <a href="#top" className={styles.logo} aria-label="Versor Robotics, back to top">
          <RoverBot className={styles.logoBot} title="" />
          <span>Versor</span>
        </a>

        <nav className={styles.nav} aria-label="Primary">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} className={active === n.id ? styles.active : undefined} aria-current={active === n.id ? "true" : undefined}>
              {n.label}
            </a>
          ))}
          <a href="#contact" className={`btn btn--tomato ${styles.cta}`}>
            Start a pilot
          </a>
        </nav>

        <button
          type="button"
          className={styles.burger}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <nav id="mobile-nav" className={`${styles.panel} ${open ? styles.panelOpen : ""}`} aria-label="Mobile">
        {nav.map((n) => (
          <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}>
            {n.label}
          </a>
        ))}
        <a href="#contact" className="btn btn--tomato" onClick={() => setOpen(false)}>
          Start a pilot
        </a>
      </nav>
    </header>
  );
}
