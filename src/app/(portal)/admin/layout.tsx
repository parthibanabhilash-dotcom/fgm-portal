import { pageUser } from '@/lib/auth';
export default async function AdminLayout({ children }: { children: React.ReactNode }) { await pageUser(true); return children; }
