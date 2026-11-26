/* Test manuale IA con quattro fonti didattiche sintetiche:
   pnpm exec tsx scripts/test-inclusive-ai.ts
   Usa la chiave configurata e non scrive nel database. */
import "dotenv/config";
import { generateInclusiveExercise } from "../server/inclusiveGeneration";
import type { GenerateInput } from "../shared/exercise";

const base = { cognome: "", nome: "", classe: "", data: "" };
const cases: Array<{ name: string; data: GenerateInput }> = [
  { name: "spagnolo 2 verbi", data: { ...base, lang: "es", type: "mc", optionsCount: 2, text: "1. Yo ___ (vivir) en Madrid.\n2. Ella ___ (comer) una manzana.\n3. Nosotros ___ (hablar) español.", adaptation: "Presente indicativo: una forma coniugata corretta e una errata." } },
  { name: "francese 3 traduzioni", data: { ...base, lang: "fr", type: "mc", optionsCount: 3, text: "1. la maison\n2. la cuisine\n3. la fenêtre", adaptation: "Vocabolario della casa: proponi traduzioni italiane, una sola corretta." } },
  { name: "italiano in inglese riordino", data: { ...base, lang: "en", type: "reorder", optionsCount: 3, text: "Ogni mattina mi sveglio alle sette. Faccio colazione con mia sorella.", adaptation: "Traduci ogni frase in inglese e proponila da riordinare." } },
  { name: "inglese 4 opzioni", data: { ...base, lang: "en", type: "mc", optionsCount: 4, text: "1. Kate ___ a brother. (has / have)\n2. I ___ two sisters. (has / have)", adaptation: "Completa con la forma corretta del verbo avere." } },
];

await Promise.all(cases.map(async ({name,data}) => {
  const start = Date.now();
  try {
    const result = await generateInclusiveExercise(data);
    console.log(`TEST ${name} OK ${((Date.now()-start)/1000).toFixed(1)}s`);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`TEST ${name} FAILED:`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}));

