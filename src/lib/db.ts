import { PrismaClient } from '@prisma/client';
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient({ transactionOptions: { maxWait: 15000, timeout: 20000 } });
if (process.env.NODE_ENV !== 'production') globalDb.prisma = db;
