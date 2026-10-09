"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import styles from "./SprayLabLoader.module.css";

function Loading() {
  const t = useTranslations("simulator");
  return (
    <div className={styles.loading} role="status">
      {t("loading")}
    </div>
  );
}

/** The simulator is canvas + browser APIs only, so it is never rendered on the server. */
const SprayLab = dynamic(() => import("./SprayLab"), { ssr: false, loading: Loading });

export default function SprayLabLoader() {
  return <SprayLab />;
}
