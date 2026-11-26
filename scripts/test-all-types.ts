/**
 * Test end-to-end: genera tutte e 4 le tipologie da un testo di prova con
 * frasi lunghe, applica gli stessi controlli verbatim del server e costruisce
 * i PDF (con e senza risposte) per l'ispezione visiva.
 * Uso: npx tsx scripts/test-all-types.ts  (server di dev attivo su :3000)
 */
import { readFileSync, mkdirSync, writeFileSync } from "fs";

/* env manuale PRIMA degli import dinamici (tsx non carica .env) */
try {
  const env = readFileSync(".env", "utf8");
  for (const m of env.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/gm)) {
    const k = m[1];
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
} catch {
  /* niente .env */
}

const { generateExercise } = await import("../server/exerciseGen");
const { buildWorkoutPdf } = await import("../client/src/lib/exportWorkout");

const TEXT = `Every morning Marco gets up at seven o'clock and drinks a big cup of coffee with his sister Laura in the small kitchen. Laura never drinks coffee because she prefers tea with a lot of sugar. After breakfast they take the crowded bus to school together. Marco usually does his homework in the library after the lessons, because at home there is a lot of noise. On Sundays the family often visits their grandmother in the old house near the lake, and they always bring her a cake.`;

const student = { cognome: "Rossi", nome: "Marco", data: "15/09/2026", classe: "2A" };

const INSTR =
  "Leggi con attenzione ogni frase e cerchia la risposta che completa la frase nel modo giusto. Se ti serve, ascolta la frase con il pulsante Ascolta e chiedi aiuto all'insegnante quando hai un dubbio. Puoi rileggere il testo quante volte vuoi prima di rispondere. Buon lavoro!";

/* --- stessi controlli del server --- */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normStrict(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function stripWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[^a-z0-9'-]/g, "");
}
function vocabOf(text: string): Set<string> {
  return new Set(norm(text).split(" ").map(stripWord).filter((w) => w.length >= 2));
}
function srcSents(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => norm(s))
    .filter((s) => s.split(" ").length >= 3);
}

function checkExercise(ex: any, text: string): string[] {
  const problems: string[] = [];
  const strict = normStrict(text);
  if (ex.type === "mc") {
    ex.items.forEach((it: any, i: number) => {
      if (!it.source || !strict.includes(normStrict(it.source))) {
        problems.push(`MC ${i + 1}: source non verbatim: ${JSON.stringify(it.source ?? null)}`);
        return;
      }
      const words = it.source.split(/\s+/).filter(Boolean);
      const ci = stripWord(it.correct);
      const blankIdx = words.findIndex((w: string) => stripWord(w) === ci);
      if (blankIdx < 0) problems.push(`MC ${i + 1}: correct "${it.correct}" non è una parola della source`);
      const shown: string[] = [];
      words.forEach((w: string, j: number) => {
        if (j !== blankIdx) shown.push(stripWord(w));
      });
      const segWords: string[] = [];
      for (const seg of it.segments) {
        if (seg.t === "blank") continue;
        for (const w of String(seg.v).split(/\s+/).filter(Boolean)) segWords.push(stripWord(w));
      }
      if (JSON.stringify(segWords) !== JSON.stringify(shown)) {
        problems.push(`MC ${i + 1}: i segmenti non ricostruiscono la source`);
      }
      if (!it.options.includes(it.correct)) problems.push(`MC ${i + 1}: correct non tra le opzioni`);
    });
  }
  if (ex.type === "tf") {
    const sents = srcSents(text);
    const vocab = vocabOf(text);
    ex.items.forEach((it: any, i: number) => {
      if (it.isTrue) {
        if (!strict.includes(normStrict(it.sentence))) {
          problems.push(`TF ${i + 1} TRUE non verbatim: ${JSON.stringify(it.sentence)}`);
        }
      } else {
        let ok = false;
        const words = norm(it.sentence).split(" ").map(stripWord);
        for (const s of sents) {
          const orig = s.split(" ").map(stripWord);
          if (orig.length !== words.length) continue;
          const diff: number[] = [];
          for (let k = 0; k < words.length; k++) if (words[k] !== orig[k]) diff.push(k);
          if (diff.length === 1 && vocab.has(words[diff[0]])) {
            ok = true;
            break;
          }
        }
        if (!ok) problems.push(`TF ${i + 1} FALSE non conforme (1 parola del testo): ${JSON.stringify(it.sentence)}`);
      }
      if (!normStrict(it.sentence).toLowerCase().includes(normStrict(it.highlight || "").toLowerCase())) {
        problems.push(`TF ${i + 1}: highlight "${it.highlight}" non nella frase`);
      }
    });
  }
  if (ex.type === "match") {
    const vocab = vocabOf(text);
    ex.pairs.forEach((p: any, i: number) => {
      const tokens = norm(p.word).split(" ").map(stripWord).filter((t: string) => t.length >= 2);
      const missing = tokens.filter((t: string) => !vocab.has(t));
      if (tokens.length === 0 || missing.length > 0) {
        problems.push(`MATCH ${i + 1}: parola "${p.word}" non copiata dal testo`);
      }
    });
  }
  if (ex.type === "reorder") {
    ex.items.forEach((it: any, i: number) => {
      if (!strict.includes(normStrict(it.answer))) {
        problems.push(`REORDER ${i + 1}: frase non verbatim: ${JSON.stringify(it.answer)}`);
      }
      if (norm(it.chips.map((c: any) => c.t).join(" ")) !== norm(it.answer)) {
        problems.push(`REORDER ${i + 1}: i chips non compongono la frase`);
      }
    });
  }
  return problems;
}

const outDir = "/tmp/pdf-test";
mkdirSync(outDir, { recursive: true });

const types = ["mc", "tf", "match", "reorder"] as const;
let anyProblem = false;

for (const type of types) {
  console.log(`\n=== genero ${type} ===`);
  const t0 = Date.now();
  try {
    const ex = await generateExercise({ ...student, text: TEXT, type, optionsCount: 3 });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const problems = checkExercise(ex, TEXT);
    if (problems.length > 0) anyProblem = true;
    console.log(`${type}: generato in ${secs}s — problemi verbatim: ${problems.length}`);
    for (const p of problems) console.log("  !!", p);
    writeFileSync(`${outDir}/${type}.json`, JSON.stringify(ex, null, 2));

    if (ex.type === "mc") ex.items.forEach((it: any, i: number) => console.log(`  MC${i + 1}: ${it.source}`));
    if (ex.type === "tf")
      ex.items.forEach((it: any, i: number) =>
        console.log(`  TF${i + 1} (${it.isTrue ? "V" : "F"}): ${it.sentence}  [${it.highlight}]`)
      );
    if (ex.type === "match") ex.pairs.forEach((p: any, i: number) => console.log(`  M${i + 1}: ${p.word}`));
    if (ex.type === "reorder") ex.items.forEach((it: any, i: number) => console.log(`  R${i + 1}: ${it.answer}`));

    const fake = (ex.type === "match" ? ex.pairs : ex.items).map((_: any, i: number) => ({
      ok: i % 3 !== 2,
      attempts: i % 3 === 0 ? 0 : 2,
      value: i % 3 !== 2 ? (ex.type === "mc" ? ex.items[i]?.correct ?? "test" : String.fromCharCode(65 + (i % 6))) : "sbagliato",
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
      writeFileSync(`${outDir}/${type}-${withAnswers ? "con" : "senza"}-risposte.pdf`, buf);
      console.log(`  PDF ${withAnswers ? "con" : "senza"} risposte scritto`);
    }
  } catch (e) {
    anyProblem = true;
    console.log(`${type}: ERRORE dopo ${((Date.now() - t0) / 1000).toFixed(1)}s —`, e instanceof Error ? e.message : e);
  }
}

console.log(`\nEsito: ${anyProblem ? "CI SONO PROBLEMI" : "TUTTO OK"} → ${outDir}`);
