import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Averomira",
    short_name: "Averomira",
    description:
      "Averomira helps industrial sales teams move customer orders from RFQ to reviewed quote, purchase order reconciliation and ERP-ready sales order.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
