import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.test-deps'))

from playwright.sync_api import sync_playwright


server = subprocess.Popen(
    [sys.executable, '-m', 'http.server', '3360', '--bind', '127.0.0.1', '--directory', str(ROOT / 'site')],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)

try:
    for _ in range(30):
        try:
            urllib.request.urlopen('http://127.0.0.1:3360/', timeout=1).close()
            break
        except Exception:
            time.sleep(0.1)
    else:
        raise RuntimeError('Le serveur local ne répond pas.')

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='msedge', headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
        page.route('https://fonts.gstatic.com/**', lambda route: route.abort())
        page.route('https://fr.wiktionary.org/**', lambda route: route.abort())
        page.route('https://kzdvpbbjvjbxnsamdnao.supabase.co/**', lambda route: route.abort())
        page.goto('http://127.0.0.1:3360/', wait_until='domcontentloaded')

        assert page.locator('h1').get_by_text('Une idée à retenir.').is_visible()
        page.locator('[data-add-daily-word]').click()
        page.locator('[data-add-daily-expression]').click()
        page.locator('[data-article-read]').check()
        assert page.locator('#day-progress-count').inner_text() == '3/3'

        page.locator('[data-view="search"]').click()
        page.locator('#word-search').fill('sagace')
        page.locator('#word-search-form').evaluate('form => form.requestSubmit()')
        page.locator('.result-card').wait_for()
        assert 'Sagace' in page.locator('.result-card').inner_text().title()
        page.locator('[data-add-result]').click()

        page.locator('[data-view="library"]').click()
        assert page.locator('#words-count').inner_text() == '2'
        assert page.locator('#expressions-count').inner_text() == '1'
        assert page.locator('#articles-count').inner_text() == '1'

        page.locator('[data-view="quiz"]').click()
        definition = page.locator('#quiz-definition').inner_text()
        expected = page.evaluate(
            "definition => MotContent.words.find(word => word.definition === definition)?.term",
            definition,
        )
        if not expected:
            expected = page.evaluate(
                "definition => MotApp.read().words.find(word => word.definition === definition)?.term",
                definition,
            )
        assert expected
        page.locator('#quiz-answer').fill(expected)
        page.locator('#quiz-form').evaluate('form => form.requestSubmit()')
        assert 'Exact' in page.locator('#quiz-feedback').inner_text()

        page.reload(wait_until='domcontentloaded')
        assert page.locator('#nav-count').inner_text() == '3'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

        artifacts = ROOT / 'test-artifacts'
        artifacts.mkdir(exist_ok=True)
        page.screenshot(path=str(artifacts / 'desktop.png'), full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload(wait_until='domcontentloaded')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(artifacts / 'mobile.png'), full_page=True)
        assert not errors, errors

        print('UI PASS: daily ritual, offline lookup, library, quiz, reload, desktop and mobile. No JS errors.')
        browser.close()
finally:
    server.terminate()
    server.wait()
