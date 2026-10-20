import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { HttpError } from './http';
function storage() {
  const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET } = process.env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET) throw new HttpError(503, 'Document storage is not configured.');
  return { bucket: S3_BUCKET, client: new S3Client({ endpoint: S3_ENDPOINT, region: process.env.S3_REGION || 'us-east-1', forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false', credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY } }) };
}
export function validatePdf(name: string, type: string, bytes: Uint8Array) {
  if (!name.toLowerCase().endsWith('.pdf') || type !== 'application/pdf' || bytes.length < 5 || bytes.length > 20 * 1024 * 1024 || Buffer.from(bytes.slice(0, 5)).toString() !== '%PDF-') throw new HttpError(400, 'Upload a valid PDF of at most 20 MB.');
}
export async function uploadPdf(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new HttpError(400, 'PDF exceeds 20 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  validatePdf(file.name, file.type, bytes);
  const { client, bucket } = storage();
  try { await client.send(new HeadBucketCommand({ Bucket: bucket })); }
  catch (e) {
    if ((e as { $metadata?: { httpStatusCode: number } }).$metadata?.httpStatusCode !== 404) throw e;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  const key = `notes/${randomUUID()}.pdf`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: 'application/pdf' }));
  return { key, size: file.size, name: file.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180) };
}
export async function downloadUrl(key: string, name: string) {
  const { client, bucket } = storage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: 'application/pdf', ResponseContentDisposition: `attachment; filename="${name.replace(/[^a-zA-Z0-9._ -]/g, '_')}"` }), { expiresIn: 60 });
}
