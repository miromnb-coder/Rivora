import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://averomira.com";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/favicon.svg"],
      disallow: [
        "/app/",
        "/login",
        "/forgot-password",
        "/reset-password",
        "/onboarding",
        "/auth/",
        "/api/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
