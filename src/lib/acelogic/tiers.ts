import type { LicenseManifest, LicenseTier } from "./types";

export function buildTierDefaults(
  tier: LicenseTier
): Pick<LicenseManifest, "gates" | "modules" | "limits"> {
  switch (tier) {
    case "free":
      return {
        gates: { min_gate: 1, max_gate: 3 },
        modules: {
          identity_core: true,
          mission_binding: true,
          metadata_signing: true,
          failover: false,
          fork_detection: false,
          resurrection_verification: false,
          continuity_api: false,
        },
        limits: {
          max_agents: 20,
          max_environments: 1,
          telemetry_required: true,
        },
      };
    case "builder":
      return {
        gates: { min_gate: 1, max_gate: 3 },
        modules: {
          identity_core: true,
          mission_binding: true,
          metadata_signing: true,
          failover: true,
          fork_detection: false,
          resurrection_verification: false,
          continuity_api: false,
        },
        limits: {
          max_agents: 10,
          max_environments: 2,
          telemetry_required: true,
        },
      };
    case "growth":
      return {
        gates: { min_gate: 1, max_gate: 6 },
        modules: {
          identity_core: true,
          mission_binding: true,
          metadata_signing: true,
          failover: true,
          fork_detection: true,
          resurrection_verification: true,
          continuity_api: true,
        },
        limits: {
          max_agents: null,
          max_environments: 5,
          telemetry_required: true,
        },
      };
    default: {
      const _x: never = tier;
      throw new Error(`UNSUPPORTED_LICENSE_TIER:${String(_x)}`);
    }
  }
}
