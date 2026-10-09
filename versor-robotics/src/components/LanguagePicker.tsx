"use client";

import { useTransition } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import styles from "./LanguagePicker.module.css";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, routing, type Locale } from "@/i18n/routing";

/**
 * Language dropdown. Each language is shown in its own script. Switching goes through next-intl's router,
 * which also stores the choice in the NEXT_LOCALE cookie (kept for a year, see i18n/routing.ts),
 * so the next visit to "/" opens in the same language.
 */
export default function LanguagePicker({ className = "", onPick }: { className?: string; onPick?: () => void }) {
  const t = useTranslations("header");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className={`${styles.picker} ${className}`} data-pending={pending || undefined}>
      <Languages size={16} aria-hidden="true" className={styles.icon} />
      <span className={styles.sr}>{t("language")}</span>
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          onPick?.();
          startTransition(() => router.replace(pathname, { locale: next }));
        }}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" className={styles.chev} />
    </label>
  );
}
