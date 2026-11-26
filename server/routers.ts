import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { exercises } from "../drizzle/schema";
import { generateInclusiveExerciseWithLimit } from "./inclusiveGeneration";
import { describeExerciseAdaptation, readExercisePhoto, translateMcOptions, translateOldItem, transcribeTeacherAudio } from "./aiAssist";
import {
  answersSchema,
  focusSchema,
  generateInputSchema,
} from "../shared/exercise";
import { checkFeasibility } from "./exerciseGen";
import { countWords, MAX_EXERCISE_WORDS, MAX_INPUT_CHARACTERS } from "../shared/textLimits";

export const appRouter = router({
  system: systemRouter,

  exercises: router({
    /** Lettura IA della foto già ritagliata, senza salvarla nel database. */
    readPhoto: publicProcedure.input(z.object({
      image: z.string().max(3_500_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
      lang: z.enum(["en", "fr", "es"]),
    })).mutation(async ({ input }) => ({ text: await readExercisePhoto(input.image, input.lang) })),

    /** Spiegazione preliminare modificabile: non crea record nel database. */
    describeAdaptation: publicProcedure.input(z.object({
      text: z.string().trim().min(1).max(MAX_INPUT_CHARACTERS)
        .refine((value) => countWords(value) <= MAX_EXERCISE_WORDS, `Massimo ${MAX_EXERCISE_WORDS} parole.`),
      lang: z.enum(["en", "fr", "es"]),
      mode: z.enum(["mc", "reorder"]),
      optionsCount: z.union([z.literal(2), z.literal(3), z.literal(4)]),
      teacherNotes: z.string().max(MAX_INPUT_CHARACTERS)
        .refine((value) => countWords(value) <= MAX_EXERCISE_WORDS, `Massimo ${MAX_EXERCISE_WORDS} parole.`).optional(),
    })).mutation(async ({ input }) => ({ description: await describeExerciseAdaptation(input) })),

    /** Traduzione a richiesta, compatibile con gli esercizi più vecchi. */
    translate: publicProcedure.input(z.object({
      text: z.string().min(1).max(1200),
      lang: z.enum(["en", "fr", "es"]),
    })).mutation(async ({ input }) => ({ translation: await translateOldItem(input.text, input.lang) })),

    /** Traduzione su richiesta delle opzioni per schede MC salvate senza optionsTranslationIt. */
    translateOptions: publicProcedure.input(z.object({
      text: z.string().min(1).max(1200),
      options: z.array(z.string().min(1).max(300)).min(2).max(4),
      lang: z.enum(["en", "fr", "es"]),
    })).mutation(async ({ input }) => ({ translations: await translateMcOptions(input.text, input.options, input.lang) })),

    /** Registrazione breve o file audio caricato, senza salvare il file. */
    transcribe: publicProcedure.input(z.object({
      audio: z.string().min(100).max(17_000_000).regex(/^[A-Za-z0-9+/=]+$/),
      mime: z.string().min(1).max(100).regex(/^(audio\/[a-z0-9.+-]+|video\/mp4|application\/octet-stream)$/i),
      source: z.enum(["recording", "upload"]).default("recording"),
    })).mutation(async ({ input }) => ({ text: await transcribeTeacherAudio(input.audio, input.mime, input.source) })),

    /** Analizza il testo: per quali tipologie l'esercizio è costruibile? */
    checkTypes: publicProcedure
      .input(
        z.object({
          text: z.string().min(20).max(6000),
          focus: focusSchema.optional(),
          lang: z.enum(["en", "fr", "es"]).optional(),
        })
      )
      .mutation(async ({ input }) => checkFeasibility(input.text, input.focus, input.lang ?? "en")),

    /** Genera e salva la scheda: la fonte resta integra, la scheda contiene
        al massimo le prime 10 domande; il client segnala le esclusioni. */
    generate: publicProcedure.input(generateInputSchema).mutation(async ({ input }) => {
      const { exercise, wasTruncated } = await generateInclusiveExerciseWithLimit(input);
      const id = nanoid(12);
      if (db) {
        await db.insert(exercises).values({
          id,
          studentCognome: input.cognome,
          studentNome: input.nome,
          studentData: input.data,
          studentClasse: input.classe,
          sourceText: input.text,
          type: exercise.type,
          lang: input.lang,
          optionsCount: input.optionsCount,
          exercise,
          /* Fonte unica dell'idoneità + istruzioni personalizzate: salvate
             con l'esercizio così la pagina finale riusa ESATTAMENTE quello
             che la schermata 2 ha mostrato (niente ricontrolli AI). */
          feasibility: input.feasibility ?? null,
          instructions: input.instructions ?? null,
          focus: input.focus ?? null,
        });
      }
      return { id, exercise, wasTruncated };
    }),

    /** Carica un esercizio salvato (per id). */
    get: publicProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
      if (!db) return null;
      const [row] = await db.select().from(exercises).where(eq(exercises.id, input.id));
      return row ?? null;
    }),

    /** Salva le risposte dello studente (per il PDF "con le mie risposte"). */
    saveAnswers: publicProcedure
      .input(z.object({ id: z.string().min(1), answers: answersSchema }))
      .mutation(async ({ input }) => {
        if (!db) return { ok: false };
        await db
          .update(exercises)
          .set({ answers: input.answers.items, score: input.answers.score })
          .where(eq(exercises.id, input.id));
        return { ok: true };
      }),

    /** Salva le istruzioni personalizzate scritte in alto nella pagina
        esercizio: una sola fonte per lo schermo e per il PDF. */
    updateInstructions: publicProcedure
      .input(z.object({ id: z.string().min(1), instructions: z.string().max(500) }))
      .mutation(async ({ input }) => {
        if (!db) return { ok: false };
        await db
          .update(exercises)
          .set({ instructions: input.instructions.trim() || null })
          .where(eq(exercises.id, input.id));
        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
