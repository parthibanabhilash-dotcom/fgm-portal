import Link from 'next/link';
import { BookOpen, ArrowUpRight, Layers3 } from 'lucide-react';
import type { ReactNode } from 'react';
export function Heading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{children}</div>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty"><BookOpen size={32} /><h3>{title}</h3><div className="muted">{children}</div></div>; }
export function Progress({ completed, total }: { completed: number; total: number }) {
  const pct = total ? Math.round(completed / total * 100) : 0;
  return <div><div className="progress-label"><span>{completed} of {total} lessons completed</span><strong>{pct}%</strong></div><div className="progress" role="progressbar" aria-label="Course progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div></div>;
}
export function CourseCard({ course, completed = 0, total = 0, enrolled = false, href }: { course: { title: string; category: string; instructor: string; description: string; thumbnail: string | null }; completed?: number; total?: number; enrolled?: boolean; href: string }) {
  return <article className="course-card"><Link href={href} className="course-art" style={course.thumbnail ? { backgroundImage: `linear-gradient(90deg, #103e2bcc, #103e2b33), url("${course.thumbnail.replace(/["\\\n\r]/g, '')}")` } : undefined}><span className="badge light">{course.category}</span><div className="art-content"><Layers3 size={42} strokeWidth={1.2} /><span>FGM TRAINING<br /><strong>Build skills for your role.</strong></span></div><span className="art-corner">FGM.</span></Link><div className="course-card-body"><p className="course-kicker">INTERN TRAINING COURSE</p><h3><Link href={href}>{course.title}</Link></h3><p className="muted small">With {course.instructor}</p><p className="course-description">{course.description}</p>{enrolled ? <Progress completed={completed} total={total} /> : <p className="badge">Not assigned</p>}<Link className="course-link" href={href}>{enrolled ? completed === total && total > 0 ? 'Review course' : completed > 0 ? 'Continue training' : 'Start training' : 'View course'}<ArrowUpRight size={18} /></Link></div></article>;
}
export function Stat({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) { return <div className="stat"><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong></div></div>; }
export function formatDate(date: Date | string | null) { return date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(date)) + ' IST' : '—'; }
