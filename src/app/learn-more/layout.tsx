import type { Metadata } from "next";

const BASE_URL = "https://aceplace.app";

export const metadata: Metadata = {
  title: "Learn More — ACEPLACE Workstation",
  description:
    "Discover how ACEPLACE Workstation enables deterministic AI agent identity, governed autonomous execution, real-time telemetry, and full accountability across your AI workforce.",
  keywords: [
    "ACEPLACE overview",
    "AI agent identity",
    "governed autonomous AI",
    "ACEAGENT explained",
    "deterministic agent runtime",
    "AI governance framework",
    "multi-agent orchestration",
    "AI agent accountability",
    "enterprise AI platform",
    "ACELOGIC",
  ],
  alternates: {
    canonical: `${BASE_URL}/learn-more`,
  },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/learn-more`,
    title: "Learn More — ACEPLACE Workstation",
    description:
      "Discover ACEPLACE™: the enterprise platform for deterministic AI agents with persistent identity, full governance, and real-time observability.",
    images: [
      {
        url: "/ace-symbol.png",
        width: 1200,
        height: 630,
        alt: "ACEPLACE Workstation — Learn More",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn More — ACEPLACE Workstation",
    description:
      "Discover ACEPLACE™: the enterprise platform for deterministic AI agents with persistent identity, full governance, and real-time observability.",
    images: ["/ace-symbol.png"],
  },
};

export default function LearnMoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
