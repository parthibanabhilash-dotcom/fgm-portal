import { LessonOutline } from '@/components/lesson-outline';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Circle, CheckCircle2, LockKeyhole } from 'lucide-react';
import { pageUser } from '@/lib/auth';
import { lessonAccess } from '@/lib/access';
import { HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { Heading, Progress, Empty } from '@/components/ui';
import { LessonWorkspace } from '@/components/lesson-workspace';
export default async function Learn({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const user = await pageUser(); const { courseId, lessonId } = await params;
  try { const access = await lessonAccess(user, lessonId); if (access.course.id !== courseId) notFound(); }
  catch (e) { if (e instanceof HttpError) return <Empty title={e.status === 403 ? 'Lesson unavailable' : 'Lesson not found'}>{e.message} <Link href={`/courses/${courseId}`} className="text-link">Back to course</Link></Empty>; throw e; }
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  const modules = await db.module.findMany({ where: { courseId }, orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, include: { progress: { where: { userId: user.id } } } } } });
  const lessons = modules.flatMap(m => m.lessons), index = lessons.findIndex(l => l.id === lessonId);
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { note: true, attachments: true, videoAsset: { select: { id: true } }, exams: { where: { published: true, archived: false }, select: { id: true, title: true } } } });
  const completed = lessons.filter(l => l.progress[0]?.completed).length;
  return <><Heading eyebrow={course.title} title={lesson.title} description={`Module ${modules.find(m => m.id === lesson.moduleId)?.position} · Lesson ${index + 1} of ${lessons.length}`} /><div className="learning-grid"><LessonOutline key={lessonId} completed={completed} total={lessons.length}><div><h3>Course content</h3><Progress completed={completed} total={lessons.length} /></div>{modules.map(m => <section key={m.id}><h3 className="module-label">{m.position}. {m.title}</h3>{m.lessons.map(l => { const done = l.progress[0]?.completed; const locked = user.role !== 'ADMIN' && course.sequential && lessons.slice(0, lessons.findIndex(x => x.id === l.id)).some(x => !x.progress[0]?.completed); const Icon = locked ? LockKeyhole : done ? CheckCircle2 : Circle; return locked ? <span className="lesson-link locked" key={l.id}><Icon size={15} />{l.title}</span> : <Link className={`lesson-link ${l.id === lessonId ? 'active' : ''}`} key={l.id} href={`/courses/${courseId}/learn/${l.id}`}><Icon size={15} style={{ flexShrink: 0 }} />{l.title}</Link>; })}</section>)}<div><Link className="text-link small" href={`/courses/${courseId}`}>← Course overview & final exams</Link></div></LessonOutline><LessonWorkspace key={lessonId} courseId={courseId} lesson={{ id: lesson.id, title: lesson.title, videoUrl: lesson.videoAsset ? `/api/videos/${lesson.id}` : lesson.videoUrl, markdown: lesson.note?.markdown ?? '', attachments: lesson.attachments.map(a => ({ id: a.id, name: a.name })), exams: lesson.exams, completed: lessons[index]?.progress[0]?.completed ?? false, position: lessons[index]?.progress[0]?.position ?? 0 }} previous={lessons[index - 1]?.id ?? null} next={lessons[index + 1]?.id ?? null} /></div></>;
}
