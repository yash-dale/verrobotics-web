import type { Metadata, Viewport } from "next";
import "@fontsource-variable/montserrat";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Versor Robotics | Autonomous machines for the fields of tomorrow",
  description:
    "Versor Robotics builds autonomous harvesting and spraying robots for farms: rugged, precise and quietly relentless.",
  openGraph: {
    title: "Versor Robotics",
    description: "Autonomous machines for the fields of tomorrow.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#131f1d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* arms the scroll-reveal styles only when JavaScript is running */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
