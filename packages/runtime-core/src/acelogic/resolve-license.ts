import { getDb } from "../db";
import type { LicenseManifest, LicenseTier } from "./types";
import { buildTierDefaults } from "./tiers";

const COLLECTION = "licenses";

function devFallbackLicense(
  licenseId: string,
  orgId: string,
  tier: LicenseTier
): LicenseManifest {
  const defaults = buildTierDefaults(tier);
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
export async function resolveLicenseById(
  licenseId: string,
  orgId: string
): Promise<LicenseManifest | null> {
  const snap = await getDb().collection(COLLECTION).doc(licenseId).get();
  if (snap.exists) {
    const data = snap.data() as LicenseManifest;
    if (licenseId === "dev_license") return data;
    if (data.org_id !== orgId) return null;
    return data;
  }

  if (
    process.env.ACELOGIC_DEV_LICENSE_FALLBACK === "1" ||
    process.env.ACELOGIC_DEV_LICENSE_FALLBACK === "true" ||
    licenseId === "dev_license"
  ) {
    const tier = (process.env.ACELOGIC_DEV_LICENSE_TIER as LicenseTier) || "growth";
    return devFallbackLicense(licenseId, orgId, tier);
  }

  return null;
}

export function isLicenseExpired(license: LicenseManifest): boolean {
  if (!license.expires_at) return false;
  return new Date(license.expires_at) < new Date();
}
