import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, grade, mayReview, safeQuestions, type Snapshot } from '../src/lib/exam-core';
import { validatePdf } from '../src/lib/storage';
const snapshot: Snapshot = { title: 'Test', passPercentage: 60, release: 'NEVER', availableUntil: null, questions: [
  { id: 'q1', text: 'One', marks: 2, choices: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: false }] },
  { id: 'q2', text: 'Two', marks: 1, choices: [{ id: 'c', text: 'C', correct: false }, { id: 'd', text: 'D', correct: true }] }
] };
test('weighted grading, unanswered questions, pass threshold, and invalid choices', () => {
  assert.deepEqual(grade(snapshot, [{ questionId: 'q1', choiceId: 'a' }]), { score: 66.67, passed: true });
  assert.deepEqual(grade(snapshot, [{ questionId: 'q1', choiceId: 'd' }]), { score: 0, passed: false });
  assert.deepEqual(grade(snapshot, []), { score: 0, passed: false });
});
test('correct answers are absent from pre-release DTOs', () => {
  assert.equal(JSON.stringify(safeQuestions(snapshot, false)).includes('correct'), false);
  assert.equal(safeQuestions(snapshot, true)[0].choices[0].correct, true);
  assert.equal(mayReview(snapshot, true), false);
  assert.equal(mayReview({ ...snapshot, release: 'IMMEDIATE' }, false), false);
  assert.equal(mayReview({ ...snapshot, release: 'IMMEDIATE' }, true), true);
  assert.equal(mayReview({ ...snapshot, release: 'AFTER_CLOSE', availableUntil: '2020-01-01' }, true), true);
  assert.equal(mayReview({ ...snapshot, release: 'AFTER_CLOSE' }, true), false);
  assert.equal(mayReview({ ...snapshot, release: 'AFTER_CLOSE', availableUntil: '2099-01-01' }, true), false);
});
test('CSV neutralizes formulas and escapes quotes', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"'); assert.equal(csvCell('  @SUM(A1)'), '"\'  @SUM(A1)"');
  assert.equal(csvCell('A "quoted" name'), '"A ""quoted"" name"');
});
test('PDF validation checks signature, MIME, extension, and size', () => {
  const bytes = Buffer.from('%PDF-1.7\n'); validatePdf('notes.pdf', 'application/pdf', bytes);
  assert.throws(() => validatePdf('notes.exe', 'application/pdf', bytes));
  assert.throws(() => validatePdf('notes.pdf', 'text/plain', bytes));
  assert.throws(() => validatePdf('notes.pdf', 'application/pdf', Buffer.from('HTML!')));
  assert.throws(() => validatePdf('notes.pdf', 'application/pdf', Buffer.alloc(20 * 1024 * 1024 + 1)));
});
