import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

/** Converte formati audio diversi in MP3 mono in memoria. Il processo riceve
 *  soltanto byte via pipe, non usa un nome di file né protocolli di rete. */
export function normalizeAudioToMp3(input: Buffer, maximumSeconds?: number): Promise<Buffer> {
  const binary = ffmpegPath;
  if (!binary) throw new Error("Il convertitore audio non è disponibile su questo server.");
  const args = [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-protocol_whitelist", "pipe",
    "-i", "pipe:0", "-map", "0:a:0", "-vn", "-map_metadata", "-1",
    ...(maximumSeconds ? ["-t", String(maximumSeconds)] : []),
    "-ac", "1", "-ar", "16000", "-b:a", "48k", "-f", "mp3", "pipe:1",
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("La conversione audio ha impiegato troppo tempo."));
    }, 45_000);
    const finish = (error?: Error, value?: Buffer) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value!);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(new Error("L'audio convertito è troppo lungo: usa un file più breve."));
        return;
      }
      chunks.push(chunk);
    });
    // Gli errori del decoder possono contenere metadati personali: non registrarli.
    child.stderr.resume();
    child.stdin.on("error", () => { /* il decoder può chiudere prima la pipe */ });
    child.on("error", () => finish(new Error("Impossibile avviare il convertitore audio.")));
    child.on("close", (code) => {
      if (code !== 0 || !total) {
        finish(new Error("Formato audio non leggibile: prova MP3, WAV, M4A, OGG, FLAC o WebM."));
        return;
      }
      finish(undefined, Buffer.concat(chunks));
    });
    child.stdin.end(input);
  });
}

