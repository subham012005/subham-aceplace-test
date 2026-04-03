import { getDb } from "@/lib/runtime/db";
import { COLLECTIONS } from "@/lib/runtime/constants";
import type { LicenseManifest } from "./types";

export function checkCapability(
  license: LicenseManifest,
  capability: string,
  requiredGate?: number
): { ok: boolean; reason?: string } {
  if (!license.modules?.[capability]) {
    return { ok: false, reason: "CAPABILITY_DENIED" };
  }
  if (requiredGate !== undefined) {
    const { min_gate, max_gate } = license.gates;
    if (requiredGate < min_gate || requiredGate > max_gate) {
      return { ok: false, reason: "GATE_DENIED" };
    }
  }
  return { ok: true };
}

export async function auditLicenseCheck(params: {
  license: LicenseManifest;
  route: string;
  capability: string;
  requiredGate: number | null;
  outcome: "allowed" | "denied";
  reason: string | null;
  runtimeId: string | null;
}): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.LICENSE_AUDIT_EVENTS)
    .add({
      org_id: params.license.org_id,
      license_id: params.license.license_id,
      route: params.route,
      capability: params.capability,
      required_gate: params.requiredGate,
      outcome: params.outcome,
      reason: params.reason,
      runtime_id: params.runtimeId,
      timestamp: new Date().toISOString(),
    });
}
