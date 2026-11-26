/* PDF sintetici per controllo visivo; avviare prima pnpm dev per i font:
   pnpm exec tsx scripts/test-inclusive-pdf.ts */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildWorkoutPdf } from "../client/src/lib/exportWorkout";
import { exerciseSchema, type Exercise } from "../shared/exercise";

const student = { cognome: "Prova", nome: "Studentessa", classe: "2A", data: "06/11/2026" };
const mc: Exercise = exerciseSchema.parse({ type: "mc", items: [
  { segments: [{t:"text",v:"Yo "},{t:"blank"},{t:"text",v:" en Madrid."}], options:["vivo","vive"], correct:"vivo", translationIt:"Io ___ a Madrid." },
  { segments: [{t:"text",v:"Qual è la traduzione di «la maison»?"}], options:["la casa","il balcone","la stanza"], correct:"la casa", translationIt:"Qual è la traduzione di casa?" },
  { segments: [{t:"text",v:"Kate "},{t:"blank"},{t:"text",v:" a brother."}], options:["has","have","haves","having"], correct:"has", translationIt:"Kate ___ un fratello." },
  { segments: [{t:"text",v:"Quale descrizione corrisponde alla frase?"}], options:["Una casa accogliente con molte finestre, un giardino e una cucina luminosa vicino alla grande piazza", "Un piccolo tavolo", "Un quaderno aperto"], correct:"Una casa accogliente con molte finestre, un giardino e una cucina luminosa vicino alla grande piazza", translationIt:"Quale descrizione corrisponde?" },
] });
const reordered = "No sería extraño que condujera todo el tiempo mi marido.";
const alternative = "No sería extraño que mi marido condujera todo el tiempo.";
const reorder: Exercise = exerciseSchema.parse({ type:"reorder", items:[{
  chips: reordered.split(" ").map((t,i)=>({t,role:i===0?"subject":"other"})), answer:reordered, alsoCorrect:[alternative], translationIt:"Non sarebbe strano che guidasse sempre mio marito."
}] });
const out = "/tmp/lingue-inclusive-pdf"; mkdirSync(out,{recursive:true});
for (const [name,exercise,answers] of [
  ["scelta",mc,mc.type === "mc" ? mc.items.map((it,i)=>({ ok:true,attempts:i===1?1:0,value:it.correct })) : []],
  ["riordino",reorder,[{ok:true,attempts:0,value:alternative}]],
] as const) {
  for (const withAnswers of [false,true]) {
    const blob = await buildWorkoutPdf({exercise, student, withAnswers, answers:withAnswers?[...answers]:undefined, lang:name==="riordino"?"es":"fr"});
    const path=`${out}/${name}-${withAnswers?"svolto":"vuoto"}.pdf`;
    writeFileSync(path,Buffer.from(await blob.arrayBuffer()));
    console.log(path);
  }
}

