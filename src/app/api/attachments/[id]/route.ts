import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { lessonAccess } from '@/lib/access';
import { api, HttpError } from '@/lib/http';
import { db } from '@/lib/db';
import { downloadUrl } from '@/lib/storage';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let url = '';
  const result = await api(async () => {
    const user = await requireUser(); const item = await db.attachment.findUnique({ where: { id: (await params).id } });
    if (!item) throw new HttpError(404, 'Document not found.');
    await lessonAccess(user, item.lessonId); url = await downloadUrl(item.key, item.name); return {};
  });
  return url ? NextResponse.redirect(url, { headers: { 'Cache-Control': 'no-store' } }) : result;
}
