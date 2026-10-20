'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LayoutDashboard, BriefcaseBusiness as GraduationCap, Users, ClipboardCheck, Settings, ArrowUpRight } from 'lucide-react';
export function Nav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const items = admin ? [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard }, { href: '/admin/courses', label: 'Courses', icon: BookOpen },
    { href: '/admin/students', label: 'Interns', icon: Users }, { href: '/admin/results', label: 'Exam results', icon: ClipboardCheck }
  ] : [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { href: '/courses', label: 'My training', icon: BookOpen },
    { href: '/results', label: 'Exams & results', icon: GraduationCap }, { href: '/profile', label: 'My profile', icon: Settings }
  ];
  return <nav className={`main-nav ${admin ? 'admin-nav' : ''}`} aria-label="Main navigation">{items.map(({ href, label, icon: Icon }) => {
    const active = path === href || (href !== '/admin' && path.startsWith(href + '/')) || (href === '/results' && (path.startsWith('/exams/') || path.startsWith('/attempts/')));
    return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''}><Icon size={19} aria-hidden="true" /><span>{label}</span></Link>;
  })}{admin && <Link href="/dashboard" aria-current={path === '/dashboard' ? 'page' : undefined}><ArrowUpRight size={19} aria-hidden="true" /><span>Intern view</span></Link>}</nav>;
}
