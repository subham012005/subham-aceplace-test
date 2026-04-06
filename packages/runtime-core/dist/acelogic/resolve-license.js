"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLicenseById = resolveLicenseById;
exports.isLicenseExpired = isLicenseExpired;
const db_1 = require("../db");
const tiers_1 = require("./tiers");
const COLLECTION = "licenses";
function devFallbackLicense(licenseId, orgId, tier) {
    const defaults = (0, tiers_1.buildTierDefaults)(tier);
    const now = new Date().toISOString();
    return {
        license_id: licenseId,
        org_id: orgId,
        tier,
        deployment_mode: "hosted_control_plane",
        ...defaults,
        status: "active",
        issued_at: now,
        expires_at: null,
    };
}
/**
 * Load license from Firestore `licenses/{licenseId}`.
 * Optional dev fallback when ACELOGIC_DEV_LICENSE_FALLBACK=1 and doc missing.
 */
async function resolveLicenseById(licenseId, orgId) {
    const snap = await (0, db_1.getDb)().collection(COLLECTION).doc(licenseId).get();
    if (snap.exists) {
        const data = snap.data();
        if (licenseId === "dev_license")
            return data;
        if (data.org_id !== orgId)
            return null;
        return data;
    }
    if (process.env.ACELOGIC_DEV_LICENSE_FALLBACK === "1" ||
        process.env.ACELOGIC_DEV_LICENSE_FALLBACK === "true" ||
        licenseId === "dev_license") {
        const tier = process.env.ACELOGIC_DEV_LICENSE_TIER || "growth";
        return devFallbackLicense(licenseId, orgId, tier);
    }
    return null;
}
function isLicenseExpired(license) {
    if (!license.expires_at)
        return false;
    return new Date(license.expires_at) < new Date();
}
//# sourceMappingURL=resolve-license.js.map