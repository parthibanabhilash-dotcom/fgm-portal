import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to an isolated migrated PostgreSQL test database.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
test('PostgreSQL permissions, progress, exam lifecycle and constraints', async t => {
  const { db } = await import('../../src/lib/db');
  const { courseAccess, lessonAccess } = await import('../../src/lib/access');
  const { startAttempt, readAttempt, saveAnswer, submitAttempt, expireAttempts } = await import('../../src/lib/exams');
  const token = randomUUID();
  const student = await db.user.create({ data: { email: `test-${token}@example.test`, name: 'Integration Student', passwordHash: 'unused' } });
  const stranger = await db.user.create({ data: { email: `other-${token}@example.test`, name: 'Other Student', passwordHash: 'unused' } });
  const course = await db.course.create({ data: { title: 'Integration course', description: 'Tests', instructor: 'Tests', category: 'Tests', sequential: true, status: 'PUBLISHED', modules: { create: { title: 'One', position: 1, lessons: { create: [{ title: 'First', position: 1 }, { title: 'Second', position: 2 }] } } } }, include: { modules: { include: { lessons: { orderBy: { position: 'asc' } } } } } });
  const enrollment = await db.enrollment.create({ data: { userId: student.id, courseId: course.id } });
  const lessons = course.modules[0].lessons;
  let examId = '';
  try {
    await t.test('enrollment restrictions, course publication, sequential access and progress', async () => {
      await assert.rejects(courseAccess(stranger, course.id), /not enrolled/);
      await courseAccess(student, course.id);
      await assert.rejects(lessonAccess(student, lessons[1].id), /preceding lessons/);
      await db.lessonProgress.upsert({ where: { userId_lessonId: { userId: student.id, lessonId: lessons[0].id } }, create: { userId: student.id, lessonId: lessons[0].id, completed: true, position: 97.5 }, update: {} });
      await lessonAccess(student, lessons[1].id);
      assert.equal((await db.lessonProgress.findUniqueOrThrow({ where: { userId_lessonId: { userId: student.id, lessonId: lessons[0].id } } })).position, 97.5);
      await db.enrollment.update({ where: { id: enrollment.id }, data: { active: false } });
      await assert.rejects(courseAccess(student, course.id), /not enrolled/);
      await db.enrollment.update({ where: { id: enrollment.id }, data: { active: true } });
      await db.course.update({ where: { id: course.id }, data: { status: 'UNPUBLISHED' } });
      await assert.rejects(courseAccess(student, course.id), /not enrolled/);
      await db.course.update({ where: { id: course.id }, data: { status: 'PUBLISHED' } });
      await assert.rejects(db.enrollment.create({ data: { userId: student.id, courseId: course.id } }));
    });
    const exam = await db.exam.create({ data: { courseId: course.id, title: 'Original exam', instructions: 'Test', published: true, maxAttempts: 2, randomize: true, release: 'NEVER', durationMinutes: 1, questions: { create: Array.from({ length: 3 }, (_, i) => ({ text: `Question ${i}`, position: i + 1, marks: i + 1, choices: { create: [{ text: 'Correct', position: 1, correct: true }, { text: 'Wrong', position: 2 }] } })) } } }); examId = exam.id;
    let firstId = '';
    await t.test('concurrent starts reuse one attempt and enforce enrollment', async () => {
      await assert.rejects(startAttempt(stranger, examId), /not enrolled/);
      const results = await Promise.all(Array.from({ length: 5 }, () => startAttempt(student, examId)));
      assert.equal(new Set(results.map(a => a.id)).size, 1); firstId = results[0].id;
    });
    await t.test('safe DTO, autosave, ownership, invalid answers, and stable random order', async () => {
      const first = await readAttempt(student, firstId), again = await readAttempt(student, firstId);
      assert.deepEqual(first.questions, again.questions);
      assert.equal(JSON.stringify(first).includes('correct'), false);
      await assert.rejects(readAttempt(stranger, firstId), /not found/);
      await assert.rejects(saveAnswer(student, firstId, first.questions[0].id, 'invalid'), /Invalid answer/);
      const snapshot = (await db.examAttempt.findUniqueOrThrow({ where: { id: firstId } })).snapshot as unknown as { questions: { id: string; choices: { id: string; correct: boolean }[] }[] };
      for (const q of snapshot.questions) await saveAnswer(student, firstId, q.id, q.choices.find(c => c.correct)!.id);
      assert.equal((await readAttempt(student, firstId)).answers.length, 3);
      await assert.rejects(db.studentAnswer.create({ data: { attemptId: firstId, questionId: 'not-in-snapshot', choiceId: 'not-in-snapshot' } }));
      await assert.rejects(db.examAttempt.update({ where: { id: firstId }, data: { snapshot: { title: 'tampered' } } }), /immutable/);
    });
    await t.test('server grading, idempotent concurrent submissions, immutable content history', async () => {
      await db.exam.update({ where: { id: examId }, data: { title: 'Edited exam', passPercentage: 100, release: 'IMMEDIATE' } });
      const results = await Promise.all([submitAttempt(student, firstId), submitAttempt(student, firstId)]);
      assert.equal(results[0].score, 100); assert.equal(results[0].passed, true); assert.equal(results[0].title, 'Original exam');
      assert.equal(results[0].review, false); assert.equal(results[1].score, 100);
      await assert.rejects(saveAnswer(student, firstId, 'x', 'y'), /submitted/);
    });
    await t.test('availability dates and attempt limits', async () => {
      await db.exam.update({ where: { id: examId }, data: { availableFrom: new Date(Date.now() + 60000) } });
      await assert.rejects(startAttempt(student, examId), /not currently available/);
      await db.exam.update({ where: { id: examId }, data: { availableFrom: null, availableUntil: new Date(Date.now() - 1000) } });
      await assert.rejects(startAttempt(student, examId), /not currently available/);
      await db.exam.update({ where: { id: examId }, data: { availableUntil: null } });
    });
    await t.test('worker expiry rejects late answers and is safe to retry', async () => {
      const second = await startAttempt(student, examId);
      await db.examAttempt.update({ where: { id: second.id }, data: { deadline: new Date(Date.now() - 100) } });
      await assert.rejects(saveAnswer(student, second.id, 'x', 'y'), /Time expired/);
      const result = await readAttempt(student, second.id); assert.equal(result.status, 'SUBMITTED'); assert.equal(result.score, 0);
      assert.equal(result.review, true);
      await expireAttempts(); await expireAttempts();
      await assert.rejects(startAttempt(student, examId), /Maximum attempts/);
    });
    await t.test('worker finalizes closed-browser attempt and read finalizes overdue attempts', async () => {
      await db.exam.update({ where: { id: examId }, data: { maxAttempts: 4 } });
      const third = await startAttempt(student, examId);
      await db.examAttempt.update({ where: { id: third.id }, data: { deadline: new Date(Date.now() - 100) } });
      await expireAttempts(); assert.equal((await db.examAttempt.findUniqueOrThrow({ where: { id: third.id } })).status, 'SUBMITTED');
      const fourth = await startAttempt(student, examId);
      await db.examAttempt.update({ where: { id: fourth.id }, data: { deadline: new Date(Date.now() - 100) } });
      assert.equal((await readAttempt(student, fourth.id)).status, 'SUBMITTED');
    });
  } finally {
    await db.studentAnswer.deleteMany({ where: { attempt: { userId: student.id } } });
    await db.examAttempt.deleteMany({ where: { userId: student.id } });
    await db.exam.deleteMany({ where: { courseId: course.id } });
    await db.lessonProgress.deleteMany({ where: { userId: student.id } });
    await db.enrollment.deleteMany({ where: { courseId: course.id } });
    await db.lesson.deleteMany({ where: { module: { courseId: course.id } } });
    await db.module.deleteMany({ where: { courseId: course.id } });
    await db.course.delete({ where: { id: course.id } });
    await db.user.deleteMany({ where: { id: { in: [student.id, stranger.id] } } }); await db.$disconnect();
  }
});
