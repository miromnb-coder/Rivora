import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/forgot-password"],
      disallow: [
        "/app/",
        "/reset-password",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: "https://averomira.com/sitemap.xml",
    host: "https://averomira.com",
  };
}
