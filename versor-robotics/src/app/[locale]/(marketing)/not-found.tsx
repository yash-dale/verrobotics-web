import { useLocale, useTranslations } from "next-intl";
import { rich } from "@/i18n/rich";
import { localePath, type Locale } from "@/i18n/routing";

export default function NotFound() {
  const t = useTranslations("notFound");
  const locale = useLocale() as Locale;
  return (
    <section className="container" style={{ padding: "calc(var(--header-h) + 18vh) var(--gutter) 22vh" }}>
      <p className="kicker">404</p>
      <h1 className="title">
        {t.rich("title", rich)}
      </h1>
      <p className="lede">{t("text")}</p>
      <p style={{ marginTop: 32 }}>
        <a href={localePath(locale)} className="btn btn--amber">
          {t("home")}
        </a>
      </p>
    </section>
  );
}
