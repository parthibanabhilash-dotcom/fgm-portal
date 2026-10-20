import Link from 'next/link';
import { Users, BookOpen, ClipboardCheck, BriefcaseBusiness as GraduationCap } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Heading, Stat, formatDate } from '@/components/ui';
import type { Snapshot } from '@/lib/exam-core';
export default async function Admin() {
  await requireAdmin();
  const [students, courses, enrollments, attempts, recent] = await Promise.all([
    db.user.count({ where: { role: 'STUDENT' } }), db.course.count(), db.enrollment.count({ where: { active: true } }), db.examAttempt.count(),
    db.examAttempt.findMany({ take: 8, orderBy: { startedAt: 'desc' }, include: { user: { select: { name: true, id: true } } } })
  ]);
  return <><Heading eyebrow="TRAINING MANAGEMENT" title="Your intern training overview." description="Assign training, support your interns, and review their progress and exam results."><Link className="button" href="/admin/courses">Manage courses →</Link></Heading><div className="stats"><Stat label="Total interns" value={students} icon={<Users size={20} />} /><Stat label="Total courses" value={courses} icon={<BookOpen size={20} />} /><Stat label="Active course assignments" value={enrollments} icon={<GraduationCap size={20} />} /><Stat label="Exam attempts" value={attempts} icon={<ClipboardCheck size={20} />} /></div><section className="hero"><div><p className="eyebrow">BUILD ROLE-READY TEAMS</p><h2>Effective onboarding starts<br />with clear training.</h2><p>Organize company training, share resources, and check understanding with course exams.</p><Link className="button" href="/admin/courses">Create or edit a course →</Link></div><div className="hero-art"><BookOpen size={80} /></div></section><section className="panel"><div className="section-header"><h2>Recent exam activity</h2><Link className="text-link" href="/admin/results">View results →</Link></div><div className="table-wrap"><table><thead><tr><th>Intern</th><th>Exam</th><th>Date</th><th>Status</th><th>Score</th></tr></thead><tbody>{recent.map(a => <tr key={a.id}><td><Link href={`/admin/students/${a.user.id}`}>{a.user.name}</Link></td><td>{(a.snapshot as Snapshot).title}</td><td>{formatDate(a.startedAt)}</td><td>{a.status}</td><td>{a.score === null ? '—' : `${a.score}%`}</td></tr>)}</tbody></table>{!recent.length && <p className="muted">No exam attempts yet.</p>}</div></section></>;
}
