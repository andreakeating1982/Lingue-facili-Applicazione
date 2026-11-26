/**
 * Rigenera gli 8 PDF di prova dai JSON già prodotti da test-all-types.ts
 * (senza rilanciare l'AI) — utile per iterare sul layout del PDF.
 * Uso: npx tsx scripts/rebuild-pdfs.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from "fs";

const { buildWorkoutPdf } = await import("../client/src/lib/exportWorkout");

const dir = "/tmp/pdf-test";
mkdirSync(dir, { recursive: true });
const student = { cognome: "Rossi", nome: "Marco", data: "15/09/2026", classe: "2A" };

const INSTR =
  "Leggi con attenzione ogni frase e cerchia la risposta che completa la frase nel modo giusto. Se ti serve, ascolta la frase con il pulsante Ascolta e chiedi aiuto all'insegnante quando hai un dubbio. Puoi rileggere il testo quante volte vuoi prima di rispondere. Buon lavoro!";

for (const type of ["mc", "tf", "match", "reorder"]) {
  const ex = JSON.parse(readFileSync(`${dir}/${type}.json`, "utf8"));
  const fake = (ex.type === "match" ? ex.pairs : ex.items).map((_: any, i: number) => ({
    ok: i % 3 !== 2,
    attempts: i % 3 === 0 ? 0 : 2,
    value:
      i % 3 !== 2
        ? ex.type === "mc"
          ? ex.items[i]?.correct ?? "test"
          : String.fromCharCode(65 + (i % 6))
        : "sbagliato",
  }));
  for (const withAnswers of [false, true]) {
    const blob = await buildWorkoutPdf({
      exercise: ex,
      student,
      withAnswers,
      answers: withAnswers ? fake : undefined,
      instructions: INSTR,
    });
    const buf = Buffer.from(await blob.arrayBuffer());
    writeFileSync(`${dir}/${type}-${withAnswers ? "con" : "senza"}-risposte.pdf`, buf);
    console.log(`${type}-${withAnswers ? "con" : "senza"}-risposte.pdf ok`);
  }
}
console.log("fatto");
