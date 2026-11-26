/* Prova con 15 frasi sintetiche: l'anteprima genera le prime 10 e segnala l'esclusione; nessuna scheda viene salvata.
   pnpm exec tsx scripts/test-quindici-frasi-ai.ts */
import "dotenv/config";
import assert from "node:assert/strict";
import { generateInclusiveExerciseWithLimit } from "../server/inclusiveGeneration";
import type { GenerateInput } from "../shared/exercise";

const sentences = [
  "She reads a book at home.", "They play football every Saturday.", "We visit our friends on Sunday.",
  "He drinks milk in the morning.", "My sister walks to school every day.", "The children listen to music after school.",
  "I write a letter to my grandmother.", "The teacher opens the classroom door.", "Our dog sleeps under the table.",
  "Tom watches a film in the evening.", "My parents cook dinner together.", "The birds sing early in the morning.",
  "Anna helps her brother with homework.", "The bus stops near the station.", "We study English on Tuesday."
];
const base = { cognome:"", nome:"", classe:"", data:"", lang:"en" as const, optionsCount:2 as const };
const tasks: Array<{name:string; input:GenerateInput}> = [
  {name:"riordino", input:{...base,type:"reorder",text:sentences.map((s,i)=>`${i+1}. ${s}`).join("\n"),adaptation:"Mantieni ogni frase originale e riordina le sue parole."}},
  {name:"scelta multipla", input:{...base,type:"mc",text:sentences.map((s,i)=>`${i+1}. ${s.replace(/\b(reads|play|visit|drinks|walks|listen|write|opens|sleeps|watches|cook|sing|helps|stops|study)\b/,"___")}`).join("\n"),adaptation:"Completa ogni frase con un verbo inglese corretto e un'alternativa errata."}}
];
await Promise.all(tasks.map(async ({name,input})=>{
  try {
    const { exercise, wasTruncated }=await generateInclusiveExerciseWithLimit(input);
    assert.ok(exercise.type === "mc" || exercise.type === "reorder");
    assert.equal(exercise.items.length,10,`${name}: servono le prime 10 frasi`);
    assert.equal(wasTruncated,true,`${name}: la selezione delle prime 10 va segnalata`);
    console.log(`IA reale ${name}: prime 10 di 15 e avviso verificati, senza scrivere nel database.`);
  } catch(error) {
    console.error(`IA reale ${name}: ${error instanceof Error ? error.message : error}`);
    process.exitCode=1;
  }
}));

