import { chatCompletion } from "./_core/chat";
import { exerciseSchema, type Exercise, type GenerateInput } from "../shared/exercise";
import { inclusivePrompt } from "./inclusivePrompt";
import {
  hasMoreThanTenUnnumbered,
  limitCandidate,
  maxUnnumberedItemsHint,
  numberedSourceHint,
  teacherRequestsExtraQuestions,
  MAX_GENERATED_QUESTIONS,
} from "./exerciseLimit";

export type InclusiveGenerationResult = { exercise: Exercise; wasTruncated: boolean };

function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La risposta dell'IA non contiene un esercizio valido.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

/** Confronto non sensibile a spazi, punteggiatura e maiuscole. */
function normalized(value: string): string {
  return value.toLocaleLowerCase().replace(/[’‘`´]/g, "'").replace(/[^\p{L}\p{N}'\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function bag(value: string): string {
  return normalized(value).split(" ").filter(Boolean).sort().join(" ");
}

/** Validazione strutturale prima del salvataggio. Il significato delle
 *  alternative rimane da controllare da parte del docente: l'IA può sbagliare. */
export function validateInclusiveResult(raw: Record<string, unknown>, input: GenerateInput): InclusiveGenerationResult {
  if (typeof raw.error === "string" && raw.error.trim()) throw new SourceNeedsReview(raw.error.trim());
  if (input.type !== "mc" && input.type !== "reorder") throw new Error("Scegli riordino oppure risposta multipla.");
  if (raw.type && raw.type !== input.type) throw new Error("Il tipo generato non corrisponde alla scelta.");

  const hint = numberedSourceHint(input.text, input.type);
  const extraRequested = teacherRequestsExtraQuestions(input.adaptation);

  // Impedisce che su elenchi numerati con meno di 10 punti l'IA inventi domande extra per arrivare a 10.
  if (Array.isArray(raw.items) && !extraRequested && hint && !hint.hasTrailingContent && hint.questionCount <= MAX_GENERATED_QUESTIONS && raw.items.length > hint.rowCount) {
    throw new Error(
      `L'esercizio originale contiene solo ${hint.rowCount} punti numerati, ma ne hai generati ${raw.items.length}: adatta esclusivamente le domande/frasi presenti nell'originale senza aggiungerne altre.`
    );
  }

  const { candidate, clipped } = limitCandidate(raw, input.type);
  const exercise = exerciseSchema.parse({ ...candidate, type: input.type });
  const questionCount = exercise.type === "mc"
    ? exercise.items.reduce((sum, item) => sum + Math.max(1, item.segments.filter(segment => segment.t === "blank").length), 0)
    : exercise.type === "reorder" ? exercise.items.length : 0;

  // Se l'elenco numerato ha <= 10 domande e nessun contenuto successivo, non c'è alcun taglio oltre 10.
  const boundedAtMostTen = Boolean(hint && !hint.hasTrailingContent && hint.questionCount <= MAX_GENERATED_QUESTIONS && !clipped);
  const wasTruncated = boundedAtMostTen
    ? false
    : (clipped || raw.hasMoreItems === true || (hint?.questionCount ?? 0) > MAX_GENERATED_QUESTIONS || hasMoreThanTenUnnumbered(input.text, input.type));

  if (questionCount > MAX_GENERATED_QUESTIONS) throw new Error("Il limite delle domande non è stato applicato correttamente.");
  if (hint && (exercise.type === "mc" || exercise.type === "reorder") && exercise.items.length < hint.requiredRows) {
    throw new Error(`La fonte numerata richiede almeno ${hint.requiredRows} righe fra le prime 10 domande, ma ne hai restituite ${exercise.items.length}: includile in ordine.`);
  }
  if (wasTruncated && questionCount < MAX_GENERATED_QUESTIONS) {
    throw new Error(`La fonte supera 10 domande: restituisci tutte le prime ${MAX_GENERATED_QUESTIONS} in ordine.`);
  }
  if (exercise.type === "mc") {
    for (const [i, item] of exercise.items.entries()) {
      const blankCount = item.segments.filter(segment => segment.t === "blank").length;
      if (blankCount > 1 && item.steps?.length !== blankCount) throw new Error(`Domanda ${i + 1}: ogni lacuna richiede un passo distinto con le sue opzioni.`);
      if (item.steps && (blankCount < 2 || item.steps.length !== blankCount)) throw new Error(`Domanda ${i + 1}: il numero di passi non corrisponde alle lacune.`);
      if (item.steps && (item.correct !== item.steps[0].correct || JSON.stringify(item.options) !== JSON.stringify(item.steps[0].options))) throw new Error(`Domanda ${i + 1}: opzioni iniziali e primo passo non coincidono.`);
      if (item.steps && item.steps[0].optionsTranslationIt && !item.optionsTranslationIt) {
        item.optionsTranslationIt = item.steps[0].optionsTranslationIt;
      }
      if (item.steps && item.optionsTranslationIt && item.steps[0].optionsTranslationIt && JSON.stringify(item.optionsTranslationIt) !== JSON.stringify(item.steps[0].optionsTranslationIt)) {
        item.optionsTranslationIt = item.steps[0].optionsTranslationIt;
      }
      /* Evita di mostrare nel testo le alternative non ancora attive, per
         esempio "(writes/write)" trascritto erroneamente fra i segmenti. */
      if (item.steps && item.segments.some(segment => segment.t !== "blank" && /\([^)]*\/[^)]*\)/.test(segment.v))) {
        throw new Error(`Domanda ${i + 1}: le alternative devono comparire soltanto nel proprio passo.`);
      }
      for (const step of item.steps ?? [item]) {
        if (step.options.length !== input.optionsCount) throw new Error(`Domanda ${i + 1}: devono esserci esattamente ${input.optionsCount} opzioni.`);
        if (new Set(step.options.map(normalized)).size !== step.options.length) throw new Error(`Domanda ${i + 1}: le opzioni devono essere diverse.`);
        if (step.options.filter((o) => o === step.correct).length !== 1) throw new Error(`Domanda ${i + 1}: la risposta corretta non coincide con un'opzione.`);
        if (step.optionsTranslationIt !== undefined) {
          if (step.optionsTranslationIt.length !== step.options.length || step.optionsTranslationIt.some((t) => !t.trim())) {
            throw new Error(`Domanda ${i + 1}: optionsTranslationIt deve contenere una traduzione italiana non vuota per ciascuna delle ${step.options.length} opzioni.`);
          }
        }
      }
      if (item.alsoCorrect?.length) throw new Error(`Domanda ${i + 1}: serve una sola risposta corretta.`);
      if (!item.translationIt?.trim()) throw new Error(`Domanda ${i + 1}: manca la traduzione italiana.`);
      /* La traduzione di una frase con lacuna deve conservare la lacuna:
         altrimenti il pulsante mostrerebbe involontariamente la soluzione. */
      const translatedBlanks = item.translationIt.match(/_{2,}|\.{3,}|…/g)?.length ?? 0;
      if (blankCount > 0 && translatedBlanks < blankCount) {
        throw new Error(`Domanda ${i + 1}: la traduzione deve mantenere il vuoto senza completarlo.`);
      }
    }
    return { exercise, wasTruncated };
  }
  if (exercise.type === "reorder") {
    for (const [i, item] of exercise.items.entries()) {
      if (!item.translationIt?.trim()) throw new Error(`Frase ${i + 1}: manca la traduzione italiana.`);
      if (/(_{2,}|\.{4,}|…)/.test(item.answer)) throw new Error(`Frase ${i + 1}: la risposta contiene ancora un vuoto.`);
      if (/\([^)]*\/[^)]*\)/.test(item.answer)) throw new Error(`Frase ${i + 1}: la risposta contiene ancora alternative fra parentesi.`);
      if (/^\s*(?:fill in|complete the|choose the|riordina|completa (?:le|i|il|la)|rellena los|compl[eè]te les)\b/i.test(item.answer)) {
        throw new Error(`Frase ${i + 1}: sembra un'istruzione, non una frase dell'esercizio.`);
      }
      if (normalized(item.chips.map((chip) => chip.t).join(" ")) !== normalized(item.answer)) {
        throw new Error(`Frase ${i + 1}: le parole non ricostruiscono la frase corretta.`);
      }
      if (item.alsoCorrect) {
        const key = bag(item.answer);
        item.alsoCorrect = item.alsoCorrect.filter((alt) => bag(alt) === key && normalized(alt) !== normalized(item.answer));
        if (!item.alsoCorrect.length) delete item.alsoCorrect;
      }
    }
    return { exercise, wasTruncated };
  }
  throw new Error("Questa modalità non è disponibile per i nuovi esercizi.");
}

/** Interfaccia mantenuta per i test e gli script già esistenti. */
export function validateInclusiveExercise(raw: Record<string, unknown>, input: GenerateInput): Exercise {
  return validateInclusiveResult(raw, input).exercise;
}

class SourceNeedsReview extends Error {}

export async function generateInclusiveExerciseWithLimit(input: GenerateInput): Promise<InclusiveGenerationResult> {
  if (input.type !== "mc" && input.type !== "reorder") throw new Error("Scegli riordino oppure risposta multipla.");
  const prompt = inclusivePrompt(input);
  let previous = "";
  let reason = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await chatCompletion({
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
          ...(previous ? [
            { role: "assistant" as const, content: previous },
            {
              role: "user" as const,
              content: `The previous JSON did not pass validation: ${reason}. Correct it: adapt ONLY the exact questions/sentences present in ORIGINAL EXERCISE in source order (NEVER invent or add extra questions when there are fewer than 10; set hasMoreItems: false for <= 10, and true ONLY if ORIGINAL EXERCISE has more than 10). For multiple choice include optionsTranslationIt for every step/item. Return only valid JSON.`,
            },
          ] : []),
        ],
        temperature: 0.2,
        max_tokens: 12000,
        timeoutMs: 65000,
      });
      previous = raw;
      const candidate = extractJson(raw);
      if (typeof candidate.hasMoreItems !== "boolean" && typeof candidate.error !== "string") {
        throw new Error("Inserisci il campo booleano hasMoreItems nel JSON.");
      }
      const hint = numberedSourceHint(input.text, input.type);
      const extraRequested = teacherRequestsExtraQuestions(input.adaptation);
      const unnumberedMax = !hint && !extraRequested ? maxUnnumberedItemsHint(input.text, input.type) : null;
      if (Array.isArray(candidate.items) && unnumberedMax !== null && candidate.items.length > unnumberedMax) {
        throw new Error(
          `L'esercizio originale contiene al massimo ${unnumberedMax} domande o frasi, ma ne hai generate ${candidate.items.length}: adatta solo quelle presenti nell'esercizio originario senza aggiungerne altre per arrivare a 10.`
        );
      }
      const validated = validateInclusiveResult(candidate, input);
      if (validated.exercise.type === "mc") {
        for (const [i, item] of validated.exercise.items.entries()) {
          for (const step of item.steps ?? [item]) {
            if (!step.optionsTranslationIt || step.optionsTranslationIt.length !== step.options.length) {
              throw new Error(`Domanda ${i + 1}: inserisci optionsTranslationIt con la traduzione italiana di tutte le ${step.options.length} opzioni.`);
            }
          }
        }
      }
      return validated;
    } catch (error) {
      if (error instanceof SourceNeedsReview) throw new Error(error.message);
      reason = error instanceof Error ? error.message : "risposta non valida";
      console.error(`[adattamento IA] tentativo ${attempt + 1}: ${reason.slice(0, 250)}`);
      if (/\b429\b|401|403|not configured/i.test(reason)) break;
    }
  }
  throw new Error("Non sono riuscito ad adattare l'esercizio con l'IA. Controlla il testo e riprova.");
}

/** Compatibilità con le chiamate precedenti che non richiedono i metadati. */
export async function generateInclusiveExercise(input: GenerateInput): Promise<Exercise> {
  return (await generateInclusiveExerciseWithLimit(input)).exercise;
}
