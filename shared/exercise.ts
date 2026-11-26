/**
 * Tipi e schemi condivisi (client + server) per gli esercizi generati.
 * Tutte le tipologie sono pensate per studenti con disabilità intellettiva
 * lieve/media: frasi brevi, un solo focus per item, colori-semplificazione.
 */
import { z } from "zod";
import { countWords, MAX_EXERCISE_WORDS, MAX_INPUT_CHARACTERS } from "./textLimits";

export const EXERCISE_TYPES = ["mc", "tf", "match", "matchIt", "reorder"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const TYPE_META: Record<
  ExerciseType,
  { it: string; color: string; soft: string; dark: string }
> = {
  /* Palette allineata a Widget-metacognitivo-per-il-calcolo-di-equazioni
     (#8B3A1A primario terracotta, #EEE2D5 secondario, #2E2118 inchiostro). */
  mc: { it: "Scelta multipla", color: "#8B3A1A", soft: "#EEE2D5", dark: "#8B3A1A" },
  tf: { it: "Vero o falso", color: "#8B3A1A", soft: "#EEE2D5", dark: "#8B3A1A" },
  match: { it: "Abbina immagine e parola", color: "#8B3A1A", soft: "#EEE2D5", dark: "#8B3A1A" },
  matchIt: { it: "Abbina lingua e italiano", color: "#8B3A1A", soft: "#EEE2D5", dark: "#8B3A1A" },
  reorder: { it: "Riordina le parole", color: "#8B3A1A", soft: "#EEE2D5", dark: "#8B3A1A" },
};

/* ---------------- Multiple choice ---------------- */
export const mcSegmentSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("text"), v: z.string() }),
  z.object({ t: z.literal("subject"), v: z.string().min(1), group: z.enum(["A", "B"]) }),
  z.object({ t: z.literal("blank") }),
]);

export const mcStepSchema = z.object({
  options: z.array(z.string().min(1)).min(2).max(4),
  /** Traduzione italiana di ciascuna opzione del passo, nello stesso ordine di options. */
  optionsTranslationIt: z.array(z.string().min(1).max(300)).min(2).max(4).optional(),
  correct: z.string().min(1),
});

export const mcItemSchema = z.object({
  segments: z.array(mcSegmentSchema).min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  /** Traduzione italiana di ciascuna opzione (nello stesso ordine di options).
      Opzionale nello schema di lettura per compatibilità con le schede già salvate. */
  optionsTranslationIt: z.array(z.string().min(1).max(300)).min(2).max(4).optional(),
  /** Traduzione del solo testo presentato, senza rivelare i vuoti. Gli
      esercizi salvati prima di questa funzione possono non averla. */
  translationIt: z.string().min(1).max(1200).optional(),
  correct: z.string().min(1),
  /** Per frasi con più lacune: una serie di scelte per ogni lacuna,
      in ordine. options/correct sopra restano il primo passo per compatibilità. */
  steps: z.array(mcStepSchema).min(2).max(10).optional(),
  /** Altre opzioni che completano correttamente la frase (opzionale): se
      c'è più di una risposta possibile, l'app lo annota a schermo e nel
      PDF e accetta tutte come giuste. */
  alsoCorrect: z.array(z.string().min(1)).max(3).optional(),
  /** Frase originale COMPLETA, copiata verbatim dal testo sorgente (prima
      di togliere la parola del blank): usata per la validazione verbatim. */
  source: z.string().min(3).optional(),
});

/* ---------------- True / False ---------------- */
export const tfItemSchema = z.object({
  sentence: z.string().min(3),
  highlight: z.string().min(1),
  isTrue: z.boolean(),
});

/* ---------------- Match image & word ---------------- */
export const matchPairSchema = z.object({
  word: z.string().min(1),
  it: z.string().min(1),
  emoji: z.string().min(1),
  imagePrompt: z.string().min(3),
  imageUrl: z.string().optional(),
});

/* ---------------- Match lingua straniera & italiano ---------------- */
export const matchItPairSchema = z.object({
  /** Parola o frase nella lingua straniera COPIATA dal testo sorgente
      (1-4 parole). Il nome del campo resta "en" per compatibilità con le
      app della famiglia «Facile»: cambia solo la semantica (es. spagnolo). */
  en: z.string().min(1),
  /** Corrispettivo italiano. */
  it: z.string().min(1),
});

/* ---------------- Word reordering ---------------- */
export const reorderRoleSchema = z.enum(["subject", "verb", "adverb", "other"]);
export const reorderItemSchema = z.object({
  chips: z.array(z.object({ t: z.string().min(1), role: reorderRoleSchema })).min(2),
  answer: z.string().min(2),
  /** Traduzione in italiano, generata insieme all'esercizio. */
  translationIt: z.string().min(1).max(1200).optional(),
  /** Ordini alternativi di parole EQUAMENTE corretti (es. soggetto
      spostato prima o dopo il verbo, complemento spostabile): il
      controllo accetta anche questi, oltre alla frase originale. Ogni
      alternativa usa ESATTAMENTE le stesse parole dell'answer, solo
      in ordine diverso. Opzionale: gli esercizi vecchi non ce l'hanno. */
  alsoCorrect: z.array(z.string().min(1)).max(3).optional(),
});

export const exerciseSchema = z.discriminatedUnion("type", [
  /* Schede storiche fino a 60 item restano leggibili. I nuovi esercizi sono
     limitati a 10 domande nel validatore, non nello schema di lettura. */
  z.object({ type: z.literal("mc"), items: z.array(mcItemSchema).min(1).max(60) }),
  z.object({ type: z.literal("tf"), items: z.array(tfItemSchema).min(3).max(60) }),
  z.object({ type: z.literal("match"), pairs: z.array(matchPairSchema).min(3).max(8) }),
  z.object({ type: z.literal("matchIt"), pairs: z.array(matchItPairSchema).min(3).max(6) }),
  z.object({ type: z.literal("reorder"), items: z.array(reorderItemSchema).min(1).max(60) }),
]);

export type Exercise = z.infer<typeof exerciseSchema>;
export type McItem = z.infer<typeof mcItemSchema>;
export type McSegment = z.infer<typeof mcSegmentSchema>;
export type TfItem = z.infer<typeof tfItemSchema>;
export type MatchPair = z.infer<typeof matchPairSchema>;
export type MatchItPair = z.infer<typeof matchItPairSchema>;
export type ReorderItem = z.infer<typeof reorderItemSchema>;
export type ReorderRole = z.infer<typeof reorderRoleSchema>;

export const studentDataSchema = z.object({
  cognome: z.string().max(80).default(""),
  nome: z.string().max(80).default(""),
  data: z.string().max(40).default(""),
  classe: z.string().max(40).default(""),
});
export type StudentData = z.infer<typeof studentDataSchema>;

/* ---------------- Adattabilità del testo alle 5 tipologie ---------------- */

/** Singola correzione di trascrizione: frammento prima → dopo. */
export const textCorrectionSchema = z.object({
  before: z.string().min(1).max(200),
  after: z.string().max(200),
});

/** Risposta del controllo «questo testo si presta a questa tipologia?».
    Il controllo CORREGGE anche gli errori di trascrizione (foto/OCR o battitura):
    correctedText è il testo sistemato e corrections l'elenco trasparente
    delle modifiche (prima → dopo), mostrate all'insegnante prima di generare. */
export const feasibilitySchema = z.object({
  feasible: z.object({
    mc: z.boolean(),
    tf: z.boolean(),
    match: z.boolean(),
    matchIt: z.boolean(),
    reorder: z.boolean(),
  }),
  /** Motivazioni brevi (italiano semplice) SOLO per le tipologie non adatte. */
  reasons: z.object({
    mc: z.string().optional(),
    tf: z.string().optional(),
    match: z.string().optional(),
    matchIt: z.string().optional(),
    reorder: z.string().optional(),
  }),
  /** Testo CON le correzioni applicate: presente solo se il controllo ha
      trovato errori di trascrizione/grammatica da sistemare. */
  correctedText: z.string().optional(),
  /** Elenco delle correzioni applicate (prima → dopo). */
  corrections: z.array(textCorrectionSchema).max(40).optional(),
});
export type Feasibility = z.infer<typeof feasibilitySchema>;

/** Tutte le tipologie disponibili: usato come fail-open se il controllo fallisce. */
export const ALL_FEASIBLE: Feasibility = {
  feasible: { mc: true, tf: true, match: true, matchIt: true, reorder: true },
  reasons: {},
};

/** Le 4 opzioni del reparto «2 · COSA VUOI ALLENARE CON QUESTO ESERCIZIO?»:
    l'insegnante sceglie UNA categoria; per grammatica, lessico e funzioni
    comunicative scrive anche gli ARGOMENTI SPECIFICI da lavorare (testo
    libero). Guida l'AI e il riconoscimento delle tipologie senza MAI
    cambiare le frasi originali. */
export const FOCUS_CATEGORIES = [
  {
    id: "grammatica",
    it: "GRAMMATICA",
    en: "grammar",
  },
  {
    id: "lessico",
    it: "LESSICO",
    en: "vocabulary",
  },
  {
    id: "funzioni",
    it: "FUNZIONI COMUNICATIVE",
    en: "communicative functions",
  },
  {
    id: "comprensione",
    it: "COMPRENSIONE DEL TESTO",
    en: "text comprehension",
    placeholder: "",
  },
] as const;

export type FocusCategoryId = (typeof FOCUS_CATEGORIES)[number]["id"];
export const FOCUS_CATEGORY_IDS = FOCUS_CATEGORIES.map((c) => c.id) as FocusCategoryId[];

/** Il focus salvato con l'esercizio: categoria + argomenti specifici. */
export const focusSchema = z.object({
  category: z.enum(FOCUS_CATEGORY_IDS as [FocusCategoryId, ...FocusCategoryId[]]),
  /** Argomenti specifici scritti dall'insegnante (per grammatica, lessico e
      funzioni comunicative); assente o vuoto per la comprensione del testo. */
  topics: z.string().max(300).optional(),
});
export type Focus = z.infer<typeof focusSchema>;

/** Etichette dei vecchi chip (versione precedente dell'app), per la
    conversione del focus salvato nelle righe create prima del cambiamento. */
const LEGACY_FOCUS_LABELS: Record<string, string> = {
  "pres-simple": "present simple",
  "pres-continuous": "present continuous",
  "past-simple": "past simple",
  future: "futuro (will / going to)",
  "present-perfect": "present perfect",
  modali: "verbi modali",
  comparativi: "comparativi e superlativi",
};

/** Converte il focus salvato nel DB: il formato vecchio (array di chip) nel
    nuovo formato { category, topics }; il nuovo formato passa invariato. */
export function normalizeFocus(raw: unknown): Focus | undefined {
  if (Array.isArray(raw)) {
    const ids = raw.filter((v): v is string => typeof v === "string");
    if (ids.includes("comprensione")) return { category: "comprensione" };
    const labels = ids
      .map((id) => LEGACY_FOCUS_LABELS[id])
      .filter((v): v is string => Boolean(v));
    if (ids.includes("lessico")) {
      return labels.length > 0
        ? { category: "lessico", topics: labels.join(", ") }
        : { category: "lessico" };
    }
    if (labels.length === 0) return undefined;
    return { category: "grammatica", topics: labels.join(", ") };
  }
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as { category?: unknown }).category === "string"
  ) {
    return raw as Focus;
  }
  return undefined;
}

export const generateInputSchema = studentDataSchema.extend({
  text: z.string().trim().min(1, "Scrivi il testo dell'esercizio.").max(MAX_INPUT_CHARACTERS)
    .refine((value) => countWords(value) <= MAX_EXERCISE_WORDS, `Il testo può contenere al massimo ${MAX_EXERCISE_WORDS} parole.`),
  type: z.enum(EXERCISE_TYPES),
  optionsCount: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  /** Indicazioni del docente per l'IA, separate dalla consegna allo studente. */
  adaptation: z.string().max(MAX_INPUT_CHARACTERS)
    .refine((value) => countWords(value) <= MAX_EXERCISE_WORDS, `La spiegazione può contenere al massimo ${MAX_EXERCISE_WORDS} parole.`).optional(),
  /** Lingua straniera del contenuto: «en» inglese, «fr» francese,
      «es» spagnolo. Guida prompt AI, fallback, PDF e OCR. */
  lang: z.enum(["en", "fr", "es"]).default("en"),
  /** Istruzioni personalizzate per lo studente, in QUALSIASI lingua: le
      scrive l'insegnante e vengono mostrate così come sono (pagina esercizio
      e PDF). Se assenti si usano le istruzioni standard dell'app. */
  instructions: z.string().max(500).optional(),
  /** Esito del controllo di adattabilità mostrato nella schermata 2: viene
      SALVATO con l'esercizio ed è la FONTE UNICA per la pagina finale
      (niente rilanci dell'AI → niente liste incoerenti). */
  feasibility: feasibilitySchema.optional(),
  /** Focus scelto dall'insegnante (categoria + argomenti specifici):
      salvato con l'esercizio e riusato al cambio tipologia (stesso testo). */
  focus: focusSchema.optional(),
});
export type GenerateInput = z.infer<typeof generateInputSchema>;

/** Risposte dello studente: un record per item (ok = riuscito, attempts = tentativi) */
export const answersSchema = z.object({
  items: z.array(
    z.object({
      ok: z.boolean(),
      attempts: z.number().int().min(0),
      value: z.string(),
      /** Risultati per lacuna nelle nuove frasi a più passi. */
      steps: z.array(z.object({ ok: z.boolean(), attempts: z.number().int().min(0), value: z.string() })).optional(),
    })
  ),
  score: z.number().int().min(0),
});
export type Answers = z.infer<typeof answersSchema>;
/** Singola risposta di un item (usata da viste e PDF). */
export type ItemAnswer = Answers["items"][number];

/** Vero se il carattere è «di parola» (lettere o numeri, accentate incluse). */
export function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[\p{L}\p{N}]/u.test(ch);
}

/** Spazio mancante tra due frammenti incollati (es. «John»+«and Peter»)?
 *  Restituisce `b` preceduto da uno spazio solo se serve: punteggiatura e
 *  apostrofi restano attaccati («and,» e «don't» non vengono separati). */
export function withMissingSpace(a: string, b: string): string {
  return a && b && isWordChar(a.slice(-1)) && isWordChar(b.charAt(0)) ? ` ${b}` : b;
}

/** Ripara i confini incollati tra segmenti consecutivi (parole colorate vs
 *  testo semplice: «John»+«and Peter» → «John and Peter»). I segmenti senza
 *  testo (blank) non interrompono il controllo sul carattere precedente. */
export function repairGluedSegments<T extends { t: string; v?: string }>(segs: T[]): T[] {
  let prev: string | undefined;
  return segs.map((s) => {
    if (typeof s.v !== "string" || !s.v) return s;
    const v = prev !== undefined ? withMissingSpace(prev, s.v) : s.v;
    prev = v;
    return v === s.v ? s : { ...s, v };
  });
}

/** Palette unica delle tessere di riordino, condivisa da app e PDF e coordinata al Widget equazioni. */
export const REORDER_CHIP_PALETTE = {
  bg: "#F2E7DE",
  border: "#C9AD9A",
  text: "#2E2118",
} as const;

/** Palette storica per compatibilità: il riordino non colora più per ruolo. */
export const ROLE_COLORS: Record<ReorderRole, { bg: string; border: string; text: string; label: string }> = {
  subject: { bg: "#E8EAF6", border: "#3949AB", text: "#283593", label: "CHI" },
  verb: { bg: "#E2F3EF", border: "#00695C", text: "#004D40", label: "COSA FA" },
  adverb: { bg: "#FFF3B0", border: "#E09E00", text: "#8A6400", label: "OGNI QUANTO" },
  other: { bg: "#FAF8F5", border: "#8C827A", text: "#5A4A38", label: "IL RESTO" },
};


