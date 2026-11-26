/**
 * Genera PDF sintetici per verificare la palette uniforme del riordino,
 * le tre lingue, la conservazione delle istruzioni personalizzate e gli
 * ordini alternativi. Nessun dato reale né accesso al database.
 *
 *   pnpm exec tsx scripts/test-riordino-uniforme.ts
 *   python3 scripts/verifica-riordino-uniforme-pdf.py
 *
 * I font sono caricati dal server locale sulla porta 3000; i PDF vanno in /tmp.
 */
import { mkdir, writeFile } from "node:fs/promises";
import type { Exercise, ReorderRole } from "../shared/exercise";
import type { LangCode } from "../shared/languages";

const { buildWorkoutPdf } = await import("../client/src/lib/exportWorkout");
const out = "/tmp/lingue-riordino-uniforme-pdf";
await mkdir(out, { recursive: true });
const student = { cognome: "Sintetico", nome: "Test", data: "07/11/2026", classe: "2A" };

const fixtures: Array<{
  lang: LangCode;
  words: Array<[string, ReorderRole]>;
  answer: string;
  alternative: string;
  translation: string;
}> = [
  { lang: "en", words: [["She", "subject"], ["often", "adverb"], ["eats", "verb"], ["apples.", "other"]], answer: "She often eats apples.", alternative: "Often she eats apples.", translation: "Lei mangia spesso le mele." },
  { lang: "fr", words: [["Elle", "subject"], ["mange", "verb"], ["souvent", "adverb"], ["des", "other"], ["pommes.", "other"]], answer: "Elle mange souvent des pommes.", alternative: "Souvent elle mange des pommes.", translation: "Lei mangia spesso delle mele." },
  { lang: "es", words: [["Ella", "subject"], ["siempre", "adverb"], ["come", "verb"], ["manzanas.", "other"]], answer: "Ella siempre come manzanas.", alternative: "Siempre ella come manzanas.", translation: "Lei mangia sempre mele." },
];

for (const fixture of fixtures) {
  const exercise: Exercise = {
    type: "reorder",
    items: [{
      chips: fixture.words.map(([t, role]) => ({ t, role })),
      answer: fixture.answer,
      alsoCorrect: [fixture.alternative],
      translationIt: fixture.translation,
    }],
  };
  for (const withAnswers of [false, true]) {
    const blob = await buildWorkoutPdf({
      exercise,
      student,
      lang: fixture.lang,
      withAnswers,
      answers: withAnswers ? [{ ok: true, attempts: 0, value: fixture.answer }] : undefined,
    });
    const path = `${out}/${fixture.lang}-${withAnswers ? "con" : "senza"}.pdf`;
    await writeFile(path, Buffer.from(await blob.arrayBuffer()));
    console.log(`PDF sintetico creato: ${path}`);
  }
  if (fixture.lang === "en") {
    const blob = await buildWorkoutPdf({
      exercise,
      student,
      lang: fixture.lang,
      withAnswers: false,
      instructions: "Consegna personale: forma la frase corretta.",
    });
    await writeFile(`${out}/en-personalizzato.pdf`, Buffer.from(await blob.arrayBuffer()));
  }
}

