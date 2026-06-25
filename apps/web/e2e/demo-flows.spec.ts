import { expect, test } from "@playwright/test";

test.describe("demo data flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("account switch changes overview data", async ({ page }) => {
    await page.goto("/overview");
    const firstMetric = page.getByTestId("kpi-card").first().locator(".metric-value");
    const before = await firstMetric.innerText();

    await page.getByTestId("account-picker").click();

    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await expect(firstMetric).not.toHaveText(before);
  });

  test("budget edit changes the campaign table", async ({ page }) => {
    await page.goto("/campaigns?level=campaign&status=all&minSpend=0");
    const firstRow = page.getByTestId("campaign-row").first();
    await expect(firstRow).toBeVisible();

    await firstRow.locator('input[type="checkbox"]').check();
    await page.locator(".bulk-bar button").nth(2).click();
    await expect(page.locator(".budget-dialog")).toBeVisible();
    await page.locator(".budget-dialog input").fill("333000");
    await page.locator(".budget-dialog .dialog-actions .button.primary").click();

    await expect(firstRow).toContainText("333,000");
  });

  test("simulated publish creates a searchable ad object", async ({ page }) => {
    await page.goto("/campaigns/new?step=4");
    await page.locator(".wizard-footer .button.primary").click();

    await expect(page).toHaveURL(/\/campaigns\?level=campaign/);
    await expect(page.getByTestId("campaign-row").first()).toContainText("Summer Glow");
  });

  test("report configuration changes the generated result", async ({ page }) => {
    await page.goto("/reports");
    const firstRow = page.getByTestId("report-row").first();
    await expect(firstRow).toBeVisible();
    const before = await firstRow.innerText();

    const selects = page.locator(".report-builder select");
    await selects.nth(1).selectOption("Campaign");
    await selects.nth(3).selectOption({ index: 1 });
    await selects.nth(4).selectOption({ index: 1 });
    await page.locator(".report-builder .button.primary.full").click();

    await expect(page.getByTestId("report-note")).toContainText("Campaign", { timeout: 3_000 });
    await expect(firstRow).not.toHaveText(before);
  });

  test("new sync task progresses from running to success", async ({ page }) => {
    await page.goto("/sync-center");
    await page.locator(".page-actions .button.primary").click();

    const newestJob = page.getByTestId("sync-job-row").first();
    await expect(newestJob).toContainText("运行中");
    await expect(newestJob).toContainText("成功", { timeout: 3_000 });
  });
});
