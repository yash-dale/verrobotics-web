import { ArrowUpRight } from "lucide-react";
import Chapter from "./Chapter";
import { SproutIcon } from "./illustrations/Bots";
import styles from "./JoinUs.module.css";
import { C } from "@/lib/palette";
import { roles, site } from "@/lib/site";

export default function JoinUs() {
  const { url, embedUrl } = site.forms.join;
  // Until a Google Form link is set, applications fall back to email.
  const apply = url || `mailto:${site.email}?subject=${encodeURIComponent("Application: Versor Robotics")}`;
  const external = Boolean(url);

  return (
    <Chapter id="join" prev={C.deep} bg={C.ink}>
      <div className="container">
        <div className={styles.head}>
          <div>
            <p className="kicker">06 / Join us</p>
            <h2 className="title">
              Grow with
              <br />
              the fleet<span className="dot">.</span>
            </h2>
            <p className="lede">
              We are engineers, agronomists and ex-arcade kids building machines that smell like soil and hum like
              synthesizers. Come build the fleet with us.
            </p>
            <div className={styles.ctas}>
              <a href={apply} className="btn btn--sprout" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                Apply now
              </a>
              <a href={`mailto:${site.email}`} className="btn btn--ghost">
                Say hello
              </a>
            </div>
          </div>

          <div className={styles.badge} aria-hidden="true">
            <SproutIcon className={styles.sprout} title="" />
          </div>
        </div>

        <div className={styles.roles}>
          <div className={styles.rolesHead}>
            <span>Open roles</span>
            <span>Team / Location</span>
          </div>
          <ul>
            {roles.map((r) => (
              <li key={r.title}>
                <a href={apply} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  <strong>{r.title}</strong>
                  <span className={styles.tags}>
                    <em>{r.team}</em>
                    <em className={styles.where}>{r.where}</em>
                    <ArrowUpRight size={18} aria-hidden="true" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {embedUrl ? (
          <div className={styles.embed}>
            <iframe src={embedUrl} title="Versor Robotics application form" loading="lazy" />
          </div>
        ) : null}
      </div>
    </Chapter>
  );
}
