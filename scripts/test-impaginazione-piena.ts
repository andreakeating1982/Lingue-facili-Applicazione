/**
 * Verifica IMPAGINAZIONE PIENA: ogni pagina deve riempirsi al massimo prima
 * di passare alla successiva. Include un caso sintetico di 6 item MC
 * spagnoli «con risposte», ispirato alla segnalazione di un item orfano,
 * più scenari di stress per altre tipologie.
 * Nessun dato reale e nessun accesso al database.
 *
 *   pnpm exec tsx scripts/test-impaginazione-piena.ts
 *   python3 scripts/verifica-impaginazione-piena.py
 *
 * I font sono caricati dal server locale sulla porta 3000; i PDF vanno in /tmp.
 */
import { mkdirSync } from "fs";
import type { Exercise, ItemAnswer, McItem, TfItem } from "../shared/exercise";
import type { LangCode } from "../shared/languages";

const { buildWorkoutPdf } = await import("../client/src/lib/exportWorkout");
const out = "/tmp/pdf-impaginazione";
mkdirSync(out, { recursive: true });

const student = { cognome: "Sintetico", nome: "Prova", data: "07/11/2026", classe: "1A" };
const ok = (value: string): ItemAnswer => ({ ok: true, attempts: 0, value });
const ko = (value: string, attempts: number): ItemAnswer => ({ ok: false, attempts, value });

/** Caso sintetico: 6 item brevi, 2 opzioni, tutte le risposte corrette. */
const casoSinteticoItems: McItem[] = [
  { segments: [{ t: "subject", v: "¿Tú", group: "A" }, { t: "blank" }, { t: "text", v: "la merienda, por favor?" }], options: ["preparas", "prepara"], correct: "preparas" },
  { segments: [{ t: "text", v: "Amigos, " }, { t: "subject", v: "¿ustedes", group: "B" }, { t: "text", v: "cómo " }, { t: "blank" }, { t: "text", v: "?" }], options: ["nos llamamos", "se llaman"], correct: "se llaman" },
  { segments: [{ t: "text", v: "Este tren " }, { t: "blank" }, { t: "text", v: "a Valencia a las 10:00." }], options: ["llega", "llegan"], correct: "llega" },
  { segments: [{ t: "text", v: "¿Qué idiomas " }, { t: "blank" }, { t: "subject", v: "vosotras?", group: "A" }], options: ["estudian", "estudiáis"], correct: "estudiáis" },
  { segments: [{ t: "subject", v: "Nosotros", group: "A" }, { t: "blank" }, { t: "text", v: "en el parque todas las tardes." }], options: ["paseamos", "pasean"], correct: "paseamos" },
  { segments: [{ t: "subject", v: "Yo", group: "A" }, { t: "text", v: "te " }, { t: "blank" }, { t: "text", v: "a la biblioteca esta tarde." }], options: ["acompaña", "acompaño"], correct: "acompaño" },
];
const casoSinteticoExercise: Exercise = { type: "mc", items: casoSinteticoItems };

/** Stress MC: item con note, risposte errate con errori e ordini alternativi. */
const stressMc: McItem[] = Array.from({ length: 14 }, (_, i) => ({
  segments: [
    { t: "subject", v: `Soggetto ${i + 1}`, group: i % 2 ? "B" : "A" },
    { t: "text", v: `frase numero ${i + 1} con una parte un po' più lunga per variare le righe` },
    { t: "blank" },
    { t: "text", v: "e un finale." },
  ],
  options: [`opzione-${i}-a`, `opzione-${i}-b`, `opzione-${i}-c`],
  correct: `opzione-${i}-a`,
  ...(i % 3 === 0 ? { alsoCorrect: [`opzione-${i}-c`] } : {}),
}));
const stressMcExercise: Exercise = { type: "mc", items: stressMc };

/** Stress TF: frasi lunghe che si avvolgono su due righi. */
const stressTf: TfItem[] = Array.from({ length: 12 }, (_, i) => ({
  sentence: `Frase numero ${i + 1} dell'esercizio vero o falso, con una coda abbastanza lunga da andare a capo nel foglio ${i + 1}.`,
  highlight: "frase",
  isTrue: i % 2 === 0,
}));
const stressTfExercise: Exercise = { type: "tf", items: stressTf };

/** Stress riordino: frasi da 6-7 tessere, con risposte e alternative. */
const stressReorder: Exercise = {
  type: "reorder",
  items: Array.from({ length: 12 }, (_, i) => ({
    chips: [
      { t: `Parola${i}a`, role: "subject" as const },
      { t: `parola${i}b`, role: "verb" as const },
      { t: `molto${i}`, role: "adverb" as const },
      { t: `lontano${i}.`, role: "other" as const },
    ],
    answer: `Parola${i}a parola${i}b molto${i} lontano${i}.`,
    ...(i % 4 === 0 ? { alsoCorrect: [`Molto${i} Parola${i}a parola${i}b lontano${i}.`] } : {}),
  })),
};

async function make(name: string, opts: Parameters<typeof buildWorkoutPdf>[0]): Promise<void> {
  const blob = await buildWorkoutPdf(opts);
  const bytes = Buffer.from(await blob.arrayBuffer());
  const { writeFileSync } = await import("fs");
  writeFileSync(`${out}/${name}.pdf`, bytes);
  console.log(`PDF sintetico creato: ${out}/${name}.pdf`);
}

const answersMc = stressMc.map((item, i) => (i % 5 === 3 ? ko(`opzione-${i}-b`, 2) : ok(item.correct)));
const answersTf = stressTf.map((item, i) => (i % 4 === 2 ? ko(item.isTrue ? "F" : "V", 1) : ok(item.isTrue ? "V" : "F")));
const answersReorder = stressReorder.items.map((item, i) => (i % 6 === 5 ? ko(item.answer, 1) : ok(item.answer)));

/* Caso analogo alla segnalazione, con anagrafica e frasi inventate. */
await make("mc-caso-sintetico-con", {
  exercise: casoSinteticoExercise,
  student,
  withAnswers: true,
  answers: casoSinteticoItems.map((item) => ok(item.correct)),
  lang: "es" as LangCode,
});
await make("mc-stress-con", { exercise: stressMcExercise, student, withAnswers: true, answers: answersMc, lang: "en" as LangCode });
await make("mc-stress-senza", { exercise: stressMcExercise, student, withAnswers: false, lang: "fr" as LangCode });
await make("tf-stress-con", { exercise: stressTfExercise, student, withAnswers: true, answers: answersTf, lang: "en" as LangCode });
await make("reorder-stress-con", { exercise: stressReorder, student, withAnswers: true, answers: answersReorder, lang: "en" as LangCode });

console.log("Generazione completata: verifica con scripts/verifica-impaginazione-piena.py");

