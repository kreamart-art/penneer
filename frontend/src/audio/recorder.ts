// Voice-memo recording via MediaRecorder. iOS Safari records audio/mp4 (AAC),
// Chrome/Android audio/webm (Opus); we take the first supported so playback
// works on as many devices as possible without server transcoding.

export interface Recording {
  blob: Blob;
  mime: string;
  duration: number; // seconds, rounded
}

export interface Recorder {
  /** Stop and get the result (null if nothing was captured). */
  stop: () => Promise<Recording | null>;
  /** Abort and discard. */
  cancel: () => void;
}

const MIMES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

export function recordingSupported(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === "function" && typeof window.MediaRecorder === "function";
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MIMES.find((m) => MediaRecorder.isTypeSupported(m));
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start(250);

  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise<Recording | null>((resolve) => {
        rec.onstop = () => {
          release();
          if (chunks.length === 0) return resolve(null);
          const type = rec.mimeType || mime || "audio/webm";
          resolve({
            blob: new Blob(chunks, { type }),
            mime: type.split(";")[0],
            duration: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
          });
        };
        try {
          rec.stop();
        } catch {
          release();
          resolve(null);
        }
      }),
    cancel: () => {
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      release();
    },
  };
}
