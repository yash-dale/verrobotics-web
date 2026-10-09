import type { ReactNode } from "react";

/**
 * Tags shared by rich messages: <dot>.</dot> is the amber full stop in titles, <br></br> a line break.
 * Usage: t.rich("title", rich)
 */
export const rich = {
  dot: (chunks: ReactNode) => <span className="dot">{chunks}</span>,
  br: () => <br />,
};

/** "01 / Vision": section number plus its (translated) nav label. */
export const kicker = (n: number, label: string) => `${String(n).padStart(2, "0")} / ${label}`;
