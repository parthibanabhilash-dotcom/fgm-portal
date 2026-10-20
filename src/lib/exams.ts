import { randomInt } from 'node:crypto';
import { Prisma, type User } from '@prisma/client';
import { db } from './db';
import { courseAccess, lessonAccess } from './access';
import { HttpError } from './http';
import { grade, mayReview, safeQuestions, type Snapshot } from './exam-core';
type Tx = Prisma.TransactionClient;
async function lockAttempt(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "ExamAttempt" WHERE "id" = ${id} FOR UPDATE`;
  const attempt = await tx.examAttempt.findUnique({ where: { id }, include: { answers: true } });
  if (!attempt) throw new HttpError(404, 'Attempt not found.');
  return attempt;
}
async function finishLocked(tx: Tx, attempt: Awaited<ReturnType<typeof lockAttempt>>) {
  if (attempt.status === 'SUBMITTED') return attempt;
  return tx.examAttempt.update({ where: { id: attempt.id }, data: {
    status: 'SUBMITTED', submittedAt: new Date(), ...grade(attempt.snapshot as Snapshot, attempt.answers)
  }, include: { answers: true } });
}
export async function expireAttempts() {
  const due = await db.examAttempt.findMany({ where: { status: 'ACTIVE', deadline: { lte: new Date() } }, select: { id: true }, take: 100 });
  for (const { id } of due) await db.$transaction(async tx => {
    const a = await lockAttempt(tx, id);
    if (a.status === 'ACTIVE' && a.deadline <= new Date()) await finishLocked(tx, a);
  });
  return due.length;
}
export async function examAccess(user: User, examId: string) {
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new HttpError(404, 'Exam not found.');
  await courseAccess(user, exam.courseId);
  if (exam.lessonId) await lessonAccess(user, exam.lessonId);
  return exam;
}
export async function startAttempt(user: User, examId: string) {
  if (user.role !== 'STUDENT') throw new HttpError(403, 'Use an intern account to take exams.');
  await examAccess(user, examId);
  return db.$transaction(async tx => {
    // All starts for one user serialize, so concurrent requests cannot evade limits.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Exam" WHERE "id" = ${examId} FOR SHARE`;
    const exam = await tx.exam.findUniqueOrThrow({ where: { id: examId }, include: { questions: { orderBy: { position: 'asc' }, include: { choices: { orderBy: { position: 'asc' } } } } } });
    const previous = await tx.examAttempt.findMany({ where: { userId: user.id, examId } });
    const active = previous.find(a => a.status === 'ACTIVE');
    if (active) {
      const locked = await lockAttempt(tx, active.id);
      if (locked.deadline > new Date()) return { id: active.id };
      await finishLocked(tx, locked);
    }
    const now = new Date();
    if (!exam.published || exam.archived || (exam.availableFrom && now < exam.availableFrom) || (exam.availableUntil && now >= exam.availableUntil)) throw new HttpError(403, 'Exam is not currently available.');
    if (previous.length >= exam.maxAttempts) throw new HttpError(403, 'Maximum attempts reached.');
    if (!exam.questions.length || exam.questions.some(q => q.choices.length < 2 || q.choices.filter(c => c.correct).length !== 1)) throw new HttpError(409, 'This exam is not ready. Contact your administrator.');
    const questions: Snapshot['questions'] = exam.questions.map(q => ({ id: q.id, text: q.text, marks: q.marks, choices: q.choices.map(c => ({ id: c.id, text: c.text, correct: c.correct })) }));
    if (exam.randomize) for (let i = questions.length - 1; i > 0; i--) { const j = randomInt(i + 1); [questions[i], questions[j]] = [questions[j], questions[i]]; }
    const snapshot: Snapshot = { title: exam.title, passPercentage: exam.passPercentage, release: exam.release, availableUntil: exam.availableUntil?.toISOString() ?? null, questions };
    const deadline = new Date(Math.min(now.getTime() + exam.durationMinutes * 60000, exam.availableUntil?.getTime() ?? Infinity));
    return tx.examAttempt.create({ data: { examId, userId: user.id, deadline, snapshot: snapshot as unknown as Prisma.InputJsonValue }, select: { id: true } });
  });
}
async function ownAttempt(user: User, id: string) {
  const attempt = await db.examAttempt.findUnique({ where: { id } });
  if (!attempt || attempt.userId !== user.id) throw new HttpError(404, 'Attempt not found.');
  await examAccess(user, attempt.examId);
}
export async function readAttempt(user: User, id: string) {
  await ownAttempt(user, id);
  const attempt = await db.$transaction(async tx => {
    const a = await lockAttempt(tx, id);
    return a.status === 'ACTIVE' && a.deadline <= new Date() ? finishLocked(tx, a) : a;
  });
  const snapshot = attempt.snapshot as Snapshot;
  const review = mayReview(snapshot, attempt.status === 'SUBMITTED');
  return { id: attempt.id, examId: attempt.examId, title: snapshot.title, status: attempt.status, deadline: attempt.deadline.toISOString(),
    serverNow: new Date().toISOString(), score: attempt.score, passed: attempt.passed, passPercentage: snapshot.passPercentage,
    review, questions: safeQuestions(snapshot, review), answers: attempt.answers.map(a => ({ questionId: a.questionId, choiceId: a.choiceId })) };
}
export async function saveAnswer(user: User, id: string, questionId: string, choiceId: string) {
  await ownAttempt(user, id);
  const result = await db.$transaction(async tx => {
    const a = await lockAttempt(tx, id);
    if (a.status !== 'ACTIVE') return 'submitted';
    if (a.deadline <= new Date()) { await finishLocked(tx, a); return 'expired'; }
    const q = (a.snapshot as Snapshot).questions.find(q => q.id === questionId);
    if (!q?.choices.some(c => c.id === choiceId)) throw new HttpError(400, 'Invalid answer choice.');
    await tx.studentAnswer.upsert({ where: { attemptId_questionId: { attemptId: id, questionId } }, create: { attemptId: id, questionId, choiceId }, update: { choiceId } });
    return 'saved';
  });
  if (result !== 'saved') throw new HttpError(409, result === 'expired' ? 'Time expired. Your saved answers were submitted.' : 'Attempt already submitted.');
  return { saved: true };
}
export async function submitAttempt(user: User, id: string) {
  await ownAttempt(user, id);
  await db.$transaction(async tx => finishLocked(tx, await lockAttempt(tx, id)));
  return readAttempt(user, id);
}
