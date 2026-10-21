import { db } from './db';
export async function enrolledCourses(userId: string) {
  // Dashboard/course pages only need a compact course summary. Fetching notes,
  // video URLs, and a nested progress array for every lesson made these pages
  // increasingly slow as more training content was added.
  const enrollments = await db.enrollment.findMany({
    where: { userId, active: true, course: { status: 'PUBLISHED' } },
    select: { course: { select: { id: true, title: true, description: true, thumbnail: true, category: true, instructor: true } } }
  });
  const courseIds = enrollments.map(({ course }) => course.id);
  if (!courseIds.length) return [];
  const [modules, progress] = await Promise.all([
    db.module.findMany({
      where: { courseId: { in: courseIds } },
      select: { courseId: true, position: true, lessons: { select: { id: true, title: true, position: true }, orderBy: { position: 'asc' } } },
      orderBy: [{ courseId: 'asc' }, { position: 'asc' }]
    }),
    db.lessonProgress.findMany({
      where: { userId, lesson: { module: { courseId: { in: courseIds } } } },
      select: { lessonId: true, completed: true }
    })
  ]);
  const progressByLesson = new Map(progress.map(item => [item.lessonId, item.completed]));
  const lessonsByCourse = new Map<string, { id: string; title: string; position: number }[]>();
  for (const module of modules) lessonsByCourse.set(module.courseId, [...(lessonsByCourse.get(module.courseId) ?? []), ...module.lessons]);
  return enrollments.map(({ course }) => {
    const lessons = lessonsByCourse.get(course.id) ?? [];
    const completed = lessons.filter(lesson => progressByLesson.get(lesson.id)).length;
    return { course, lessons, completed, total: lessons.length, next: lessons.find(lesson => !progressByLesson.get(lesson.id)) ?? lessons[0] };
  });
}
