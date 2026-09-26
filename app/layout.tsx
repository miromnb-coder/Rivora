import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { NavigationProgress } from "@/components/NavigationProgress";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.nodra.fi"),
  title: "Nodra — RFQ to ready-to-review quote",
  description: "AI-assisted RFQ product matching for technical distributors and manufacturers.",
  applicationName: "Nodra",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body><NavigationProgress />{children}</body>
    </html>
  );
}
