import { cookies, headers } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import type { User } from '@prisma/client';
import { db } from './db';
import { HttpError } from './http';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export async function currentUser() {
  const token = (await cookies()).get('lkp_session')?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  return session && session.expiresAt > new Date() && session.user.active ? session.user : null;
}
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Please sign in to continue.');
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Administrator access required.');
  return user;
}
export async function pageUser(admin = false) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (admin && user.role !== 'ADMIN') redirect('/dashboard');
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set('lkp_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt });
}
export async function assertOrigin() {
  const origin = (await headers()).get('origin');
  if (!process.env.APP_URL || origin !== new URL(process.env.APP_URL).origin) throw new HttpError(403, 'Request origin is not allowed.');
}
export async function consumeRateLimit(key: string, limit = 10) {
  // Atomic upsert is shared across application processes. No client-controlled IP headers.
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, NOW() + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
    "count" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
    "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  if (rows[0].count > limit) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
}
