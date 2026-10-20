import { z } from 'zod';
import { api } from '@/lib/http';
import { assertOrigin, requireUser } from '@/lib/auth';
import { readAttempt, saveAnswer } from '@/lib/exams';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => readAttempt(await requireUser(), (await params).id));
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    await assertOrigin(); const user = await requireUser();
    const data = z.object({ questionId: z.string().min(1).max(100), choiceId: z.string().min(1).max(100) }).strict().parse(await req.json());
    return saveAnswer(user, (await params).id, data.questionId, data.choiceId);
  });
}
