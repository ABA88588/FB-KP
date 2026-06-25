import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const outputDir = "../../test-results/ui";
const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.3,
  threshold: 0.35
};

test.describe("UI reference screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await mkdir(outputDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("captures implemented pages at 1440x900", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveScreenshot("01-overview.png", screenshotOptions);
    await page.screenshot({ path: `${outputDir}/01-overview.png`, fullPage: false });

    await page.goto("/campaigns?level=campaign");
    await page.getByLabel("选择 Summer Glow｜转化").check();
    await expect(page).toHaveScreenshot("02-campaign-manager.png", screenshotOptions);
    await page.screenshot({ path: `${outputDir}/02-campaign-manager.png`, fullPage: false });

    await page.getByText("Summer Glow｜转化").first().click();
    await expect(page).toHaveScreenshot("03-campaign-inspector.png", screenshotOptions);
    await page.screenshot({ path: `${outputDir}/03-campaign-inspector.png`, fullPage: false });

    await page.goto("/campaigns/new?step=4");
    await page.getByText("发布前检查").waitFor();
    await expect(page).toHaveScreenshot("04-create-wizard-review.png", screenshotOptions);
    await page.screenshot({ path: `${outputDir}/04-create-wizard-review.png`, fullPage: false });

    await page.goto("/reports");
    await expect(page).toHaveScreenshot("05-custom-report.png", screenshotOptions);
    await page.screenshot({ path: `${outputDir}/05-custom-report.png`, fullPage: false });

    await page.goto("/sync-center");
    await page.getByRole("button", { name: /API 错误/ }).click();
    await expect(page).toHaveScreenshot("06-sync-errors.png", screenshotOptions);
    await page.screenshot({ path: `${outputDir}/06-sync-errors.png`, fullPage: false });
  });
});
