// A voice-memo bubble: play/pause button, a static waveform, and the duration.
// Source is a capability URL (room: /api/voice/CODE/ID, dm: /api/dm/voice/ID).
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { colors, font, withAlpha } from "../theme/tokens";

// A fixed pseudo-waveform (seeded by duration) so the bubble reads as audio
// without decoding the file. Purely decorative; playback drives the fill.
function bars(seconds: number): number[] {
  const n = 26;
  let seed = (seconds * 2654435761) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: n }, (_, i) => {
    const env = Math.sin((i / (n - 1)) * Math.PI); // taper the ends
    return 0.28 + env * (0.35 + rnd() * 0.55);
  });
}

export function VoiceNote({ src, duration, mine }: { src: string; duration: number; mine?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const shape = useRef(bars(duration || 1));

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", () => setPlaying(false));
    a.addEventListener("play", () => setPlaying(true));
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const accent = mine ? colors.gold : colors.violet;
  const mmss = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 168 }}>
      <audio ref={audioRef} src={src} preload="none" />
      <button
        onClick={toggle}
        aria-label={playing ? "Pauze" : "Speel af"}
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: accent,
          color: colors.bg0,
          display: "grid",
          placeItems: "center",
        }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 1 }} />}
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 2, height: 26, flex: 1 }}>
        {shape.current.map((h, i) => {
          const played = i / shape.current.length <= progress;
          return (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${Math.round(h * 100)}%`,
                borderRadius: 2,
                background: played ? accent : withAlpha(accent, 0.32),
                transition: "background .1s",
              }}
            />
          );
        })}
      </div>
      <span style={{ flexShrink: 0, fontFamily: font.ui, fontSize: 11.5, color: colors.faint, fontVariantNumeric: "tabular-nums" }}>{mmss}</span>
    </div>
  );
}
