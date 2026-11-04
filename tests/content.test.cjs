const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('../site/content.js');

const articles = global.window.MotContent.articles;
const dailyArticles = articles.filter(article => article.daily !== false);

test('la rotation quotidienne ne contient que des publications éditoriales', () => {
  assert.ok(dailyArticles.length >= 10);
  assert.ok(dailyArticles.every(article => ['Insee Première', 'Insee Focus'].includes(article.publication)));
  assert.ok(dailyArticles.every(article => article.summary.length >= 100));
});

test('les anciennes fiches de données restent disponibles sans revenir dans la rotation', () => {
  const excluded = new Set(articles.filter(article => article.daily === false).map(article => article.id));
  assert.ok(excluded.has('insee:2408369'));
  assert.ok(excluded.has('insee:8670944'));
  assert.ok(!dailyArticles.some(article => excluded.has(article.id)));
});
