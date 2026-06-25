#!/usr/bin/env python3
"""Render deterministic 1440×900 reference screenshots from the UI prototype.

The prototype is loaded with ``page.set_content`` so it does not require a web server.
Requires Python Playwright and a Chromium executable.
"""
from __future__ import annotations

import shutil
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PROTOTYPE = ROOT / "prototype"
OUT = ROOT / "screenshots"
WIDTH = 1440
HEIGHT = 900


def build_html() -> str:
    html = (PROTOTYPE / "index.html").read_text(encoding="utf-8")
    css = (PROTOTYPE / "styles.css").read_text(encoding="utf-8")
    js = (PROTOTYPE / "app.js").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="styles.css" />', f"<style>{css}</style>")
    script_tag = '<script src="app.js"></script>'
    if script_tag in html:
        html = html.replace(script_tag, f"<script>{js}</script>")
    else:
        html = html.replace("</body>", f"<script>{js}</script></body>")
    return html


def settle(page: Page) -> None:
    page.add_style_tag(content="""
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      html, body { overflow: hidden !important; }
    """)
    page.wait_for_timeout(250)


def shot(page: Page, filename: str) -> None:
    settle(page)
    page.screenshot(path=str(OUT / filename), full_page=False)


def load(page: Page, html: str) -> None:
    page.set_content(html, wait_until="load", timeout=30_000)
    page.wait_for_function("document.querySelectorAll('#campaign-table-body tr').length > 0")
    settle(page)


def render_all() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for path in OUT.glob("*.png"):
        path.unlink()

    html = build_html()
    executable = shutil.which("chromium") or shutil.which("google-chrome") or shutil.which("chrome")

    with sync_playwright() as p:
        launch_args = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if executable:
            launch_args["executable_path"] = executable
        browser = p.chromium.launch(**launch_args)
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)

        load(page, html)
        shot(page, "01-overview.png")

        page.locator('.nav-item[data-page="campaigns"]').click()
        page.locator("#campaign-table-body .row-check").first.check()
        shot(page, "02-campaign-manager.png")

        page.locator("#campaign-table-body tr").first.locator(".name-col").click()
        shot(page, "03-campaign-inspector.png")
        page.locator("#drawer-close").click()

        page.evaluate("openWizard(4)")
        shot(page, "04-create-wizard-review.png")
        page.locator("#wizard-close").click()

        page.locator('.nav-item[data-page="reports"]').click()
        shot(page, "05-custom-report.png")

        page.locator('.nav-item[data-page="sync"]').click()
        shot(page, "06-sync-errors.png")

        browser.close()


if __name__ == "__main__":
    render_all()
