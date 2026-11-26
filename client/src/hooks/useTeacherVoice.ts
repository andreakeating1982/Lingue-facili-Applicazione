import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { countWords, MAX_EXERCISE_WORDS, MAX_INPUT_CHARACTERS } from "@shared/textLimits";

const MAX_RECORD_SECONDS = 30;
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
type VoiceState = "idle" | "requesting" | "listening" | "transcribing";

function guessAudioMime(file: File): string {
  const mime = file.type.toLowerCase().split(";")[0];
  if (mime.startsWith("audio/") || mime === "video/mp4") return mime;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    mp3: "audio/mpeg", mp4: "audio/mp4", m4a: "audio/mp4", wav: "audio/wav",
    webm: "audio/webm", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/opus",
    flac: "audio/flac", aac: "audio/aac", aiff: "audio/aiff", aif: "audio/aiff",
    amr: "audio/amr", wma: "audio/x-ms-wma", caf: "audio/x-caf",
  };
  return types[extension] ?? "application/octet-stream";
}

async function asBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Lettura audio non riuscita"));
    reader.readAsDataURL(blob);
  });
}

/** Registrazione con arresto automatico a 30 secondi oppure caricamento di un
 * file audio. Il server trascrive e non conserva il file o la registrazione. */
export function useTeacherVoice(text: string, setText: Dispatch<SetStateAction<string>>) {
  const [state, setState] = useState<VoiceState>("idle");
  const [remaining, setRemaining] = useState(MAX_RECORD_SECONDS);
  const stateRef = useRef<VoiceState>("idle");
  const textRef = useRef(text);
  textRef.current = text;
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const alive = useRef(true);
  const transcribe = trpc.exercises.transcribe.useMutation();

  const setVoiceState = (next: VoiceState) => { stateRef.current = next; if (alive.current) setState(next); };
  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    if (ticker.current) clearInterval(ticker.current);
    timer.current = null;
    ticker.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimers();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const transcribeBlob = async (audio: Blob, mime: string, source: "recording" | "upload") => {
    if (!audio.size || audio.size > MAX_AUDIO_BYTES) {
      toast.error("Il file audio è vuoto o supera 12 MB.");
      setVoiceState("idle");
      return;
    }
    setVoiceState("transcribing");
    try {
      const base64 = await asBase64(audio);
      const result = await transcribe.mutateAsync({ audio: base64, mime, source });
      if (!alive.current) return;
      const received = result.text.trim();
      const combined = [textRef.current.trim(), received].filter(Boolean).join("\n");
      // Conserva tutta la trascrizione, anche se eccede: il docente può
      // ridurla a 500 parole senza perdere ciò che ha dettato.
      textRef.current = combined;
      setText((previous) => [previous.trim(), received].filter(Boolean).join("\n"));
      if (countWords(combined) > MAX_EXERCISE_WORDS || combined.length > MAX_INPUT_CHARACTERS) {
        toast.warning(`La trascrizione supera ${MAX_EXERCISE_WORDS} parole: riduci il testo prima di creare l'esercizio.`, { duration: 9000 });
      } else {
        toast.success("Istruzioni trascritte con l'IA: controllale e modificale se necessario.");
      }
    } catch (error) {
      if (alive.current) {
        const detail = error instanceof Error ? error.message : "";
        toast.error(detail.includes("Formato audio") ? detail : "Non riesco a trascrivere l'audio. Riprova o scrivi le istruzioni.", { duration: 7000 });
      }
    } finally { setVoiceState("idle"); }
  };

  const stop = () => {
    clearTimers();
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const start = async () => {
    if (stateRef.current !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("La registrazione non è disponibile su questo browser: puoi caricare un audio o scrivere le istruzioni.");
      return;
    }
    setVoiceState("requesting");
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { audioStream.getTracks().forEach((track) => track.stop()); return; }
      stream.current = audioStream;
      const preferred = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported?.(m));
      const rec = preferred ? new MediaRecorder(audioStream, { mimeType: preferred }) : new MediaRecorder(audioStream);
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      rec.onstop = () => {
        clearTimers();
        audioStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        recorder.current = null;
        if (!alive.current) return;
        const mime = (rec.mimeType || chunks[0]?.type || "audio/webm").toLowerCase().split(";")[0];
        void transcribeBlob(new Blob(chunks, { type: mime }), mime.startsWith("audio/") ? mime : "application/octet-stream", "recording");
      };
      rec.start(1000);
      setRemaining(MAX_RECORD_SECONDS);
      setVoiceState("listening");
      const startTime = Date.now();
      ticker.current = setInterval(() => {
        if (alive.current) setRemaining(Math.max(0, Math.ceil(MAX_RECORD_SECONDS - (Date.now() - startTime) / 1000)));
      }, 250);
      timer.current = setTimeout(() => { if (rec.state === "recording") rec.stop(); }, MAX_RECORD_SECONDS * 1000);
    } catch {
      clearTimers();
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      if (alive.current) toast.error("Non riesco ad accedere al microfono. Controlla i permessi oppure carica un file audio.");
      setVoiceState("idle");
    }
  };

  const upload = async (file: File) => {
    if (stateRef.current !== "idle") return;
    await transcribeBlob(file, guessAudioMime(file), "upload");
  };

  return { state, remaining, start, stop, upload };
}

