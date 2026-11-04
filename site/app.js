(() => {
  'use strict';
  const STORAGE_KEY = 'mot-a-mot-v1';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const C = window.MotContent;
  const D = window.MotDomain;
  let documentState = load();
  let activeView = 'home';
  let libraryTab = 'words';
  let quizDeck = [];
  let quizIndex = 0;
  let answered = false;
  let toastTimer;

  function load() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || D.empty(); return D.validate(value); }
    catch { return D.empty(); }
  }
  function read() { return structuredClone(documentState); }
  function apply(value) { D.validate(value); documentState = structuredClone(value); localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState)); renderAll(); }
  function save() { D.validate(documentState); localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState)); window.motSync?.mark(); renderCounts(); renderProgress(); }
  function now() { return Date.now(); }
  function makeId(prefix) { return `${prefix}:${now()}:${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function toast(message) { const node = $('#toast'); node.textContent = message; node.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => node.hidden = true, 2600); }
  function sourceUrl(term) { return `https://fr.wiktionary.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}`; }
  function wordId(term) { return `word:${D.canonical(term).replace(/ /g, '-')}`; }

  function showView(name) {
    activeView = name;
    $$('.view').forEach(view => view.hidden = view.id !== `${name}-view`);
    $$('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    $('nav').classList.remove('open'); $('.mobile-menu').setAttribute('aria-expanded', 'false');
    if (name === 'library') renderLibrary();
    if (name === 'quiz') startQuiz();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function dailyItems() {
    const readableArticles = C.articles.filter(article => article.daily !== false);
    return {
      word: D.daily(C.words, new Date(), 'mot-quotidien'),
      expression: D.daily(C.expressions, new Date(), 'expression-quotidienne'),
      article: D.daily(readableArticles, new Date(), 'article-quotidien')
    };
  }
  function hasWord(term) { return documentState.words.some(item => D.canonical(item.term) === D.canonical(term)); }
  function hasExpression(id) { return documentState.expressions.some(item => item.id === id); }
  function articleNote(id) { return documentState.articleNotes.find(item => item.id === id); }

  function addWord(word) {
    if (hasWord(word.term)) return toast('Ce mot est déjà dans ta bibliothèque.');
    const stamp = now();
    documentState.words.unshift({ id: wordId(word.term), term: word.term, nature: word.nature || '', definition: word.definition, example: word.example || '', source: word.source || sourceUrl(word.term), note: '', learned: false, addedAt: stamp, updated: stamp });
    save(); renderHome(); if (activeView === 'search') renderLookup(word); toast('Mot ajouté à ta bibliothèque.');
  }
  function addExpression(expression) {
    if (hasExpression(expression.id)) return toast('Cette expression est déjà gardée.');
    const stamp = now();
    documentState.expressions.unshift({ ...expression, note: '', learned: false, addedAt: stamp, updated: stamp });
    save(); renderHome(); toast('Expression ajoutée à ta bibliothèque.');
  }

  function renderHome() {
    const {word, expression, article} = dailyItems();
    $('#today-label').textContent = new Intl.DateTimeFormat('fr-FR', {weekday:'long', day:'numeric', month:'long'}).format(new Date());
    $('#daily-word').innerHTML = `<h2 class="daily-word-term">${esc(word.term)}</h2><span class="nature">${esc(word.nature)}</span><p class="definition">${esc(word.definition)}</p><p class="example">« ${esc(word.example)} »</p><div class="card-actions"><button class="button secondary ${hasWord(word.term)?'saved':''}" data-add-daily-word>${hasWord(word.term)?'✓ Dans ma bibliothèque':'+ Ajouter à ma bibliothèque'}</button></div>`;
    $('#daily-expression').innerHTML = `<h2 class="daily-expression-term">« ${esc(expression.expression)} »</h2><p class="definition">${esc(expression.meaning)}</p><p class="example">${esc(expression.origin)}</p><div class="card-actions"><button class="button secondary ${hasExpression(expression.id)?'saved':''}" data-add-daily-expression>${hasExpression(expression.id)?'✓ Expression gardée':'+ Garder cette expression'}</button></div>`;
    const note = articleNote(article.id) || {summary:'', comment:'', read:false};
    $('#daily-article').innerHTML = `<div class="article-topline"><span>La lecture du jour · ${esc(article.theme)}</span><small>${esc(article.source)} · ${esc(article.publication || 'Publication')} · ${esc(article.date)}</small></div><div class="article-layout"><div class="big-stat">${esc(article.stat)}</div><div class="article-copy"><h2>${esc(article.title)}</h2><p>${esc(article.summary)}</p><div class="source-row"><span>${article.minutes} min de lecture</span><a href="${esc(article.url)}" target="_blank" rel="noopener">Lire l’analyse complète ↗</a></div><div class="article-notes"><label>Mon résumé<textarea data-article-field="summary" maxlength="12000" placeholder="Ce que je veux retenir…">${esc(note.summary)}</textarea></label><label>Mon commentaire<textarea data-article-field="comment" maxlength="12000" placeholder="Ce que cela m’évoque…">${esc(note.comment)}</textarea></label></div><label class="read-check"><input type="checkbox" data-article-read ${note.read?'checked':''}> Marquer comme lu et le garder dans mes lectures</label></div></div>`;
    renderProgress();
  }

  function upsertArticle(article, patch) {
    let note = articleNote(article.id);
    if (!note) { note = {id:article.id, summary:'', comment:'', read:false, updated:now()}; documentState.articleNotes.unshift(note); }
    Object.assign(note, patch, {updated:now()});
    if (!note.summary && !note.comment && !note.read) documentState.articleNotes = documentState.articleNotes.filter(item => item.id !== note.id);
    save();
  }

  async function lookup(term) {
    const clean = term.trim();
    const local = C.words.find(item => D.canonical(item.term) === D.canonical(clean));
    $('#lookup-status').textContent = 'Recherche dans le Wiktionnaire…';
    try {
      const endpoint = new URL('https://fr.wiktionary.org/w/api.php');
      endpoint.search = new URLSearchParams({action:'parse', page:clean, prop:'text|displaytitle', redirects:'1', format:'json', origin:'*'});
      const response = await fetch(endpoint, {signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error('Service indisponible');
      const payload = await response.json();
      if (payload.error || !payload.parse?.text?.['*']) throw Error('Mot introuvable');
      const parsed = new DOMParser().parseFromString(payload.parse.text['*'], 'text/html');
      const frenchTitle = parsed.querySelector('#fr')?.closest('h2');
      const french = frenchTitle?.closest('.mw-heading2') || frenchTitle;
      if (!french) throw Error('Aucune section française');
      const definitions = [];
      for (let node = french.nextElementSibling; node; node = node.nextElementSibling) {
        if (node.tagName === 'H2' || node.matches?.('.mw-heading2') || node.querySelector?.(':scope > h2')) break;
        const lists = node.tagName === 'OL' ? [node] : [...(node.querySelectorAll?.(':scope > ol') || [])];
        lists.forEach(list => list.querySelectorAll(':scope > li').forEach(item => {
          const copy = item.cloneNode(true); copy.querySelectorAll('ol,ul,dl,table,sup,.reference').forEach(child => child.remove());
          const text = copy.textContent.replace(/\s+/g, ' ').trim().replace(/\s*\[[^\]]+\]\s*/g, ' ');
          if (text.length > 12 && text.length < 700 && !definitions.includes(text)) definitions.push(text);
        }));
      }
      if (!definitions.length) throw Error('Aucune définition lisible');
      return {id:wordId(clean), term:clean.toLocaleLowerCase('fr-FR'), nature:local?.nature || 'mot français', definition:definitions[0], definitions:definitions.slice(0,3), example:local?.example || '', source:sourceUrl(clean)};
    } catch (error) {
      if (local) return {...local, definitions:[local.definition], source:sourceUrl(local.term), fallback:true};
      throw Error('Ce mot n’a pas été trouvé. Vérifie l’orthographe ou réessaie avec sa forme au singulier.');
    }
  }
  function renderLookup(word) {
    $('#lookup-status').textContent = word.fallback ? 'Définition disponible hors ligne.' : 'Définition trouvée.';
    const definitions = word.definitions || [word.definition];
    $('#lookup-result').innerHTML = `<article class="result-card"><span class="nature">${esc(word.nature || 'mot français')}</span><h3>${esc(word.term)}</h3><ol>${definitions.map(value=>`<li>${esc(value)}</li>`).join('')}</ol>${word.example?`<p class="example">« ${esc(word.example)} »</p>`:''}<div class="card-actions"><button class="button secondary ${hasWord(word.term)?'saved':''}" data-add-result>${hasWord(word.term)?'✓ Dans ma bibliothèque':'+ Ajouter à ma bibliothèque'}</button><span class="result-source">Source : <a href="${esc(word.source)}" target="_blank" rel="noopener">Wiktionnaire ↗</a></span></div></article>`;
    $('[data-add-result]').onclick = () => addWord(word);
  }

  function renderCounts() {
    $('#nav-count').textContent = documentState.words.length + documentState.expressions.length;
    $('#words-count').textContent = documentState.words.length;
    $('#expressions-count').textContent = documentState.expressions.length;
    $('#articles-count').textContent = documentState.articleNotes.length;
  }
  function renderProgress() {
    const daily = dailyItems();
    const count = Number(hasWord(daily.word.term)) + Number(hasExpression(daily.expression.id)) + Number(Boolean(articleNote(daily.article.id)?.read));
    $('#day-progress-count').textContent = `${count}/3`;
    $('#day-progress-fill').style.width = `${count/3*100}%`;
  }

  function renderLibrary() {
    renderCounts();
    const query = D.canonical($('#library-search').value);
    const list = $('#library-list');
    let items = documentState[libraryTab] || [];
    if (libraryTab === 'articles') items = documentState.articleNotes.map(note => ({...C.articles.find(article=>article.id===note.id), ...note})).filter(item=>item.title);
    if (query) items = items.filter(item => D.canonical(Object.values(item).join(' ')).includes(query));
    if (!items.length) {
      const labels = {words:['Aucun mot pour le moment.','Cherche un mot ou ajoute celui du jour.'],expressions:['Aucune expression gardée.','L’expression quotidienne t’attend sur l’accueil.'],articles:['Aucune lecture annotée.','Écris un résumé ou marque la donnée du jour comme lue.']};
      list.innerHTML = `<div class="empty-state"><strong>${labels[libraryTab][0]}</strong><p>${labels[libraryTab][1]}</p></div>`; return;
    }
    if (libraryTab === 'words') list.innerHTML = items.map(item => `<article class="library-item" data-id="${esc(item.id)}"><span class="nature">${esc(item.nature)}</span><h3>${esc(item.term)}</h3><p>${esc(item.definition)}</p><textarea data-note maxlength="12000" placeholder="Ma note personnelle…">${esc(item.note)}</textarea><div class="library-item-actions"><button data-learned>${item.learned?'✓ Acquis':'À revoir'}</button><a href="${esc(item.source)}" target="_blank" rel="noopener">Source ↗</a><button data-delete>Supprimer</button></div></article>`).join('');
    if (libraryTab === 'expressions') list.innerHTML = items.map(item => `<article class="library-item expression-item" data-id="${esc(item.id)}"><span class="nature">Expression</span><h3>« ${esc(item.expression)} »</h3><p>${esc(item.meaning)}</p><textarea data-note maxlength="12000" placeholder="Ma note personnelle…">${esc(item.note)}</textarea><div class="library-item-actions"><button data-learned>${item.learned?'✓ Acquise':'À revoir'}</button><button data-delete>Supprimer</button></div></article>`).join('');
    if (libraryTab === 'articles') list.innerHTML = items.map(item => `<article class="library-item expression-item" data-id="${esc(item.id)}"><span class="nature">${esc(item.source)} · ${esc(item.theme)}</span><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p>${item.comment?`<p class="example">« ${esc(item.comment)} »</p>`:''}<div class="library-item-actions"><button>${item.read?'✓ Lu':'Note en cours'}</button><a href="${esc(item.url)}" target="_blank" rel="noopener">Relire ↗</a><button data-delete>Supprimer mes notes</button></div></article>`).join('');
  }

  function shuffle(values) {
    const result = [...values];
    for (let index=result.length-1; index>0; index--) { const other=Math.floor(Math.random()*(index+1)); [result[index],result[other]]=[result[other],result[index]]; }
    return result;
  }
  function quizPool() {
    const saved = documentState.words.map(item=>({...item, saved:true}));
    const extras = C.words.filter(item=>!saved.some(word=>D.canonical(word.term)===D.canonical(item.term)));
    return shuffle([...shuffle(saved).slice(0,5), ...shuffle(extras).slice(0,Math.max(0,5-saved.length))]).slice(0,5);
  }
  function startQuiz() { quizDeck=quizPool(); quizIndex=0; answered=false; renderQuiz(); renderQuizStats(); }
  function renderQuiz() {
    if (!quizDeck.length) quizDeck = quizPool();
    const word = quizDeck[quizIndex]; answered=false;
    $('#quiz-position').textContent = `${quizIndex+1} / ${quizDeck.length}`;
    $('#quiz-definition').textContent = word.definition;
    $('#quiz-nature').textContent = word.nature || 'mot français';
    $('#quiz-answer').value=''; $('#quiz-answer').disabled=false; $('#quiz-form button').disabled=false;
    $('#quiz-feedback').textContent=''; $('#quiz-feedback').className='quiz-feedback'; $('#quiz-next').hidden=true;
  }
  function renderQuizStats() { const stats=D.quizStats(documentState.quizAnswers); $('#quiz-rate').textContent=`${stats.rate} %`; $('#quiz-streak').textContent=stats.streak; $('#quiz-total').textContent=stats.attempts; }
  function answerQuiz() {
    if (answered) return; answered=true;
    const word=quizDeck[quizIndex], value=$('#quiz-answer').value, correct=D.canonical(value)===D.canonical(word.term);
    documentState.quizAnswers.unshift({id:makeId('answer'),term:word.term,correct,at:now()});
    if (documentState.quizAnswers.length>2000) documentState.quizAnswers.length=2000;
    const saved=documentState.words.find(item=>D.canonical(item.term)===D.canonical(word.term));
    if(saved){saved.updated=now();if(correct)saved.learned=true;}
    save(); renderQuizStats();
    $('#quiz-feedback').textContent=correct?`Exact — ${word.term}.`:`La réponse était « ${word.term} ». `;
    $('#quiz-feedback').classList.add(correct?'correct':'wrong'); $('#quiz-answer').disabled=true; $('#quiz-form button').disabled=true; $('#quiz-next').hidden=false;
  }

  function bindEvents() {
    $$('.nav-link').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));
    $('[data-view-link]').addEventListener('click',event=>{event.preventDefault();showView('home');});
    $('.mobile-menu').addEventListener('click',()=>{const open=$('nav').classList.toggle('open');$('.mobile-menu').setAttribute('aria-expanded',String(open));});
    $('#home-view').addEventListener('click',event=>{const daily=dailyItems();if(event.target.closest('[data-add-daily-word]'))addWord(daily.word);if(event.target.closest('[data-add-daily-expression]'))addExpression(daily.expression);});
    $('#daily-article').addEventListener('input',event=>{const article=dailyItems().article;if(event.target.matches('[data-article-field]'))upsertArticle(article,{[event.target.dataset.articleField]:event.target.value});if(event.target.matches('[data-article-read]'))upsertArticle(article,{read:event.target.checked});});
    $('#word-search-form').addEventListener('submit',async event=>{event.preventDefault();$('#lookup-result').innerHTML='';try{renderLookup(await lookup($('#word-search').value));}catch(error){$('#lookup-status').textContent=error.message;}});
    $$('.search-suggestions button').forEach(button=>button.addEventListener('click',()=>{$('#word-search').value=button.dataset.suggestion;$('#word-search-form').requestSubmit();}));
    $$('.library-tabs button').forEach(button=>button.addEventListener('click',()=>{libraryTab=button.dataset.libraryTab;$$('.library-tabs button').forEach(item=>item.setAttribute('aria-selected',String(item===button)));renderLibrary();}));
    $('#library-search').addEventListener('input',renderLibrary);
    $('#library-list').addEventListener('input',event=>{if(!event.target.matches('[data-note]'))return;const item=(documentState[libraryTab]||[]).find(value=>value.id===event.target.closest('[data-id]').dataset.id);if(item){item.note=event.target.value;item.updated=now();save();}});
    $('#library-list').addEventListener('click',event=>{const card=event.target.closest('[data-id]');if(!card)return;const collection=libraryTab==='articles'?documentState.articleNotes:documentState[libraryTab];const item=collection.find(value=>value.id===card.dataset.id);if(!item)return;if(event.target.matches('[data-learned]')){item.learned=!item.learned;item.updated=now();save();renderLibrary();}if(event.target.matches('[data-delete]')){const name=libraryTab==='articles'?'articleNotes':libraryTab;documentState[name]=documentState[name].filter(value=>value.id!==item.id);save();renderLibrary();renderHome();}});
    $('#quiz-form').addEventListener('submit',event=>{event.preventDefault();answerQuiz();});
    $('#quiz-next').addEventListener('click',()=>{quizIndex++;if(quizIndex>=quizDeck.length){quizDeck=quizPool();quizIndex=0;toast('Nouvelle série de cinq mots.');}renderQuiz();$('#quiz-answer').focus();});
  }
  function renderAll(){renderHome();renderCounts();if(activeView==='library')renderLibrary();renderQuizStats();}
  function init(){bindEvents();renderAll();}
  window.MotApp={read,apply,renderAll};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
