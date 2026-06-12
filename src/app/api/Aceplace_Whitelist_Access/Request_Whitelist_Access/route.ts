import { NextResponse } from "next/server";

// api: /api/Aceplace_Whitelist_Access/Request_Whitelist_Access

type WhitelistRequestBody = {
  fullName: string;
  company: string;
  email: string;
  useCase: string;
  deploymentInterest: string;
  infrastructureTier: string;
  providerInterest: string[];
  classification: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as WhitelistRequestBody;

    const acelogicBaseUrl = process.env.ACELOGIC_API_URL;

    if (!acelogicBaseUrl) {
      return NextResponse.json(
        { error: "ACELOGIC_API_URL_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${acelogicBaseUrl}/api/aceplace/whitelist-request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "WHITELIST_REQUEST_ERROR";

    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}