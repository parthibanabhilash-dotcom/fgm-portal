'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
export function VideoUpload({ lessonId, current }: { lessonId: string; current: { name: string; size: number } | null }) {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [message, setMessage] = useState(''), [error, setError] = useState('');
  function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const file = input.current?.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) { setError('Choose a video of at most 1 GB.'); return; }
    if (current && !confirm('Replace the uploaded lesson video? The previous stored copy will be removed.')) return;
    setBusy(true); setError(''); setMessage(''); setProgress(0);
    const xhr = new XMLHttpRequest(); xhr.open('POST', `/api/admin/videos/${lessonId}`);
    xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onerror = () => { setError('Upload interrupted. Check your connection and try again.'); setBusy(false); };
    xhr.onload = () => {
      setBusy(false); let data; try { data = JSON.parse(xhr.responseText); } catch { setError('The server could not complete the upload.'); return; }
      if (xhr.status >= 400) { setError(data.error || 'Upload failed.'); return; }
      setMessage('Video uploaded. Enrolled interns can now watch it in this lesson.'); if (input.current) input.current.value = ''; router.refresh();
    };
    const data = new FormData(); data.append('file', file); xhr.send(data);
  }
  return <section style={{ marginTop: 24 }}><h3>Upload video from your computer</h3><p className="muted small" style={{ marginBottom: 12 }}>MP4 or WebM · Up to 1 GB · Stored privately on this server. MP4 with H.264 video and AAC audio offers broad browser support.</p>{current && <p className="notice" style={{ marginBottom: 12 }}>Active upload: <strong>{current.name}</strong> · {(current.size / 1024 / 1024).toFixed(1)} MB. The uploaded video takes priority over the URL above.</p>}<form className="form" onSubmit={upload}><label className="field"><span>Video file from computer</span><input ref={input} type="file" accept="video/mp4,video/webm,.mp4,.webm" required disabled={busy} /></label><button className="button" disabled={busy}>{busy ? progress === 100 ? 'Processing video…' : `Uploading ${progress}%` : current ? 'Replace uploaded video' : 'Upload video'}</button>{busy && <progress max={100} value={progress} aria-label="Video upload progress" style={{ width: '100%', accentColor: '#67195C' }} />}</form>{current && <button className="button secondary small" style={{ marginTop: 12 }} disabled={busy} onClick={async () => {
    if (!confirm('Remove the uploaded video from this lesson? The external URL, if present, will be used instead.')) return;
    setBusy(true); setError(''); setMessage('');
    try { const response = await fetch(`/api/admin/videos/${lessonId}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage('Uploaded video removed.'); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove video.'); } finally { setBusy(false); }
  }}>Remove uploaded video</button>}{message && <p className="notice success" role="status" style={{ marginTop: 12 }}>{message}</p>}{error && <p className="notice error" role="alert" style={{ marginTop: 12 }}>{error}</p>}</section>;
}
