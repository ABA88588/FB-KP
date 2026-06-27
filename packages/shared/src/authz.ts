import { createRequestId } from "./security";

export const organizationRoles = ["OWNER", "ADMIN", "OPERATOR", "ANALYST", "VIEWER"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const permissions = [
  "org:manage",
  "member:read",
  "member:write",
  "connection:read",
  "connection:write",
  "ads:read",
  "ads:write",
  "reports:read",
  "reports:export",
  "audit:read"
] as const;
export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: permissions,
  ADMIN: ["member:read", "connection:read", "connection:write", "ads:read", "ads:write", "reports:read", "reports:export", "audit:read"],
  OPERATOR: ["connection:read", "ads:read", "ads:write", "reports:read", "reports:export"],
  ANALYST: ["connection:read", "ads:read", "reports:read", "reports:export"],
  VIEWER: ["connection:read", "ads:read", "reports:read"]
};

export type TenantContext = {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  permissions: readonly Permission[];
};

export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return typeof value === "string" && organizationRoles.includes(value as OrganizationRole);
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && permissions.includes(value as Permission);
}

export function getRolePermissions(role: OrganizationRole): readonly Permission[] {
  return rolePermissions[role];
}

export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function hasAllPermissions(role: OrganizationRole, required: readonly Permission[]): boolean {
  return required.every((permission) => hasPermission(role, permission));
}

export function hasAnyPermission(role: OrganizationRole, required: readonly Permission[]): boolean {
  return required.some((permission) => hasPermission(role, permission));
}

export type WriteGateReason =
  | "ENABLE_META_WRITES=false"
  | "EMERGENCY_READONLY=true"
  | "ROLE_LACKS_ADS_WRITE"
  | "MISSING_ADS_MANAGEMENT_SCOPE"
  | "AD_ACCOUNT_ALLOWLIST_EMPTY"
  | "AD_ACCOUNT_NOT_ALLOWLISTED"
  | "AD_ACCOUNT_READONLY"
  | "CONNECTION_NOT_HEALTHY";

export type WriteGateInput = {
  enableMetaWrites: boolean;
  emergencyReadonly: boolean;
  role: OrganizationRole;
  scopes: readonly string[];
  adAccountMetaId: string;
  allowedMetaAdAccountIds: readonly string[];
  accountReadOnly: boolean;
  connectionHealthy: boolean;
};

export type WriteGateResult = {
  allowed: boolean;
  operationId: string;
  reasons: readonly WriteGateReason[];
};

export function evaluateMetaWriteGate(input: WriteGateInput, operationId = createRequestId("op")): WriteGateResult {
  const reasons: WriteGateReason[] = [];
  if (!input.enableMetaWrites) reasons.push("ENABLE_META_WRITES=false");
  if (input.emergencyReadonly) reasons.push("EMERGENCY_READONLY=true");
  if (!hasPermission(input.role, "ads:write")) reasons.push("ROLE_LACKS_ADS_WRITE");
  if (!input.scopes.includes("ads_management")) reasons.push("MISSING_ADS_MANAGEMENT_SCOPE");
  if (input.allowedMetaAdAccountIds.length === 0) reasons.push("AD_ACCOUNT_ALLOWLIST_EMPTY");
  if (input.allowedMetaAdAccountIds.length > 0 && !input.allowedMetaAdAccountIds.includes(input.adAccountMetaId)) reasons.push("AD_ACCOUNT_NOT_ALLOWLISTED");
  if (input.accountReadOnly) reasons.push("AD_ACCOUNT_READONLY");
  if (!input.connectionHealthy) reasons.push("CONNECTION_NOT_HEALTHY");
  return { allowed: reasons.length === 0, operationId, reasons };
}
