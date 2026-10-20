import { api } from '@/lib/http';
import { assertOrigin, requireUser } from '@/lib/auth';
import { submitAttempt } from '@/lib/exams';
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => { await assertOrigin(); return submitAttempt(await requireUser(), (await params).id); });
}
