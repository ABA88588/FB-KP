import { mkdir } from "node:fs/promises";
import { test } from "@playwright/test";

const outputDir = "../../test-results/ui";

test.describe("UI reference screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await mkdir(outputDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("captures implemented pages at 1440x900", async ({ page }) => {
    await page.goto("/overview");
    await page.screenshot({ path: `${outputDir}/overview.png`, fullPage: false });

    await page.goto("/campaigns?level=campaign");
    await page.getByLabel("选择 Summer Glow｜转化").check();
    await page.screenshot({ path: `${outputDir}/campaign-manager.png`, fullPage: false });

    await page.getByText("Summer Glow｜转化").first().click();
    await page.screenshot({ path: `${outputDir}/campaign-inspector.png`, fullPage: false });

    await page.goto("/campaigns/new?step=4");
    await page.getByText("发布前检查").waitFor();
    await page.screenshot({ path: `${outputDir}/create-wizard.png`, fullPage: false });

    await page.goto("/reports");
    await page.screenshot({ path: `${outputDir}/custom-report.png`, fullPage: false });

    await page.goto("/sync-center");
    await page.screenshot({ path: `${outputDir}/sync-errors.png`, fullPage: false });
  });
});
