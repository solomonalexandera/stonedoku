import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfanityFilter } from '../../src/client/lib/profanityFilter.js';

test('filters listed bad words with asterisks', () => {
  const text = 'hack spam scam cheat exploit stupid idiot loser noob';
  const filtered = ProfanityFilter.filter(text);
  ProfanityFilter.badWords.forEach((word) => {
    const wordPattern = new RegExp(`\\b${word}\\b`, 'i');
    assert.ok(!wordPattern.test(filtered), `expected word ${word} to be filtered`);
  });
});

test('leaves clean text untouched', () => {
  const text = 'Let us play Sudoku today';
  const filtered = ProfanityFilter.filter(text);
  assert.equal(filtered, text);
});
