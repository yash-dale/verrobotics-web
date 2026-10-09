import { defineRouting } from "next-intl/routing";

export const locales = ["en", "hi", "mr", "bn", "ta", "te", "kn", "ml"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  // English lives at "/", every other language under its own prefix (/hi, /mr …)
  localePrefix: "as-needed",
  // remember the visitor's choice for a year (next-intl's default is a session cookie)
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});

/** Each language named in its own script, for the language picker. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
};

/** Writing system per language; picks the Noto Sans font and the Indic typography tweaks in globals.css. */
export const localeScript: Record<Locale, string> = {
  en: "latn",
  hi: "deva",
  mr: "deva",
  bn: "beng",
  ta: "taml",
  te: "telu",
  kn: "knda",
  ml: "mlym",
};

/** Public path of a page in a given language: ("hi", "/simulator") → "/hi/simulator", ("en", "/") → "/". */
export function localePath(locale: Locale, path = "/"): string {
  if (locale === routing.defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
