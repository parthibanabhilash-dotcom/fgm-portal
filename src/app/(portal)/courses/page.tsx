import { pageUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { enrolledCourses } from '@/lib/student';
import { Heading, CourseCard, Empty } from '@/components/ui';
export default async function Courses() {
  const user = await pageUser(); const enrolled = await enrolledCourses(user.id);
  const courses = await db.course.findMany({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'asc' } });
  return <><Heading eyebrow="INTERN TRAINING" title="Your training courses" description="Browse company training courses. Your training administrator manages course assignments." />{courses.length ? <div className="courses-grid wide">{courses.map(course => { const e = enrolled.find(e => e.course.id === course.id); return <CourseCard key={course.id} course={course} completed={e?.completed} total={e?.total} enrolled={!!e} href={`/courses/${course.id}`} />; })}</div> : <Empty title="Courses are coming soon">Check back after your administrator publishes a course.</Empty>}</>;
}
