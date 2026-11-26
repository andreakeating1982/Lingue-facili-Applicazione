/**
 * Ingresso storico della generazione. Per i nuovi esercizi `generateExercise`
 * delega a `inclusiveGeneration.ts` (riordino o scelta multipla, istruzioni
 * docente e traduzioni). Le funzioni precedenti rimangono per compatibilità
 * con il controllo storico `checkTypes`, non sono il percorso attivo di
 * creazione né un fallback da mostrare silenziosamente all'utente.
 */
import { chatCompletion } from "./_core/chat";
import { generateInclusiveExercise } from "./inclusiveGeneration";
import {
  exerciseSchema,
  feasibilitySchema,
  ALL_FEASIBLE,
  type Exercise,
  type Feasibility,
  type GenerateInput,
  type ReorderItem,
  type ReorderRole,
} from "../shared/exercise";

import { langConfig, type LangCode } from "../shared/languages";

/** System prompt del «docente» esperto della lingua scelta. */
function buildSystemPrompt(lang: LangCode): string {
  const L = langConfig(lang);
  return [
    `You are an expert ${L.ai.teacherLang} teacher and inclusive-education specialist.`,
    `You transform the teacher's own ${L.ai.teacherLang} EXERCISE into a word-reordering activity for students with mild-to-moderate intellectual disabilities.`,
    "CRITICAL RULE: the source material is the user's own exercise (possibly transcribed from a photo, so it may contain errors). SOLVE it faithfully: fill every gap with the CORRECT answer (if options are given, pick the correct one; otherwise supply the grammatically correct word), choose the correct option of every multiple-choice question, answer the questions, and fix transcription errors (spelling, punctuation, capitals, OCR artifacts). Keep the original wording of the exercise's sentences as much as possible: add or change ONLY what is needed to make each sentence complete and correct. Never invent new ideas and never translate.",
    "One single focus per item; positive, concrete language.",
    "You ALWAYS reply with STRICT JSON only: no markdown, no code fences, no explanations before or after.",
  ].join(" ");
}

function extractJson(raw: string): unknown {
  let s = raw.trim();
  // rimuove eventuali fence markdown
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON found");
  return JSON.parse(s.slice(start, end + 1));
}

/** Normalizza una stringa per i confronti: minuscolo, apostrofi uniformati,
    punteggiatura tolta, spazi compressi. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'")
    .replace(/[^a-zà-öø-ÿœæ0-9'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Divisore di frasi CONDIVISO: non spezza dopo una serie di puntini
    («...............»), tipica delle schede da completare — senza questa
    regola «Kate ............... a brother.» verrebbe divisa in due
    frammenti senza senso. Spezza invece dopo punto normale, punto
    esclamativo e punto interrogativo. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?:(?<=[^.]?\.)|(?<=[?!]))\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Frasi RAW del testo (maiuscole e punteggiatura originali). */
function rawSentences(text: string): string[] {
  return splitSentences(text);
}

/** Lista ORDINATA delle frasi utilizzabili del testo (una per frase vera):
    la prima riga è spesso il titolo dell'esercizio, quindi contano solo i
    segmenti che terminano con punteggiatura (o l'ultimo, se il testo finisce
    senza punto). Le righe con SPAZI DA RIEMPIRE valgono anche se contengono
    poche parole («1. I ...............»): vengono comunque completate
    dall'AI, quindi non vanno mai escluse dalla mappatura. */
function usableSourceSentences(text: string): string[] {
  const parts = splitSentences(text);
  const GAP = /(_{2,}|\.{4,}|…)/;
  return parts.filter((s, i) => {
    const words = s
      .split(/\s+/)
      .filter((w) => !GAP.test(w)) // gli spazi da riempire non contano
      .filter((w) => !/^\d+[.):]?$/.test(w)) // neanche la numerazione
      .length;
    const minWords = GAP.test(s) ? 1 : 4;
    if (words < minWords) return false;
    if (/[.!?…]["'”’\))\]]*$/.test(s)) return true;
    return i === parts.length - 1;
  });
}

function buildPrompt(input: GenerateInput): string {
  const src = input.text.slice(0, 10000);
  const L = langConfig(input.lang);
  /* Il numero di item segue il testo: un riordino per OGNI frase utile. */
  const sents = usableSourceSentences(src);
  const nRe = sents.length >= 3 ? sents.length : 5;
  const mapping =
    sents.length >= 3
      ? [
          `SENTENCE MAPPING (STRICT): the exercise contains about ${sents.length} sentence lines:`,
          ...sents.map((s, i) => `${i + 1}. ${s}`),
          `Build the items going from the FIRST line to the LAST, in this order. NEVER skip, merge, reorder or invent sentences.`,
        ]
      : [
          "COVERAGE: build the items from the WHOLE exercise, going from the beginning to the end. The FIRST item MUST use the FIRST sentence of the text whenever it fits the task; if that first line is really unusable (e.g. a title or an instruction), start from the first COMPLETE sentence after it.",
        ];
  return [
    `SOURCE MATERIAL (${L.ai.teacherLang}) - the teacher's own EXERCISE. It is the STARTING POINT for every item:`,
    `"""`,
    src,
    `"""`,
    "",
    `TASK: transform this exercise into ${nRe} WORD-REORDERING items.`,
    `STEP 1 - RECOGNIZE the exercise: it can be fill-in-the-blank (gaps shown as "___" or dots "..........."), multiple choice (options A/B/C or listed words), circle-the-correct-word, answer-the-questions, true/false, or simple sentences.`,
    `STEP 2 - SOLVE it: write every sentence COMPLETE and CORRECT. Replace EVERY gap with the CORRECT answer: if options are listed, pick the one that is grammatically correct; if there are no options, supply the correct word from the grammar and meaning of the sentence. Answer the questions. Fix transcription errors (OCR artifacts, spelling, punctuation, capitals). Keep the original wording of each sentence as much as possible: add or change ONLY what is needed to complete it correctly.`,
    `MANY MISSING WORDS: if a sentence has FEW given words and MOSTLY gaps («I ...............», «She ............... not ...............»), do NOT skip it and do NOT leave it incomplete: complete it correctly using the context, the options in parentheses, or the grammar of the exercise. If no hint tells you WHICH content word to insert, write a SIMPLE, CONCRETE word that makes the sentence correct and natural («She ............... not ...............» becomes "She is not tired.").`,
    `SENTENCES ALREADY COMPLETE: if a sentence of the exercise is already complete and correct with NOTHING missing, copy it EXACTLY, character by character: do NOT rewrite, paraphrase, shorten, reorder or reword it in any way. The "different order of the words" of the exercise comes ONLY from the game (the app scrambles the chips): your job for those sentences is only to split them into chips in the sentence's own order.`,
    `STEP 3 - build ONE word-reordering item per COMPLETE sentence, in the same order as the exercise, with 3-14 words each.`,
    `IGNORE THE INSTRUCTIONS: the text may contain the instructions of the exercise (like "Fill in the gaps with...", "Complete the sentences with...", "Answer the questions:", "Choose the correct option") pasted together with the exercise. DISCARD them completely: never turn them into items, never merge their words into the sentences, and never use them as source. Build the items ONLY from the ACTUAL exercise sentences.`,
    `SKIP COMPLETELY: titles, numbering ("1.", "2."), instruction lines (like "Fill in the gaps with...", "Answer the questions:", "Choose the correct option") EVEN IF they end with a period: they are NOT sentences of the exercise. Every exercise sentence WITH A GAP or with a QUESTION MUST become one item: do not skip any of them.`,
    `The completed sentence must NOT contain gaps ("___", dots) and must NOT keep the answer hints in parentheses: the hint is REPLACED by the actual correct answer.`,

    `EXAMPLE: the line «1. Kate ............... a brother. (have / has)» becomes the item with answer "Kate has a brother." (the gap filled with "has", the hint removed). The line «4. Where does Mary live? (in Rome)» becomes the item with answer "Mary lives in Rome." (the question turned into its answer, the hint removed).`,
    ...mapping,
    `For every item return "chips": the words of the completed sentence in CORRECT order, each with a "role": "subject" (who), "verb" (action/being verb), "adverb" (frequency/time adverbs like ${L.ai.reorderAdverbs}), "other" (everything else). Punctuation attaches to the previous word. Also return "answer": the complete correct sentence.`,
    `ALSO-CORRECT ORDERS: if the completed sentence has ANOTHER word order that is EQUALLY grammatically correct (e.g. the subject can be placed before or after the verb — "No sería extraño que condujera todo el tiempo mi marido." / "No sería extraño que mi marido condujera todo el tiempo.", or a time/place complement can move), add up to 2 such orders in the optional "alsoCorrect" array. EVERY alternative must use EXACTLY the SAME words as "answer" (punctuation included, attached the same way), only in the different order. If no other order is correct, OMIT "alsoCorrect".`,
    `Reply with JSON only, exactly this shape:`,
    L.ai.reorderExample,
  ].join("\n");
}

/**
 * Prompt di SALVATAGGIO (ultimi tentativi): istruzioni minime — l'unica
 * priorità è un JSON VALIDO con le frasi COPIATE ESATTAMENTE dal testo.
 */
function buildRescuePrompt(input: GenerateInput): string {
  const src = input.text.slice(0, 10000);
  const head = [
    "SOURCE TEXT:",
    '"""',
    src,
    '"""',
    "",
    "Create 4-5 word-reordering items from DIFFERENT complete sentences of the text (4-12 words), each COPIED EXACTLY, character by character. If a sentence contains gaps (\"___\" or dots), replace the gap with a simple grammatically correct word.",
    "Return STRICT JSON only: no markdown, no code fences, no explanations.",
    "",
    `Per item: \"answer\" = the exact copied sentence (4-12 words); \"chips\" = its words in the SAME order, one {\"t\":\"<word>\",\"role\":\"other\"} per word (first word role \"subject\"), punctuation attached to the previous word.`,
    `JSON shape: ${langConfig(input.lang).ai.rescueReorderExample}`,
  ].join("\n");
  return head;
}

async function askAi(input: GenerateInput): Promise<Exercise> {
  let lastError: unknown = null;
  let lastRaw = "";
  /* 3 tentativi completi + 2 tentativi di SALVATAGGIO con prompt minimo e
     validazione rilassata: quasi nessun testo deve restare senza esercizio. */
  for (let attempt = 0; attempt < 5; attempt++) {
    const rescue = attempt >= 3;
    try {
      const raw = await chatCompletion({
        messages: [
          { role: "system", content: buildSystemPrompt(input.lang) },
          { role: "user", content: rescue ? buildRescuePrompt(input) : buildPrompt(input) },
          ...(attempt > 0 && lastRaw
            ? [
                { role: "assistant" as const, content: lastRaw },
                {
                  role: "user" as const,
                  content: `Your previous JSON was INVALID: ${
                    lastError instanceof Error ? lastError.message : String(lastError)
                  }. Return the corrected STRICT JSON only, following EXACTLY the shape from the task.`,
                },
              ]
            : []),
        ],
        temperature: attempt === 0 ? 0.4 : 0.2,
        max_tokens: 8000,
      });
      lastRaw = raw;
      // Il modello a volte omette il discriminante: lo forziamo noi
      const obj = extractJson(raw) as Record<string, unknown>;
      const parsed = exerciseSchema.parse({ ...obj, type: input.type });
      if (parsed.type !== "reorder") {
        throw new Error("only word-reordering exercises are generated");
      }
      /* Coerenza dei riordini: le chip compongono ESATTAMENTE la frase
         risposta, e ogni frase completata è di lunghezza giocabile. */
      for (const [i, item] of parsed.items.entries()) {
        const wc = norm(item.answer).split(" ").filter(Boolean).length;
        if (!rescue && (wc < 3 || wc > 14)) {
          throw new Error(
            `REORDER item ${i + 1}: every COMPLETED sentence must have 3-14 words (got ${wc}) in "answer": "${item.answer.slice(0, 60)}". Check that every gap is filled and every sentence is complete.`
          );
        }
        /* La frase completata NON deve più contenere spazi da riempire,
           suggerimenti tra parentesi o frasi d'istruzione: se li contiene,
           l'item va ricostruito (retry correttivo). */
        if (/(_{2,}|\.{4,}|…)/.test(item.answer)) {
          throw new Error(
            `REORDER item ${i + 1}: the answer "${item.answer.slice(0, 60)}" still contains a GAP ("___" or dots). Fill every gap with the CORRECT answer and return the COMPLETE sentence.`
          );
        }
        if (/\([^)]*\/[^)]*\)/.test(item.answer)) {
          throw new Error(
            `REORDER item ${i + 1}: the answer "${item.answer.slice(0, 60)}" still contains answer OPTIONS in parentheses. Replace the hint with the ONE correct answer.`
          );
        }
        if (
          !rescue &&
          /\b(gaps|blanks|correct form|right option|in brackets|following words)\b/i.test(item.answer)
        ) {
          throw new Error(
            `REORDER item ${i + 1}: "${item.answer.slice(0, 60)}" is an INSTRUCTION line, not a sentence of the exercise. Skip instructions and use the exercise sentences WITH GAPS or QUESTIONS, completed with their correct answers.`
          );
        }
        const chips = norm(item.chips.map((c) => c.t).join(" "));
        if (chips !== norm(item.answer)) {
          throw new Error("reorder: the chips do not compose the answer sentence");
        }
      }
      /* Sanificazione degli ORDINI ALTERNATIVI (alsoCorrect): si tengono
         solo quelli che usano ESATTAMENTE le stesse parole dell'answer
         (stesso multiset, punteggiatura inclusa) e che sono davvero un
         ordine diverso. Quelli sbagliati si TOLGONO senza far fallire
         la generazione: un'alternativa in meno non rompe nulla, un
         item in meno sì. */
      const wordKey = (s: string) => norm(s).split(" ").filter(Boolean).sort().join(" ");
      for (const item of parsed.items) {
        if (!item.alsoCorrect) continue;
        const key = wordKey(item.answer);
        const kept = item.alsoCorrect.filter(
          (a) => wordKey(a) === key && !sameNorm(a, item.answer)
        );
        if (kept.length > 0) item.alsoCorrect = kept;
        else delete item.alsoCorrect;
      }
      return parsed;
    } catch (err) {
      lastError = err;
      console.error(
        `[GENERAZIONE ${input.type}] tentativo ${attempt + 1}${rescue ? " (salvataggio)" : ""} fallito:`,
        err instanceof Error ? err.message : String(err)
      );
      /* Limite di piano (429 «limit of allowed words»): ritentare è
         inutile — si passa subito al costruttore di riserva. */
      if (isPlanLimit(err)) break;
    }
  }
  throw new Error(
    `AI generation failed after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/* ------------------------------------------------------------------ */
/* Fallback deterministico: l'insegnante non deve mai restare bloccato  */
/* ------------------------------------------------------------------ */

/** Riordina senza AI: le parole ESATTE delle frasi già complete del testo
    (il client mescola i chip per il gioco). Le righe con spazi da
    riempire («___», «......») vengono SALTATE: senza AI non si può sapere
    la risposta giusta, e una frase incompleta sarebbe un esercizio sbagliato. */
function fallbackReorder(text: string): Exercise {
  const hasGap = (s: string) => /(_{2,}|\.{4,}|…)/.test(s);
  const sents = rawSentences(text).filter((s) => {
    if (hasGap(s)) return false;
    const n = s.split(/\s+/).length;
    return n >= 4 && n <= 12;
  });
  if (sents.length < 3) {
    throw new Error(
      "il testo è un esercizio da completare e senza AI non posso sapere le risposte giuste: servono almeno 3 frasi già complete"
    );
  }
  /* Massimo 15 frasi per esercizio richiesto dall'insegnante. */
  const items: ReorderItem[] = sents.slice(0, 15).map((s) => ({
    chips: s.split(/\s+/).map((w, i) => ({ t: w, role: (i === 0 ? "subject" : "other") as ReorderRole })),
    answer: s,
  }));
  return exerciseSchema.parse({ type: "reorder", items });
}

/** Uguaglianza Normalizzata di due frasi (per la sanificazione di
    alsoCorrect: un'alternativa uguale all'answer non è un'alternativa). */
function sameNorm(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

/** Errore di limite del piano AI (429 «limit of allowed words»): il
    ritento non serve — meglio passare subito al costruttore di riserva. */
function isPlanLimit(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /\b429\b|limit of allowed words|upgrade your plan/i.test(m);
}

/** Fallback per tipologia: solo il RIORDINO ha un costruttore deterministico
    che non richiede l'AI (le altre tipologie non esistono più). */
export function buildFallbackExercise(input: GenerateInput, cause: unknown): Exercise {
  const text = input.text.slice(0, 10000);
  const limitMessage =
    "Il piano AI ha esaurito le parole disponibili (errore 429): aggiorna l'abbonamento su easy-peasy.ai e riprova più tardi.";
  const finalError = () => {
    if (isPlanLimit(cause)) return new Error(limitMessage);
    return cause instanceof Error ? cause : new Error(String(cause));
  };
  try {
    const ex = fallbackReorder(text);
    console.error("[GENERAZIONE] fallback deterministico usato per il riordino (AI non disponibile)");
    return ex;
  } catch (fbErr) {
    const motivo = fbErr instanceof Error ? fbErr.message : String(fbErr);
    console.error("[GENERAZIONE] fallback non riuscito:", motivo);
    if (isPlanLimit(cause)) {
      throw new Error(`${limitMessage} Inoltre il testo non basta per il costruttore di riserva (${motivo}).`);
    }
    throw new Error(
      `Nemmeno il costruttore di riserva riesce a usare questo testo (${motivo}). ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
  }
}

/** Punto d'ingresso: una sola chiamata IA per adattamento e traduzioni.
 *  Non sostituire silenziosamente una richiesta del docente con un esercizio
 *  deterministico diverso: se l'IA non riesce, l'utente può correggere e riprovare. */
export async function generateExercise(input: GenerateInput): Promise<Exercise> {
  return generateInclusiveExercise(input);
}

/* ------------------------------------------------------------------ */
/* Correzione del testo (errori di trascrizione) prima della generazione */
/* ------------------------------------------------------------------ */

function buildTextCheckPrompt(lang: LangCode): string[] {
  const L = langConfig(lang);
  return [
    `You proofread a ${L.ai.teacherLang} exercise text for a worksheet generator used by students with mild-to-moderate intellectual disabilities.`,
    "The text is often transcribed from a photo (OCR) or typed by hand, so it can contain TRANSCRIPTION ERRORS: wrong or missing letters, words joined together or split apart, wrong or missing capital letters, missing/wrong/doubled punctuation, stray OCR symbols, numbers instead of letters. It can also contain grammar or spelling mistakes.",
    "TASK 1 - CORRECT THE TEXT: return the full corrected text. Keep the SAME lines, the SAME order, the SAME meaning and the SAME language: fix ONLY errors. Do not rewrite the style, do not add or remove lines, do not translate, and do NOT solve the exercise: gaps (\"___\", \"........\") and listed options must stay exactly as they are.",
    'TASK 2 - LIST the corrections: one {"before":"...","after":"..."} entry per fix, with SHORT fragments (max 40 characters each, copy the exact fragment you changed). If the text is already correct, correctedText must be exactly the input text and corrections must be [].',
    "The adaptability check is always positive: set every feasible value to true and leave reasons empty.",
    'Reply with STRICT JSON only: {"correctedText":"<the full corrected text>","corrections":[{"before":"...","after":"..."}],"feasible":{"mc":true,"tf":true,"match":true,"matchIt":true,"reorder":true},"reasons":{}}.',
  ];
}

/**
 * Corregge gli errori di trascrizione del testo (restituendo correctedText +
 * corrections). In caso di errore AI restituisce ALL_FEASIBLE (fail-open:
 * non blocchiamo mai l'insegnante per un problema tecnico).
 */
export async function checkFeasibility(text: string, _focus?: unknown, lang: LangCode = "en"): Promise<Feasibility> {
  void _focus;
  try {
    const raw = await chatCompletion({
      messages: [
        { role: "system", content: buildTextCheckPrompt(lang).join(" ") },
        {
          role: "user",
          content:
            `SOURCE TEXT (possibly with transcription errors):\n"""\n${text.slice(0, 12000)}\n"""\n\nCorrect the text, list the corrections, and keep every feasible value true. Reply with the STRICT JSON only.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });
    const parsed = feasibilitySchema.parse(extractJson(raw));
    return parsed;
  } catch (err) {
    console.error("[checkFeasibility] fallito, fail-open:", err);
    return ALL_FEASIBLE;
  }
}
