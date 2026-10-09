import { Mail, MapPin, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Chapter from "./Chapter";
import ContactForm, { type EnglishValues } from "./ContactForm";
import styles from "./Contact.module.css";
import { kicker, rich } from "@/i18n/rich";
import type { Locale } from "@/i18n/routing";
import { C } from "@/lib/palette";
import { products, site } from "@/lib/site";

const INTERESTS = [...products.map((p) => p.id), "both", "other"] as const;

/** Interest option labels in one language: the visitor's for display, English for what is sent. */
async function interestLabels(locale: Locale): Promise<Record<string, string>> {
  const [tc, tp] = await Promise.all([
    getTranslations({ locale, namespace: "contact" }),
    getTranslations({ locale, namespace: "products" }),
  ]);
  const labels: Record<string, string> = { both: tc("interestBoth"), other: tc("interestOther") };
  for (const p of products) labels[p.id] = tp(`items.${p.id}.kind`);
  return labels;
}

export default async function Contact() {
  const locale = await getLocale();
  const [t, tn, enContact, shown, enInterests] = await Promise.all([
    getTranslations("contact"),
    getTranslations("nav"),
    getTranslations({ locale: "en", namespace: "contact" }),
    interestLabels(locale),
    interestLabels("en"),
  ]);

  const english: EnglishValues = {
    interests: enInterests,
    language: `${new Intl.DisplayNames(["en"], { type: "language" }).of(locale)} (${locale})`,
    mail: {
      subject: enContact.raw("mail.subject"),
      fallbackName: enContact("mail.fallbackName"),
      name: enContact("mail.name"),
      email: enContact("mail.email"),
      interest: enContact("mail.interest"),
      language: enContact("mail.language"),
    },
  };

  return (
    <Chapter id="contact" label={tn("contact")} prev={C.sprout} bg={C.deep}>
      <div className="container">
        <p className="kicker">{kicker(5, tn("contact"))}</p>
        <h2 className="title">{t.rich("title", rich)}</h2>
        <p className="lede">{t("lede")}</p>

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
              <p className={styles.noteTitle}>{t("noteTitle")}</p>
              <p>{t("noteText")}</p>
            </aside>
          </div>

          <ContactForm options={INTERESTS.map((id) => ({ id, label: shown[id] }))} english={english} />
        </div>
      </div>
    </Chapter>
  );
}
