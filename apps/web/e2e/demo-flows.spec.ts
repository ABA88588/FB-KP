import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const baselineHashes: Record<string, string> = {
  "00-ui-contact-sheet.png": "B25733257512D673E6F28B549DE3D8475C5AE72224C5E632FA20D0B30D3233E7",
  "01-overview.png": "3B00A82C5C8227C1E0D290D52BEC7F4F032DFBDBF4868A67A5903DC1ABA84A8E",
  "02-campaign-manager.png": "D8A9986C2ED9F31853B4B70620AE8CD930F1B554C056FC7797DA0423FEC41341",
  "03-campaign-inspector.png": "838524D6784525CE6F441255DF5EC4DC16C5348DFD17FE2A2EC51B98BF685067",
  "04-create-wizard-review.png": "7D627DCA75CF70C64CCB71815D8CB0B29BCE531EDF80A2AD2E674140928F6CD7",
  "05-custom-report.png": "C4FD27F6972E34D19675B4539B5002E0DBDBE6791D0E32990B5BB411D1962E95",
  "06-sync-errors.png": "7CB33C202A65929AF3BEAA065C2EA9AB2112AA83EECFC3FC15648C466E0D83C7"
};

test.describe("demo data flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/overview");
    await page.evaluate(() => window.localStorage.clear());
  });

  test("account switch changes overview data", async ({ page }) => {
    await page.goto("/overview");
    const firstMetric = page.getByTestId("kpi-card").first().locator(".metric-value");
    const before = await firstMetric.innerText();

    await page.getByTestId("account-picker").click();

    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await expect(firstMetric).not.toHaveText(before);
  });

  test("overview account persists across Campaign, Reports and Sync", async ({ page }) => {
    await page.goto("/overview");
    await page.getByTestId("account-picker").click();
    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");

    await page.goto("/campaigns?level=campaign&status=all&minSpend=0");
    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await page.goto("/reports");
    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await page.goto("/sync-center");
    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
  });

  test("refresh keeps selected account and date range", async ({ page }) => {
    await page.goto("/overview");
    await page.getByTestId("account-picker").click();
    await page.getByTestId("date-range-picker").click();
    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await expect(page.getByTestId("date-range-picker")).toContainText("近 14 天");

    await page.reload();

    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await expect(page.getByTestId("date-range-picker")).toContainText("近 14 天");
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

  test("two account datasets do not affect each other", async ({ page }) => {
    await page.goto("/campaigns?level=campaign&status=all&minSpend=0");
    const firstRow = page.getByTestId("campaign-row").first();
    await firstRow.locator('input[type="checkbox"]').check();
    await page.locator(".bulk-bar button").nth(2).click();
    await page.locator(".budget-dialog input").fill("333000");
    await page.locator(".budget-dialog .dialog-actions .button.primary").click();
    await expect(firstRow).toContainText("333,000");

    await page.getByTestId("account-picker").click();
    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await expect(page.getByTestId("campaign-row").first()).not.toContainText("333,000");

    await page.getByTestId("account-picker").click();
    await expect(page.getByTestId("account-picker")).toContainText("Seoul Beauty KR");
    await expect(page.getByTestId("campaign-row").first()).toContainText("333,000");
  });

  test("USD account shows dollar amounts", async ({ page }) => {
    await page.goto("/campaigns?level=campaign&status=all&minSpend=0");
    await page.getByTestId("account-picker").click();
    await expect(page.getByTestId("account-picker")).toContainText("Glow US DTC");
    await expect(page.getByTestId("campaign-row").first()).toContainText("$");
  });

  test("detail drawer edit syncs back to the table", async ({ page }) => {
    await page.goto("/campaigns?level=campaign&status=all&minSpend=0");
    const firstRow = page.getByTestId("campaign-row").first();
    await firstRow.click();
    await page.locator(".drawer-footer .button.primary").click();
    await page.locator(".drawer-edit-form input").first().fill("Edited Campaign Demo");
    await page.locator(".drawer-edit-form input").last().fill("444000");
    await page.locator(".drawer-edit-form .button.primary").click();

    await expect(firstRow).toContainText("Edited Campaign Demo");
    await expect(firstRow).toContainText("444,000");
  });

  test("simulated publish creates a searchable ad object", async ({ page }) => {
    await page.goto("/campaigns/new?step=4");
    await page.locator(".wizard-footer .button.primary").click();

    await expect(page).toHaveURL(/\/campaigns\?level=campaign/);
    await expect(page.getByTestId("campaign-row").first()).toContainText("Summer Glow");
  });

  test("new creative appears in creative center after simulated publish", async ({ page }) => {
    await page.goto("/campaigns/new?step=4");
    await page.locator(".wizard-footer .button.primary").click();
    await expect(page).toHaveURL(/\/campaigns\?level=campaign/);

    await page.locator(".nav-item").nth(2).click();
    await page.locator(".search-box input").fill("summer_glow_hero_01");
    await expect(page.getByTestId("creative-card").first()).toContainText("summer_glow_hero_01");
  });

  test("report configuration changes the generated result", async ({ page }) => {
    await page.goto("/reports");
    const firstRow = page.getByTestId("report-row").first();
    await expect(firstRow).toBeVisible();
    const before = await firstRow.innerText();

    const selects = page.locator(".report-builder select");
    await selects.nth(0).selectOption("Campaign");
    await selects.nth(1).selectOption("近 14 天");
    await selects.nth(2).selectOption({ index: 1 });
    await selects.nth(3).selectOption({ index: 1 });
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

test.describe("design baselines", () => {
  for (const [fileName, expectedHash] of Object.entries(baselineHashes)) {
    test(`${fileName} is unchanged`, async () => {
      const bytes = await readFile(resolve(process.cwd(), "../../screenshots", fileName));
      const actualHash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
      expect(actualHash).toBe(expectedHash);
    });
  }
});
