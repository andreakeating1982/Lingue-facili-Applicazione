import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { chatAudioTranscription } = vi.hoisted(() => ({ chatAudioTranscription: vi.fn() }));
vi.mock("./_core/chat", () => ({ chatCompletion: vi.fn(), chatVision: vi.fn(), chatAudioTranscription }));
import { normalizeAudioToMp3 } from "./audioNormalize";
import { transcribeTeacherAudio } from "./aiAssist";

let ogg: Buffer;
let mp3: Buffer;
beforeAll(() => {
  if (!ffmpegPath) throw new Error("FFmpeg non disponibile per i test");
  // Suono sintetico senza informazioni personali; 32 s per controllare il limite.
  ogg = execFileSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=32", "-c:a", "libvorbis", "-f", "ogg", "pipe:1"], { maxBuffer: 3_000_000 });
  mp3 = execFileSync(ffmpegPath, ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "libmp3lame", "-f", "mp3", "pipe:1"], { maxBuffer: 3_000_000 });
});
beforeEach(() => { chatAudioTranscription.mockReset(); chatAudioTranscription.mockResolvedValue("Istruzioni di prova."); });

describe("conversione e trascrizione delle istruzioni vocali", () => {
  it("limita a 30 secondi la registrazione anche sul server", async () => {
    const converted = await normalizeAudioToMp3(ogg, 30);
    const pcm = execFileSync(ffmpegPath!, ["-v", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1"], { input: converted, maxBuffer: 2_000_000 });
    const durationSeconds = pcm.length / 2 / 16000;
    expect(durationSeconds).toBeGreaterThan(29);
    expect(durationSeconds).toBeLessThan(30.2);
  });

  it("inoltra un MP3 caricato senza modificarlo", async () => {
    const input = mp3.toString("base64");
    await expect(transcribeTeacherAudio(input, "audio/mp3", "upload")).resolves.toBe("Istruzioni di prova.");
    expect(chatAudioTranscription).toHaveBeenCalledWith(input, "audio/mpeg");
  });

  it("converte OGG caricato e trasmette MP3 all'IA", async () => {
    await transcribeTeacherAudio(ogg.toString("base64"), "audio/ogg", "upload");
    expect(chatAudioTranscription).toHaveBeenCalledOnce();
    const [payload, mime] = chatAudioTranscription.mock.calls[0];
    expect(mime).toBe("audio/mpeg");
    expect(Buffer.from(payload, "base64").length).toBeGreaterThan(100);
  });

  it("respinge contenuti vuoti o che non possono essere decodificati", async () => {
    await expect(transcribeTeacherAudio("YQ==", "audio/ogg", "upload")).rejects.toThrow("vuoto");
    await expect(normalizeAudioToMp3(Buffer.alloc(500))).rejects.toThrow("Formato audio non leggibile");
    expect(chatAudioTranscription).not.toHaveBeenCalled();
  });
});

