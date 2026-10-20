import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#127c4b' };
export const metadata: Metadata = { title: { default: 'FGM Training · Intern training portal', template: '%s · FGM Training' }, description: 'Company onboarding, training courses, and intern assessments in one place.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>; }
