/**
 * Verifica paginazione: usa un esercizio sintetico «CON LE RISPOSTE»
 * (9 item di riordino, 5 su 9 corrette) e controlla che gli item 8-9
 * entrino in pagina 1 se ci stanno davvero (niente riservo fisso 130p).
 * Uso: npx tsx scripts/test-paginazione-reorder.ts
 */
import { writeFileSync, mkdirSync } from "fs";

const { buildWorkoutPdf } = await import("../client/src/lib/exportWorkout");

const dir = "/tmp/pdf-test";
mkdirSync(dir, { recursive: true });

const student = { cognome: "Prova", nome: "Studente", data: "01/01/2026", classe: "1A" };
const INSTR =
  "Riordina le parole e scrivi la frase corretta.";

function ruoli(parts: string[]): { t: string; role: "subject" | "verb" | "adverb" | "other" }[] {
  /* chi = subject (prima parola), verbo = "is wearing", resto = other */
  return parts.map((t, k) => ({
    t,
    role: k === 0 ? ("subject" as const) : t === "is" || t === "wearing" ? ("verb" as const) : ("other" as const),
  }));
}

const sentences = [
  "Elena is wearing white jeans.",
  "Peter is wearing an orange tie.",
  "Jane is wearing a red T-shirt.",
  "John is wearing a brown hat.",
  "Andy is wearing a yellow T-shirt.",
  "Elena is wearing black shoes.",
  "Peter is wearing a brown coat.",
  "Jane is wearing a red skirt.",
  "John is wearing brown shoes.",
];

const exercise = {
  type: "reorder" as const,
  items: sentences.map((s) => ({ chips: ruoli(s.split(" ")), answer: s })),
};

const ok = [true, false, true, true, true, true, false, false, false];
// Usare frasi intere e realistiche, come nel PDF caricato dall'utente:
// un testo segnaposto breve non dimostra che le righe entrino davvero.
const answers = ok.map((o, i) => ({
  // Nell'app si avanza solo quando la frase è corretta; attempts registra
  // gli errori precedenti, che riducono il punteggio al primo tentativo.
  ok: true,
  attempts: o ? 0 : 2,
  value: sentences[i],
}));

for (const withAnswers of [false, true]) {
  const blob = await buildWorkoutPdf({
    exercise,
    student,
    withAnswers,
    answers: withAnswers ? answers : undefined,
    instructions: INSTR,
    lang: "en",
  });
  const buf = Buffer.from(await blob.arrayBuffer());
  const name = `${dir}/paginazione-${withAnswers ? "con" : "senza"}-risposte.pdf`;
  writeFileSync(name, buf);
  console.log(`ok: ${name}`);
}
