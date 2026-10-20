import Link from 'next/link';
import { pageUser } from '@/lib/auth';
import { examAccess } from '@/lib/exams';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { Heading, Empty, formatDate } from '@/components/ui';
import { StartExam } from '@/components/exam-client';
import type { Snapshot } from '@/lib/exam-core';
export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const user = await pageUser(); const { examId } = await params;
  let exam;
  try { exam = await examAccess(user, examId); } catch (e) { if (e instanceof HttpError) return <Empty title="Exam unavailable">{e.message}</Empty>; throw e; }
  const attempts = await db.examAttempt.findMany({ where: { userId: user.id, examId }, orderBy: { startedAt: 'desc' } });
  const count = await db.question.count({ where: { examId } });
  const now = new Date(), active = attempts.find(a => a.status === 'ACTIVE');
  const unavailable = !exam.published || exam.archived || user.role !== 'STUDENT' || (exam.availableFrom && now < exam.availableFrom) || (exam.availableUntil && now >= exam.availableUntil) || attempts.length >= exam.maxAttempts;
  return <><Heading eyebrow="EXAM & ASSESSMENT" title={exam.title} description="Take a moment to review the instructions before you begin." /><section className="panel"><div className="form-grid"><p><strong>{exam.durationMinutes} minutes</strong><br /><span className="muted small">Timed assessment</span></p><p><strong>{exam.passPercentage}% to pass</strong><br /><span className="muted small">{count} single-answer MCQs</span></p><p><strong>{attempts.length} / {exam.maxAttempts} attempts used</strong></p><p className="muted small">Opens: {formatDate(exam.availableFrom)}<br />Closes: {formatDate(exam.availableUntil)}</p></div><h3 style={{ marginTop: 24 }}>Before you start</h3><p style={{ whiteSpace: 'pre-wrap', marginBottom: 20 }}>{exam.instructions}</p><p className="notice" style={{ marginBottom: 20 }}>Your answers save as you select them. Refreshing does not reset the timer. The exam submits automatically at its server deadline. Review policy: {exam.release === 'IMMEDIATE' ? 'correct answers after submission' : exam.release === 'AFTER_CLOSE' ? 'correct answers after the closing date' : 'correct answers are not released'}.</p><StartExam examId={examId} activeId={active?.id} disabled={!active && !!unavailable} /></section><section className="panel"><h2>Your attempt history</h2>{attempts.length ? <div className="table-wrap"><table className="mobile-records"><thead><tr><th>Exam</th><th>Started</th><th>Status</th><th>Score</th><th>Action</th></tr></thead><tbody>{attempts.map(a => <tr key={a.id}><td data-label="Exam">{(a.snapshot as Snapshot).title}</td><td data-label="Started">{formatDate(a.startedAt)}</td><td data-label="Status">{a.status === 'ACTIVE' ? a.deadline <= now ? 'Time expired' : 'In progress' : a.passed ? 'Passed' : 'Not passed'}</td><td data-label="Score">{a.score === null ? '—' : `${a.score}%`}</td><td data-label="Action"><Link href={`/attempts/${a.id}`}>{a.status === 'ACTIVE' ? 'Open attempt' : 'View result'} →</Link></td></tr>)}</tbody></table></div> : <Empty title="No attempts yet">Your attempt history will appear here.</Empty>}</section></>;
}
