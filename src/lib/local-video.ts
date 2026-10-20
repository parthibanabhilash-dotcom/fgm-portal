import Busboy from 'busboy';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, unlink, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join, isAbsolute } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { HttpError } from './http';
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
// Runtime media lives on a persistent volume, not in Next's traced application bundle.
export function videoDirectory() {
  const configured = process.env.VIDEO_STORAGE_DIR;
  if (configured && !isAbsolute(configured)) throw new HttpError(500, 'VIDEO_STORAGE_DIR must be an absolute persistent directory.');
  return resolve(/*turbopackIgnore: true*/ configured || join(homedir(), '.lkp-academy', 'videos'));
}
export function videoPath(key: string) {
  if (!/^[a-f0-9-]{36}\.(mp4|webm)$/.test(key)) throw new HttpError(400, 'Invalid video file.');
  return join(videoDirectory(), key);
}
export async function removeVideoFile(key: string) {
  try { await unlink(videoPath(key)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Could not remove unused video file.', e); }
}
export function validateVideoHeader(name: string, mime: string, bytes: Buffer) {
  const mp4 = name.toLowerCase().endsWith('.mp4') && mime === 'video/mp4' && bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp';
  const webm = name.toLowerCase().endsWith('.webm') && mime === 'video/webm' && bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!mp4 && !webm) throw new HttpError(400, 'Choose an MP4 or WebM video with a matching file type and signature.');
}
export async function receiveVideo(req: Request, maxBytes = MAX_VIDEO_BYTES) {
  if (!req.body) throw new HttpError(400, 'Choose a video file.');
  if (Number(req.headers.get('content-length')) > maxBytes + 1024 * 1024) throw new HttpError(413, 'Video exceeds the upload size limit.');
  let parser: ReturnType<typeof Busboy>;
  try { parser = Busboy({ headers: { 'content-type': req.headers.get('content-type') ?? '' }, limits: { files: 1, fields: 0, fileSize: maxBytes + 1, headerPairs: 40 } }); }
  catch { throw new HttpError(400, 'Upload one video using multipart form data.'); }
  await mkdir(videoDirectory(), { recursive: true });
  let key = '', name = '', mime = '', size = 0;
  let upload: Promise<void> | undefined; let uploadError: unknown;
  let issue: HttpError | undefined;
  parser.on('filesLimit', () => { issue = new HttpError(400, 'Upload one video at a time.'); });
  parser.on('fieldsLimit', () => { issue = new HttpError(400, 'Only the video file field is accepted.'); });
  parser.on('file', (field, file, info) => {
    if (field !== 'file' || !info.filename || !['video/mp4', 'video/webm'].includes(info.mimeType) || !/\.(mp4|webm)$/i.test(info.filename)) {
      issue = new HttpError(400, 'Choose an MP4 or WebM video.'); file.resume(); return;
    }
    mime = info.mimeType;
    name = info.filename.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
    key = `${randomUUID()}.${mime === 'video/mp4' ? 'mp4' : 'webm'}`;
    const counter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      callback(size > maxBytes ? new HttpError(413, 'Video exceeds the upload size limit.') : null, chunk);
    } });
    file.on('limit', () => { issue = new HttpError(413, 'Video exceeds the upload size limit.'); });
    // Attach a rejection handler immediately so interrupted uploads cannot escape cleanup.
    upload = pipeline(file, counter, createWriteStream(videoPath(key), { flags: 'wx' })).catch(error => { uploadError = error; parser.destroy(error as Error); });
  });
  try {
    let requestBytes = 0;
    const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      requestBytes += chunk.length;
      callback(requestBytes > maxBytes + 1024 * 1024 ? new HttpError(413, 'Upload exceeds the size limit.') : null, chunk);
    } });
    const source = Readable.fromWeb(req.body as unknown as NodeReadableStream<Uint8Array>);
    await pipeline(source, limiter, parser);
    await upload;
    if (issue) throw issue;
    if (uploadError) throw uploadError;
    if (!key || !size) throw new HttpError(400, 'Choose a non-empty video file.');
    const handle = await open(videoPath(key), 'r');
    try { const header = Buffer.alloc(32); const read = await handle.read(header, 0, 32, 0); validateVideoHeader(name, mime, header.subarray(0, read.bytesRead)); }
    finally { await handle.close(); }
    return { key, name, mime, size };
  } catch (error) {
    parser.destroy(); await upload;
    if (key) await removeVideoFile(key);
    if (error instanceof HttpError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOSPC') throw new HttpError(507, 'Video storage is full. Free space and try again.');
    throw new HttpError(400, 'Video upload was interrupted or invalid. Please try again.');
  }
}
export function parseRange(value: string | null, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) throw new HttpError(416, 'Invalid video byte range.');
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? match[2] ? Math.min(Number(match[2]), size - 1) : size - 1 : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new HttpError(416, 'Video range is outside the file.');
  return { start, end };
}
export async function videoResponse(req: Request, asset: { key: string; mime: string; size: number }, head = false) {
  const path = videoPath(asset.key);
  try { const item = await stat(path); if (!item.isFile() || item.size !== asset.size) throw new Error('Invalid video file'); }
  catch { throw new HttpError(404, 'The stored video is missing. Ask your administrator to upload it again.'); }
  const headers: Record<string, string> = { 'Content-Type': asset.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  let range;
  try { range = parseRange(req.headers.get('range'), asset.size); }
  catch { return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${asset.size}` } }); }
  headers['Content-Length'] = String(range ? range.end - range.start + 1 : asset.size);
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${asset.size}`;
  if (head) return new Response(null, { status: range ? 206 : 200, headers });
  const stream = createReadStream(path, range || undefined);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
}
