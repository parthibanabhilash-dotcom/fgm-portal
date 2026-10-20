import { db } from './db';
export async function enrolledCourses(userId: string) {
  const items = await db.enrollment.findMany({ where: { userId, active: true, course: { status: 'PUBLISHED' } }, include: { course: { include: { modules: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, include: { progress: { where: { userId } } } } } } } } } });
  return items.map(e => {
    const lessons = e.course.modules.flatMap(m => m.lessons);
    const completed = lessons.filter(l => l.progress[0]?.completed).length;
    return { course: e.course, lessons, completed, total: lessons.length, next: lessons.find(l => !l.progress[0]?.completed) ?? lessons[0] };
  });
}
