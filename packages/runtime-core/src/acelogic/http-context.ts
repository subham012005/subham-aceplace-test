import { NextResponse } from "next/server";
import { isLicenseExpired, resolveLicenseById } from "./resolve-license";
import type { LicenseManifest } from "./types";

export type LicenseResult =
  | { ok: true; license: LicenseManifest }
  | { ok: false; response: NextResponse };

/**
 * Resolve ACELOGIC license from request headers (x-license-id, x-org-id).
 */
export async function getLicenseFromRequest(req: Request): Promise<LicenseResult> {
  const licenseId = req.headers.get("x-license-id");
  const orgId = req.headers.get("x-org-id");
  if (!licenseId || !orgId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "LICENSE_HEADERS_REQUIRED" }, { status: 401 }),
    };
  }

  const license = await resolveLicenseById(licenseId, orgId);
  if (!license) {
    return {
      ok: false,
      response: NextResponse.json({ error: "LICENSE_NOT_FOUND" }, { status: 404 }),
    };
  }
  if (license.status !== "active") {
    return {
      ok: false,
      response: NextResponse.json({ error: "LICENSE_INACTIVE" }, { status: 403 }),
    };
  }
  if (isLicenseExpired(license)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "LICENSE_EXPIRED" }, { status: 403 }),
    };
  }

  return { ok: true, license };
}

export function runtimeIdFromRequest(req: Request): string | null {
  return req.headers.get("x-runtime-id");
}
