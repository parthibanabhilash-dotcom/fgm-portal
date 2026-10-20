import { z } from 'zod';
import { api } from '@/lib/http';
import { assertOrigin, requireUser } from '@/lib/auth';
import { lessonAccess } from '@/lib/access';
import { db } from '@/lib/db';
export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  return api(async () => {
    await assertOrigin(); const user = await requireUser(); const { lessonId } = await params;
    await lessonAccess(user, lessonId);
    const data = z.object({ completed: z.boolean().optional(), position: z.number().finite().min(0).max(604800).optional() }).strict().parse(await req.json());
    const result = await db.lessonProgress.upsert({ where: { userId_lessonId: { userId: user.id, lessonId } }, create: { userId: user.id, lessonId, ...data }, update: data });
    return { completed: result.completed, position: result.position };
  });
}
