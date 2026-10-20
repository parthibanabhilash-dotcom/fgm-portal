import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Heading, Empty, formatDate } from '@/components/ui';
import type { Snapshot } from '@/lib/exam-core';
export default async function AdminResults() {
  await requireAdmin(); const attempts = await db.examAttempt.findMany({ orderBy: { startedAt: 'desc' }, include: { user: { select: { name: true, id: true } } } });
  return <><Heading eyebrow="ASSESSMENT REPORTING" title="Exam results" description="Historical results use the exact exam content seen by each intern."><a className="button" href="/api/admin/results">Download CSV ↓</a></Heading><section className="panel">{attempts.length ? <div className="table-wrap"><table><thead><tr><th>Intern</th><th>Exam</th><th>Started</th><th>Deadline</th><th>Status</th><th>Score</th><th>Result</th></tr></thead><tbody>{attempts.map(a => <tr key={a.id}><td><Link href={`/admin/students/${a.user.id}`}>{a.user.name}</Link></td><td>{(a.snapshot as Snapshot).title}</td><td>{formatDate(a.startedAt)}</td><td>{formatDate(a.deadline)}</td><td>{a.status}</td><td>{a.score === null ? '—' : `${a.score}%`}</td><td>{a.passed === null ? '—' : <span className={`badge ${a.passed ? 'green' : 'gray'}`}>{a.passed ? 'PASS' : 'FAIL'}</span>}</td></tr>)}</tbody></table></div> : <Empty title="No exam results yet">Results appear here when interns start assessments.</Empty>}</section></>;
}
