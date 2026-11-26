/**
 * Verifica verbatim COMPLETA: controlla che TUTTO il testo mostrato
 * all'alunno sia copiato dal testo sorgente, per tutte e 4 le tipologie.
 * Uso: node scripts/verify-verbatim.mjs <id-esercizio>
 */
import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";

// Risoluzione relativa al progetto, utilizzabile anche dopo l'esportazione.
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
let url = process.env.DATABASE_URL;
if (!url) {
  try {
    const env = readFileSync(envPath, "utf8");
    const m = env.match(/DATABASE_URL=([^\n]+)/);
    if (m) url = m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* niente .env */
  }
}
if (!url) {
  console.error("DATABASE_URL non trovato");
  process.exit(1);
}
const sql = postgres(url);

function norm(s) {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normStrict(s) {
  return s
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripWord(w) {
  return w
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[^a-z0-9'-]/g, "");
}

function vocabOf(text) {
  return new Set(
    norm(text)
      .split(" ")
      .map(stripWord)
      .filter((w) => w.length >= 2)
  );
}

function sourceSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => norm(s))
    .filter((s) => s.split(" ").length >= 3);
}

const id = process.argv[2];
if (!id) {
  console.error("serve l'id: node scripts/verify-verbatim.mjs <id>");
  process.exit(1);
}
const rows = await sql`SELECT exercise, source_text, instructions, feasibility FROM exercises WHERE id = ${id}`;
if (rows.length === 0) {
  console.error("esercizio non trovato:", id);
  process.exit(1);
}
const r = rows[0];
const ex = r.exercise;
const strictSrc = normStrict(r.source_text);
console.log("id:", id, "· tipo:", ex.type);
console.log("istruzioni salvate:", JSON.stringify(r.instructions));
console.log("feasibility salvata:", JSON.stringify(r.feasibility));
console.log("---");

let fail = 0;
let tot = 0;
const check = (label, ok, detail) => {
  tot++;
  console.log(`${ok ? "OK " : "NO "} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) fail++;
};

if (ex.type === "mc") {
  for (const [i, it] of (ex.items || []).entries()) {
    check(
      `MC ${i + 1} source verbatim (maiuscole e punteggiatura)`,
      !!it.source && strictSrc.includes(normStrict(it.source || "")),
      JSON.stringify(it.source || "(mancante)")
    );
    if (it.source) {
      /* i segmenti mostrati devono ricostruire ESATTAMENTE la source,
         con il blank al posto della parola "correct" */
      const words = it.source.split(/\s+/).filter(Boolean);
      const ci = stripWord(it.correct || "");
      const blankIdx = words.findIndex((w) => stripWord(w) === ci);
      const shown = [];
      words.forEach((w, j) => {
        if (j !== blankIdx) shown.push(stripWord(w));
      });
      const segWords = [];
      for (const seg of it.segments || []) {
        if (seg.t === "blank") continue;
        for (const w of String(seg.v).split(/\s+/).filter(Boolean)) segWords.push(stripWord(w));
      }
      check(
        `MC ${i + 1} segmenti = source (meno la parola nascosta)`,
        blankIdx >= 0 && JSON.stringify(segWords) === JSON.stringify(shown),
        `correct="${it.correct}"`
      );
    }
    check(`MC ${i + 1} correct tra le opzioni`, (it.options || []).includes(it.correct), `options=${JSON.stringify(it.options)}`);
  }
}

if (ex.type === "tf") {
  const sents = sourceSentences(r.source_text);
  const vocab = vocabOf(r.source_text);
  for (const [i, it] of (ex.items || []).entries()) {
    if (it.isTrue) {
      check(
        `TF ${i + 1} TRUE verbatim (maiuscole e punteggiatura)`,
        strictSrc.includes(normStrict(it.sentence)),
        JSON.stringify(it.sentence)
      );
    } else {
      let ok = false;
      let swapped = "";
      const words = norm(it.sentence).split(" ").map(stripWord);
      for (const s of sents) {
        const orig = s.split(" ").map(stripWord);
        if (orig.length !== words.length) continue;
        const diff = [];
        for (let k = 0; k < words.length; k++) if (words[k] !== orig[k]) diff.push(k);
        if (diff.length === 1 && vocab.has(words[diff[0]])) {
          ok = true;
          swapped = words[diff[0]];
          break;
        }
      }
      check(
        `TF ${i + 1} FALSE = frase originale con 1 parola del testo sostituita`,
        ok,
        `${JSON.stringify(it.sentence)}${swapped ? ` (sostituita: "${swapped}")` : ""}`
      );
    }
    check(
      `TF ${i + 1} highlight presente nella frase`,
      normStrict(it.sentence).toLowerCase().includes(normStrict(it.highlight || "").toLowerCase()),
      `"${it.highlight}"`
    );
  }
}

if (ex.type === "match") {
  const vocab = vocabOf(r.source_text);
  for (const [i, p] of (ex.pairs || []).entries()) {
    const tokens = norm(p.word).split(" ").map(stripWord).filter((t) => t.length >= 2);
    const missing = tokens.filter((t) => !vocab.has(t));
    check(
      `MATCH ${i + 1} parola copiata dal testo`,
      tokens.length > 0 && missing.length === 0,
      `"${p.word}"${missing.length ? ` mancanti: ${missing.join(",")}` : ""}`
    );
  }
}

if (ex.type === "reorder") {
  for (const [i, it] of (ex.items || []).entries()) {
    check(
      `REORDER ${i + 1} frase verbatim (maiuscole e punteggiatura)`,
      strictSrc.includes(normStrict(it.answer)),
      JSON.stringify(it.answer)
    );
    check(
      `REORDER ${i + 1} chips = frase`,
      norm((it.chips || []).map((c) => c.t).join(" ")) === norm(it.answer)
    );
  }
}

console.log("---");
console.log(fail === 0 ? `VERBATIM: TUTTO OK (${tot} controlli)` : `VERBATIM: ${fail} PROBLEMI su ${tot} controlli`);
process.exit(fail === 0 ? 0 : 1);
