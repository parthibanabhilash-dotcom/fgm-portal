import type { User } from '@prisma/client';
import { db } from './db';
import { HttpError } from './http';
export async function courseAccess(user: User, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found.');
  if (user.role === 'ADMIN') return course;
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
  if (!enrollment?.active || course.status !== 'PUBLISHED') throw new HttpError(403, 'You are not enrolled in an available course. Contact your administrator.');
  return course;
}
export async function lessonAccess(user: User, lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson) throw new HttpError(404, 'Lesson not found.');
  const course = await courseAccess(user, lesson.module.courseId);
  if (course.sequential && user.role !== 'ADMIN') {
    const previous = await db.lesson.findMany({ where: { module: { courseId: course.id }, OR: [
      { module: { position: { lt: lesson.module.position } } },
      { moduleId: lesson.moduleId, position: { lt: lesson.position } }
    ] }, include: { progress: { where: { userId: user.id, completed: true } } } });
    if (previous.some(l => l.progress.length === 0)) throw new HttpError(403, 'Complete the preceding lessons first.');
  }
  return { lesson, course };
}
