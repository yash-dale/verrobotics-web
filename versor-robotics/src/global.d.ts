import type { Locale } from "@/i18n/routing";
import type messages from "../messages/en.json";

// Type-checks every t("…") key against messages/en.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
