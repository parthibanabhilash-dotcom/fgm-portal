import { z } from 'zod';
export const text = (max = 200) => z.string().trim().min(1, 'This field is required.').max(max);
export const email = z.email().trim().toLowerCase().max(254);
export const password = z.string().min(12, 'Use at least 12 characters.').max(72, 'Use at most 72 characters.').refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes.');
export const httpsUrl = z.string().trim().refine(value => {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}, 'Enter an HTTPS URL or leave blank.');
export const courseSchema = z.object({ title: text(), description: text(10000), category: text(), instructor: text(), thumbnail: httpsUrl, sequential: z.boolean(), status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']) });
export const examSchema = z.object({ title: text(), instructions: text(10000), durationMinutes: z.coerce.number().int().min(1).max(1440), passPercentage: z.coerce.number().int().min(1).max(100), maxAttempts: z.coerce.number().int().min(1).max(100), availableFrom: z.date().nullable(), availableUntil: z.date().nullable(), randomize: z.boolean(), release: z.enum(['IMMEDIATE', 'AFTER_CLOSE', 'NEVER']), published: z.boolean() }).superRefine((e, ctx) => {
  if (e.availableFrom && e.availableUntil && e.availableFrom >= e.availableUntil) ctx.addIssue({ code: 'custom', message: 'Closing date must follow opening date.' });
  if (e.release === 'AFTER_CLOSE' && !e.availableUntil) ctx.addIssue({ code: 'custom', message: 'Set a closing date for answer release after closing.' });
});
