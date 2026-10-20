import { DeleteContent } from '@/components/delete-content';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Heading } from '@/components/ui';
import { CourseEditor } from '@/components/admin-editors';
export default async function AdminCourses() {
  await requireAdmin(); const courses = await db.course.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { enrollments: true } } } });
  return <><Heading eyebrow="CONTENT MANAGEMENT" title="Courses" description="Create and manage onboarding courses for new interns." /><section className="panel"><div className="table-wrap"><table><thead><tr><th>Course</th><th>Category</th><th>Status</th><th>Course assignments</th><th>Actions</th></tr></thead><tbody>{courses.filter(c => c.status !== 'ARCHIVED').map(c => <tr key={c.id}><td><strong>{c.title}</strong><p className="muted small">{c.instructor}</p></td><td>{c.category}</td><td><span className="badge">{c.status}</span></td><td>{c._count.enrollments}</td><td><div className="content-actions"><Link className="button secondary" href={`/admin/courses/${c.id}`}>Edit course</Link><DeleteContent kind="course" id={c.id} title={c.title} /></div></td></tr>)}</tbody></table></div>{!courses.some(c => c.status !== 'ARCHIVED') && <p className="muted">No active courses. Create a course below.</p>}</section><details className="details"><summary>Deleted / archived courses ({courses.filter(c => c.status === 'ARCHIVED').length})</summary><p className="muted">Deleted courses are archived to preserve intern records. To restore one, edit its publication status to Draft or Published.</p>{courses.filter(c => c.status === 'ARCHIVED').map(c => <div className="record-item" key={c.id}><span>{c.title}</span><Link className="text-link" href={`/admin/courses/${c.id}`}>Edit / restore course</Link></div>)}</details><details className="details"><summary>＋ Create a new course</summary><CourseEditor /></details></>;
}
