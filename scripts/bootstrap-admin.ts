import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { email, password, text } from '../src/lib/validation';

async function main() {
  const values = [process.env.ADMIN_EMAIL, process.env.ADMIN_NAME, process.env.ADMIN_PASSWORD];
  if (values.every(value => !value)) {
    console.log('ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD are not set; skipping admin bootstrap.');
    return;
  }
  if (values.some(value => !value)) throw new Error('Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD together.');
  const address = email.parse(process.env.ADMIN_EMAIL);
  const name = text(100).parse(process.env.ADMIN_NAME);
  const adminPassword = password.parse(process.env.ADMIN_PASSWORD);
  const existing = await db.user.findUnique({ where: { email: address }, select: { role: true } });
  if (existing) {
    if (existing.role !== 'ADMIN') throw new Error('ADMIN_EMAIL already belongs to an intern account.');
    console.log('Administrator already exists; password was not changed.');
    return;
  }
  await db.user.create({ data: { email: address, name, role: 'ADMIN', passwordHash: await bcrypt.hash(adminPassword, 12) } });
  console.log('Initial administrator created.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Administrator bootstrap failed.');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
