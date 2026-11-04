from pathlib import Path
from playwright.sync_api import sync_playwright

EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=str(EDGE))
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.route("https://fr.wiktionary.org/**", lambda route: route.abort())
    page.route("https://kzdvpbbjvjbxnsamdnao.supabase.co/**", lambda route: route.abort())
    page.goto("http://127.0.0.1:3360/", wait_until="domcontentloaded")

    assert page.locator("h1").get_by_text("Une idée à retenir.").is_visible()
    page.locator("[data-add-daily-word]").click()
    page.locator("[data-add-daily-expression]").click()
    page.locator("[data-article-read]").check()
    assert page.locator("#day-progress-count").inner_text() == "3/3"

    page.locator('[data-view="search"]').click()
    page.locator("#word-search").fill("sagace")
    page.locator("#word-search-form").evaluate("form => form.requestSubmit()")
    page.locator(".result-card").wait_for()
    assert "Sagace" in page.locator(".result-card").inner_text().title()
    page.locator("[data-add-result]").click()

    page.locator('[data-view="library"]').click()
    assert page.locator("#words-count").inner_text() == "2"
    assert page.locator("#expressions-count").inner_text() == "1"
    assert page.locator("#articles-count").inner_text() == "1"

    page.locator('[data-view="quiz"]').click()
    definition = page.locator("#quiz-definition").inner_text()
    expected = page.evaluate("definition => MotContent.words.find(word => word.definition === definition)?.term", definition)
    if not expected:
        expected = page.evaluate("definition => MotApp.read().words.find(word => word.definition === definition)?.term", definition)
    assert expected
    page.locator("#quiz-answer").fill(expected)
    page.locator("#quiz-form").evaluate("form => form.requestSubmit()")
    assert "Exact" in page.locator("#quiz-feedback").inner_text()

    page.reload(wait_until="domcontentloaded")
    assert page.locator("#nav-count").inner_text() == "3"
    artifacts = Path(__file__).parents[1] / "test-artifacts"
    artifacts.mkdir(exist_ok=True)
    page.screenshot(path=str(artifacts / "desktop.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.reload(wait_until="domcontentloaded")
    page.screenshot(path=str(artifacts / "mobile.png"), full_page=True)
    browser.close()
