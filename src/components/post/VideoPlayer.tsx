import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play, Loader2 } from "lucide-react";
import type { Post } from "@/data/types";

/**
 * Global registry so only the most-visible video plays at a time.
 * Solves the "every video on the feed is fighting for audio + bandwidth" problem.
 */
const REGISTRY = new Set<HTMLVideoElement>();
let activeEl: HTMLVideoElement | null = null;
// Persist mute pref across players in the same session.
let GLOBAL_MUTED = true;
const MUTE_LISTENERS = new Set<(m: boolean) => void>();
function setGlobalMuted(m: boolean) {
  GLOBAL_MUTED = m;
  REGISTRY.forEach((v) => (v.muted = m));
  MUTE_LISTENERS.forEach((fn) => fn(m));
}

function makeActive(el: HTMLVideoElement) {
  if (activeEl && activeEl !== el) {
    activeEl.pause();
  }
  activeEl = el;
}

export function VideoPlayer({ post }: { post: Post }) {
  if (post.media.type !== "video") return null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(GLOBAL_MUTED);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [showPoster, setShowPoster] = useState(true);

  // Subscribe to global mute changes (so all players stay in sync).
  useEffect(() => {
    const fn = (m: boolean) => setMuted(m);
    MUTE_LISTENERS.add(fn);
    return () => {
      MUTE_LISTENERS.delete(fn);
    };
  }, []);

  // Register / observe visibility.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = GLOBAL_MUTED;
    REGISTRY.add(el);

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          makeActive(el);
          el.play()
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false));
        } else {
          el.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);

    const onPlaying = () => {
      setPlaying(true);
      setWaiting(false);
      setShowPoster(false);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setWaiting(true);
    const onCanPlay = () => setWaiting(false);
    const onEnded = () => setPlaying(false);

    el.addEventListener("playing", onPlaying);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("ended", onEnded);

    return () => {
      obs.disconnect();
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("ended", onEnded);
      REGISTRY.delete(el);
      if (activeEl === el) activeEl = null;
    };
  }, []);

  // Pause when the tab is hidden — saves battery / bandwidth.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && activeEl) activeEl.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      makeActive(el);
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  return (
    <div className="relative aspect-[9/14] w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={post.media.src}
        poster={post.media.poster || undefined}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onClick={togglePlay}
        className="h-full w-full object-cover"
      />

      {/* Poster fade — hides as soon as the first frame plays */}
      {showPoster && post.media.poster && (
        <img
          src={post.media.poster}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity"
          style={{ opacity: playing ? 0 : 1 }}
          aria-hidden
        />
      )}

      {!playing && !waiting && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play video"
        >
          <span className="rounded-full bg-background/40 p-4 backdrop-blur-sm">
            <Play className="h-8 w-8 fill-foreground text-foreground" />
          </span>
        </button>
      )}

      {waiting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-foreground/80" />
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          setGlobalMuted(!muted);
        }}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-3 right-3 rounded-full bg-background/60 p-2 backdrop-blur-sm"
      >
        {muted ? <VolumeX className="h-4 w-4 text-foreground" /> : <Volume2 className="h-4 w-4 text-foreground" />}
      </button>
    </div>
  );
}
