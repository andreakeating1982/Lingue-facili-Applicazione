/**
 * Test CLI del PDF «senza risposte»: replica un esercizio MC come quello
 * dell'utente (frasi lunghe will/going to, OpenDyslexic) con 8 item per
 * verificare spaziatura fra item e salto pagina.
 * Uso: npx tsx scripts/test-pdf.ts  ->  /tmp/test-workout.pdf
 */
import { writeFileSync } from "node:fs";
import { buildWorkoutPdf } from "../client/src/lib/exportWorkout";
import type { Exercise, StudentData } from "@shared/exercise";

const text = (v: string) => ({ t: "text" as const, v });
const subject = (v: string, group: "A" | "B" = "A") => ({ t: "subject" as const, v, group });
const blank = { t: "blank" as const };

const items: Extract<Exercise, { type: "mc" }>["items"] = [
  {
    source: '"We have no coffee." - "I will get some." (risposta spontanea)',
    segments: [text('"We have no coffee." - "I'), subject("I", "A"), blank, text('get some." (risposta spontanea)')],
    options: ["will", "shall", "are"],
    correct: "will",
    alsoCorrect: ["shall"],
  },
  {
    source: "Look! That car is going to hit the wall!",
    segments: [text("Look! That car"), subject("That car", "B"), blank, text("going to hit the wall!")],
    options: ["is", "are", "am"],
    correct: "is",
  },
  {
    source: "I am meeting the client at three tomorrow - we arranged it last Friday.",
    segments: [text("I"), subject("I", "A"), blank, text("meeting the client at three tomorrow - we arranged it last Friday.")],
    options: ["am", "is", "are"],
    correct: "am",
  },
  {
    source: "They are going to open a new branch next spring - the CEO announced it.",
    segments: [text("They"), subject("They", "A"), blank, text("going to open a new branch next spring - the CEO announced it.")],
    options: ["are", "am", "is"],
    correct: "are",
  },
  {
    source: "Look at those clouds - it is going to rain any minute now!",
    segments: [text("Look at those clouds - it is"), subject("it", "B"), blank, text("to rain any minute now!")],
    options: ["going", "go", "goes"],
    correct: "going",
  },
  {
    source: "She is going to buy a new laptop next weekend because hers is broken.",
    segments: [text("She is"), subject("She", "B"), blank, text("to buy a new laptop next weekend because hers is broken.")],
    options: ["going", "go", "goes"],
    correct: "going",
  },
  {
    source: "I think our team will win the match on Saturday afternoon.",
    segments: [text("I think our team"), subject("our team", "A"), blank, text("win the match on Saturday afternoon.")],
    options: ["will", "are", "is"],
    correct: "will",
  },
  {
    source: "Look! The children are playing football in the park right now.",
    segments: [text("Look! The children"), subject("The children", "A"), blank, text("playing football in the park right now.")],
    options: ["are", "is", "am"],
    correct: "are",
  },
];

const exercise: Exercise = { type: "mc", items };
const student: StudentData = {
  cognome: "Prova",
  nome: "Studente",
  data: "01/01/2026",
  classe: "1A",
};

const blob = await buildWorkoutPdf({ exercise, student, withAnswers: false });
writeFileSync("/tmp/test-workout.pdf", Buffer.from(await blob.arrayBuffer()));
console.log("OK -> /tmp/test-workout.pdf");
