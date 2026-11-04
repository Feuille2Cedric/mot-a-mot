const test = require('node:test');
const assert = require('node:assert/strict');
const Domain = require('../domain.js');

test('canonical compare les réponses sans accents ni ponctuation', () => {
  assert.equal(Domain.canonical('  PÉ-RENNE ! '), 'pe renne');
  assert.equal(Domain.canonical('L’ esprit'), 'l esprit');
});

test('daily renvoie le même contenu toute la journée', () => {
  const items = [{id:'a'},{id:'b'},{id:'c'}];
  const morning = new Date(2026, 10, 4, 8, 0);
  const evening = new Date(2026, 10, 4, 23, 0);
  assert.equal(Domain.daily(items, morning, 'mot').id, Domain.daily(items, evening, 'mot').id);
});

test('validate accepte une sauvegarde vide et refuse les doublons', () => {
  assert.equal(Domain.validate(Domain.empty()).version, 1);
  const invalid = Domain.empty();
  invalid.words = [
    {id:'word:a',term:'a',definition:'a',note:'',addedAt:1,updated:1},
    {id:'word:a',term:'b',definition:'b',note:'',addedAt:1,updated:1}
  ];
  assert.throws(() => Domain.validate(invalid), /identifiant/);
});

test('quizStats calcule réussite et série quotidienne', () => {
  const now = new Date(2026, 10, 4, 12);
  const answers = [
    {id:'1',term:'a',correct:true,at:new Date(2026,10,4,9).getTime()},
    {id:'2',term:'b',correct:false,at:new Date(2026,10,3,9).getTime()},
    {id:'3',term:'c',correct:true,at:new Date(2026,10,2,9).getTime()}
  ];
  assert.deepEqual(Domain.quizStats(answers, now), {attempts:3,correct:2,rate:67,streak:3});
});
