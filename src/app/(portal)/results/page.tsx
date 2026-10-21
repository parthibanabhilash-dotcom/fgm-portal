import Link from 'next/link';
import { pageUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { enrolledCourses } from '@/lib/student';
import { Heading, Empty, formatDate } from '@/components/ui';
import type { Snapshot } from '@/lib/exam-core';
export default async function Results() {
  const user = await pageUser(); const courses = await enrolledCourses(user.id); const ids = courses.map(c => c.course.id);
  const exams = await db.exam.findMany({ where: { courseId: { in: ids }, published: true, archived: false }, select: { id: true, title: true, durationMinutes: true, maxAttempts: true } });
  const attempts = await db.examAttempt.findMany({ where: { userId: user.id, exam: { courseId: { in: ids } } }, orderBy: { startedAt: 'desc' }, select: { id: true, snapshot: true, startedAt: true, status: true, score: true, passed: true } });
  return <><Heading eyebrow="CHECK YOUR PROGRESS" title="Exams & results" description="Put your knowledge into practice and see how far you’ve come." /><section className="panel"><h2>Course assessments</h2>{exams.length ? exams.map(e => <div className="record-item" key={e.id}><Link className="text-link" href={`/exams/${e.id}`}>{e.title} →</Link><p>{e.durationMinutes} minutes · Up to {e.maxAttempts} attempts</p></div>) : <Empty title="No exams available">Exams appear when your administrator publishes them.</Empty>}</section><section className="panel"><h2>Attempt history</h2>{attempts.length ? <div className="table-wrap"><table className="mobile-records"><thead><tr><th>Exam</th><th>Date</th><th>Status</th><th>Score</th><th>Details</th></tr></thead><tbody>{attempts.map(a => <tr key={a.id}><td data-label="Exam">{(a.snapshot as Snapshot).title}</td><td data-label="Date">{formatDate(a.startedAt)}</td><td data-label="Status">{a.status === 'ACTIVE' ? 'In progress / awaiting expiry' : a.passed ? 'Passed' : 'Not passed'}</td><td data-label="Score">{a.score === null ? '—' : `${a.score}%`}</td><td data-label="Details"><Link href={`/attempts/${a.id}`}>View →</Link></td></tr>)}</tbody></table></div> : <Empty title="Your results start here">Complete your first assessment to see your results.</Empty>}</section></>;
}
