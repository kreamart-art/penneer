// Record-a-voice-memo control for the composer. Idle: a mic button. Recording:
// a red pulsing dot, a live timer, and cancel/send. Uploads the blob via the
// caller-provided uploader, then hands back {id, dur} to attach to a message.
import { useEffect, useRef, useState } from "react";
import { Check, Mic, X } from "lucide-react";
import { recordingSupported, startRecording, type Recorder } from "../audio/recorder";
import { colors, font, withAlpha } from "../theme/tokens";

const MAX_SECONDS = 60;

export function MicButton({
  upload,
  onSent,
  disabled,
}: {
  /** Uploads the recorded blob and resolves to its server id (or null on fail). */
  upload: (blob: Blob, mime: string) => Promise<string | null>;
  onSent: (voiceId: string, duration: number) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const recRef = useRef<Recorder | null>(null);
  const tickRef = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    window.clearInterval(tickRef.current);
    recRef.current?.cancel();
  }, []);

  if (!recordingSupported()) return null;

  const begin = async () => {
    if (busy || recording) return;
    setBusy(true);
    try {
      recRef.current = await startRecording();
      setSecs(0);
      setRecording(true);
      tickRef.current = window.setInterval(() => {
        setSecs((s) => {
          if (s + 1 >= MAX_SECONDS) {
            // Auto-stop and send at the cap.
            window.clearInterval(tickRef.current);
            void finish();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      // Permission denied or no mic: silently return to idle.
      recRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    window.clearInterval(tickRef.current);
    recRef.current?.cancel();
    recRef.current = null;
    setRecording(false);
    setSecs(0);
  };

  const finish = async () => {
    window.clearInterval(tickRef.current);
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (!rec) return;
    setBusy(true);
    try {
      const result = await rec.stop();
      if (!result) return;
      const id = await upload(result.blob, result.mime);
      if (id) onSent(id, result.duration);
    } finally {
      setBusy(false);
      setSecs(0);
    }
  };

  if (recording) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={cancel}
          aria-label="Annuleer opname"
          style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer", background: withAlpha("#000000", 0.3), color: colors.faint, display: "grid", placeItems: "center" }}
        >
          <X size={18} />
        </button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: colors.ink, fontVariantNumeric: "tabular-nums", minWidth: 42 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors.red, animation: "fill-pulse 1s ease-in-out infinite" }} />
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
        <button
          onClick={finish}
          disabled={busy}
          aria-label="Verstuur opname"
          style={{ width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", background: colors.gold, color: colors.bg0, display: "grid", placeItems: "center" }}
        >
          <Check size={19} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={begin}
      disabled={disabled || busy}
      aria-label="Neem spraakbericht op"
      style={{
        flexShrink: 0,
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: `1px solid ${colors.panelBorder}`,
        cursor: disabled ? "default" : "pointer",
        background: withAlpha("#000000", 0.25),
        color: colors.sub,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Mic size={19} />
    </button>
  );
}
