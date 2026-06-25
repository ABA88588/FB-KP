import { describe, expect, it } from "vitest";
import { DemoMetaAdsProvider } from "@adflow/meta-client";
import { rowsToCsv } from "@adflow/shared";

describe("DemoMetaAdsProvider", () => {
  it("filters entities by name or Meta ID", () => {
    const provider = new DemoMetaAdsProvider();
    const rows = provider.listEntities("campaign", "summer");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toContain("Summer Glow");
  });

  it("updates status only in local demo data", () => {
    const provider = new DemoMetaAdsProvider();
    const [row] = provider.listEntities("campaign", "Summer Glow");
    expect(row?.status).toBe("active");
    provider.updateStatus("campaign", [row?.id ?? ""], "paused");
    expect(provider.listEntities("campaign", "Summer Glow")[0]?.status).toBe("paused");
  });
});

describe("CSV export", () => {
  it("escapes formula-like cells", () => {
    const csv = rowsToCsv([["name", "value"], ["safe", "=cmd"]]);
    expect(csv).toContain("\"'=cmd\"");
  });
});
