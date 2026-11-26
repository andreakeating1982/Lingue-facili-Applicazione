/**
 * Test CLI dei PDF dell'abbinamento: genera le due versioni (senza risposte
 * e con le risposte) su /tmp, così si possono verificare immagini e pagina
 * unica senza passare dal browser. Uso:
 *   pnpm exec tsx scripts/test-match-pdf.ts [exerciseId]
 */
import { writeFileSync } from "fs";
import { eq } from "drizzle-orm";
import { buildWorkoutPdf } from "../client/src/lib/exportWorkout";
import { db } from "../server/db";
import { exercises } from "../drizzle/schema";
import type { Exercise, ItemAnswer } from "../shared/exercise";

async function main(): Promise<void> {
  const id = process.argv[2] ?? "DX0nOmFPuTCl";
  if (!db) throw new Error("DATABASE_URL non configurato");
  const rows = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
  if (rows.length === 0) throw new Error(`esercizio ${id} non trovato`);
  const exercise = rows[0].exercise as Exercise;
  console.log(`esercizio ${id} di tipo ${exercise.type}`);
  const pairs = exercise.type === "match" ? exercise.pairs : [];
  pairs.forEach((p, i) => console.log(`  ${"ABCDEF"[i]}: ${p.word} → ${p.imageUrl?.slice(0, 60)}`));

  const student = { cognome: "Prova", nome: "Studente", classe: "1^A", data: "01/01/2026" };

  const senza = await buildWorkoutPdf({ exercise, student, withAnswers: false });
  writeFileSync("/tmp/match-senza-risposte.pdf", Buffer.from(await senza.arrayBuffer()));
  console.log("OK /tmp/match-senza-risposte.pdf");

  const answers: ItemAnswer[] =
    exercise.type === "match"
      ? pairs.map((_, i) => ({ ok: true, attempts: 0, value: "ABCDEF"[i] }))
      : ((exercise as { items: unknown[] }).items ?? []).map(() => ({
          ok: true,
          attempts: 0,
          value: "X",
        }));
  const con = await buildWorkoutPdf({ exercise, student, withAnswers: true, answers });
  writeFileSync("/tmp/match-con-risposte.pdf", Buffer.from(await con.arrayBuffer()));
  console.log("OK /tmp/match-con-risposte.pdf");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERRORE:", e);
  process.exit(1);
});
