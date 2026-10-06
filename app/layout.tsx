import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { NavigationProgress } from "@/components/NavigationProgress";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://averomira.com"),
  title: {
    default: "Averomira — RFQ, Quotes, PO Reconciliation & ERP",
    template: "%s | Averomira",
  },
  description:
    "Averomira helps industrial sales teams move customer orders from RFQ to reviewed quote, purchase order reconciliation and ERP-ready sales order.",
  applicationName: "Averomira",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-icon.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://averomira.com",
    siteName: "Averomira",
    title: "Averomira — RFQ, Quotes, PO Reconciliation & ERP",
    description:
      "Averomira helps industrial sales teams move customer orders from RFQ to reviewed quote, purchase order reconciliation and ERP-ready sales order.",
  },
  twitter: {
    card: "summary",
    title: "Averomira — RFQ, Quotes, PO Reconciliation & ERP",
    description:
      "Averomira helps industrial sales teams move customer orders from RFQ to reviewed quote, purchase order reconciliation and ERP-ready sales order.",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body><NavigationProgress />{children}</body>
    </html>
  );
}
