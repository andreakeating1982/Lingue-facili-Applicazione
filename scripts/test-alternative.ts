/**
 * Verifica ORDINI ALTERNATIVI: un item di riordino con alsoCorrect deve
 * 1) stampare «Anche corretto: ...» nel PDF «con risposte»,
 * 2) non sforare la pagina (altezza esatta include le alternative).
 * Uso: npx tsx scripts/test-alternative.ts
 */
import { writeFileSync, mkdirSync } from "fs";

const { buildWorkoutPdf } = await import("../client/src/lib/exportWorkout");

const dir = "/tmp/pdf-test";
mkdirSync(dir, { recursive: true });

const student = { cognome: "Rossi", nome: "Maria", data: "27/09/2026", classe: "1A" };
const INSTR =
  "Riordina le parole e scrivi la frase corretta.";

const exercise = {
  type: "reorder" as const,
  items: [
    {
      chips: "No sería extraño que condujera todo el tiempo mi marido."
        .replace(/\.$/, "")
        .split(" ")
        .map((t, k) => ({ t, role: k === 0 ? ("other" as const) : k === 4 ? ("verb" as const) : ("other" as const) })),
      answer: "No sería extraño que condujera todo el tiempo mi marido.",
      alsoCorrect: ["No sería extraño que mi marido condujera todo el tiempo."],
    },
    {
      chips: "Mi hermana estudia francés todos los días."
        .replace(/\.$/, "")
        .split(" ")
        .map((t, k) => ({ t, role: k === 0 ? ("subject" as const) : k === 1 || k === 2 ? ("verb" as const) : ("other" as const) })),
      answer: "Mi hermana estudia francés todos los días.",
      alsoCorrect: ["Todos los días mi hermana estudia francés."],
    },
    {
      chips: "El libro está sobre la mesa."
        .replace(/\.$/, "")
        .split(" ")
        .map((t) => ({ t, role: "other" as const })),
      answer: "El libro está sobre la mesa.",
    },
  ],
};

const answers = [
  { ok: true, attempts: 0, value: exercise.items[0].answer },
  { ok: false, attempts: 2, value: exercise.items[1].answer },
  { ok: true, attempts: 0, value: exercise.items[2].answer },
];

for (const withAnswers of [false, true]) {
  const blob = await buildWorkoutPdf({
    exercise,
    student,
    withAnswers,
    answers: withAnswers ? answers : undefined,
    instructions: INSTR,
    lang: "es",
  });
  const buf = Buffer.from(await blob.arrayBuffer());
  const name = `${dir}/alternative-${withAnswers ? "con" : "senza"}-risposte.pdf`;
  writeFileSync(name, buf);
  console.log(`ok: ${name}`);
}
