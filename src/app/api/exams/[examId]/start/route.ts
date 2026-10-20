import { api } from '@/lib/http';
import { assertOrigin, requireUser } from '@/lib/auth';
import { startAttempt } from '@/lib/exams';
export async function POST(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  return api(async () => { await assertOrigin(); return startAttempt(await requireUser(), (await params).examId); });
}
