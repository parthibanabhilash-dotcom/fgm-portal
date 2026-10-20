import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { email, password, text } from '../src/lib/validation';
async function main() {
  const data = { email: email.parse(process.env.ADMIN_EMAIL), name: text(100).parse(process.env.ADMIN_NAME), passwordHash: await bcrypt.hash(password.parse(process.env.ADMIN_PASSWORD), 12), role: 'ADMIN' as const };
  await db.user.create({ data }); console.log('Administrator created.');
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Administrator creation failed.'); process.exitCode = 1; }).finally(() => db.$disconnect());
