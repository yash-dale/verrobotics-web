// The real root layout (<html lang>, fonts, messages) is app/[locale]/layout.tsx.
// This one only exists so app/not-found.tsx has a parent; it just passes children through.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
