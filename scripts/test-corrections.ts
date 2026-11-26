/**
 * Test del nuovo flusso «testo trascritto con errori»:
 * 1. checkFeasibility corregge gli errori (correctedText + corrections)
 * 2. gli esercizi generati dal testo CORRETTO sono verbatim vs testo corretto
 * 3. il PRIMO item usa la PRIMA frase del testo (copertura)
 * Uso: npx tsx scripts/test-corrections.ts
 */
import { readFileSync } from "fs";

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

const { checkFeasibility, generateExercise } = await import("../server/exerciseGen");

/* Testo trascritto con errori tipici: titolo, niente maiuscole/punteggiatura,
   errori di grammar, parole unite, OCR-like */
const BAD_TEXT = `francais facile exercice
marie est une eleve de paris
tous les matins elle se leve a sept heures et boi du cafe avec du lait
son frere luc ne bois jamais de cafe parce que il prefere le the
apres le petit dejeuner marie prend le bus pour le college le bus est souvent plein
au college elle etudie le francais l'histoire et les sciences elle aime le francais`;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[^a-zà-öø-ÿœæ0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normStrict(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function stripWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[^a-zà-öø-ÿœæ0-9'-]/g, "");
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
function firstUsable(text: string): string | undefined {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .find((s) => s.split(/\s+/).length >= 4);
}
function isFirstVariant(sentence: string, first: string): boolean {
  if (normStrict(sentence) === normStrict(first)) return true;
  const wa = norm(sentence).split(" ");
  const wb = norm(first).split(" ");
  if (wa.length !== wb.length) return false;
  let diff = 0;
  for (let i = 0; i < wa.length; i++) if (wa[i] !== wb[i]) diff++;
  return diff === 1;
}

function checkVerbatim(ex: any, text: string): string[] {
  const problems: string[] = [];
  const strict = normStrict(text);
  if (ex.type === "mc") {
    ex.items.forEach((it: any, i: number) => {
      if (!it.source || !strict.includes(normStrict(it.source))) {
        problems.push(`MC ${i + 1}: source non verbatim vs testo corretto`);
      }
    });
  }
  if (ex.type === "tf") {
    const sents = srcSents(text);
    const vocab = vocabOf(text);
    ex.items.forEach((it: any, i: number) => {
      if (it.isTrue) {
        if (!strict.includes(normStrict(it.sentence))) {
          problems.push(`TF ${i + 1} TRUE non verbatim vs testo corretto`);
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
        if (!ok) problems.push(`TF ${i + 1} FALSE non conforme`);
      }
    });
  }
  if (ex.type === "reorder") {
    ex.items.forEach((it: any, i: number) => {
      if (!strict.includes(normStrict(it.answer))) {
        problems.push(`REORDER ${i + 1}: frase non verbatim vs testo corretto`);
      }
    });
  }
  return problems;
}

let fail = 0;

console.log("=== 1. checkFeasibility su testo trascritto con errori ===");
const check = await checkFeasibility(BAD_TEXT);
console.log("feasible:", JSON.stringify(check.feasible));
console.log("correzioni:", check.corrections?.map((c) => `${c.before} → ${c.after}`).join(" | ") ?? "(nessuna)");
console.log("--- testo corretto ---");
console.log(check.correctedText ?? "(MANCANTE!)");
console.log("---------------------");
if (!check.correctedText) {
  console.log("!! correctedText mancante");
  fail++;
}
const corrected = check.correctedText?.trim() || BAD_TEXT;
const first = firstUsable(corrected);
console.log("\nprima frase attesa nel primo item:", first);

for (const type of ["mc", "tf", "reorder"] as const) {
  console.log(`\n=== 2. genero ${type} dal testo CORRETTO ===`);
  const t0 = Date.now();
  try {
    const ex = await generateExercise({
      cognome: "Rossi",
      nome: "Marco",
      data: "15/09/2026",
      classe: "2A",
      text: corrected.slice(0, 6000),
      type,
      optionsCount: 3,
    });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const problems = checkVerbatim(ex, corrected);
    let firstUsed = false;
    if (ex.type === "mc") firstUsed = isFirstVariant(ex.items[0]?.source ?? "", first ?? "");
    if (ex.type === "tf") firstUsed = isFirstVariant(ex.items[0]?.sentence ?? "", first ?? "");
    if (ex.type === "reorder") firstUsed = isFirstVariant(ex.items[0]?.answer ?? "", first ?? "");
    console.log(
      `${type}: ${secs}s — problemi verbatim: ${problems.length} — prima frase nel primo item: ${firstUsed ? "SI" : "NO"}`
    );
    if (problems.length > 0) fail++;
    if (!firstUsed) fail++;
    for (const p of problems) console.log("  !!", p);
    if (ex.type === "mc") ex.items.forEach((it, i) => console.log(`  MC${i + 1}: ${it.source}`));
    if (ex.type === "tf")
      ex.items.forEach((it, i) => console.log(`  TF${i + 1} (${it.isTrue ? "V" : "F"}): ${it.sentence}`));
    if (ex.type === "reorder") ex.items.forEach((it, i) => console.log(`  R${i + 1}: ${it.answer}`));
  } catch (e) {
    fail++;
    console.log(`${type}: ERRORE dopo ${((Date.now() - t0) / 1000).toFixed(1)}s —`, e instanceof Error ? e.message : e);
  }
}

console.log(`\nEsito: ${fail === 0 ? "TUTTO OK" : `${fail} PROBLEMI`}`);
