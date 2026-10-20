import { api, HttpError } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { lessonAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { videoResponse } from '@/lib/local-video';
export const runtime = 'nodejs';
async function serve(req: Request, lessonId: string, head: boolean) {
  let response: Response | undefined;
  const result = await api(async () => {
    const user = await requireUser(); await lessonAccess(user, lessonId);
    const asset = await db.videoAsset.findUnique({ where: { lessonId } });
    if (!asset) throw new HttpError(404, 'No video has been uploaded for this lesson.');
    response = await videoResponse(req, asset, head); return {};
  });
  return response || result;
}
export async function GET(req: Request, { params }: { params: Promise<{ lessonId: string }> }) { return serve(req, (await params).lessonId, false); }
export async function HEAD(req: Request, { params }: { params: Promise<{ lessonId: string }> }) { return serve(req, (await params).lessonId, true); }
