import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.nodra.fi"),
  title: "Nodra — RFQ to ready-to-review quote",
  description: "AI-assisted RFQ product matching for technical distributors and manufacturers.",
  applicationName: "Nodra",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
