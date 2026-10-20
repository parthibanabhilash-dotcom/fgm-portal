'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { FileDown, CheckCircle2 } from 'lucide-react';
import { VideoPlayer } from './video-player';
export function LessonWorkspace({ lesson, courseId, previous, next }: {
  lesson: { id: string; title: string; videoUrl: string | null; markdown: string; position: number; completed: boolean; attachments: { id: string; name: string }[]; exams: { id: string; title: string }[] };
  courseId: string; previous: string | null; next: string | null;
}) {
  const router = useRouter(); const [tab, setTab] = useState('Video'); const [completed, setCompleted] = useState(lesson.completed);
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(lesson.position);
  async function progress(data: { completed?: boolean; position?: number }) {
    try {
      const res = await fetch(`/api/progress/${lesson.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error);
      if (data.completed !== undefined) { setCompleted(json.completed); router.refresh(); }
      setStatus('Progress saved');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Could not save progress.'); }
  }
  return <div><div role="tablist" aria-label="Lesson content" className="tabs" style={{ marginTop: 0 }}>{['Video', 'Notes', 'Exam'].map(t => <button key={t} id={`tab-${t}`} role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} tabIndex={tab === t ? 0 : -1} onKeyDown={e => { const names = ['Video', 'Notes', 'Exam']; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const name = names[(names.indexOf(t) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setTab(name); document.getElementById(`tab-${name}`)?.focus(); } }} onClick={() => setTab(t)}>{t}</button>)}</div><section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
    {tab === 'Video' && <VideoPlayer key={lesson.id} url={lesson.videoUrl} position={position} onPosition={value => { setPosition(value); void progress({ position: value }); }} />}
    {tab === 'Notes' && <div className="panel"><div className="markdown"><ReactMarkdown skipHtml>{lesson.markdown || 'Notes for this lesson have not been added yet.'}</ReactMarkdown></div><h3 style={{ marginTop: 25 }}>Lesson documents</h3>{lesson.attachments.length ? lesson.attachments.map(a => <a className="button secondary small" key={a.id} href={`/api/attachments/${a.id}`} style={{ margin: '10px 10px 0 0' }}><FileDown size={16} />{a.name}</a>) : <p className="notice">PDF placeholder · Your administrator can upload the real lesson document.</p>}</div>}
    {tab === 'Exam' && <div className="panel"><h2>Check your understanding</h2>{lesson.exams.length ? lesson.exams.map(e => <p key={e.id} className="record-item"><Link className="text-link" href={`/exams/${e.id}`}>{e.title} →</Link></p>) : <p className="muted">There is no exam attached to this lesson. Final course exams are listed on the course overview.</p>}</div>}
    </section><div className="lesson-controls"><Link className="button secondary small" href={previous ? `/courses/${courseId}/learn/${previous}` : `/courses/${courseId}`}>{previous ? '← Previous lesson' : '← Course overview'}</Link><button className="button small" disabled={busy || completed} onClick={async () => { setBusy(true); await progress({ completed: true }); setBusy(false); }}><CheckCircle2 size={16} />{completed ? 'Lesson completed' : busy ? 'Saving…' : 'Mark as completed'}</button>{next && <Link className="button secondary small" href={`/courses/${courseId}/learn/${next}`}>Next lesson →</Link>}</div><p aria-live="polite" className="muted small" style={{ marginTop: 12 }}>{status}</p></div>;
}
