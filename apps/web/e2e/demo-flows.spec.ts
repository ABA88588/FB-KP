import { expect, test } from "@playwright/test";

const productionPaths = [
  "/ads/overview",
  "/ads/campaigns",
  "/ads/creatives",
  "/ads/reports",
  "/ads/sync-center",
  "/ads/settings/meta-app",
  "/ads/settings/connections",
  "/ads/settings/write-controls"
];

const forbiddenProductionCopy = [
  "Demo mode",
  "Demo Provider",
  "Seoul Beauty KR",
  "demo_asset",
  "Summer Glow",
  "Retargeting",
  "Beauty Bundle",
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

  test("login page is formal Chinese and has no test account prefill", async ({ page }) => {
    await page.goto("/ads/login");
    await expect(page.getByRole("heading", { name: "AdFlow 广告工作台" })).toBeVisible();
    await expect(page.getByText("当前尚未连接 Meta。登录后请先配置 Meta App，并完成账号授权。")).toBeVisible();
    await expect(page.getByRole("button", { name: "登录工作台" })).toBeVisible();
    await expect(page.getByRole("button", { name: "进入接入向导" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveValue("");
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Sign in");
    expect(text).not.toContain("Email");
    expect(text).not.toContain("owner@example.com");
  });

  test("live overview shows access guide instead of fake KPIs", async ({ page }) => {
    await page.goto("/ads/overview");
    await expect(page.getByTestId("live-access-guide")).toBeVisible();
    await expect(page.getByText("开始连接你的 Meta 广告账户")).toBeVisible();
    await expect(page.getByText("配置 Meta App").first()).toBeVisible();
    await expect(page.getByTestId("account-picker")).toContainText("未连接广告账户");
    await expect(page.getByTestId("account-picker")).toContainText("请选择 Meta 广告账户");
    await expect(page.getByTestId("kpi-card")).toHaveCount(0);
  });

  test("live business pages show formal empty states", async ({ page }) => {
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
      await expect(page.getByText("正式 Meta").first()).toBeVisible();
      for (const forbidden of forbiddenProductionCopy) {
        expect(text, `${path} should not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("new ad entry is disabled until write prerequisites are met", async ({ page }) => {
    await page.goto("/ads/campaigns");
    await expect(page.getByRole("button", { name: /新建广告/ })).toBeDisabled();

    await page.goto("/ads/campaigns/new?step=4");
    await expect(page.getByText("真实发布条件尚未满足")).toBeVisible();
    await expect(page.getByText("Meta App 未配置").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "发布不可用" })).toBeDisabled();
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("模拟发布成功");
    expect(text).not.toContain("Instagram Feed");
  });

  test("meta app and write controls pages use Chinese production copy", async ({ page }) => {
    await page.goto("/ads/settings/meta-app");
    await expect(page.getByRole("heading", { name: "Meta App 配置" }).first()).toBeVisible();
    await expect(page.getByText("应用配置状态")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "OAuth 回调地址" })).toHaveValue(/\/ads\/api\/meta\/oauth\/callback$/);
    let text = await page.locator("body").innerText();
    expect(text).not.toContain("unconfigured");
    expect(text).not.toContain("Allowed Ad Account IDs");
    expect(text).not.toContain("Owner/Admin/Operator");

    await page.goto("/ads/settings/write-controls");
    await expect(page.getByText("真实写入守卫")).toBeVisible();
    text = await page.locator("body").innerText();
    expect(text).toContain("Token 权限范围");
    expect(text).toContain("允许写入的广告账户 ID");
    expect(text).not.toContain("Token Scope");
    expect(text).not.toContain("write controls");
  });
});

test.describe("demo sandbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("demo sandbox is isolated and localized", async ({ page }) => {
    await page.goto("/ads/demo/overview");
    await expect(page.getByText("演示沙箱").first()).toBeVisible();
    await expect(page.getByText("所有数据均为模拟，不会连接 Meta，也不会写入真实广告账户。")).toBeVisible();
    await expect(page.getByTestId("account-picker")).toContainText("首尔美妆演示账户");
    await expect(page.getByTestId("kpi-card").first()).toBeVisible();

    await page.goto("/ads/overview");
    await expect(page.getByText("开始连接你的 Meta 广告账户")).toBeVisible();
    await expect(page.getByTestId("account-picker")).toContainText("未连接广告账户");
  });

  test("demo navigation stays inside the sandbox", async ({ page }) => {
    await page.goto("/ads/demo/campaigns?level=campaign");
    await page.locator(".entity-tab", { hasText: "广告组" }).click();
    await expect(page).toHaveURL(/\/ads\/demo\/campaigns\?level=adset$/);
  });
});
