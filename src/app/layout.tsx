import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const BASE_URL = "https://aceplace.ai";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#06b6d4" },
    { media: "(prefers-color-scheme: light)", color: "#06b6d4" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: "ACEPLACE Workstation — Governed AI Agent Runtime Platform",
    template: "%s | ACEPLACE Workstation",
  },

  description:
    "ACEPLACE Workstation is the world's first deterministic multi-agent runtime platform. Deploy ACEAGENTS™ with persistent identity, full governance, real-time telemetry, and accountable AI execution.",

  keywords: [
    "AI agent platform",
    "multi-agent runtime",
    "deterministic AI agents",
    "governed AI execution",
    "ACEPLACE workstation",
    "ACEAGENT",
    "ACELOGIC",
    "autonomous AI workers",
    "AI governance platform",
    "AI identity management",
    "enterprise AI orchestration",
    "LLM orchestration",
    "AI audit trail",
    "accountable AI",
    "bring your own LLM",
    "OpenAI GPT-4o enterprise",
    "Claude enterprise AI",
    "AI execution telemetry",
    "autonomous agent governance",
    "AI agent lifecycle management",
  ],

  authors: [{ name: "ACEPLACE", url: BASE_URL }],
  creator: "ACEPLACE",
  publisher: "ACEPLACE",

  category: "technology",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "ACEPLACE Workstation",
    title: "ACEPLACE Workstation — Governed AI Agent Runtime Platform",
    description:
      "Deploy ACEAGENTS™ with deterministic identity, full governance, and accountable autonomous execution. The enterprise-grade multi-agent runtime platform.",
    images: [
      {
        url: "/ace-symbol.png",
        width: 1200,
        height: 630,
        alt: "ACEPLACE Workstation — AI Agent Governance Platform",
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    site: "@aceplace_ai",
    creator: "@aceplace_ai",
    title: "ACEPLACE Workstation — Governed AI Agent Runtime Platform",
    description:
      "Deploy ACEAGENTS™ with deterministic identity, full governance, and accountable autonomous execution.",
    images: ["/ace-symbol.png"],
  },

  icons: {
    icon: [
      { url: "/ace-favicon.png", type: "image/png" },
      { url: "/ace-favicon1.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/ace-favicon.png", sizes: "180x180" }],
    shortcut: "/ace-favicon.png",
  },

  manifest: "/manifest.json",

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: BASE_URL,
  },

  // Uncomment and fill these after verifying your site in Search Console / Bing Webmaster
  // verification: {
  //   google: "YOUR_GOOGLE_SITE_VERIFICATION_TOKEN",
  //   yandex: "YOUR_YANDEX_TOKEN",
  //   bing: "YOUR_BING_TOKEN",
  // },
};

import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "ACEPLACE Workstation",
      description:
        "The world's first deterministic multi-agent runtime platform with full governance and accountable AI execution.",
      publisher: { "@id": `${BASE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "ACEPLACE",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/ace-symbol.png`,
        width: 512,
        height: 512,
      },
      sameAs: [
        "https://twitter.com/aceplace_ai",
        "https://linkedin.com/company/aceplace",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${BASE_URL}/#product`,
      name: "ACEPLACE Workstation",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: BASE_URL,
      description:
        "A governed multi-agent runtime platform enabling deterministic AI agent identity, execution governance, real-time telemetry, and full accountability.",
      featureList: [
        "Deterministic Agent Identity (ACELOGIC™)",
        "Governed Autonomous Execution (ACEPLACE™)",
        "Canonical Digital Workers (ACEAGENTS™)",
        "Real-time telemetry and observability",
        "Full execution audit trails",
        "Bring Your Own LLM — model agnostic",
        "Multi-provider support: OpenAI, Anthropic, Gemini, Azure, Groq",
        "Cross-session identity continuity",
        "Human oversight and accountability layer",
      ],
      creator: { "@id": `${BASE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is ACEPLACE Workstation?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ACEPLACE Workstation is the world's first deterministic multi-agent runtime platform. It provides governed autonomous execution for AI agents (ACEAGENTS™) with persistent identity, full audit trails, and real-time telemetry.",
          },
        },
        {
          "@type": "Question",
          name: "What is an ACEAGENT™?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ACEAGENTS™ are canonical digital workers created through ACELOGIC™ with deterministic identity, continuity, and governance throughout their lifecycle. Unlike traditional AI agents, they maintain persistent identity and accountability across governed autonomous work.",
          },
        },
        {
          "@type": "Question",
          name: "Which LLM providers does ACEPLACE support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ACEPLACE is model-agnostic and supports OpenAI (GPT-4o), Anthropic (Claude), Google Gemini (Flash/Pro), Azure OpenAI, NVIDIA NIM, Groq, OpenRouter, and self-hosted private endpoints. You bring your own provider accounts and control inference billing directly.",
          },
        },
        {
          "@type": "Question",
          name: "What makes ACEPLACE different from other AI agent platforms?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ACEPLACE provides 100% deterministic agent identity, 360° governance coverage, and zero gaps in audit trails. Every agent action is traceable, governed, and accountable — something no other AI agent platform offers at this level.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <SettingsProvider>
            {children}
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
