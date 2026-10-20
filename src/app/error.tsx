'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="panel" style={{ margin: 30 }}><h1>Something went wrong</h1><p className="muted">Please try again. If the issue continues, contact your administrator.</p><button className="button" onClick={reset}>Try again</button></main>; }
