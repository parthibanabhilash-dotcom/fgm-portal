import Link from 'next/link';
export default function NotFound() { return <main id="main" className="empty"><h1>Page not found</h1><p>This page may have moved or is unavailable.</p><Link className="text-link" href="/dashboard">Return to dashboard</Link></main>; }
