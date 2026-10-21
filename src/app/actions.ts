'use server';
import { z, ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { assertOrigin, bootstrapAdminOnFirstLogin, consumeRateLimit, createSession, hashToken, requireAdmin, requireUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { courseSchema, email, examSchema, httpsUrl, password, text } from '@/lib/validation';
import { uploadPdf } from '@/lib/storage';
export type ActionState = { error?: string; success?: string };
const value = (f: FormData, key: string) => String(f.get(key) ?? '');
const checked = (f: FormData, key: string) => f.get(key) === 'on';
function message(e: unknown): ActionState {
  if (e instanceof ZodError) return { error: e.issues.map(i => i.message).join('; ') };
  if (e instanceof HttpError) return { error: e.message };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { error: 'This record already exists.' };
  if (e instanceof Prisma.PrismaClientInitializationError || (e instanceof Prisma.PrismaClientKnownRequestError && ['P1001', 'P2021'].includes(e.code))) return { error: 'Training database is not ready. Please contact the administrator.' };
  console.error(e); return { error: 'Unable to save. Please check your input and try again.' };
}
export async function loginAction(_: ActionState, f: FormData): Promise<ActionState> {
  let destination = '/dashboard';
  try {
    await assertOrigin();
    const address = email.parse(value(f, 'email'));
    await consumeRateLimit(`login:${address}`);
    const supplied = z.string().min(1).max(256).parse(value(f, 'password'));
    const user = await db.user.findUnique({ where: { email: address } }) ?? await bootstrapAdminOnFirstLogin(address, supplied);
    const match = await bcrypt.compare(supplied, user?.passwordHash ?? '$2b$12$Gz0W5jDrmxg3uG.QCj.EuehFUrMB3YL5u55LqFjmST3QRUtDyqh8a');
    if (!user?.active || !match) throw new HttpError(401, 'Invalid email or password.');
    await createSession(user.id);
    destination = user.role === 'ADMIN' ? '/admin' : '/dashboard';
  } catch (e) { return message(e); }
  redirect(destination);
}
export async function registerAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await assertOrigin();
    const parsed = z.object({ email, name: text(100), password }).parse(Object.fromEntries(f));
    await consumeRateLimit('register:global', 100);
    await consumeRateLimit(`register:${parsed.email}`, 4);
    const user = await db.user.create({ data: { email: parsed.email, name: parsed.name, passwordHash: await bcrypt.hash(parsed.password, 12), role: 'STUDENT' } });
    await createSession(user.id);
  } catch (e) { return message(e); }
  redirect('/dashboard');
}
export async function logoutAction() {
  await assertOrigin();
  const jar = await cookies(); const token = jar.get('lkp_session')?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete('lkp_session'); redirect('/login');
}
export async function profileAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    await assertOrigin(); const user = await requireUser();
    const name = text(100).parse(value(f, 'name'));
    const nextPassword = value(f, 'newPassword');
    let passwordHash: string | undefined;
    if (nextPassword) {
      await consumeRateLimit(`password:${user.id}`, 8);
      if (!await bcrypt.compare(value(f, 'currentPassword'), user.passwordHash)) throw new HttpError(400, 'Current password is incorrect.');
      passwordHash = await bcrypt.hash(password.parse(nextPassword), 12);
    }
    await db.user.update({ where: { id: user.id }, data: { name, ...(passwordHash ? { passwordHash } : {}) } });
    if (passwordHash) { await db.session.deleteMany({ where: { userId: user.id } }); await createSession(user.id); }
    revalidatePath('/', 'layout'); return { success: 'Profile updated.' };
  } catch (e) { return message(e); }
}
async function reorder(kind: 'module' | 'lesson', id: string, direction: string) {
  await db.$transaction(async tx => {
    // Serialize reorders with a transaction-scoped advisory lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273)`;
    if (kind === 'module') {
      const item = await tx.module.findUniqueOrThrow({ where: { id } });
      const items = await tx.module.findMany({ where: { courseId: item.courseId }, orderBy: { position: 'asc' } });
      const other = items[items.findIndex(i => i.id === id) + (direction === 'up' ? -1 : 1)];
      if (!other) return;
      await tx.module.update({ where: { id }, data: { position: Math.max(...items.map(i => i.position)) + 100 } });
      await tx.module.update({ where: { id: other.id }, data: { position: item.position } });
      await tx.module.update({ where: { id }, data: { position: other.position } });
    } else {
      const item = await tx.lesson.findUniqueOrThrow({ where: { id } });
      const items = await tx.lesson.findMany({ where: { moduleId: item.moduleId }, orderBy: { position: 'asc' } });
      const other = items[items.findIndex(i => i.id === id) + (direction === 'up' ? -1 : 1)];
      if (!other) return;
      await tx.lesson.update({ where: { id }, data: { position: Math.max(...items.map(i => i.position)) + 100 } });
      await tx.lesson.update({ where: { id: other.id }, data: { position: item.position } });
      await tx.lesson.update({ where: { id }, data: { position: other.position } });
    }
  });
}
export async function adminAction(_: ActionState, f: FormData): Promise<ActionState> {
  let destination: string | undefined;
  try {
    await assertOrigin(); const admin = await requireAdmin();
    const op = value(f, 'op'), id = value(f, 'id');
    switch (op) {
      case 'course': {
        const data = courseSchema.parse({ ...Object.fromEntries(f), sequential: checked(f, 'sequential') });
        if (data.status === 'ARCHIVED' && !checked(f, 'confirm')) throw new HttpError(400, 'Confirm course archival.');
        const c = id ? await db.course.update({ where: { id }, data }) : await db.course.create({ data });
        if (!id) destination = `/admin/courses/${c.id}`;
        break;
      }
      case 'deleteCourse': {
        if (!checked(f, 'confirm')) throw new HttpError(400, 'Confirm course deletion.');
        await db.course.update({ where: { id }, data: { status: 'ARCHIVED' } });
        destination = '/admin/courses';
        break;
      }
      case 'deleteExam': {
        if (!checked(f, 'confirm')) throw new HttpError(400, 'Confirm exam deletion.');
        await db.exam.update({ where: { id }, data: { archived: true, published: false } });
        break;
      }
      case 'restoreExam': {
        await db.exam.update({ where: { id }, data: { archived: false, published: false } });
        break;
      }
      case 'module': {
        const title = text().parse(value(f, 'title'));
        if (id) await db.module.update({ where: { id }, data: { title } });
        else await db.$transaction(async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273)`;
          const courseId = value(f, 'courseId');
          const max = await tx.module.aggregate({ where: { courseId }, _max: { position: true } });
          await tx.module.create({ data: { courseId, title, position: (max._max.position ?? 0) + 1 } });
        });
        break;
      }
      case 'lesson': {
        const title = text().parse(value(f, 'title')), videoUrl = httpsUrl.parse(value(f, 'videoUrl')) || null;
        const markdown = z.string().max(100000).parse(value(f, 'markdown'));
        if (id) await db.lesson.update({ where: { id }, data: { title, videoUrl, note: { upsert: { create: { markdown }, update: { markdown } } } } });
        else await db.$transaction(async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273)`;
          const moduleId = value(f, 'moduleId');
          const max = await tx.lesson.aggregate({ where: { moduleId }, _max: { position: true } });
          await tx.lesson.create({ data: { moduleId, title, videoUrl, position: (max._max.position ?? 0) + 1, note: { create: { markdown } } } });
        });
        break;
      }
      case 'reorder': await reorder(z.enum(['module', 'lesson']).parse(value(f, 'kind')), id, z.enum(['up', 'down']).parse(value(f, 'direction'))); break;
      case 'attachment': {
        await db.lesson.findUniqueOrThrow({ where: { id } });
        const file = f.get('file'); if (!(file instanceof File) || !file.size) throw new HttpError(400, 'Choose a PDF file.');
        const stored = await uploadPdf(file); await db.attachment.create({ data: { lessonId: id, ...stored } }); break;
      }
      case 'enrollment': {
        const userId = value(f, 'userId'), courseId = value(f, 'courseId');
        const student = await db.user.findUniqueOrThrow({ where: { id: userId } });
        if (student.role !== 'STUDENT') throw new HttpError(400, 'Select an intern.');
        const active = checked(f, 'active');
        if (!active && !checked(f, 'confirm')) throw new HttpError(400, 'Confirm enrollment revocation.');
        await db.enrollment.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId, active }, update: { active } }); break;
      }
      case 'student': {
        if (id === admin.id) throw new HttpError(400, 'You cannot deactivate your own account.');
        const active = checked(f, 'active');
        if (!active && !checked(f, 'confirm')) throw new HttpError(400, 'Confirm account deactivation.');
        const student = await db.user.findUniqueOrThrow({ where: { id } });
        if (student.role !== 'STUDENT') throw new HttpError(400, 'Only intern accounts can be managed here.');
        await db.user.update({ where: { id }, data: { active } });
        if (!active) await db.session.deleteMany({ where: { userId: id } }); break;
      }
      case 'exam': {
        const date = (key: string) => value(f, key) ? new Date(value(f, key) + 'Z') : null;
        const data = examSchema.parse({ ...Object.fromEntries(f), availableFrom: date('availableFrom'), availableUntil: date('availableUntil'), randomize: checked(f, 'randomize'), published: checked(f, 'published') });
        const courseId = value(f, 'courseId'), lessonId = value(f, 'lessonId') || null;
        if (lessonId) {
          const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { module: true } });
          if (lesson.module.courseId !== courseId) throw new HttpError(400, 'Lesson must belong to this course.');
        }
        const exam = await db.$transaction(async tx => {
          if (id) await tx.$queryRaw`SELECT "id" FROM "Exam" WHERE "id" = ${id} FOR UPDATE`;
          if (id && data.published) {
            const questions = await tx.question.findMany({ where: { examId: id }, include: { choices: true } });
            if (!questions.length || questions.some(q => q.choices.length < 2 || q.choices.filter(c => c.correct).length !== 1)) throw new HttpError(400, 'Add valid questions before publishing.');
          }
          if (!id && data.published) throw new HttpError(400, 'Create the exam as a draft, then add questions before publishing.');
          return id ? tx.exam.update({ where: { id }, data: { ...data, lessonId } }) : tx.exam.create({ data: { ...data, courseId, lessonId } });
        });
        if (!id) destination = `/admin/courses/${exam.courseId}#exam-${exam.id}`; break;
      }
      case 'archiveExam': {
        if (!checked(f, 'confirm')) throw new HttpError(400, 'Confirm exam archival.');
        await db.exam.update({ where: { id }, data: { archived: true, published: false } }); break;
      }
      case 'question': {
        const examId = value(f, 'examId');
        const qtext = text(10000).parse(value(f, 'text'));
        const marks = z.coerce.number().int().min(1).max(1000).parse(value(f, 'marks'));
        const choices = value(f, 'choices').split('\n').map(c => c.trim()).filter(Boolean);
        z.array(text(2000)).min(2).max(8).parse(choices);
        const correct = z.coerce.number().int().min(1).max(choices.length).parse(value(f, 'correct')) - 1;
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT "id" FROM "Exam" WHERE "id" = ${examId} FOR UPDATE`;
          const max = await tx.question.aggregate({ where: { examId }, _max: { position: true } });
          if (id) {
            const old = await tx.question.findUniqueOrThrow({ where: { id } });
            if (old.examId !== examId) throw new HttpError(400, 'Question does not belong to this exam.');
            await tx.choice.deleteMany({ where: { questionId: id } });
            await tx.question.update({ where: { id }, data: { text: qtext, marks, choices: { create: choices.map((c, i) => ({ text: c, position: i + 1, correct: i === correct })) } } });
          } else await tx.question.create({ data: { examId, text: qtext, marks, position: (max._max.position ?? 0) + 1, choices: { create: choices.map((c, i) => ({ text: c, position: i + 1, correct: i === correct })) } } });
        }); break;
      }
      case 'deleteQuestion': {
        if (!checked(f, 'confirm')) throw new HttpError(400, 'Confirm question removal.');
        await db.$transaction(async tx => {
          const q = await tx.question.findUniqueOrThrow({ where: { id } });
          await tx.$queryRaw`SELECT "id" FROM "Exam" WHERE "id" = ${q.examId} FOR UPDATE`;
          await tx.question.delete({ where: { id } });
          await tx.exam.update({ where: { id: q.examId }, data: { published: false } });
        }); break;
      }
      default: throw new HttpError(400, 'Unknown operation.');
    }
    revalidatePath('/', 'layout');
  } catch (e) { return message(e); }
  if (destination) redirect(destination);
  return { success: 'Changes saved.' };
}
