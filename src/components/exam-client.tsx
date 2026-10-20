'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import type { readAttempt } from '@/lib/exams';
type Attempt = Awaited<ReturnType<typeof readAttempt>>;
export function StartExam({ examId, activeId, disabled }: { examId: string; activeId?: string; disabled: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <><button className="button" disabled={disabled || busy} onClick={async () => {
    if (!activeId && !confirm('Start this exam now? The timer begins immediately and continues if you leave or refresh.')) return;
    if (activeId) { router.push(`/attempts/${activeId}`); return; }
    setBusy(true); setError('');
    try { const r = await fetch(`/api/exams/${examId}/start`, { method: 'POST' }); const d = await r.json(); if (!r.ok) throw new Error(d.error); router.push(`/attempts/${d.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start exam.'); setBusy(false); }
  }}>{busy ? 'Starting…' : activeId ? 'Resume attempt' : disabled ? 'Exam unavailable' : 'Start exam'}</button>{error && <p role="alert" className="notice error">{error}</p>}</>;
}
export function ExamClient({ initial }: { initial: Attempt }) {
  const [attempt, setAttempt] = useState(initial), [answers, setAnswers] = useState<Record<string, string>>(Object.fromEntries(initial.answers.map(a => [a.questionId, a.choiceId])));
  const [saving, setSaving] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('All saved answers restored');
  const offset = useRef(0); const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((new Date(initial.deadline).getTime() - new Date(initial.serverNow).getTime()) / 1000)));
  useEffect(() => { offset.current = new Date(initial.serverNow).getTime() - Date.now(); }, [initial.serverNow]);
  const pending = useRef<Promise<void>>(Promise.resolve()); const submitting = useRef(false);
  const submit = useCallback(async (automatic = false) => {
    if (submitting.current) return;
    if (!automatic && !confirm('Submit your exam? You cannot change answers after submission.')) return;
    submitting.current = true; setBusy(true); setError('');
    await pending.current;
    try {
      const r = await fetch(`/api/attempts/${initial.id}/submit`, { method: 'POST' }); const d = await r.json();
      if (!r.ok) throw new Error(d.error); setAttempt(d); setStatus('Exam submitted');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit. Retry or refresh to check your result.'); }
    finally { submitting.current = false; setBusy(false); }
  }, [initial.id]);
  useEffect(() => {
    if (attempt.status !== 'ACTIVE') return;
    const tick = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((new Date(attempt.deadline).getTime() - Date.now() - offset.current) / 1000));
      setRemaining(seconds); if (!seconds) void submit(true);
    }, 1000);
    const poll = setInterval(async () => {
      try { const r = await fetch(`/api/attempts/${attempt.id}`, { cache: 'no-store' }); if (r.ok) { const d: Attempt = await r.json(); offset.current = new Date(d.serverNow).getTime() - Date.now(); if (d.status === 'SUBMITTED') setAttempt(d); } } catch { /* Timer and saved answers remain intact; next poll retries. */ }
    }, 15000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [attempt.status, attempt.deadline, attempt.id, submit]);
  const done = attempt.status === 'SUBMITTED';
  async function save(questionId: string, choiceId: string) {
    const old = answers[questionId]; setAnswers(a => ({ ...a, [questionId]: choiceId })); setSaving(questionId); setError(''); setStatus('Saving answer…');
    const work = (async () => {
      try { const r = await fetch(`/api/attempts/${attempt.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, choiceId }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setStatus('Answer saved'); }
      catch (e) { setAnswers(a => { const next = { ...a }; if (old) next[questionId] = old; else delete next[questionId]; return next; }); setError(e instanceof Error ? e.message : 'Answer was not saved. Please select it again.'); setStatus('Answer not saved'); }
      finally { setSaving(null); }
    })(); pending.current = work; await work;
  }
  return <>{done ? <section className="panel"><span className={`badge ${attempt.passed ? 'green' : 'gray'}`}>{attempt.passed ? 'PASSED' : 'NOT PASSED'}</span><div className="result-score">{attempt.score}%</div><h2>{attempt.passed ? 'A step worth celebrating.' : 'Keep learning. You can build on this.'}</h2><p className="muted">Pass mark: {attempt.passPercentage}%. Your result is calculated and stored on the server.</p><p className="notice" style={{ marginTop: 15 }}>{attempt.review ? 'Correct answers are highlighted below.' : 'Correct answers are not available under this exam’s review policy.'}</p><Link className="text-link" href={`/exams/${attempt.examId}`}>View attempt history →</Link></section> : <div className="exam-toolbar"><div><span className="muted small">TIME REMAINING</span><div className="timer"><Clock3 size={17} style={{ display: 'inline', marginRight: 8 }} />{Math.floor(remaining / 60).toString().padStart(2, '0')}:{(remaining % 60).toString().padStart(2, '0')}</div></div><span role="status" className="muted small">{status} · {Object.keys(answers).length}/{attempt.questions.length} answered</span><button className="button small" disabled={busy || !!saving} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit exam'}</button></div>}{error && <p role="alert" className="notice error" style={{ marginBottom: 15 }}>{error}</p>}{attempt.questions.map((q, i) => <fieldset className="question" key={q.id} disabled={done || busy || !!saving || remaining === 0}><legend><span className="muted small">QUESTION {i + 1} · {q.marks} MARK{q.marks === 1 ? '' : 'S'}</span><br />{q.text}</legend>{q.choices.map(c => <label key={c.id} className={'correct' in c && c.correct ? 'correct' : ''}><input type="radio" name={q.id} value={c.id} checked={(done ? attempt.answers.find(a => a.questionId === q.id)?.choiceId : answers[q.id]) === c.id} onChange={() => void save(q.id, c.id)} />{c.text}{'correct' in c && c.correct && <strong className="small" style={{ marginLeft: 'auto' }}>Correct</strong>}</label>)}</fieldset>)}{!done && <p className="muted small">The server controls your deadline. The timer continues if this page is closed. Only answers confirmed as saved count toward your result.</p>}</>;
}
