import { describe, expect, it } from "vitest";
import { DemoMetaAdsProvider } from "@adflow/meta-client";
import { effectiveStatusTone, rowsToCsv } from "@adflow/shared";

const krAccountId = "act_23840008291";
const usAccountId = "act_23840007712";

describe("DemoMetaAdsProvider", () => {
  it("filters entities by name or Meta ID", () => {
    const provider = new DemoMetaAdsProvider();
    const rows = provider.listEntities("campaign", krAccountId, "summer");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toContain("Summer Glow");
  });

  it("updates status only in local demo data", () => {
    const provider = new DemoMetaAdsProvider();
    const [row] = provider.listEntities("campaign", krAccountId, "Summer Glow");
    expect(row?.status).toBe("active");
    provider.updateStatus("campaign", krAccountId, [row?.id ?? ""], "paused");
    expect(provider.listEntities("campaign", krAccountId, "Summer Glow")[0]?.status).toBe("paused");
  });

  it("updates budgets and duplicates rows in demo data", () => {
    const provider = new DemoMetaAdsProvider();
    const [row] = provider.listEntities("campaign", krAccountId, "Summer Glow");
    provider.updateBudget("campaign", krAccountId, [row?.id ?? ""], 300000);
    expect(provider.listEntities("campaign", krAccountId, "Summer Glow")[0]?.budget).toBe("₩300,000 / 日");

    const copies = provider.duplicateEntities("campaign", krAccountId, [row?.id ?? ""]);
    expect(copies).toHaveLength(1);
    expect(copies[0]?.status).toBe("paused");
    expect(provider.listEntities("campaign", krAccountId, "副本")).toHaveLength(1);
  });

  it("adds a visible sync job when manual sync starts", () => {
    const provider = new DemoMetaAdsProvider();
    const count = provider.listSyncJobs(krAccountId).length;
    const job = provider.enqueueSyncJob(krAccountId);
    expect(provider.listSyncJobs(krAccountId)).toHaveLength(count + 1);
    expect(provider.listSyncJobs(krAccountId)[0]?.id).toBe(job.id);
    expect(job.status).toBe("running");
  });

  it("isolates mutable entities and creatives by account", () => {
    const provider = new DemoMetaAdsProvider();
    const [krRow] = provider.listEntities("campaign", krAccountId, "Summer Glow");
    provider.updateBudget("campaign", usAccountId, [krRow?.id ?? ""], 999);
    expect(provider.listEntities("campaign", krAccountId, "Summer Glow")[0]?.budget).not.toBe("$999 / 日");

    const ids = provider.createAdBundle(usAccountId, {
      campaignName: "US Demo Campaign",
      objective: "Sales",
      budget: "120",
      audience: "US Broad",
      event: "Purchase",
      title: "US Demo Creative",
      assetFile: "us_demo.jpg"
    });
    expect(ids.creativeId).toContain("cr_demo_");
    expect(provider.listEntities("campaign", usAccountId, "US Demo Campaign")).toHaveLength(1);
    expect(provider.listEntities("campaign", krAccountId, "US Demo Campaign")).toHaveLength(0);
    expect(provider.listCreatives(usAccountId, "us_demo")).toHaveLength(1);
  });
});

describe("CSV export", () => {
  it("escapes formula-like cells", () => {
    const csv = rowsToCsv([["name", "value"], ["safe", "=cmd"]]);
    expect(csv).toContain("\"'=cmd\"");
  });
});

describe("effectiveStatusTone", () => {
  it("does not classify 未投放 as active", () => {
    expect(effectiveStatusTone("未投放")).toBe("paused");
    expect(effectiveStatusTone("投放中")).toBe("active");
  });
});
