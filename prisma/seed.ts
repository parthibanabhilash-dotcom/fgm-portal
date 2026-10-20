import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') throw new Error('Demo seeding is disabled in production.');
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'AdminDemo!2026';
  const studentPassword = process.env.DEMO_STUDENT_PASSWORD || 'StudentDemo!2026';
  await db.user.upsert({ where: { email: 'admin@lkpacademy.test' }, update: {}, create: { name: 'Training Admin', email: 'admin@lkpacademy.test', role: 'ADMIN', passwordHash: await bcrypt.hash(adminPassword, 12) } });
  const student = await db.user.upsert({ where: { email: 'student@lkpacademy.test' }, update: {}, create: { name: 'Alex Sharma', email: 'student@lkpacademy.test', passwordHash: await bcrypt.hash(studentPassword, 12) } });
  const course = await db.course.upsert({ where: { id: 'demo-digital-marketing' }, update: {}, create: { id: 'demo-digital-marketing', title: 'Certificate in Digital Marketing Basics', description: 'Discover how brands connect with people online. Build a practical foundation in digital strategy, search, social media, and meaningful campaign measurement.', category: 'Digital Marketing', instructor: 'FGM Training Team', status: 'PUBLISHED' } });
  const modules = [
    { title: 'Foundations of Digital Marketing', lessons: [
      { title: 'The digital marketing landscape', notes: '# Understanding digital marketing\nDigital marketing connects an organization with its audience through online channels.\n\n## Core channels\n- Search engines help people find solutions.\n- Social media supports conversation and discovery.\n- Email nurtures ongoing relationships.\n\nStart with a clear audience and a measurable goal.\n\n**Practice:** List three online channels used by a local business.\n\n*Video and PDF: placeholders awaiting real academy media.*' },
      { title: 'Audience, objectives & customer journeys', notes: '# Know who you are helping\nAn audience persona describes a useful customer segment, its goals, and its challenges.\n\n## Set a SMART objective\nMake objectives specific, measurable, achievable, relevant, and time-bound.\n\n## Map the journey\n1. Awareness\n2. Consideration\n3. Conversion\n4. Retention\n\n**Practice:** Write one SMART objective for a new online course.' }
    ] },
    { title: 'Search, Content & Social Media', lessons: [
      { title: 'Search engine optimization essentials', notes: '# Help people find useful answers\nSEO improves the visibility of helpful content in unpaid search results.\n\n## Start with intent\nUnderstand what a person wants to learn or do when they search.\n\n- Write descriptive titles.\n- Structure pages with meaningful headings.\n- Create original, relevant information.\n- Make pages usable on mobile.\n\n**Practice:** Suggest a title and three headings for a beginner’s guide.' },
      { title: 'Content planning & social media', notes: '# Plan content with purpose\nA content calendar connects your audience’s questions with a consistent publishing schedule.\n\n## Useful content pillars\n- Educate: explain a relevant topic.\n- Inspire: share an example or story.\n- Engage: invite a conversation.\n\nChoose channels based on audience fit. Track engagement rather than follower counts alone.\n\n**Practice:** Draft a one-week content calendar.' }
    ] },
    { title: 'Campaigns, Email & Analytics', lessons: [
      { title: 'Email marketing & paid campaigns', notes: '# Build relationships responsibly\nEmail works best when people have chosen to hear from you. Use clear consent, relevant messages, and an easy unsubscribe option.\n\n## Campaign essentials\n- A defined audience\n- A useful offer\n- A clear call to action\n- A relevant landing page\n\nPaid campaigns require budget limits and ongoing measurement.\n\n**Practice:** Write a short welcome email with one clear action.' },
      { title: 'Measuring results & optimizing performance', notes: '# Measure what matters\nChoose metrics that reflect the objective.\n\n- **CTR:** clicks divided by impressions.\n- **Conversion rate:** conversions divided by the chosen traffic base.\n- **ROI:** return relative to investment.\n\nUse UTM parameters to identify campaign traffic. Compare results over a consistent period and change one variable at a time.\n\n**Practice:** A campaign receives 1,000 impressions and 50 clicks. Its CTR is 5%.\n\nYou are ready to review the course and take the final assessment.' }
    ] }
  ];
  for (let mi = 0; mi < modules.length; mi++) {
    const m = await db.module.upsert({ where: { id: `demo-module-${mi + 1}` }, update: {}, create: { id: `demo-module-${mi + 1}`, courseId: course.id, position: mi + 1, title: modules[mi].title } });
    for (let li = 0; li < modules[mi].lessons.length; li++) {
      const l = modules[mi].lessons[li];
      await db.lesson.upsert({ where: { id: `demo-lesson-${mi + 1}-${li + 1}` }, update: {}, create: { id: `demo-lesson-${mi + 1}-${li + 1}`, moduleId: m.id, position: li + 1, title: l.title, note: { create: { markdown: l.notes } } } });
    }
  }
  await db.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: course.id } }, update: {}, create: { userId: student.id, courseId: course.id } });
  const questions = [
    ['What does SEO aim to improve?', ['Unpaid search visibility', 'Office attendance', 'Printing speed', 'Offline inventory']],
    ['Which is a SMART objective?', ['Increase course sign-ups by 10% within three months', 'Become famous', 'Post whenever possible', 'Get more everything']],
    ['What is a customer persona?', ['A useful description of a target audience segment', 'A password format', 'A search engine', 'An invoice']],
    ['Which stage commonly follows awareness?', ['Consideration', 'Payroll', 'Archiving', 'Uninstallation']],
    ['What helps organize a publishing schedule?', ['A content calendar', 'A router', 'A billing address', 'A password manager']],
    ['What should email subscribers be able to do easily?', ['Unsubscribe', 'View other subscribers’ passwords', 'Edit your database', 'Disable your website']],
    ['What does CTR stand for?', ['Click-through rate', 'Customer tax return', 'Content tracking receipt', 'Course timer reset']],
    ['50 clicks from 1,000 impressions gives what CTR?', ['5%', '50%', '0.5%', '20%']],
    ['What do UTM parameters help identify?', ['Campaign traffic sources', 'Student passwords', 'Video resolution', 'Server disk size']],
    ['What is a useful optimization approach?', ['Change one variable and measure the outcome', 'Change everything without measurement', 'Ignore the objective', 'Use follower count as the only metric']]
  ];
  await db.exam.upsert({ where: { id: 'demo-final-exam' }, update: {}, create: { id: 'demo-final-exam', courseId: course.id, title: 'Digital Marketing Basics · Final Assessment', instructions: 'Answer all ten single-answer questions. Each question carries one mark. You have 20 minutes and need 60% to pass. Your answers save automatically after each selection.', durationMinutes: 20, passPercentage: 60, maxAttempts: 3, randomize: true, published: true, questions: { create: questions.map(([q, options], i) => ({ text: q as string, position: i + 1, marks: 1, choices: { create: (options as string[]).map((c, j) => ({ text: c, correct: j === 0, position: j + 1 })) } })) } } });
  console.log('Seed complete. Demo admin: admin@lkpacademy.test; student: student@lkpacademy.test. Passwords use .env values or the documented development defaults.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
