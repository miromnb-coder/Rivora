import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rivora — RFQ to ready-to-review quote",
  description: "AI-assisted RFQ product matching for technical distributors and manufacturers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
