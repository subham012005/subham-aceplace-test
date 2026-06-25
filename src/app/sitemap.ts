import type { MetadataRoute } from "next";

const BASE_URL = "https://aceplace.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    // ── Home / Landing ──────────────────────────────────────
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },

    // ── Learn More ──────────────────────────────────────────
    {
      url: `${BASE_URL}/learn-more`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },

    // ── Login ───────────────────────────────────────────────
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.7,
    },

    // ── Legal ───────────────────────────────────────────────
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/acceptable-use`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/runtime-usage`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
