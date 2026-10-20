import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
test.beforeAll(async () => { await db.rateLimit.deleteMany({ where: { key: { in: ['login:student@lkpacademy.test', 'login:admin@lkpacademy.test'] } } }); });
test.afterAll(async () => db.$disconnect());
test('student login, server permissions, progress, notes, profile and logout', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('Email address').fill('student@lkpacademy.test'); await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_STUDENT_PASSWORD || 'StudentDemo!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole('heading', { name: /Hello/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('dashboard-desktop.png'), fullPage: true });
  for (const width of [820, 390]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy(); await page.screenshot({ path: test.info().outputPath(`dashboard-${width}.png`), fullPage: true }); }
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCSS('position', 'fixed');
  await page.getByRole('link', { name: 'My training', exact: true }).click(); await expect(page).toHaveURL(/courses$/);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click(); await expect(page).toHaveURL(/dashboard$/);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin'); await expect(page).toHaveURL(/dashboard/);
  const exportResponse = await page.request.get('/api/admin/results'); expect(exportResponse.status()).toBe(403);
  const lesson = await db.lesson.findFirstOrThrow({ where: { module: { courseId: 'demo-digital-marketing' } }, orderBy: { id: 'asc' } });
  await page.goto(`/courses/demo-digital-marketing/learn/${lesson.id}`);
  await page.setViewportSize({ width: 390, height: 844 });
  const outline = page.getByRole('button', { name: /Course lessons/ });
  await expect(outline).toHaveAttribute('aria-expanded', 'false');
  await outline.click(); await expect(outline).toHaveAttribute('aria-expanded', 'true');
  await outline.click(); await expect(page.locator('.outline-content')).toBeHidden();
  await page.getByRole('tab', { name: 'Notes' }).click(); await expect(page.getByText('PDF placeholder', { exact: false })).toBeVisible();
  const progress = await page.request.post(`/api/progress/${lesson.id}`, { headers: { Origin: 'http://localhost:3100' }, data: { completed: true, position: 42 } }); expect(progress.ok()).toBeTruthy();
  await page.reload(); await expect(page.getByRole('button', { name: 'Lesson completed' })).toBeVisible();
  const badOrigin = await page.request.post(`/api/progress/${lesson.id}`, { headers: { Origin: 'https://evil.example' }, data: { position: 0 } }); expect(badOrigin.status()).toBe(403);
  await page.goto('/profile'); await page.getByLabel('Full name').fill('Alex Sharma'); await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.getByRole('status')).toContainText('Profile updated');
  await page.getByRole('button', { name: 'Sign out' }).click(); await expect(page).toHaveURL(/login/);
  await page.goto('/dashboard'); await expect(page).toHaveURL(/login/);
});
test('registration creates student only, enrollment restrictions, inactive sessions', async ({ page }) => {
  const email = `browser-${randomUUID()}@example.test`;
  await page.goto('/register'); await page.getByLabel('Full name').fill('New Student'); await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill('BrowserTest!2026');
  await page.evaluate(() => { const field = document.createElement('input'); field.type = 'hidden'; field.name = 'role'; field.value = 'ADMIN'; document.querySelector('form')!.appendChild(field); });
  await page.getByRole('button', { name: 'Create intern account' }).click(); await expect(page).toHaveURL(/dashboard/);
  const user = await db.user.findUniqueOrThrow({ where: { email } }); expect(user.role).toBe('STUDENT');
  let attachmentId: string | undefined;
  try {
    await page.goto('/courses/demo-digital-marketing'); await expect(page.getByRole('heading', { name: 'Not assigned' })).toBeVisible();
    const lesson = await db.lesson.findFirstOrThrow({ where: { module: { courseId: 'demo-digital-marketing' } } });
    const attachment = await db.attachment.create({ data: { lessonId: lesson.id, name: 'Authorization test fixture.pdf', key: `tests/${randomUUID()}.pdf`, size: 8 } }); attachmentId = attachment.id;
    expect((await page.request.get(`/api/attachments/${attachment.id}`, { maxRedirects: 0 })).status()).toBe(403);
    const response = await page.request.post(`/api/progress/${lesson.id}`, { headers: { Origin: 'http://localhost:3100' }, data: { completed: true } }); expect(response.status()).toBe(403);
    const examResponse = await page.request.post('/api/exams/demo-final-exam/start', { headers: { Origin: 'http://localhost:3100' } }); expect(examResponse.status()).toBe(403);
    await db.user.update({ where: { id: user.id }, data: { active: false } }); await page.goto('/dashboard'); await expect(page).toHaveURL(/login/);
    expect((await page.request.get(`/api/attachments/${attachment.id}`, { maxRedirects: 0 })).status()).toBe(401);
  } finally { if (attachmentId) await db.attachment.delete({ where: { id: attachmentId } }); await db.user.delete({ where: { id: user.id } }); }
});
test('admin dashboard, course creation and mobile layout', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('Email address').fill('admin@lkpacademy.test'); await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_ADMIN_PASSWORD || 'AdminDemo!2026'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page).toHaveURL(/admin$/);
  await page.goto('/admin/courses'); await page.getByText('＋ Create a new course', { exact: true }).click();
  const title = `Browser course ${randomUUID()}`; await page.getByLabel('Course title').fill(title); await page.getByLabel('Description', { exact: true }).fill('Browser test course'); await page.getByLabel('Category', { exact: true }).fill('Testing'); await page.getByLabel('Trainer', { exact: true }).fill('Academy'); await page.getByRole('button', { name: 'Create course', exact: true }).click(); await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const course = await db.course.findFirstOrThrow({ where: { title } });
  try {
    const addModule = page.locator('details').filter({ has: page.getByText('＋ Add module', { exact: true }) });
    await addModule.locator('summary').click(); await addModule.getByLabel('Module title').fill('Browser module'); await addModule.getByRole('button', { name: 'Add module', exact: true }).click();
    await expect.poll(async () => db.module.count({ where: { courseId: course.id } })).toBe(1); await expect(addModule.getByRole('button', { name: 'Add module', exact: true })).toBeEnabled();
    await addModule.getByLabel('Module title').fill('Second module'); await addModule.getByRole('button', { name: 'Add module', exact: true }).click();
    const secondPanel = page.locator('section.panel').filter({ has: page.locator('input[value="Second module"]') });
    await secondPanel.getByRole('button', { name: 'Move up', exact: true }).click();
    await expect.poll(async () => (await db.module.findFirstOrThrow({ where: { courseId: course.id }, orderBy: { position: 'asc' } })).title).toBe('Second module');
    await expect(secondPanel.getByRole('button', { name: 'Move up', exact: true })).toBeEnabled();
    const originalPanel = page.locator('section.panel').filter({ has: page.locator('input[value="Browser module"]') });
    const addLesson = originalPanel.locator('details').filter({ has: page.getByText('＋ Add lesson', { exact: true }) });
    await addLesson.locator('summary').click(); await addLesson.getByLabel('Lesson title').fill('Browser lesson'); await addLesson.getByLabel('Notes (Markdown)').fill('# Browser notes\nHelpful learning material.'); await addLesson.getByRole('button', { name: 'Add lesson', exact: true }).click(); await expect(page.getByText('1. Browser lesson', { exact: true })).toBeVisible();
    const response = await page.request.get('/api/admin/results'); expect(response.ok()).toBeTruthy(); expect(response.headers()['content-type']).toContain('text/csv');
    await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole('heading', { name: title })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  finally { await db.lesson.deleteMany({ where: { module: { courseId: course.id } } }); await db.module.deleteMany({ where: { courseId: course.id } }); await db.course.delete({ where: { id: course.id } }); }
});
test('exam confirmation, autosave, refresh, safe response, scoring, timer and limits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const student = await db.user.findUniqueOrThrow({ where: { email: 'student@lkpacademy.test' } });
  const exam = await db.exam.create({ data: { courseId: 'demo-digital-marketing', title: `Browser exam ${randomUUID()}`, instructions: 'Choose the correct option.', published: true, durationMinutes: 10, maxAttempts: 2, questions: { create: { text: 'Which is a digital marketing channel?', position: 1, marks: 2, choices: { create: [{ text: 'Email marketing', position: 1, correct: true }, { text: 'A wooden desk', position: 2 }] } } } } });
  try {
    await page.goto('/login'); await page.getByLabel('Email address').fill(student.email); await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_STUDENT_PASSWORD || 'StudentDemo!2026'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page).toHaveURL(/dashboard/);
    await page.goto(`/exams/${exam.id}`); page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Start exam', exact: true }).click(); await expect(page).toHaveURL(/attempts\//);
    await page.getByLabel('Email marketing', { exact: true }).check(); await expect(page.getByRole('status')).toContainText('Answer saved');
    await expect(page.locator('.exam-toolbar')).toHaveCSS('position', 'sticky');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: test.info().outputPath('exam-mobile.png'), fullPage: true });
    const attemptId = page.url().split('/').at(-1)!;
    const raw = await page.request.get(`/api/attempts/${attemptId}`); expect(JSON.stringify(await raw.json())).not.toContain('correct');
    await page.reload(); await expect(page.getByLabel('Email marketing', { exact: true })).toBeChecked();
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Submit exam', exact: true }).click(); await expect(page.getByText('100%', { exact: true })).toBeVisible(); await expect(page.getByText('PASSED', { exact: true })).toBeVisible();
    const duplicate = await page.request.post(`/api/attempts/${attemptId}/submit`, { headers: { Origin: 'http://localhost:3100' } }); expect((await duplicate.json()).score).toBe(100);
    await page.goto(`/exams/${exam.id}`); page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Start exam', exact: true }).click(); await expect(page).toHaveURL(/attempts\//);
    const secondId = page.url().split('/').at(-1)!; await db.examAttempt.update({ where: { id: secondId }, data: { deadline: new Date(Date.now() + 2000) } }); await page.reload();
    await expect(page.getByText('0%', { exact: true })).toBeVisible({ timeout: 20000 }); await expect(page.getByText('NOT PASSED', { exact: true })).toBeVisible();
    const limit = await page.request.post(`/api/exams/${exam.id}/start`, { headers: { Origin: 'http://localhost:3100' } }); expect(limit.status()).toBe(403);
  } finally { await db.studentAnswer.deleteMany({ where: { attempt: { examId: exam.id } } }); await db.examAttempt.deleteMany({ where: { examId: exam.id } }); await db.exam.delete({ where: { id: exam.id } }); }
});
