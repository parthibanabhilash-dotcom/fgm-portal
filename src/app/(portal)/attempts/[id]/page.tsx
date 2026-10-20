import { pageUser } from '@/lib/auth';
import { readAttempt } from '@/lib/exams';
import { HttpError } from '@/lib/http';
import { Heading, Empty } from '@/components/ui';
import { ExamClient } from '@/components/exam-client';
export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser(); let attempt;
  try { attempt = await readAttempt(user, (await params).id); } catch (e) { if (e instanceof HttpError) return <Empty title="Attempt unavailable">{e.message}</Empty>; throw e; }
  return <><Heading eyebrow={attempt.status === 'ACTIVE' ? 'ASSESSMENT IN PROGRESS' : 'YOUR EXAM RESULT'} title={attempt.title} /><ExamClient initial={attempt} /></>;
}
