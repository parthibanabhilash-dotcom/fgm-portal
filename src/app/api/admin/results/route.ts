import { requireAdmin } from '@/lib/auth';
import { api } from '@/lib/http';
import { db } from '@/lib/db';
import { csvCell, type Snapshot } from '@/lib/exam-core';
export async function GET() {
  const auth = await api(async () => { await requireAdmin(); return {}; });
  if (!auth.ok) return auth;
  const attempts = await db.examAttempt.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { startedAt: 'desc' } });
  const rows = [['Intern', 'Email', 'Exam', 'Status', 'Score %', 'Passed', 'Started (UTC)', 'Submitted (UTC)'], ...attempts.map(a => [a.user.name, a.user.email, (a.snapshot as Snapshot).title, a.status, a.score, a.passed, a.startedAt.toISOString(), a.submittedAt?.toISOString()])];
  return new Response('\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="lkp-exam-results.csv"', 'Cache-Control': 'no-store' } });
}
