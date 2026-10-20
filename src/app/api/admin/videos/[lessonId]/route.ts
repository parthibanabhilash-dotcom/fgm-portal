import { revalidatePath } from 'next/cache';
import { api } from '@/lib/http';
import { assertOrigin, requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { receiveVideo, removeVideoFile } from '@/lib/local-video';
export const runtime = 'nodejs';
export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  return api(async () => {
    await assertOrigin(); await requireAdmin(); const { lessonId } = await params;
    await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    const stored = await receiveVideo(req);
    let previousKey: string | undefined;
    try {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Lesson" WHERE "id" = ${lessonId} FOR UPDATE`;
        previousKey = (await tx.videoAsset.findUnique({ where: { lessonId } }))?.key;
        await tx.videoAsset.upsert({ where: { lessonId }, create: { lessonId, ...stored }, update: stored });
      });
    } catch (e) { await removeVideoFile(stored.key); throw e; }
    if (previousKey) await removeVideoFile(previousKey);
    revalidatePath('/', 'layout');
    return { success: true, name: stored.name, size: stored.size };
  });
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  return api(async () => {
    await assertOrigin(); await requireAdmin(); const { lessonId } = await params;
    const item = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Lesson" WHERE "id" = ${lessonId} FOR UPDATE`;
      const asset = await tx.videoAsset.findUnique({ where: { lessonId } });
      if (asset) await tx.videoAsset.delete({ where: { lessonId } });
      return asset;
    });
    if (item) await removeVideoFile(item.key);
    revalidatePath('/', 'layout'); return { success: true };
  });
}
