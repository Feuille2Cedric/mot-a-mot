import os
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
        def wiktionary(route):
            route.fulfill(
                status=200,
                content_type='application/json',
                body='''{"parse":{"title":"alacrité","text":{"*":"<div class=\\"mw-heading mw-heading2\\"><h2><span id=\\"fr\\">Français</span></h2></div><div class=\\"mw-heading mw-heading3\\"><h3><span id=\\"fr-nom-1\\">Nom commun</span></h3></div><p><b>alacrité</b></p><ol><li><i>(Soutenu)</i> Allégresse, enjouement, entrain.<ul><li>Un exemple à ignorer.</li></ul></li><li>Vivacité joyeuse dans la manière d’agir.</li></ol><div class=\\"mw-heading mw-heading2\\"><h2><span id=\\"en\\">Anglais</span></h2></div>"}}}''',
            )

        def english_wiktionary(route):
            route.fulfill(
                status=200,
                content_type='application/json',
                body='''{"parse":{"title":"candid","text":{"*":"<div class=\\"mw-heading mw-heading2\\"><h2 id=\\"English\\">English</h2></div><div class=\\"mw-heading mw-heading3\\"><h3>Adjective</h3></div><ol><li>Impartial and free from prejudice.</li><li>Open, honest, and sincere.</li></ol><div class=\\"mw-heading mw-heading2\\"><h2 id=\\"French\\">French</h2></div>"}}}''',
            )

        if os.environ.get('MOT_TEST_LIVE_WIKTIONARY') != '1':
            page.route('https://fr.wiktionary.org/**', wiktionary)
            page.route('https://en.wiktionary.org/**', english_wiktionary)
        page.route('https://kzdvpbbjvjbxnsamdnao.supabase.co/**', lambda route: route.abort())
        page.goto('http://127.0.0.1:3360/', wait_until='domcontentloaded')

        assert page.locator('h1').get_by_text('Une idée à retenir.').is_visible()
        page.locator('[data-add-daily-word]').click()
        page.locator('[data-add-daily-expression]').click()
        page.locator('[data-article-read]').check()
        assert page.locator('#day-progress-count').inner_text() == '3/3'

        page.locator('[data-view="search"]').click()
        tab_style = page.locator('[data-lookup-tab="word"]').evaluate(
            "button => ({border: getComputedStyle(button).borderTopWidth, background: getComputedStyle(button).backgroundColor})"
        )
        assert tab_style['border'] == '0px'
        assert tab_style['background'] == 'rgba(0, 0, 0, 0)'
        page.locator('#word-search').fill('alacrité')
        page.locator('#word-search-form').evaluate('form => form.requestSubmit()')
        page.locator('.result-card').wait_for()
        result = page.locator('.result-card').inner_text()
        assert 'Alacrité' in result.title()
        assert 'Allégresse, enjouement, entrain.' in result
        assert 'Vivacité joyeuse dans la manière d’agir.' in result
        assert 'Un exemple à ignorer.' not in result
        page.locator('[data-add-result]').click()

        page.locator('[data-lookup-tab="expression"]').click()
        page.locator('#expression-search').fill('La violence institutionnelle est mère de toutes les autres')
        page.locator('#expression-search-form').evaluate('form => form.requestSubmit()')
        page.locator('[data-add-expression-result]').wait_for()
        expression_result = page.locator('.result-card').inner_text()
        assert 'La première, mère de toutes les autres, est la violence institutionnelle' in expression_result
        assert 'Dom Hélder Câmara' in expression_result
        artifacts = ROOT / 'test-artifacts'
        artifacts.mkdir(exist_ok=True)
        page.screenshot(path=str(artifacts / 'expression-search.png'), full_page=True)
        page.locator('[data-add-expression-result]').click()

        page.locator('#expression-search').fill('Une formule personnelle encore inconnue')
        page.locator('#expression-search-form').evaluate('form => form.requestSubmit()')
        assert page.locator('[data-expression-meaning]').is_visible()
        assert 'pas encore dans le carnet' in page.locator('#lookup-status').inner_text()
        page.locator('[data-expression-type]').select_option('citation')
        page.locator('[data-expression-author]').fill('Une autrice')
        page.locator('[data-expression-meaning]').fill('Première ligne\nDeuxième ligne')
        page.locator('[data-expression-sources]').fill('https://example.com/source-1\nhttps://example.org/source-2')
        page.locator('[data-save-expression-draft]').click()

        page.locator('[data-view="library"]').click()
        assert page.locator('#words-count').inner_text() == '2'
        assert int(page.locator('#expressions-count').inner_text()) >= 1
        assert page.locator('#articles-count').inner_text() == '1'
        alacrity_card = page.locator('.library-item', has_text='alacrité')
        assert alacrity_card.get_by_text('Allégresse, enjouement, entrain.', exact=False).is_visible()
        assert alacrity_card.get_by_text('Vivacité joyeuse dans la manière d’agir.', exact=False).is_visible()
        source_box = alacrity_card.locator('.library-action-link').bounding_box()
        delete_box = alacrity_card.locator('[data-delete]').bounding_box()
        assert abs(source_box['height'] - delete_box['height']) < 1
        alacrity_card.locator('[data-note]').fill('Ligne une\nLigne deux')
        page.locator('[data-library-tab="expressions"]').click()
        assert page.locator('#library-list').get_by_text('La première, mère de toutes les autres, est la violence institutionnelle', exact=False).is_visible()
        personal_card = page.locator('.library-item', has_text='Une formule personnelle encore inconnue')
        assert 'Citation' in personal_card.inner_text()
        assert 'UNE AUTRICE' in personal_card.inner_text()
        assert personal_card.locator('.library-sources a').count() == 2
        assert personal_card.locator('p.preserve-lines').first.evaluate("node => getComputedStyle(node).whiteSpace") == 'pre-wrap'

        page.locator('[data-view="quiz"]').click()
        unknown_definition = page.locator('#quiz-definition').inner_text()
        unknown_answer = page.evaluate(
            "definition => MotContent.words.find(word => word.definition === definition)?.term || MotApp.read().words.find(word => word.definition === definition)?.term",
            unknown_definition,
        )
        assert unknown_answer
        attempts_before_give_up = int(page.locator('#quiz-total').inner_text())
        assert page.locator('#quiz-give-up').is_visible()
        page.screenshot(path=str(artifacts / 'quiz-give-up-before.png'), full_page=True)
        page.locator('#quiz-give-up').click()
        assert unknown_answer in page.locator('#quiz-feedback').inner_text()
        assert 'Pas de souci' in page.locator('#quiz-feedback').inner_text()
        assert 'wrong' in page.locator('#quiz-feedback').get_attribute('class')
        assert page.locator('#quiz-answer').is_disabled()
        assert page.locator('#quiz-give-up').is_hidden()
        assert page.locator('#quiz-save').is_visible()
        assert int(page.locator('#quiz-total').inner_text()) == attempts_before_give_up + 1
        page.screenshot(path=str(artifacts / 'quiz-give-up.png'), full_page=True)
        page.locator('#quiz-next').click()

        added_from_quiz = False
        for _ in range(4):
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
            already_saved = page.evaluate(
                "term => MotApp.read().words.some(word => MotDomain.canonical(word.term) === MotDomain.canonical(term))",
                expected,
            )
            page.locator('#quiz-answer').fill(expected)
            page.locator('#quiz-form').evaluate('form => form.requestSubmit()')
            assert 'Exact' in page.locator('#quiz-feedback').inner_text()
            assert page.locator('#quiz-save').is_visible()
            if not already_saved:
                before_quiz_add = page.evaluate('MotApp.read().words.length')
                assert 'Ajouter ce mot' in page.locator('#quiz-save').inner_text()
                page.locator('#quiz-save').click()
                assert page.evaluate('MotApp.read().words.length') == before_quiz_add + 1
                assert page.locator('#quiz-save').is_disabled()
                assert 'Dans ma bibliothèque' in page.locator('#quiz-save').inner_text()
                page.screenshot(path=str(artifacts / 'quiz-add.png'), full_page=True)
                page.set_viewport_size({'width': 390, 'height': 844})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=str(artifacts / 'quiz-add-mobile.png'), full_page=True)
                page.set_viewport_size({'width': 1440, 'height': 1000})
                added_from_quiz = True
                break
            page.locator('#quiz-next').click()
        assert added_from_quiz

        page.locator('#language-switch').click()
        assert page.locator('[data-view="home"]').inner_text() == 'Today'
        assert page.locator('#word-search').get_attribute('placeholder') == 'E.g. perspicacious'
        page.locator('[data-view="search"]').click()
        page.locator('[data-lookup-tab="word"]').click()
        page.locator('#word-search').fill('candid')
        page.locator('#word-search-form').evaluate('form => form.requestSubmit()')
        page.locator('.result-card').wait_for()
        english_result = page.locator('.result-card').inner_text()
        assert 'Impartial and free from prejudice.' in english_result
        assert 'Open, honest, and sincere.' in english_result
        page.locator('[data-add-result]').click()
        assert page.evaluate("MotApp.read().words.find(word => word.term === 'candid').definitions.length") == 2
        assert page.evaluate("MotApp.read().words.find(word => word.term === 'candid').language") == 'en'

        page.reload(wait_until='domcontentloaded')
        saved_total = page.evaluate('MotApp.read().words.length + MotApp.read().expressions.length')
        assert page.locator('#nav-count').inner_text() == str(saved_total)
        assert page.evaluate("MotApp.read().words.find(word => word.term === 'alacrité').note") == 'Ligne une\nLigne deux'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

        page.screenshot(path=str(artifacts / 'desktop.png'), full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.reload(wait_until='domcontentloaded')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(artifacts / 'mobile.png'), full_page=True)
        assert not errors, errors

        print('UI PASS: daily ritual, word and expression lookup, library, quiz, reload, desktop and mobile. No JS errors.')
        browser.close()
finally:
    server.terminate()
    server.wait()
