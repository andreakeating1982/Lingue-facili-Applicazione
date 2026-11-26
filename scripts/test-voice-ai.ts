/* Test manuale con voce sintetica locale e IA configurata:
   espeak -v it -s 150 -w /tmp/lingue-voce-test.wav "Completa i verbi al presente e proponi due risposte, una sola corretta."
   pnpm exec tsx scripts/test-voice-ai.ts
   L'audio viene inviato direttamente all'IA senza scriverlo nello storage dell'app. */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { transcribeTeacherAudio } from "../server/aiAssist";
const audio = await readFile("/tmp/lingue-voce-test.wav");
const started = Date.now();
// I due percorsi sono diversi: la registrazione viene convertita e limitata
// a 30 secondi, mentre il file WAV viene inviato all'IA come file caricato.
const results = await Promise.all((["recording", "upload"] as const).map(async (source) => {
  const transcript = await transcribeTeacherAudio(audio.toString("base64"), "audio/wav", source);
  if (!/verbi/i.test(transcript) || !/presente/i.test(transcript) || !/due/i.test(transcript)) {
    throw new Error(`Trascrizione ${source} non coerente con il parlato sintetico: ${transcript}`);
  }
  return { source, transcript };
}));
for (const {source, transcript} of results) console.log(`IA ${source}: ${transcript}`);
console.log(`Registrazione e file trascritti dall'IA in ${((Date.now()-started)/1000).toFixed(1)} s; nessun dato nel database.`);

