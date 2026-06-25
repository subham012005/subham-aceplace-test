import type { MetadataRoute } from "next";

const BASE_URL = "https://aceplace.ai";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/learn-more", "/login", "/legal/"],
        // Disallow authenticated/private workstation routes
        disallow: ["/dashboard", "/dashboard/", "/system-config", "/api/"],
      },
      {
        // Allow all major crawlers full access to public pages
        userAgent: [
          "Googlebot",
          "Googlebot-Image",
          "Bingbot",
          "DuckDuckBot",
          "Slurp",
        ],
        allow: "/",
        disallow: ["/dashboard", "/system-config", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
