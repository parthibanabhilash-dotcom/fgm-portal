import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Heading, Empty, formatDate } from '@/components/ui';
export default async function Students() {
  await requireAdmin(); const students = await db.user.findMany({ where: { role: 'STUDENT' }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { enrollments: true, attempts: true } } } });
  return <><Heading eyebrow="INTERN MANAGEMENT" title="Interns & training assignments" description="Manage intern accounts, assign training courses, and review progress." /><section className="panel">{students.length ? <div className="table-wrap"><table><thead><tr><th>Intern</th><th>Account</th><th>Course assignments</th><th>Attempts</th><th>Joined</th><th>Manage</th></tr></thead><tbody>{students.map(s => <tr key={s.id}><td><strong>{s.name}</strong><p className="muted small">{s.email}</p></td><td><span className={`badge ${s.active ? 'green' : 'gray'}`}>{s.active ? 'ACTIVE' : 'INACTIVE'}</span></td><td>{s._count.enrollments}</td><td>{s._count.attempts}</td><td>{formatDate(s.createdAt)}</td><td><Link href={`/admin/students/${s.id}`}>View →</Link></td></tr>)}</tbody></table></div> : <Empty title="No interns yet">Interns can create an account using the registration page.</Empty>}</section></>;
}
