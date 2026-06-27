import { expect, test } from "@playwright/test";

const productionPaths = [
  "/ads/overview",
  "/ads/campaigns",
  "/ads/creatives",
  "/ads/reports",
  "/ads/sync-center"
];

const forbiddenProductionCopy = [
  "Demo mode",
  "Demo Provider",
  "Seoul Beauty KR",
  "demo_asset",
  "Summer Glow",
  "UGC ROUTINE",
  "NEW SERUM",
  "Instagram Feed",
  "PAUSED",
  "Sales",
  "Broad",
  "META_RATE_LIMITED"
];

test.describe("production live mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("base path and legacy routes redirect into /ads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/ads\/login$/);

    await page.goto("/login");
    await expect(page).toHaveURL(/\/ads\/login$/);

    await page.goto("/overview");
    await expect(page).toHaveURL(/\/ads\/overview$/);
  });

  test("live overview shows setup guidance instead of fake KPIs", async ({ page }) => {
    await page.goto("/ads/overview");
    await expect(page.getByText("尚未连接 Meta 广告账户")).toBeVisible();
    await expect(page.getByRole("button", { name: "配置 Meta App" })).toBeVisible();
    await expect(page.getByTestId("account-picker")).toContainText("未连接广告账户");
    await expect(page.getByTestId("kpi-card")).toHaveCount(0);
  });

  test("live business pages do not render demo data", async ({ page }) => {
    const expectedTitles: Record<string, string> = {
      "/ads/campaigns": "暂无真实广告对象",
      "/ads/creatives": "暂无真实素材",
      "/ads/reports": "暂无真实 Insights 数据",
      "/ads/sync-center": "暂无同步任务"
    };
    for (const [path, title] of Object.entries(expectedTitles)) {
      await page.goto(path);
      await expect(page.getByText(title)).toBeVisible();
      const text = await page.locator("body").innerText();
      for (const forbidden of forbiddenProductionCopy) {
        expect(text, `${path} should not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("production pages are localized and free of demo labels", async ({ page }) => {
    for (const path of productionPaths) {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      await expect(page.getByText("Live Meta").first()).toBeVisible();
      for (const forbidden of forbiddenProductionCopy) {
        expect(text, `${path} should not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("create flow opens but live publish is blocked with explicit missing requirements", async ({ page }) => {
    await page.goto("/ads/campaigns/new?step=4");
    await expect(page.getByText("真实发布条件尚未满足")).toBeVisible();
    await expect(page.getByText("Meta App 未配置").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "发布不可用" })).toBeDisabled();
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("模拟发布成功");
    expect(text).not.toContain("Instagram Feed");
  });

  test("meta app page shows secure redirect and does not echo a secret", async ({ page }) => {
    await page.goto("/ads/settings/meta-app");
    await expect(page.getByText("Meta App 配置").first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "OAuth Redirect URI" })).toHaveValue(/\/ads\/api\/meta\/oauth\/callback$/);
  });
});

test.describe("demo sandbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("demo sandbox is isolated under /ads/demo and may show demo data", async ({ page }) => {
    await page.goto("/ads/demo/overview");
    await expect(page.getByText("演示沙箱").first()).toBeVisible();
    await expect(page.getByTestId("account-picker")).toContainText("Seoul Beauty KR");
    await expect(page.getByTestId("kpi-card").first()).toBeVisible();

    await page.goto("/ads/overview");
    await expect(page.getByText("尚未连接 Meta 广告账户")).toBeVisible();
    await expect(page.getByTestId("account-picker")).toContainText("未连接广告账户");
  });

  test("demo navigation stays inside the sandbox", async ({ page }) => {
    await page.goto("/ads/demo/campaigns?level=campaign");
    await page.locator(".entity-tab", { hasText: "广告组" }).click();
    await expect(page).toHaveURL(/\/ads\/demo\/campaigns\?level=adset$/);
  });
});
