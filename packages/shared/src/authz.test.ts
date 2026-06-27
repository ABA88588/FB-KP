import { describe, expect, it } from "vitest";
import { evaluateMetaWriteGate, hasPermission, type WriteGateInput } from "./authz";

const allowedInput: WriteGateInput = {
  enableMetaWrites: true,
  emergencyReadonly: false,
  role: "OPERATOR",
  scopes: ["ads_read", "ads_management"],
  adAccountMetaId: "act_1",
  allowedMetaAdAccountIds: ["act_1"],
  accountReadOnly: false,
  connectionHealthy: true
};

describe("role permissions", () => {
  it("keeps read-only roles away from Meta write permission", () => {
    expect(hasPermission("VIEWER", "ads:write")).toBe(false);
    expect(hasPermission("ANALYST", "ads:write")).toBe(false);
    expect(hasPermission("OPERATOR", "ads:write")).toBe(true);
  });
});

describe("evaluateMetaWriteGate", () => {
  it("allows writes only when every guard is satisfied", () => {
    expect(evaluateMetaWriteGate(allowedInput, "op_test")).toEqual({
      allowed: true,
      operationId: "op_test",
      reasons: []
    });
  });

  it("returns every independent blocker for denied Meta writes", () => {
    const result = evaluateMetaWriteGate(
      {
        ...allowedInput,
        enableMetaWrites: false,
        emergencyReadonly: true,
        role: "ANALYST",
        scopes: ["ads_read"],
        adAccountMetaId: "act_2",
        accountReadOnly: true,
        connectionHealthy: false
      },
      "op_denied"
    );

    expect(result.allowed).toBe(false);
    expect(result.operationId).toBe("op_denied");
    expect(result.reasons).toEqual([
      "ENABLE_META_WRITES=false",
      "EMERGENCY_READONLY=true",
      "ROLE_LACKS_ADS_WRITE",
      "MISSING_ADS_MANAGEMENT_SCOPE",
      "AD_ACCOUNT_NOT_ALLOWLISTED",
      "AD_ACCOUNT_READONLY",
      "CONNECTION_NOT_HEALTHY"
    ]);
  });
});
