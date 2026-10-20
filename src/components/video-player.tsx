'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayCircle } from 'lucide-react';
type YTPlayer = { getCurrentTime(): number; seekTo(time: number, ahead: boolean): void; destroy(): void; setPlaybackRate(rate: number): void };
declare global { interface Window { YT?: { Player: new (node: HTMLElement, config: object) => YTPlayer }; onYouTubeIframeAPIReady?: () => void } }
let youtubeReady: Promise<void> | undefined;
function youtubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (!youtubeReady) youtubeReady = new Promise(resolve => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(script);
  });
  return youtubeReady;
}
export function videoSource(url: string) {
  if (url.startsWith('/api/videos/')) return { kind: 'direct', id: url };
  const u = new URL(url); const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com') {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.split('/').at(-1);
    if (id && /^[\w-]{11}$/.test(id)) return { kind: 'youtube', id };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').find(x => /^\d+$/.test(x));
    if (id) return { kind: 'vimeo', id, hash: u.searchParams.get('h') || u.pathname.split('/').at(-1) !== id && u.pathname.split('/').at(-1) || '' };
  }
  return { kind: 'direct', id: url };
}
export function VideoPlayer({ url, position, onPosition }: { url: string | null; position: number; onPosition: (value: number) => void }) {
  const host = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null), video = useRef<HTMLVideoElement>(null);
  const save = useRef(onPosition); const initial = useRef(position); const yt = useRef<YTPlayer | null>(null);
  const [warning, setWarning] = useState('');
  const lastSave = useRef(0);
  const nativeResume = useRef(position);
  const restoreNative = useCallback((player: HTMLVideoElement) => {
    if (nativeResume.current <= 0) return;
    if (!Number.isFinite(player.duration)) {
      setWarning('This file has no seekable duration metadata. Re-export it as MP4 or WebM with duration metadata for reliable resume.');
      return;
    }
    if (player.duration <= 0 || player.readyState < 1) return;
    const target = Math.min(nativeResume.current, Math.max(0, player.duration - 0.1));
    if (Math.abs(player.currentTime - target) < 0.1) { nativeResume.current = 0; return; }
    try { player.currentTime = target; } catch { /* Retry once the browser has enough metadata. */ }
  }, []);
  useEffect(() => { save.current = onPosition; }, [onPosition]);
  useEffect(() => {
    if (!url) return;
    const source = videoSource(url); let stopped = false; let ready = false; let interval: ReturnType<typeof setInterval> | undefined;
    const publish = (value: number) => { if (Number.isFinite(value) && value >= 0) save.current(value); };
    if (source.kind === 'youtube') {
      const timeout = setTimeout(() => { if (!yt.current) setWarning('The video provider did not load. Check your connection and its embed permissions.'); }, 12000);
      youtubeApi().then(() => {
        if (stopped || !host.current || !window.YT) return;
        const node = document.createElement('div'); host.current.appendChild(node);
        yt.current = new window.YT.Player(node, { videoId: source.id, playerVars: { playsinline: 1, origin: window.location.origin, rel: 0 }, events: {
          onReady: () => { clearTimeout(timeout); yt.current?.seekTo(initial.current, true); ready = true; },
          onStateChange: () => { if (ready && yt.current?.getCurrentTime) publish(yt.current.getCurrentTime()); },
          onError: () => setWarning('This YouTube video is unavailable or its owner has disabled embedding.')
        } });
        interval = setInterval(() => { if (ready && yt.current?.getCurrentTime) publish(yt.current.getCurrentTime()); }, 10000);
      });
      return () => { stopped = true; clearTimeout(timeout); if (interval) clearInterval(interval); yt.current?.destroy(); yt.current = null; };
    }
    if (source.kind === 'vimeo') {
      const send = (method: string, value?: unknown) => iframe.current?.contentWindow?.postMessage({ method, value }, 'https://player.vimeo.com');
      const receive = (event: MessageEvent) => {
        if (event.origin !== 'https://player.vimeo.com' || event.source !== iframe.current?.contentWindow) return;
        let data; try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
        if (!ready && (data.event === 'ready' || data.method === 'ping')) { ready = true; send('setCurrentTime', initial.current); send('addEventListener', 'timeupdate'); send('addEventListener', 'pause'); }
        if (data.event === 'timeupdate' && Date.now() - lastSave.current > 10000) { lastSave.current = Date.now(); publish(data.data.seconds); }
        if (data.event === 'pause') send('getCurrentTime');
        if (data.method === 'getCurrentTime') publish(data.value);
        if (data.event === 'error') setWarning('Vimeo could not play this video. Check the owner’s privacy and embed settings.');
      };
      window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
    }
    // The browser can load metadata before React hydrates an SSR video element.
    // Restore on mount too, rather than relying only on the metadata event.
    if (video.current?.readyState) restoreNative(video.current);
  }, [url, restoreNative]);
  if (!url) return <div className="video-shell"><div className="video-placeholder"><PlayCircle size={46} style={{ margin: 'auto' }} /><h3>Your video will be here.</h3><p>No video yet · Your administrator can upload a video file or add a video URL.</p></div></div>;
  const source = videoSource(url);
  function speed(rate: number) {
    if (video.current) video.current.playbackRate = rate;
    yt.current?.setPlaybackRate(rate);
    iframe.current?.contentWindow?.postMessage({ method: 'setPlaybackRate', value: rate }, 'https://player.vimeo.com');
  }
  return <><div className="video-shell">{source.kind === 'youtube' ? <div ref={host} style={{ width: '100%', height: '100%' }} /> : source.kind === 'vimeo' ? <iframe ref={iframe} title="Lesson video" src={`https://player.vimeo.com/video/${source.id}?dnt=1${source.hash ? `&h=${encodeURIComponent(source.hash)}` : ''}`} onLoad={() => iframe.current?.contentWindow?.postMessage({ method: 'ping' }, 'https://player.vimeo.com')} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /> : <video ref={video} src={url} controls playsInline preload="metadata" onLoadedMetadata={e => restoreNative(e.currentTarget)} onLoadedData={e => restoreNative(e.currentTarget)} onCanPlay={e => restoreNative(e.currentTarget)} onSeeked={e => restoreNative(e.currentTarget)} onPause={e => save.current(e.currentTarget.currentTime)} onTimeUpdate={e => { if (Date.now() - lastSave.current > 10000) { lastSave.current = Date.now(); save.current(e.currentTarget.currentTime); } }} onError={() => setWarning('The video could not load. Ask your administrator to check the source URL.')} />}</div><div className="lesson-controls"><label className="small">Playback speed <select aria-label="Playback speed" defaultValue="1" onChange={e => speed(Number(e.target.value))} style={{ marginLeft: 8 }}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => <option key={r} value={r}>{r}×</option>)}</select></label><small className="muted">External player features depend on the provider.</small></div>{warning && <p role="alert" className="notice error" style={{ marginTop: 10 }}>{warning}</p>}</>;
}
