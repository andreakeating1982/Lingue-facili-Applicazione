import type { GenerateInput } from "../shared/exercise";

/** Il limite riguarda solo le nuove schede: quelle già salvate non vengono toccate. */
export const MAX_GENERATED_QUESTIONS = 10;

type Candidate = Record<string, unknown>;
type Mode = Extract<GenerateInput["type"], "mc" | "reorder">;

function record(value: unknown): value is Candidate {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const INSTRUCTION_LINE_RE = /^(?:esercizio|exercise|exercice|ejercicio|fill in|complete (?:the|les|las|le|la)|choose|read the|reorder|put the words|riordina|completa|scegli|traduci|scrivi|trasforma|coniuga|inserisci|rellena|elige|compl[eè]te|mets?\s+les\s+mots)\b/i;
const OPTION_LINE_RE = /^(?:[a-d][.)]|[-•]\s*[a-d][.)])\s/i;

/** Vero solo quando il docente chiede esplicitamente di creare/inventare nuove
 *  domande (es. comprensione di un brano narrativo privo di quesiti). */
export function teacherRequestsExtraQuestions(adaptation?: string): boolean {
  if (!adaptation?.trim()) return false;
  return /\b(?:inventa\w*|aggiung\w*|crea\s+(?:\d+|alcun\w*|nuov\w*)\s+(?:domand\w*|quesit\w*|fras\w*)|formula\s+(?:\d+\s+)?domand\w*|comprensione\s+del\s+testo)\b/i.test(adaptation);
}

/** Indizio conservativo per gli elenchi numerati in ordine. La classificazione
 *  generale di consegne, risposte e frasi resta affidata all'IA: i formati
 *  ambigui non vengono interpretati qui come un elenco certo. */
export function numberedSourceHint(text: string, mode: Mode): {
  questionCount: number;
  requiredRows: number;
  rowCount: number;
  hasTrailingContent: boolean;
} | null {
  const lines = text.split(/\r?\n/);
  const rows: Array<{ number: number; text: string; lineIndex: number }> = [];
  lines.forEach((line, lineIndex) => {
    const match = line.match(/^\s*(\d{1,3})[.)]\s+(\S.*)$/);
    if (match) rows.push({ number: Number(match[1]), text: match[2], lineIndex });
  });
  if (rows.length < 2 || rows.some((row, i) => i > 0 && row.number !== rows[i - 1].number + 1)) return null;

  const lastRowLine = rows[rows.length - 1].lineIndex;
  const hasTrailingContent = lines.slice(lastRowLine + 1).some((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed || OPTION_LINE_RE.test(trimmed) || INSTRUCTION_LINE_RE.test(trimmed)) return false;
    // Una riga corta di sole opzioni separate da "/" dopo l'ultimo punto non è una nuova domanda.
    if (/^\([^()\n]+\)$/.test(trimmed)) return false;
    return trimmed.split(/\s+/).length >= 2;
  });

  let questionCount = 0;
  let requiredRows = 0;
  for (const row of rows) {
    // Una frase di riordino vale sempre un item; in scelta multipla ogni
    // lacuna (o coppia di alternative senza lacuna) vale una domanda.
    const gaps = (row.text.match(/_{2,}|\.{3,}|…/g) ?? []).length;
    const alternatives = gaps === 0 ? (row.text.match(/\([^()\n]*\/[^()\n]*\)/g) ?? []).length : 0;
    const count = mode === "reorder" ? 1 : Math.max(1, gaps || alternatives);
    if (questionCount < MAX_GENERATED_QUESTIONS) requiredRows++;
    questionCount += count;
  }
  return { questionCount, requiredRows, rowCount: rows.length, hasTrailingContent };
}

/** Stima superiore prudente del numero massimo di item genuini in una fonte
 *  NON numerata con meno di 10 frasi/domande, così da bloccare l'aggiunta di
 *  domande inventate dall'IA per arrivare a 10. Restituisce null se il testo è
 *  lungo o strutturalmente ambiguo. */
export function maxUnnumberedItemsHint(text: string, mode: Mode): number | null {
  const contentLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !OPTION_LINE_RE.test(l) && !INSTRUCTION_LINE_RE.test(l));
  if (!contentLines.length) return null;

  const joined = contentLines.join("\n");
  // Conta frasi separate da punto, punto interrogativo, esclamativo, punto e virgola o a capo.
  const sentenceChunks = joined
    .replace(/_{2,}|\.{3,}|…/g, " __GAP__ ")
    .split(/(?:[.!?]+(?:\s+|$)|\n+)/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && /\p{L}/u.test(s));

  if (mode === "reorder") {
    const upper = Math.max(contentLines.length, sentenceChunks.length);
    return upper >= 1 && upper < MAX_GENERATED_QUESTIONS ? upper : null;
  }

  const gapCount = (joined.match(/_{2,}|\.{3,}|…/g) ?? []).length;
  const altCount = (joined.match(/\([^()\n]*\/[^()\n]*\)/g) ?? []).length;
  const bracketCount = (joined.match(/\[[^[\]\n]+\]/g) ?? []).length;
  const upper = Math.max(contentLines.length, sentenceChunks.length, gapCount, altCount, bracketCount);
  return upper >= 1 && upper < MAX_GENERATED_QUESTIONS ? upper : null;
}

/** Indizio aggiuntivo per frasi o lacune non numerate poste su righe separate.
 *  Non contare le opzioni etichettate a)/b) né le istruzioni come domande.
 *  I testi ambigui, ad esempio un brano con domande da inventare, restano
 *  affidati al metadato dell'IA e non vengono considerati qui con certezza. */
export function hasMoreThanTenUnnumbered(text: string, mode: Mode): boolean {
  let count = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^\d{1,3}[.)]\s/.test(line) || OPTION_LINE_RE.test(line)) continue;
    if (INSTRUCTION_LINE_RE.test(line)) continue;
    if (mode === "reorder") {
      if (/[.!?]["'”’)\]]*$/.test(line) && line.split(/\s+/).length >= 2) count++;
    } else {
      const gaps = (line.match(/_{2,}|\.{3,}|…/g) ?? []).length;
      const alternatives = gaps === 0 ? (line.match(/\([^()\n]*\/[^()\n]*\)/g) ?? []).length : 0;
      count += gaps || alternatives || Number(/\?\s*$/.test(line));
    }
    if (count > MAX_GENERATED_QUESTIONS) return true;
  }
  return false;
}

function countMcQuestions(value: unknown): number {
  if (!record(value) || !Array.isArray(value.segments)) return 1;
  return Math.max(1, value.segments.filter((segment) => record(segment) && segment.t === "blank").length);
}

/** Taglia una frase a più lacune se il confine dei 10 la attraversa. Si
 *  conservano il testo e le lacune iniziali, troncando prima della prima
 *  lacuna esclusa; anche la traduzione segue lo stesso confine. */
function cutMcItem(item: Candidate, allowed: number): Candidate {
  if (!Array.isArray(item.segments) || allowed < 1) throw new Error("Impossibile individuare le prime lacune della frase.");
  const visible: unknown[] = [];
  let included = 0;
  let cut = false;
  for (const segment of item.segments) {
    if (record(segment) && segment.t === "blank") {
      if (included >= allowed) { cut = true; break; }
      included++;
    }
    visible.push(segment);
  }
  if (!cut || included !== allowed) throw new Error("Impossibile delimitare le prime lacune della frase.");
  visible.push({ t: "text", v: " …" });

  if (typeof item.translationIt !== "string") throw new Error("Manca la traduzione della frase al limite delle 10 domande.");
  const translations = Array.from(item.translationIt.matchAll(/_{2,}|\.{3,}|…/g));
  const firstOmitted = translations[allowed];
  if (!firstOmitted || firstOmitted.index === undefined) {
    throw new Error("La traduzione deve indicare anche le lacune successive prima del ritaglio.");
  }
  const translationIt = `${item.translationIt.slice(0, firstOmitted.index).trimEnd()} …`;
  const result: Candidate = { ...item, segments: visible, translationIt };
  // Il campo storico source può contenere la parte esclusa: non va usato per
  // ricostruire o rivelare domande che non fanno più parte della scheda.
  delete result.source;
  if (allowed === 1) {
    if (Array.isArray(item.steps) && record(item.steps[0]) && Array.isArray(item.steps[0].optionsTranslationIt) && !Array.isArray(result.optionsTranslationIt)) {
      result.optionsTranslationIt = item.steps[0].optionsTranslationIt;
    }
    delete result.steps;
  } else if (Array.isArray(item.steps)) {
    result.steps = item.steps.slice(0, allowed);
  }
  return result;
}

/** Impone il limite prima dello schema di lettura (che accetta anche schede
 *  storiche più lunghe). Le domande oltre il confine non sono salvate nella
 *  scheda nuova; il testo originale del docente resta invece invariato. */
export function limitCandidate(raw: Candidate, mode: Mode): { candidate: Candidate; clipped: boolean } {
  if (!Array.isArray(raw.items) || (raw.type && raw.type !== mode)) return { candidate: raw, clipped: false };
  const retained: unknown[] = [];
  let remaining = MAX_GENERATED_QUESTIONS;
  let clipped = false;

  for (const value of raw.items) {
    if (remaining <= 0) { clipped = true; continue; }
    const questions = mode === "mc" ? countMcQuestions(value) : 1;
    if (questions > remaining) {
      if (mode !== "mc" || !record(value)) throw new Error("Impossibile separare le domande oltre il limite.");
      retained.push(cutMcItem(value, remaining));
      remaining = 0;
      clipped = true;
      continue;
    }
    retained.push(value);
    remaining -= questions;
  }
  return { candidate: { ...raw, items: retained }, clipped };
}
