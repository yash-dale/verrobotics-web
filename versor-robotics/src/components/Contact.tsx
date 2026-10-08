"use client";

import { useState, type FormEvent } from "react";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import Chapter from "./Chapter";
import styles from "./Contact.module.css";
import { C } from "@/lib/palette";
import { site } from "@/lib/site";

type Status = "idle" | "sending" | "sent" | "mailto" | "error";

export default function Contact() {
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get("company")) return; // honeypot: bots fill this, people never see it

    const values = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      interest: String(data.get("interest") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
    };

    const { action, fields } = site.forms.contact;

    // Not connected to a Google Form yet → hand over to the visitor's email app.
    if (!action) {
      const subject = encodeURIComponent(`Pilot enquiry from ${values.name || "the website"}`);
      const body = encodeURIComponent(
        `${values.message}\n\nName: ${values.name}\nEmail: ${values.email}\nInterested in: ${values.interest}`,
      );
      window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
      setStatus("mailto");
      return;
    }

    setStatus("sending");
    try {
      const body = new URLSearchParams();
      body.append(fields.name, values.name);
      body.append(fields.email, values.email);
      body.append(fields.interest, values.interest);
      body.append(fields.message, values.message);
      // Google Forms does not send CORS headers, so the reply is opaque; a thrown error means the request never left.
      await fetch(action, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Chapter id="contact" prev={C.sprout} bg={C.deep}>
      <div className="container">
        <p className="kicker">05 / Contact</p>
        <h2 className="title">
          Insert coin<span className="dot">.</span> Talk to us<span className="dot">.</span>
        </h2>
        <p className="lede">
          Running a farm, a research plot, or a co-op? Tell us about your fields and we will tell you what a Versor
          fleet could do on them.
        </p>

        <div className={styles.grid}>
          <div className={styles.info}>
            <a href={`mailto:${site.email}`} className={styles.chip}>
              <Mail size={20} aria-hidden="true" />
              {site.email}
            </a>
            <a href={`tel:${site.phone.replace(/[^+\d]/g, "")}`} className={styles.chip}>
              <Phone size={20} aria-hidden="true" />
              {site.phone}
            </a>
            <p className={styles.chip}>
              <MapPin size={20} aria-hidden="true" />
              {site.address}
            </p>
            <aside className={styles.note}>
              <p className={styles.noteTitle}>Pilot program</p>
              <p>Tell us about your crops, your acreage and your biggest bottleneck. A real person will reply.</p>
            </aside>
          </div>

          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.two}>
              <label>
                <span>Name</span>
                <input name="name" type="text" required autoComplete="name" placeholder="Farm name / your name" />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" required autoComplete="email" placeholder="you@farm.example" />
              </label>
            </div>

            <label>
              <span>I&rsquo;m interested in</span>
              <select name="interest" defaultValue="Both robots">
                <option>Harvesting robot</option>
                <option>Spraying robot</option>
                <option>Both robots</option>
                <option>Something else</option>
              </select>
            </label>

            <label>
              <span>Your fields &amp; what you need</span>
              <textarea name="message" required rows={5} placeholder="40 acres of strawberries, spraying by hand…" />
            </label>

            {/* honeypot */}
            <input name="company" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className={styles.hp} />

            <div className={styles.actions}>
              <button type="submit" className="btn btn--tomato" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send message"}
                <Send size={16} aria-hidden="true" />
              </button>
              <p className={styles.status} role="status" aria-live="polite">
                {status === "sent" && "Message sent. We will be in touch soon."}
                {status === "mailto" && "Your email app should open with the message ready to send."}
                {status === "error" && "That did not go through. Please check your connection or email us directly."}
              </p>
            </div>
          </form>
        </div>
      </div>
    </Chapter>
  );
}
