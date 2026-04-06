/**
 * ACELOGIC control plane logic — used by /api/acelogic/* and runtime guard.
 */

import { randomUUID } from "crypto";
import type { ExecutionGuardResult } from "../types";
import { auditLicenseCheck, checkCapability } from "./capability";
import { isLicenseExpired, resolveLicenseById } from "./resolve-license";
import type { LicenseManifest } from "./types";

const LEASE_TTL_MS = 60_000;

function inferGateFromLease(
  lease: ExecutionGuardResult["lease"]
): number {
  if (!lease) return 1;
  if (lease.status === "active") return 5;
  return 1;
}

export async function aceLogicIntrospect(license: LicenseManifest) {
  return {
    license_id: license.license_id,
    org_id: license.org_id,
    tier: license.tier,
    deployment_mode: license.deployment_mode,
    gates: license.gates,
    modules: license.modules,
    limits: license.limits,
  };
}

export async function aceLogicVerifyIdentity(params: {
  license: LicenseManifest;
  route: string;
  body: { agent_id?: string; identity_fingerprint?: string; instance_id?: string };
  runtimeId: string | null;
}) {
  const { license, route, body, runtimeId } = params;
  const cap = checkCapability(license, "identity_core", 1);
  if (!cap.ok) {
    await auditLicenseCheck({
      license,
      route,
      capability: "identity_core",
      requiredGate: 1,
      outcome: "denied",
      reason: cap.reason ?? null,
      runtimeId,
    });
    return { error: cap.reason, capability: "identity_core" };
  }
  if (!body.agent_id || !body.identity_fingerprint) {
    return { error: "INVALID_INPUT" };
  }
  await auditLicenseCheck({
    license,
    route,
    capability: "identity_core",
    requiredGate: 1,
    outcome: "allowed",
    reason: null,
    runtimeId,
  });
  return {
    valid: true,
    agent_id: body.agent_id,
    identity_fingerprint: body.identity_fingerprint,
  };
}

export async function aceLogicLeaseAcquire(params: {
  license: LicenseManifest;
  route: string;
  body: { agent_id?: string; instance_id?: string };
  runtimeId: string | null;
}) {
  const { license, route, body, runtimeId } = params;
  const cap = checkCapability(license, "fork_detection", 5);
  if (!cap.ok) {
    await auditLicenseCheck({
      license,
      route,
      capability: "fork_detection",
      requiredGate: 5,
      outcome: "denied",
      reason: cap.reason ?? null,
      runtimeId,
    });
    return { error: cap.reason, capability: "fork_detection" };
  }
  await auditLicenseCheck({
    license,
    route,
    capability: "fork_detection",
    requiredGate: 5,
    outcome: "allowed",
    reason: null,
    runtimeId,
  });
  const lease_id = `lease_${randomUUID().replace(/-/g, "")}`;
  const lease_expires_at = new Date(Date.now() + LEASE_TTL_MS).toISOString();
  return {
    lease_id,
    agent_id: body.agent_id,
    instance_id: body.instance_id,
    lease_expires_at,
    status: "active" as const,
  };
}

export async function aceLogicLeaseRenew(params: {
  license: LicenseManifest;
  route: string;
  runtimeId: string | null;
}) {
  const cap = checkCapability(params.license, "fork_detection", 5);
  if (!cap.ok) {
    await auditLicenseCheck({
      license: params.license,
      route: params.route,
      capability: "fork_detection",
      requiredGate: 5,
      outcome: "denied",
      reason: cap.reason ?? null,
      runtimeId: params.runtimeId,
    });
    return { error: cap.reason };
  }
  await auditLicenseCheck({
    license: params.license,
    route: params.route,
    capability: "fork_detection",
    requiredGate: 5,
    outcome: "allowed",
    reason: null,
    runtimeId: params.runtimeId,
  });
  return {
    renewed: true,
    lease_expires_at: new Date(Date.now() + LEASE_TTL_MS).toISOString(),
  };
}

export async function aceLogicLeaseRelease(params: {
  license: LicenseManifest;
  route: string;
  runtimeId: string | null;
}) {
  const cap = checkCapability(params.license, "fork_detection", 5);
  if (!cap.ok) {
    await auditLicenseCheck({
      license: params.license,
      route: params.route,
      capability: "fork_detection",
      requiredGate: 5,
      outcome: "denied",
      reason: cap.reason ?? null,
      runtimeId: params.runtimeId,
    });
    return { error: cap.reason };
  }
  await auditLicenseCheck({
    license: params.license,
    route: params.route,
    capability: "fork_detection",
    requiredGate: 5,
    outcome: "allowed",
    reason: null,
    runtimeId: params.runtimeId,
  });
  return { released: true };
}

export async function aceLogicResurrectionVerify(params: {
  license: LicenseManifest;
  route: string;
  runtimeId: string | null;
}) {
  const cap = checkCapability(params.license, "resurrection_verification", 6);
  if (!cap.ok) {
    await auditLicenseCheck({
      license: params.license,
      route: params.route,
      capability: "resurrection_verification",
      requiredGate: 6,
      outcome: "denied",
      reason: cap.reason ?? null,
      runtimeId: params.runtimeId,
    });
    return { error: cap.reason };
  }
  await auditLicenseCheck({
    license: params.license,
    route: params.route,
    capability: "resurrection_verification",
    requiredGate: 6,
    outcome: "allowed",
    reason: null,
    runtimeId: params.runtimeId,
  });
  return { valid: true, status: "verified" as const };
}

/**
 * Unified guard for runtime: identity + optional lease when tier allows fork_detection.
 */
export async function runAceLogicExecutionGuard(params: {
  agent_id: string;
  identity_fingerprint: string;
  instance_id: string;
  org_id: string;
  license_id: string;
}): Promise<ExecutionGuardResult> {
  const license = await resolveLicenseById(params.license_id, params.org_id);
  if (!license || license.status !== "active" || isLicenseExpired(license)) {
    console.log("[GUARD_TEST] Blocked because license invalid:", { hasLicense: !!license, status: license?.status, expired: license ? isLicenseExpired(license) : undefined });
    return {
      allowed: false,
      identity_context: {
        agent_id: params.agent_id,
        identity_fingerprint: params.identity_fingerprint,
        instance_id: params.instance_id,
        gate_level: 0,
      },
      lease: null,
    };
  }

  const idCap = checkCapability(license, "identity_core", 1);
  if (!idCap.ok) {
    console.log("[GUARD_TEST] Blocked because idCap not ok:", idCap.reason);
    return {
      allowed: false,
      identity_context: {
        agent_id: params.agent_id,
        identity_fingerprint: params.identity_fingerprint,
        instance_id: params.instance_id,
        gate_level: 0,
      },
      lease: null,
    };
  }

  if (!params.agent_id || !params.identity_fingerprint) {
    console.log("[GUARD_TEST] Blocked because missing agent_id or identity_fingerprint:", params);
    return {
      allowed: false,
      identity_context: {
        agent_id: params.agent_id,
        identity_fingerprint: params.identity_fingerprint,
        instance_id: params.instance_id,
        gate_level: 0,
      },
      lease: null,
    };
  }

  let lease: ExecutionGuardResult["lease"] = null;
  const leaseCap = checkCapability(license, "fork_detection", 5);
  if (leaseCap.ok) {
    const lease_id = `lease_${randomUUID().replace(/-/g, "")}`;
    lease = {
      lease_id,
      lease_expires_at: new Date(Date.now() + LEASE_TTL_MS).toISOString(),
      status: "active",
    };
  }

  return {
    allowed: true,
    identity_context: {
      agent_id: params.agent_id,
      identity_fingerprint: params.identity_fingerprint,
      instance_id: params.instance_id,
      gate_level: inferGateFromLease(lease),
    },
    lease,
  };
}
