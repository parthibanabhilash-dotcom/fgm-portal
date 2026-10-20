import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
test.afterAll(async () => db.$disconnect());
test('admin authors and publishes their own MCQ question paper', async ({ page }) => {
  await db.rateLimit.deleteMany({ where: { key: 'login:admin@lkpacademy.test' } });
  const course = await db.course.create({ data: { title: `Question authoring test ${randomUUID()}`, description: 'Test fixture', category: 'Testing', instructor: 'Test author' } });
  try {
    await page.goto('/login'); await page.getByLabel('Email address').fill('admin@lkpacademy.test'); await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_ADMIN_PASSWORD || 'AdminDemo!2026'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page).toHaveURL(/admin$/);
    await page.goto(`/admin/courses/${course.id}`); await page.getByText('＋ Create an exam', { exact: true }).click();
    await page.getByLabel('Exam title', { exact: true }).fill('My own question paper'); await page.getByRole('button', { name: 'Create draft exam', exact: true }).click(); await expect(page).toHaveURL(new RegExp(`/admin/courses/${course.id}#exam-`));
    const examId = new URL(page.url()).hash.slice('#exam-'.length);
    await page.getByText('＋ Add MCQ question', { exact: true }).click();
    await page.getByLabel('Question', { exact: true }).fill('Which test choice is correct?'); await page.getByLabel('Choices (one per line, 2–8 choices)').fill('First option\nMy correct option\nThird option'); await page.getByLabel('Correct choice number (starts at 1)').fill('2'); await page.getByLabel('Marks', { exact: true }).fill('3'); await page.getByRole('button', { name: 'Add question', exact: true }).click();
    await expect.poll(() => db.question.count({ where: { examId } })).toBe(1);
    await page.getByText('Edit exam', { exact: true }).click();
    const settings = page.locator('details').filter({ has: page.getByText('Edit exam', { exact: true }) });
    await settings.last().getByLabel('Published (requires at least one valid question)').check(); await settings.last().getByRole('button', { name: 'Save exam settings', exact: true }).click();
    await expect.poll(async () => (await db.exam.findUniqueOrThrow({ where: { id: examId } })).published).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/admin/courses/${course.id}#exam-${examId}`));
    await page.goto(`/admin/exams/${examId}`);
    await expect(page).toHaveURL(new RegExp(`/admin/courses/${course.id}#exam-${examId}`));
    const question = await db.question.findFirstOrThrow({ where: { examId }, include: { choices: true } }); expect(question.marks).toBe(3); expect(question.choices.find(c => c.correct)?.text).toBe('My correct option');
    // Edit the course and exam on the same course page.
    await page.getByText('Edit course details & publication', { exact: true }).click();
    await page.getByLabel('Course title', { exact: true }).fill('Edited course title');
    await page.getByRole('button', { name: 'Save course', exact: true }).click();
    await expect.poll(async () => (await db.course.findUniqueOrThrow({ where: { id: course.id } })).title).toBe('Edited course title');
    await page.getByText('Edit exam', { exact: true }).click();
    const examSettings = page.locator('details').filter({ has: page.getByText('Edit exam', { exact: true }) }).last();
    await examSettings.getByLabel('Exam title', { exact: true }).fill('Edited question paper');
    await examSettings.getByRole('button', { name: 'Save exam settings', exact: true }).click();
    await expect.poll(async () => (await db.exam.findUniqueOrThrow({ where: { id: examId } })).title).toBe('Edited question paper');
    page.once('dialog', d => d.dismiss());
    await page.getByRole('button', { name: 'Delete exam', exact: true }).click();
    expect((await db.exam.findUniqueOrThrow({ where: { id: examId } })).archived).toBe(false);
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Delete exam', exact: true }).click();
    await expect.poll(async () => (await db.exam.findUniqueOrThrow({ where: { id: examId } })).archived).toBe(true);
    await expect(page.getByRole('button', { name: 'Delete exam', exact: true })).toHaveCount(0);
    await page.getByText('Deleted / archived exams (1)', { exact: true }).click();
    await page.getByRole('button', { name: 'Restore exam as draft', exact: true }).click();
    await expect.poll(async () => { const e = await db.exam.findUniqueOrThrow({ where: { id: examId } }); return [e.archived, e.published]; }).toEqual([false, false]);
    page.once('dialog', d => d.dismiss());
    await page.getByRole('button', { name: 'Delete course', exact: true }).click();
    expect((await db.course.findUniqueOrThrow({ where: { id: course.id } })).status).toBe('DRAFT');
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Delete course', exact: true }).click();
    await expect(page).toHaveURL(/admin\/courses$/);
    expect((await db.course.findUniqueOrThrow({ where: { id: course.id } })).status).toBe('ARCHIVED');
    expect(await db.question.count({ where: { examId } })).toBe(1);
    await expect(page.getByRole('row').filter({ hasText: 'Edited course title' })).toHaveCount(0);

  } finally { await db.exam.deleteMany({ where: { courseId: course.id } }); await db.course.delete({ where: { id: course.id } }); }
});
test('admin uploads a local video; enrolled students can seek, resume, and cannot upload', async ({ page, browser }) => {
  await db.rateLimit.deleteMany({ where: { key: { in: ['login:admin@lkpacademy.test', 'login:student@lkpacademy.test'] } } });
  const student = await db.user.findUniqueOrThrow({ where: { email: 'student@lkpacademy.test' } });
  const course = await db.course.create({ data: { title: `Local video test ${randomUUID()}`, category: 'Testing', description: 'Test fixture only', instructor: 'Testing', status: 'PUBLISHED', modules: { create: { title: 'Video module', position: 1, lessons: { create: { title: 'Local video lesson', position: 1 } } } } }, include: { modules: { include: { lessons: true } } } });
  const lessonId = course.modules[0].lessons[0].id;
  const enrollment = await db.enrollment.create({ data: { courseId: course.id, userId: student.id } });
  const studentContext = await browser.newContext({ baseURL: 'http://localhost:3100' });
  try {
    await page.goto('/login'); await page.getByLabel('Email address').fill('admin@lkpacademy.test'); await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_ADMIN_PASSWORD || 'AdminDemo!2026'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page).toHaveURL(/admin$/);
    // Playwright's recorder finalizes a real WebM with duration/index metadata for seeking.
    const fixtureContext = await browser.newContext({ recordVideo: { dir: test.info().outputPath('fixture-video'), size: { width: 320, height: 240 } } });
    const fixturePage = await fixtureContext.newPage();
    await fixturePage.setContent('<body style="background:#67195C;color:white;font:24px Arial">Local video test fixture</body>');
    await fixturePage.evaluate(() => new Promise(resolve => setTimeout(resolve, 2500)));
    const recording = fixturePage.video()!; await fixtureContext.close();
    const bytes = await readFile(await recording.path());
    await page.goto(`/admin/courses/${course.id}`); await page.getByText('1. Local video lesson', { exact: true }).click();
    await page.getByLabel('Video file from computer').setInputFiles({ name: 'local-test.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: 'Upload video', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Video uploaded');
    const asset = await db.videoAsset.findUniqueOrThrow({ where: { lessonId } }); expect(asset.size).toBe(bytes.length);
    const partial = await page.request.get(`/api/videos/${lessonId}`, { headers: { Range: 'bytes=0-3' } }); expect(partial.status()).toBe(206); expect((await partial.body()).length).toBe(4);
    const learner = await studentContext.newPage(); await learner.goto('/login'); await learner.getByLabel('Email address').fill(student.email); await learner.getByLabel('Password', { exact: true }).fill(process.env.DEMO_STUDENT_PASSWORD || 'StudentDemo!2026'); await learner.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(learner).toHaveURL(/dashboard/);
    expect((await studentContext.request.post(`/api/admin/videos/${lessonId}`, { headers: { Origin: 'http://localhost:3100' }, multipart: { file: { name: 'x.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) } } })).status()).toBe(403);
    await db.lessonProgress.create({ data: { userId: student.id, lessonId, position: 0.5 } });
    await learner.goto(`/courses/${course.id}/learn/${lessonId}`);
    const video = learner.locator('video'); await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => ({ resumed: v.currentTime >= 0.4, currentTime: v.currentTime, duration: String(v.duration), seekable: v.seekable.length }))).toMatchObject({ resumed: true });
    await video.evaluate(async (v: HTMLVideoElement) => { v.muted = true; await v.play(); });
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.7);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
    await expect(learner.getByText('Progress saved', { exact: true })).toBeVisible();
    await db.enrollment.update({ where: { id: enrollment.id }, data: { active: false } });
    expect((await studentContext.request.get(`/api/videos/${lessonId}`)).status()).toBe(403);
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Remove uploaded video', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Uploaded video removed');
    expect(await db.videoAsset.count({ where: { lessonId } })).toBe(0);
  } finally {
    if (await db.videoAsset.findUnique({ where: { lessonId } })) await page.request.delete(`/api/admin/videos/${lessonId}`, { headers: { Origin: 'http://localhost:3100' } });
    await studentContext.close(); await db.lessonProgress.deleteMany({ where: { lessonId } }); await db.enrollment.delete({ where: { id: enrollment.id } });
    await db.lesson.delete({ where: { id: lessonId } }); await db.module.deleteMany({ where: { courseId: course.id } }); await db.course.delete({ where: { id: course.id } });
  }
});
