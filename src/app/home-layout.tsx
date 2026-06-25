import type { Metadata } from "next";
import Script from "next/script";

const BASE_URL = "https://aceplace.app";

export const metadata: Metadata = {
  title: "ACEPLACE Workstation — Governed AI Agent Runtime Platform",
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
  ],
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    title: "ACEPLACE Workstation — Governed AI Agent Runtime Platform",
    description:
      "Deploy ACEAGENTS™ with deterministic identity, full governance, and accountable autonomous execution. The enterprise-grade multi-agent runtime platform.",
    images: [
      {
        url: "/ace-symbol.png",
        width: 1200,
        height: 630,
        alt: "ACEPLACE Workstation — AI Agent Governance Platform",
      },
    ],
  },
};

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
      publisher: {
        "@id": `${BASE_URL}/#organization`,
      },
      potentialAction: [
        {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${BASE_URL}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      ],
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
      description:
        "ACEPLACE builds deterministic AI agent governance infrastructure for enterprises.",
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
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Access the workstation — contact for enterprise pricing.",
      },
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
      creator: {
        "@id": `${BASE_URL}/#organization`,
      },
    },
    {
      "@type": "WebPage",
      "@id": `${BASE_URL}/#webpage`,
      url: BASE_URL,
      name: "ACEPLACE Workstation — Governed AI Agent Runtime Platform",
      isPartOf: {
        "@id": `${BASE_URL}/#website`,
      },
      about: {
        "@id": `${BASE_URL}/#product`,
      },
      description:
        "ACEPLACE Workstation is the world's first deterministic multi-agent runtime platform. Deploy ACEAGENTS™ with persistent identity, full governance, real-time telemetry, and accountable AI execution.",
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: BASE_URL,
          },
        ],
      },
      speakable: {
        "@type": "SpeakableSpecification",
        cssSelector: ["h1", "h2", "p"],
      },
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

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="aceplace-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        strategy="afterInteractive"
      />
      {children}
    </>
  );
}
