"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLicenseFromRequest = getLicenseFromRequest;
exports.runtimeIdFromRequest = runtimeIdFromRequest;
const server_1 = require("next/server");
const resolve_license_1 = require("./resolve-license");
/**
 * Resolve ACELOGIC license from request headers (x-license-id, x-org-id).
 */
async function getLicenseFromRequest(req) {
    const licenseId = req.headers.get("x-license-id");
    const orgId = req.headers.get("x-org-id");
    if (!licenseId || !orgId) {
        return {
            ok: false,
            response: server_1.NextResponse.json({ error: "LICENSE_HEADERS_REQUIRED" }, { status: 401 }),
        };
    }
    const license = await (0, resolve_license_1.resolveLicenseById)(licenseId, orgId);
    if (!license) {
        return {
            ok: false,
            response: server_1.NextResponse.json({ error: "LICENSE_NOT_FOUND" }, { status: 404 }),
        };
    }
    if (license.status !== "active") {
        return {
            ok: false,
            response: server_1.NextResponse.json({ error: "LICENSE_INACTIVE" }, { status: 403 }),
        };
    }
    if ((0, resolve_license_1.isLicenseExpired)(license)) {
        return {
            ok: false,
            response: server_1.NextResponse.json({ error: "LICENSE_EXPIRED" }, { status: 403 }),
        };
    }
    return { ok: true, license };
}
function runtimeIdFromRequest(req) {
    return req.headers.get("x-runtime-id");
}
//# sourceMappingURL=http-context.js.map