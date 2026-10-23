import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiStorySchema, geminiSummarySchema } from './schemas.js';

const safeScene = {
  photoId: 'photo_1',
  narration: 'The garden has bright flowers.',
  recallQuestion: 'What can you see?',
  expectedAnswer: 'Flowers',
  answerOptions: ['Flowers', 'A blue bicycle'],
};

test('Gemini story output requires supported choices and expected answer', () => {
  assert.equal(geminiStorySchema.safeParse({ title: 'A garden', scenes: [safeScene] }).success, true);
  assert.equal(geminiStorySchema.safeParse({
    title: 'A garden',
    scenes: [{ ...safeScene, answerOptions: ['A blue bicycle', 'A quiet room'] }],
  }).success, false);
});

test('Gemini story and summary outputs reject medical claims', () => {
  assert.equal(geminiStorySchema.safeParse({
    title: 'A garden',
    scenes: [{ ...safeScene, narration: 'This will treat dementia.' }],
  }).success, false);
  assert.equal(geminiSummarySchema.safeParse({
    summary: 'The patient should change medication.',
    concerns: [],
    doctorReviewNote: 'For doctor review.',
  }).success, false);
});
