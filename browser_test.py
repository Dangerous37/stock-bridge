"""Exercise the same journey against the local API or deployed static demo."""
import os
import subprocess
from playwright.sync_api import sync_playwright, expect

service = None
try:
    url = os.environ.get("DEMO_URL")
    if not url:
        service = subprocess.Popen(["node","start.mjs"],env={**os.environ,"PORT":"0"},stdout=subprocess.PIPE,text=True)
        url = service.stdout.readline().strip().removeprefix("Open ")
    with sync_playwright() as driver:
        browser=driver.chromium.launch(channel="chrome")
        page=browser.new_page(viewport={"width":390,"height":844})
        page.goto(url)
        def click(label):
            page.get_by_role("button",name=label,exact=True).click()
        def decision(value):
            expect(page.locator("#decision")).to_have_text(value)
        click("Approve this plan");click("Receive late shipment");click("Apply approved plan")
        expect(page.get_by_role("status")).to_contain_text("Stale plan")
        click("Approve this plan");click("Apply approved plan");decision("APPLIED")
        with page.expect_download() as event:
            click("Download report")
        assert event.value.suggested_filename.endswith("-report.json")
        click("Restore example")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        browser.close()
        print("Browser journey, report download and mobile layout passed.")
finally:
    if service:
        service.terminate()
        service.wait(timeout=10)
