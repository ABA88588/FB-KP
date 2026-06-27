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

  test("meta app config saves supported Graph API versions without native pattern validation", async ({ page }) => {
    const savedBodies: Record<string, unknown>[] = [];
    await mockMetaAppSettings(page, {
      configured: false,
      secretConfigured: false,
      graphApiVersion: "v25.0"
    }, savedBodies);

    await page.goto("/ads/settings/meta-app");
    await expect(page.getByRole("button", { name: "测试配置" })).toBeDisabled();
    await page.getByLabel("Meta App ID").fill("123456789012345");
    await page.getByLabel("Meta App Secret").fill("test-input-value");
    await page.getByLabel("Graph API 版本").fill("v25.0");
    await page.getByRole("button", { name: "保存配置" }).click();

    await expect(page.getByText("配置已保存。应用密钥已加密写入数据库，前端不会回显明文。")).toBeVisible();
    await expect(page.getByLabel("Graph API 版本")).toHaveValue("v25.0");
    await expect(page.locator(".detail-grid")).toContainText("应用 ID");
    await expect(page.locator(".detail-grid")).toContainText("已保存");
    await expect(page.locator(".detail-grid")).toContainText("v25.0");
    await expect(page.getByRole("button", { name: "测试配置" })).toBeEnabled();
    expect(savedBodies).toHaveLength(1);
    expect(savedBodies[0]?.graphApiVersion).toBe("v25.0");
  });

  test("meta app config normalizes 25.0 and preserves secret on validation failure", async ({ page }) => {
    const savedBodies: Record<string, unknown>[] = [];
    await mockMetaAppSettings(page, {
      configured: false,
      secretConfigured: false,
      graphApiVersion: "v25.0"
    }, savedBodies);

    await page.goto("/ads/settings/meta-app");
    await page.getByLabel("Meta App ID").fill("123456789012345");
    await page.getByLabel("Meta App Secret").fill("input-value-that-stays");
    await page.getByLabel("Graph API 版本").fill("abc");
    await page.getByRole("button", { name: "保存配置" }).click();

    await expect(page.getByText("请输入 Graph API 版本，例如 v25.0")).toBeVisible();
    await expect(page.getByLabel("Meta App Secret")).toHaveValue("input-value-that-stays");
    expect(savedBodies).toHaveLength(0);

    await page.getByLabel("Graph API 版本").fill("25.0");
    await page.getByRole("button", { name: "保存配置" }).click();

    await expect(page.getByText("配置已保存。应用密钥已加密写入数据库，前端不会回显明文。")).toBeVisible();
    await expect(page.getByLabel("Graph API 版本")).toHaveValue("v25.0");
    expect(savedBodies).toHaveLength(1);
    expect(savedBodies[0]?.graphApiVersion).toBe("v25.0");
    expect(savedBodies[0]?.metaAppSecret).toBe("input-value-that-stays");
  });

  test("meta app config does not clear an already saved secret when saving again", async ({ page }) => {
    const savedBodies: Record<string, unknown>[] = [];
    await mockMetaAppSettings(page, {
      configured: true,
      secretConfigured: true,
      graphApiVersion: "v24.0"
    }, savedBodies);

    await page.goto("/ads/settings/meta-app");
    await expect(page.getByRole("button", { name: "测试配置" })).toBeDisabled();
    await page.getByLabel("Graph API 版本").fill("25.0");
    await page.getByRole("button", { name: "保存配置" }).click();

    await expect(page.getByText("配置已保存。应用密钥已加密写入数据库，前端不会回显明文。")).toBeVisible();
    await expect(page.getByRole("button", { name: "测试配置" })).toBeEnabled();
    expect(savedBodies).toHaveLength(1);
    expect(savedBodies[0]?.graphApiVersion).toBe("v25.0");
    expect(savedBodies[0]).not.toHaveProperty("metaAppSecret");
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

async function mockMetaAppSettings(
  page: import("@playwright/test").Page,
  state: { configured: boolean; secretConfigured: boolean; graphApiVersion: string },
  savedBodies: Record<string, unknown>[]
) {
  await page.route("**/ads/api/settings/meta-app", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: { ok: true, data: metaAppStatus(state) } });
      return;
    }
    if (request.method() === "PUT") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const graphApiVersion = typeof body.graphApiVersion === "string" ? body.graphApiVersion : state.graphApiVersion;
      savedBodies.push(body);
      await route.fulfill({
        json: {
          ok: true,
          data: metaAppStatus({
            configured: true,
            secretConfigured: true,
            graphApiVersion
          })
        }
      });
      return;
    }
    await route.fallback();
  });
}

function metaAppStatus(state: { configured: boolean; secretConfigured: boolean; graphApiVersion: string }) {
  return {
    organizationId: "11111111-1111-4111-8111-111111111111",
    source: state.configured ? "database" : "unconfigured",
    configured: state.configured,
    metaAppId: state.configured ? "123456789012345" : "",
    metaAppIdMasked: state.configured ? "1234...2345" : "",
    graphApiVersion: state.graphApiVersion,
    oauthRedirectUri: "http://127.0.0.1:3007/ads/api/meta/oauth/callback",
    enableMetaWrites: false,
    emergencyReadOnly: true,
    allowedAdAccountIds: [],
    secretConfigured: state.secretConfigured,
    updatedAt: null,
    missing: state.configured ? [] : ["META_APP_ID", "META_APP_SECRET"]
  };
}
