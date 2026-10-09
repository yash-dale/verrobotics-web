"use client";

import NextError from "next/error";

/** Last-resort 404 for requests that never reach a language (the proxy sends everything else to app/[locale]). */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <NextError statusCode={404} />
      </body>
    </html>
  );
}
