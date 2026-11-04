(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MotDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_ITEMS = 5000;
  const MAX_TEXT = 12000;

  function canonical(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('fr-FR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’'\-]/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dayNumber(date = new Date()) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of value) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function daily(items, date = new Date(), salt = '') {
    if (!Array.isArray(items) || !items.length) return null;
    return items[(dayNumber(date) + hash(salt)) % items.length];
  }

  function empty() {
    return { version: 1, words: [], expressions: [], articleNotes: [], quizAnswers: [] };
  }

  function text(value, label, max = MAX_TEXT) {
    if (typeof value !== 'string' || value.length > max) throw Error(`${label} invalide.`);
  }

  function uniqueIds(items, label) {
    if (!Array.isArray(items) || items.length > MAX_ITEMS) throw Error(`${label} invalide.`);
    const ids = new Set();
    for (const item of items) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || ids.has(item.id)) {
        throw Error(`${label} contient un identifiant invalide.`);
      }
      ids.add(item.id);
    }
  }

  function validate(document) {
    if (!document || typeof document !== 'object' || document.version !== 1) throw Error('Sauvegarde incompatible.');
    uniqueIds(document.words, 'La bibliothèque de mots');
    uniqueIds(document.expressions, 'La bibliothèque d’expressions');
    uniqueIds(document.articleNotes, 'Les notes de lecture');
    uniqueIds(document.quizAnswers, 'L’historique des quiz');

    document.words.forEach(item => {
      text(item.term, 'Mot', 120); text(item.definition, 'Définition'); text(item.note || '', 'Note');
      if (!Number.isFinite(item.addedAt) || !Number.isFinite(item.updated)) throw Error('Date de mot invalide.');
    });
    document.expressions.forEach(item => {
      text(item.expression, 'Expression', 240); text(item.meaning, 'Sens'); text(item.note || '', 'Note');
      if (!Number.isFinite(item.addedAt) || !Number.isFinite(item.updated)) throw Error('Date d’expression invalide.');
    });
    document.articleNotes.forEach(item => {
      text(item.summary || '', 'Résumé'); text(item.comment || '', 'Commentaire');
      if (typeof item.read !== 'boolean' || !Number.isFinite(item.updated)) throw Error('Note d’article invalide.');
    });
    document.quizAnswers.forEach(item => {
      text(item.term, 'Réponse', 120);
      if (typeof item.correct !== 'boolean' || !Number.isFinite(item.at)) throw Error('Résultat de quiz invalide.');
    });
    return document;
  }

  function quizStats(answers, now = new Date()) {
    const list = Array.isArray(answers) ? answers : [];
    const correct = list.filter(answer => answer.correct).length;
    const days = new Set(list.map(answer => dayNumber(new Date(answer.at))));
    let streak = 0;
    let cursor = dayNumber(now);
    if (!days.has(cursor) && days.has(cursor - 1)) cursor--;
    while (days.has(cursor)) { streak++; cursor--; }
    return { attempts: list.length, correct, rate: list.length ? Math.round(correct / list.length * 100) : 0, streak };
  }

  return { canonical, daily, dayNumber, empty, validate, quizStats };
});
