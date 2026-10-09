import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "@fontsource-variable/montserrat";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
// Indic scripts: only the script's own glyph subset is declared, and globals.css only names a family under
// html[data-script=…], so a visitor's browser downloads the font files for the active language and no other.
import "@fontsource/noto-sans-devanagari/devanagari-500.css";
import "@fontsource/noto-sans-devanagari/devanagari-700.css";
import "@fontsource/noto-sans-devanagari/devanagari-900.css";
import "@fontsource/noto-sans-bengali/bengali-500.css";
import "@fontsource/noto-sans-bengali/bengali-700.css";
import "@fontsource/noto-sans-bengali/bengali-900.css";
import "@fontsource/noto-sans-tamil/tamil-500.css";
import "@fontsource/noto-sans-tamil/tamil-700.css";
import "@fontsource/noto-sans-tamil/tamil-900.css";
import "@fontsource/noto-sans-telugu/telugu-500.css";
import "@fontsource/noto-sans-telugu/telugu-700.css";
import "@fontsource/noto-sans-telugu/telugu-900.css";
import "@fontsource/noto-sans-kannada/kannada-500.css";
import "@fontsource/noto-sans-kannada/kannada-700.css";
import "@fontsource/noto-sans-kannada/kannada-900.css";
import "@fontsource/noto-sans-malayalam/malayalam-500.css";
import "@fontsource/noto-sans-malayalam/malayalam-700.css";
import "@fontsource/noto-sans-malayalam/malayalam-900.css";
import "../globals.css";
import { localeScript, routing } from "@/i18n/routing";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(site.url),
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: site.name,
      description: t("ogDescription"),
      type: "website",
      locale,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#131f1d",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} data-script={localeScript[locale]} suppressHydrationWarning>
      <head>
        {/* arms the scroll-reveal styles only when JavaScript is running */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
