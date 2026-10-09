import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { localePath, routing } from "./routing";

/** Canonical + hreflang links for a page: every language version, plus x-default pointing at English. */
export function alternatesFor(locale: string, path = "/"): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localePath(l, path);
  languages["x-default"] = localePath(routing.defaultLocale, path);
  return { canonical: hasLocale(routing.locales, locale) ? localePath(locale, path) : path, languages };
}
