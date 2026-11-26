/**
 * Genera PDF SINTETICI per tutte le combinazioni lingua × tipologia × (con | senza risposte)
 * e un manifest per `verifica-intestazione-pdf.py`, che controlla l'intestazione della prima
 * pagina: dopo il titolo vengono subito i dati dello studente, senza la riga «<tipologia> ·
 * <italiano> [- CON LE RISPOSTE]» e senza la didascalia sul segno verde.
 * Nessun dato reale, nessuna IA e nessun accesso al database.
 *
 *   pnpm exec tsx scripts/test-intestazione-pdf.ts
 *   python3 scripts/verifica-intestazione-pdf.py
 *
 * I font sono caricati dal server locale sulla porta 3000; i PDF vanno in /tmp/pdf-intestazione.
 */
import { mkdirSync, writeFileSync } from "fs";
import type { Exercise, ItemAnswer, ReorderItem } from "../shared/exercise";
import { EXERCISE_TYPES, TYPE_META } from "../shared/exercise";
import type { LangCode } from "../shared/languages";

const { buildWorkoutPdf } = await import(process.env.PDF_MODULE ?? "../client/src/lib/exportWorkout");
const { LANGS } = await import("../shared/languages");
const out = process.env.PDF_OUT ?? "/tmp/pdf-intestazione";
mkdirSync(out, { recursive: true });

const student = { cognome: "Sintetico", nome: "Prova", data: "07/11/2026", classe: "1A" };

type Sample = {
  reorder: string[];
  mc: { subject: string; tail: string; options: [string, string]; correct: string }[];
  tf: { sentence: string; highlight: string; isTrue: boolean }[];
  match: { word: string; it: string; emoji: string }[];
  matchIt: { en: string; it: string }[];
};

const SAMPLES: Record<LangCode, Sample> = {
  en: {
    reorder: [
      "She always plays tennis on Saturday morning.",
      "My brother is reading an interesting book.",
      "We are going to visit our grandparents tomorrow.",
      "The students usually walk to school together.",
      "I have never seen such a beautiful garden.",
      "They were watching a film when the lights went out.",
    ],
    mc: [
      { subject: "She", tail: "tennis every day.", options: ["plays", "play"], correct: "plays" },
      { subject: "They", tail: "to school by bus.", options: ["go", "goes"], correct: "go" },
      { subject: "We", tail: "a new car last year.", options: ["bought", "buy"], correct: "bought" },
      { subject: "He", tail: "his homework now.", options: ["is doing", "does"], correct: "is doing" },
      { subject: "I", tail: "the answer yesterday.", options: ["knew", "know"], correct: "knew" },
      { subject: "You", tail: "very well.", options: ["sing", "sings"], correct: "sing" },
    ],
    tf: [
      { sentence: "She plays tennis every day.", highlight: "plays", isTrue: true },
      { sentence: "They goes to school by bus.", highlight: "goes", isTrue: false },
      { sentence: "We bought a new car last year.", highlight: "bought", isTrue: true },
      { sentence: "He are doing his homework.", highlight: "are", isTrue: false },
    ],
    match: [
      { word: "apple", it: "mela", emoji: "🍎" },
      { word: "house", it: "casa", emoji: "🏠" },
      { word: "dog", it: "cane", emoji: "🐕" },
      { word: "book", it: "libro", emoji: "📖" },
    ],
    matchIt: [
      { en: "always", it: "sempre" },
      { en: "tomorrow", it: "domani" },
      { en: "garden", it: "giardino" },
      { en: "grandparents", it: "nonni" },
      { en: "together", it: "insieme" },
      { en: "never", it: "mai" },
    ],
  },
  fr: {
    reorder: [
      "Nous allons souvent au marché le dimanche.",
      "Ma tante prépare un gâteau pour la fête.",
      "Les enfants jouent dans le jardin après l'école.",
      "Il a toujours aimé lire des histoires drôles.",
      "Vous habitez dans une petite ville près de la mer.",
      "Je ne mange jamais de poisson le lundi.",
    ],
    mc: [
      { subject: "Nous", tail: "au marché le dimanche.", options: ["allons", "vont"], correct: "allons" },
      { subject: "Elle", tail: "un gâteau pour la fête.", options: ["prépare", "préparez"], correct: "prépare" },
      { subject: "Les enfants", tail: "dans le jardin.", options: ["jouent", "joue"], correct: "jouent" },
      { subject: "Vous", tail: "près de la mer.", options: ["habitez", "habitent"], correct: "habitez" },
      { subject: "Je", tail: "du poisson.", options: ["mange", "manges"], correct: "mange" },
      { subject: "Il", tail: "des histoires drôles.", options: ["aime", "aimons"], correct: "aime" },
    ],
    tf: [
      { sentence: "Nous allons au marché.", highlight: "allons", isTrue: true },
      { sentence: "Elles préparez un gâteau.", highlight: "préparez", isTrue: false },
      { sentence: "Je mange du poisson.", highlight: "mange", isTrue: true },
      { sentence: "Vous habitent près de la mer.", highlight: "habitent", isTrue: false },
    ],
    match: [
      { word: "la pomme", it: "la mela", emoji: "🍎" },
      { word: "la maison", it: "la casa", emoji: "🏠" },
      { word: "le chien", it: "il cane", emoji: "🐕" },
      { word: "le livre", it: "il libro", emoji: "📖" },
    ],
    matchIt: [
      { en: "souvent", it: "spesso" },
      { en: "toujours", it: "sempre" },
      { en: "jamais", it: "mai" },
      { en: "le jardin", it: "il giardino" },
      { en: "la mer", it: "il mare" },
      { en: "le marché", it: "il mercato" },
    ],
  },
  es: {
    reorder: [
      "Nosotros paseamos en el parque todas las tardes.",
      "Mi hermana prepara una tarta para la fiesta.",
      "Los niños juegan en el jardín después de la escuela.",
      "Siempre he querido viajar a Valencia en tren.",
      "Vosotros vivís en una ciudad pequeña cerca del mar.",
      "Yo nunca como pescado los lunes.",
    ],
    mc: [
      { subject: "Nosotros", tail: "en el parque.", options: ["paseamos", "pasean"], correct: "paseamos" },
      { subject: "Ella", tail: "una tarta para la fiesta.", options: ["prepara", "preparas"], correct: "prepara" },
      { subject: "Los niños", tail: "en el jardín.", options: ["juegan", "juega"], correct: "juegan" },
      { subject: "Vosotros", tail: "cerca del mar.", options: ["vivís", "viven"], correct: "vivís" },
      { subject: "Yo", tail: "pescado los lunes.", options: ["como", "comes"], correct: "como" },
      { subject: "Tú", tail: "a la biblioteca.", options: ["vas", "van"], correct: "vas" },
    ],
    tf: [
      { sentence: "Nosotros paseamos en el parque.", highlight: "paseamos", isTrue: true },
      { sentence: "Ella preparas una tarta.", highlight: "preparas", isTrue: false },
      { sentence: "Yo como pescado los lunes.", highlight: "como", isTrue: true },
      { sentence: "Vosotros viven cerca del mar.", highlight: "viven", isTrue: false },
    ],
    match: [
      { word: "la manzana", it: "la mela", emoji: "🍎" },
      { word: "la casa", it: "la casa", emoji: "🏠" },
      { word: "el perro", it: "il cane", emoji: "🐕" },
      { word: "el libro", it: "il libro", emoji: "📖" },
    ],
    matchIt: [
      { en: "siempre", it: "sempre" },
      { en: "nunca", it: "mai" },
      { en: "el parque", it: "il parco" },
      { en: "la escuela", it: "la scuola" },
      { en: "cerca", it: "vicino" },
      { en: "la tarde", it: "il pomeriggio" },
    ],
  },
};

function reorderItem(sentence: string): ReorderItem {
  const words = sentence.replace(/[.]$/, "").split(" ");
  return {
    answer: sentence,
    chips: words.map((t, i) => ({ t, role: (i === 0 ? "subject" : i === 1 ? "verb" : "other") as "subject" | "verb" | "other" })),
  };
}

function exerciseFor(lang: LangCode, type: (typeof EXERCISE_TYPES)[number]): Exercise {
  const s = SAMPLES[lang];
  if (type === "reorder") return { type, items: s.reorder.map(reorderItem) } as Exercise;
  if (type === "mc") {
    return {
      type,
      items: s.mc.map((m) => ({
        segments: [{ t: "subject", v: m.subject, group: "A" }, { t: "blank" }, { t: "text", v: ` ${m.tail}` }],
        options: m.options,
        correct: m.correct,
      })),
    } as Exercise;
  }
  if (type === "tf") return { type, items: s.tf } as Exercise;
  if (type === "match") {
    return { type, pairs: s.match.map((p) => ({ ...p, imagePrompt: `illustrazione di ${p.word}` })) } as Exercise;
  }
  return { type, pairs: s.matchIt } as Exercise;
}

function countOf(ex: Exercise): number {
  return ex.type === "match" || ex.type === "matchIt" ? ex.pairs.length : ex.items.length;
}

const manifest: Record<string, unknown>[] = [];
let done = 0;
for (const lang of ["en", "fr", "es"] as LangCode[]) {
  for (const type of EXERCISE_TYPES) {
    const exercise = exerciseFor(lang, type);
    const n = countOf(exercise);
    // metà delle risposte giuste al primo colpo, le altre con errori
    const answers: ItemAnswer[] = Array.from({ length: n }, (_, i) =>
      i % 2 === 0 ? { ok: true, attempts: 0, value: "giusta" } : { ok: i % 4 === 1, attempts: 2, value: "tentativo" },
    );
    const expectedScore = answers.filter((a) => a.ok && a.attempts === 0).length;
    for (const withAnswers of [false, true]) {
      const file = `${lang}-${type}-${withAnswers ? "con" : "senza"}-risposte.pdf`;
      const blob = await buildWorkoutPdf({
        exercise,
        student,
        withAnswers,
        answers: withAnswers ? answers : undefined,
        lang,
      });
      writeFileSync(`${out}/${file}`, Buffer.from(await blob.arrayBuffer()));
      manifest.push({
        file,
        lang,
        type,
        withAnswers,
        title: LANGS[lang].appTitle,
        instruction: LANGS[lang].pdfInstructions[type],
        scoreLine: withAnswers ? `Risposte giuste al primo tentativo: ${expectedScore} su ${n}` : null,
        typeMetaEn: LANGS[lang].typeMeta[type].en,
        typeMetaIt: TYPE_META[type].it,
      });
      done += 1;
    }
  }
}
writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`Scritti ${done} PDF sintetici e manifest.json in ${out}`);

