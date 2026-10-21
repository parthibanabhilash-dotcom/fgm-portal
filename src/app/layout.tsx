import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MotionEnhancer } from '@/components/motion-enhancer';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#127c4b' };
export const metadata: Metadata = { title: { default: 'FGM Training · Intern training portal', template: '%s · FGM Training' }, description: 'Company onboarding, training courses, and intern assessments in one place.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><MotionEnhancer />{children}</body></html>; }
