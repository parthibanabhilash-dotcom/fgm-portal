import { notFound } from 'next/navigation';
import Link from 'next/link';
import { pageUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { Heading, Progress, Empty } from '@/components/ui';
export default async function Course({ params }: { params: Promise<{ courseId: string }> }) {
  const user = await pageUser(); const { courseId } = await params;
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || (course.status !== 'PUBLISHED' && user.role !== 'ADMIN')) notFound();
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
  if (!enrollment?.active && user.role !== 'ADMIN') return <><Heading eyebrow={course.category} title={course.title} description={`With ${course.instructor}`} /><div className="panel"><p>{course.description}</p></div><Empty title="Not assigned">Contact your training administrator for a course assignment. Lessons, notes, and exams become available once assigned.</Empty></>;
  const modules = await db.module.findMany({ where: { courseId }, orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, include: { progress: { where: { userId: user.id } } } } } });
  const lessons = modules.flatMap(m => m.lessons), completed = lessons.filter(l => l.progress[0]?.completed).length;
  const exams = await db.exam.findMany({ where: { courseId, lessonId: null, published: true, archived: false }, select: { id: true, title: true } });
  const next = lessons.find(l => !l.progress[0]?.completed) ?? lessons[0];
  return <><Heading eyebrow={course.category} title={course.title} description={`With ${course.instructor}`}>{next && <Link className="button" href={`/courses/${courseId}/learn/${next.id}`}>Continue training →</Link>}</Heading><div className="panel"><p className="muted" style={{ marginBottom: 20 }}>{course.description}</p><Progress completed={completed} total={lessons.length} />{course.sequential && <p className="muted small" style={{ marginTop: 12 }}>Complete lessons in order to unlock the next one.</p>}</div>{modules.map(m => <section className="panel" key={m.id}><p className="eyebrow">MODULE {m.position}</p><h2>{m.title}</h2>{m.lessons.map(l => { const locked = course.sequential && lessons.slice(0, lessons.findIndex(x => x.id === l.id)).some(x => !x.progress[0]?.completed); return <div key={l.id} className="record-item">{locked ? <span className="muted">🔒 {l.title}</span> : <Link className="text-link" href={`/courses/${courseId}/learn/${l.id}`}>{l.progress[0]?.completed ? '✓ ' : '○ '}{l.title} →</Link>}</div>; })}</section>)}{exams.length > 0 && <section className="panel"><h2>Final course exams</h2>{exams.map(e => <div key={e.id} className="record-item"><Link className="text-link" href={`/exams/${e.id}`}>{e.title} →</Link></div>)}</section>}</>;
}
