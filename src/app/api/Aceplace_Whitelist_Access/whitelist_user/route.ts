import { NextResponse } from "next/server";


// api: /api/Aceplace_Whitelist_Access/whitelist_user

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email || !email.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "EMAIL_IS_REQUIRED",
        },
        { status: 400 },
      );
    }

    const acelogicBaseUrl = process.env.ACELOGIC_API_URL;

    if (!acelogicBaseUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "ACELOGIC_API_URL_NOT_CONFIGURED",
        },
        { status: 500 },
      );
    }

    const response = await fetch(
      `${acelogicBaseUrl}/api/aceplace/whitelist/user?email=${encodeURIComponent(
        email,
      )}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "ACEPLACE_WHITELIST_USER_ERROR";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 },
    );
  }
}
