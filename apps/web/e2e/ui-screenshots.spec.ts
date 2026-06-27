import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const outputDir = "../../test-results/ui";
const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  threshold: 0.2
};

async function capture(page: import("@playwright/test").Page, path: string, fileName: string) {
  await page.goto(path);
  await expect(page).toHaveScreenshot(fileName, screenshotOptions);
  await page.screenshot({ path: `${outputDir}/${fileName}`, fullPage: false });
}

test.describe("UI reference screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await mkdir(outputDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("captures production live pages at 1440x900", async ({ page }) => {
    await capture(page, "/ads/overview", "01-overview.png");
    await capture(page, "/ads/campaigns", "02-campaign-manager.png");
    await capture(page, "/ads/campaigns/new?step=4", "04-create-wizard-review.png");
    await capture(page, "/ads/reports", "05-custom-report.png");
    await capture(page, "/ads/sync-center", "06-sync-errors.png");
    await capture(page, "/ads/settings/meta-app", "07-meta-app-settings.png");
  });

  test("captures demo sandbox separately", async ({ page }) => {
    await capture(page, "/ads/demo/overview", "08-demo-sandbox-overview.png");
  });
});
