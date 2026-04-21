import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import type { Post } from "@/data/types";

export function VideoPlayer({ post }: { post: Extract<Post, { media: { type: "video" } }> | Post }) {
  if (post.media.type !== "video") return null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        } else {
          el.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="relative aspect-[9/14] w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={post.media.src}
        poster={post.media.poster}
        muted={muted}
        loop
        playsInline
        onClick={togglePlay}
        className="h-full w-full object-cover"
      />
      {!playing && (
        <button
          onClick={togglePlay}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-label="Play video"
        >
          <span className="rounded-full bg-background/40 p-4 backdrop-blur-sm">
            <Play className="h-8 w-8 fill-foreground text-foreground" />
          </span>
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute bottom-3 right-3 rounded-full bg-background/60 p-2 backdrop-blur-sm"
      >
        {muted ? <VolumeX className="h-4 w-4 text-foreground" /> : <Volume2 className="h-4 w-4 text-foreground" />}
      </button>
    </div>
  );
}
