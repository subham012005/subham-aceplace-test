import type { LicenseManifest } from "./types";
/**
 * Load license from Firestore `licenses/{licenseId}`.
 * Optional dev fallback when ACELOGIC_DEV_LICENSE_FALLBACK=1 and doc missing.
 */
export declare function resolveLicenseById(licenseId: string, orgId: string): Promise<LicenseManifest | null>;
export declare function isLicenseExpired(license: LicenseManifest): boolean;
//# sourceMappingURL=resolve-license.d.ts.map