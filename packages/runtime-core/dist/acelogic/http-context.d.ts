import { NextResponse } from "next/server";
import type { LicenseManifest } from "./types";
export type LicenseResult = {
    ok: true;
    license: LicenseManifest;
} | {
    ok: false;
    response: NextResponse;
};
/**
 * Resolve ACELOGIC license from request headers (x-license-id, x-org-id).
 */
export declare function getLicenseFromRequest(req: Request): Promise<LicenseResult>;
export declare function runtimeIdFromRequest(req: Request): string | null;
//# sourceMappingURL=http-context.d.ts.map