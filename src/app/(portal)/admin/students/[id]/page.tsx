import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminAction } from '@/app/actions';
import { ActionForm, Check, Hidden } from '@/components/forms';
import { Heading, Progress, formatDate } from '@/components/ui';
import { examMarks, type Snapshot } from '@/lib/exam-core';
export default async function Student({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); const { id } = await params;
  const s = await db.user.findUnique({ where: { id }, include: { enrollments: true, progress: true, attempts: { orderBy: { startedAt: 'desc' }, include: { answers: { select: { questionId: true, choiceId: true } } } } } });
  if (!s || s.role !== 'STUDENT') notFound();
  const courses = await db.course.findMany({ orderBy: { title: 'asc' }, include: { modules: { include: { lessons: { select: { id: true, title: true } } } } } });
  return <><Heading eyebrow="INTERN RECORD" title={s.name} description={s.email} /><section className="panel"><h2>Account access</h2><ActionForm action={adminAction} button="Update account status" confirm="Apply this account access change?"><Hidden name="op" value="student" /><Hidden name="id" value={id} /><Check label="Account is active" name="active" checked={s.active} /><Check label="I confirm deactivation if clearing the active checkbox." name="confirm" /></ActionForm></section><section className="panel"><h2>Training assignments & progress</h2>{courses.map(c => {
    const enrolled = s.enrollments.find(e => e.courseId === c.id)?.active ?? false;
    const lessons = c.modules.flatMap(m => m.lessons); const done = lessons.filter(l => s.progress.some(p => p.lessonId === l.id && p.completed)).length;
    return <details key={c.id} className="details"><summary>{c.title} <span className={`badge ${enrolled ? 'green' : 'gray'}`}>{enrolled ? 'ASSIGNED' : 'NOT ASSIGNED'}</span></summary><Progress completed={done} total={lessons.length} /><div style={{ margin: '20px 0' }}><ActionForm action={adminAction} button="Update assignment" confirm="Apply this enrollment change?"><Hidden name="op" value="enrollment" /><Hidden name="userId" value={id} /><Hidden name="courseId" value={c.id} /><Check label="Course is assigned to intern" name="active" checked={enrolled} /><Check label="I confirm revocation if clearing the enrolled checkbox." name="confirm" /></ActionForm></div>{lessons.map(l => { const p = s.progress.find(p => p.lessonId === l.id); return <p className="small record-item" key={l.id}>{p?.completed ? '✓' : '○'} {l.title} · Position: {Math.floor(p?.position ?? 0)}s</p>; })}</details>;
  })}</section><section className="panel"><h2>Exam records</h2><div className="table-wrap"><table><thead><tr><th>Exam</th><th>Date</th><th>Status</th><th>Marks</th><th>Score (%)</th><th>Pass / fail</th></tr></thead><tbody>{s.attempts.map(a => { const marks = a.score === null ? null : examMarks(a.snapshot as Snapshot, a.answers); return <tr key={a.id}><td>{(a.snapshot as Snapshot).title}</td><td>{formatDate(a.startedAt)}</td><td>{a.status}</td><td>{marks ? `${marks.earned} / ${marks.total}` : "Pending"}</td><td>{a.score === null ? '—' : `${a.score}%`}</td><td>{a.passed === null ? '—' : a.passed ? 'Pass' : 'Fail'}</td></tr>; })}</tbody></table></div></section></>;
}
