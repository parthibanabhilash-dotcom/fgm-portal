import 'dotenv/config';
import { expireAttempts } from '../src/lib/exams';
import { db } from '../src/lib/db';
let stopped = false;
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });
async function main() {
  console.log('LKP exam expiry worker started (5-second poll).');
  while (!stopped) {
    try {
      const count = await expireAttempts();
      if (count) console.log(`Finalized expiry batch: ${count}`);
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
    } catch (e) { console.error('Expiry cycle failed; retrying next cycle.', e); }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
