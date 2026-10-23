import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../lib/errors.js';
import { requireStoryTransition } from './story-status.js';

test('story status transitions allow only the next state', () => {
  assert.doesNotThrow(() => requireStoryTransition('DRAFT', 'APPROVED'));
  assert.doesNotThrow(() => requireStoryTransition('APPROVED', 'ASSIGNED'));
  assert.doesNotThrow(() => requireStoryTransition('ASSIGNED', 'COMPLETED'));
});

test('assigning a non-approved story returns 409', () => {
  assert.throws(
    () => requireStoryTransition('DRAFT', 'ASSIGNED'),
    (error: unknown) => error instanceof HttpError && error.status === 409,
  );
});

test('approving a story outside DRAFT returns 409', () => {
  for (const status of ['APPROVED', 'ASSIGNED', 'COMPLETED']) {
    assert.throws(
      () => requireStoryTransition(status, 'APPROVED'),
      (error: unknown) => error instanceof HttpError && error.status === 409,
    );
  }
});
