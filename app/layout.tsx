import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DocMind — Your knowledge, connected",
  description: "A private, local-first document intelligence workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
