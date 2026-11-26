/**
 * Test di robustezza della generazione:
 * 1) fallback deterministici (senza AI) per le 5 tipologie su tre testi,
 *    incluso il testo esatto della segnalazione (429 plan limit);
 * 2) generazione AI reale (se il piano ha parole disponibili; altrimenti
 *    si osserva il fallback in azione).
 */
import { generateExercise, buildFallbackExercise } from "../server/exerciseGen";
import { exerciseSchema, type GenerateInput, type ExerciseType } from "../shared/exercise";

const TEXT_SHORT =
  "My name is Julia. Every morning I get up at seven and I go to the park with my friends. We play football and eat an ice cream. My family is very happy.";

const TEXT_LONG = [
  "At the airport, there are many things to see and do.",
  "First, you check in at the desk and they weigh your luggage.",
  "Then, you go through security where they check your passport and bags.",
  "After that, you wait in the departure lounge with the other passengers.",
  "When the plane is ready, you board and find your seat.",
  "The flight attendant explains the safety rules before takeoff.",
  "During the flight, you can read a book, watch a film or sleep.",
  "Finally, the plane lands and you arrive at your destination.",
].join(" ");

/* Testo ESATTO della segnalazione (foto MAAA.png): scheda con puntini
   da completare e numerazione — il caso che restituiva errore 429. */
const TEXT_PHOTO =
  "1. Kate ............... a brother. 2. I ............... two sisters. 3. Susan ............... a new umbrella. 4. Peter ............... a cat.";

function input(type: ExerciseType, text: string, optionsCount: 3 | 4 = 3): GenerateInput {
  return { type, text, optionsCount, cognome: "", nome: "", data: "", classe: "" } as GenerateInput;
}

function validate(label: string, ex: unknown): void {
  const parsed = exerciseSchema.parse(ex);
  const items =
    parsed.type === "match" || parsed.type === "matchIt" ? parsed.pairs.length : parsed.items.length;
  let extra = "";
  if (parsed.type === "match") extra = " | " + parsed.pairs.map((p) => `${p.word}=${p.emoji}`).join(" ");
  if (parsed.type === "matchIt") extra = " | " + parsed.pairs.map((p) => `${p.en}=${p.it}`).join(" ");
  if (parsed.type === "tf") extra = " | " + parsed.items.filter((i) => i.isTrue).length + "T/" + parsed.items.filter((i) => !i.isTrue).length + "F";
  console.log(`  OK ${label}: tipo=${parsed.type}, voci=${items}${extra}`);
}

async function testFallbacks(): Promise<void> {
  console.log("=== FALLBACK DETERMINISTICI (senza AI) ===");
  const texts: Array<[string, string]> = [
    ["breve", TEXT_SHORT],
    ["lungo", TEXT_LONG],
    ["segnalazione", TEXT_PHOTO],
  ];
  for (const t of ["mc", "tf", "reorder", "matchIt", "match"] as ExerciseType[]) {
    for (const [name, text] of texts) {
      try {
        const ex = buildFallbackExercise(input(t, text), new Error("429 You reached the limit of allowed words in your plan. Please upgrade your plan to continue."));
        validate(`fallback ${t} / ${name}`, ex);
      } catch (err) {
        console.log(`  FALLITO ${t} / ${name}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
}

async function testAi(): Promise<void> {
  console.log("=== GENERAZIONE AI REALE (5 tipologie, testo lungo) ===");
  for (const t of ["mc", "tf", "matchIt", "reorder", "match"] as ExerciseType[]) {
    const t0 = Date.now();
    try {
      const ex = await generateExercise(input(t, TEXT_LONG, 4));
      validate(`AI ${t}`, ex);
      console.log(`     (${Math.round((Date.now() - t0) / 1000)}s)`);
    } catch (err) {
      console.log(`  FALLITO AI ${t}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

const mode = process.argv[2] ?? "all";
if (mode === "fallback" || mode === "all") await testFallbacks();
if (mode === "ai" || mode === "all") await testAi();
