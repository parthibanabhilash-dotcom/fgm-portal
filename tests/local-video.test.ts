import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRange, receiveVideo, removeVideoFile, validateVideoHeader, videoPath, videoResponse } from '../src/lib/local-video';
test('byte ranges support seeking and reject malformed/out-of-bounds requests', () => {
  assert.deepEqual(parseRange('bytes=5-9', 20), { start: 5, end: 9 });
  assert.deepEqual(parseRange('bytes=15-', 20), { start: 15, end: 19 });
  assert.deepEqual(parseRange('bytes=-4', 20), { start: 16, end: 19 });
  assert.deepEqual(parseRange('bytes=0-999', 20), { start: 0, end: 19 });
  for (const invalid of ['bytes=20-', 'bytes=9-5', 'bytes=0-3,8-9', 'bytes=-0', 'bytes=-', 'something']) assert.throws(() => parseRange(invalid, 20));
  assert.throws(() => videoPath('../private.txt'));
});
test('video types require matching extension, MIME and signature', () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(12)]);
  validateVideoHeader('lesson.mp4', 'video/mp4', mp4);
  validateVideoHeader('lesson.webm', 'video/webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  assert.throws(() => validateVideoHeader('lesson.mp4', 'video/webm', mp4));
  assert.throws(() => validateVideoHeader('lesson.mp4', 'video/mp4', Buffer.from('<script>')));
});
test('streamed upload, byte serving, HEAD, removal and failed-upload cleanup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lkp-video-test-'));
  const original = process.env.VIDEO_STORAGE_DIR; process.env.VIDEO_STORAGE_DIR = directory;
  const bytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(52)]);
  const request = (body: Buffer, filename = 'sample.mp4') => {
    const data = new FormData(); data.append('file', new Blob([new Uint8Array(body)], { type: 'video/mp4' }), filename);
    return new Request('http://localhost/upload', { method: 'POST', body: data });
  };
  try {
    const asset = await receiveVideo(request(bytes)); assert.equal(asset.size, bytes.length);
    const full = await videoResponse(new Request('http://localhost/video'), asset); assert.equal(full.status, 200); assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    const partial = await videoResponse(new Request('http://localhost/video', { headers: { Range: 'bytes=4-7' } }), asset); assert.equal(partial.status, 206); assert.equal(await partial.text(), 'ftyp');
    const head = await videoResponse(new Request('http://localhost/video'), asset, true); assert.equal(head.headers.get('content-length'), String(bytes.length)); assert.equal(await head.text(), '');
    assert.equal((await videoResponse(new Request('http://localhost/video', { headers: { Range: 'bytes=999-' } }), asset)).status, 416);
    await removeVideoFile(asset.key); assert.equal((await readdir(directory)).length, 0);
    await assert.rejects(receiveVideo(request(Buffer.from('not a video')))); assert.equal((await readdir(directory)).length, 0);
    await assert.rejects(receiveVideo(request(bytes), 16)); assert.equal((await readdir(directory)).length, 0);
    await assert.rejects(receiveVideo(request(bytes, 'sample.exe'))); assert.equal((await readdir(directory)).length, 0);
  } finally {
    if (original === undefined) delete process.env.VIDEO_STORAGE_DIR; else process.env.VIDEO_STORAGE_DIR = original;
    await rmdir(directory);
  }
});
