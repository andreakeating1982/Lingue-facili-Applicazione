/* Prove IA reale con sole frasi sintetiche: non importano il router e non
   leggono né scrivono il database. pnpm exec tsx scripts/test-prime-dieci-ia.ts */
import "dotenv/config";
import assert from "node:assert/strict";
import { generateInclusiveExerciseWithLimit } from "../server/inclusiveGeneration";
import type { GenerateInput, Exercise } from "../shared/exercise";

const identity={cognome:"",nome:"",data:"",classe:"",optionsCount:2 as const};
const en=["Alice reads books.","Ben drinks water.","Carla opens doors.","David sings songs.","Emma cooks dinner.","Frank writes letters.","Grace visits friends.","Henry studies English.","Irene washes dishes.","Jill calls friends.","Kevin plays tennis.","Laura loves music.","Marta rides horses.","Noah paints pictures.","Olivia watches films."];
const fr=["Alice lit des livres.","Bruno boit de l'eau.","Claire ouvre la porte.","David chante une chanson.","Emma prépare le dîner.","François écrit une lettre.","Grace rend visite à ses amis.","Henri étudie le français.","Irène lave les assiettes.","Julie appelle ses amis.","Karim joue au tennis.","Léa aime la musique."];
const cities=["Madrid","Sevilla","Valencia","Bilbao","Málaga","Granada","Toledo","Córdoba","Zaragoza","Murcia","Vigo","Salamanca"];
const sourceMc=cities.map((city,i)=>`${i+1}. Yo ___ (visitar) ${city}.`).join("\n");
const boundary=Array.from({length:9},(_,i)=>`${i+1}. Student${i+1} ___ (play) today.`).concat("10. Sarah ___ (read) a book and ___ (write) a letter.").join("\n");
const count=(ex:Exercise)=>ex.type==="mc"?ex.items.reduce((n,item)=>n+Math.max(1,item.segments.filter(s=>s.t==="blank").length),0):ex.type==="reorder"?ex.items.length:0;
const normalized=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const tasks: Array<{name:string; input:GenerateInput; omitted:boolean; verify?:(ex:Exercise)=>void}>=[
 {name:"inglese riordino 15 numerate",input:{...identity,lang:"en",type:"reorder",text:en.map((s,i)=>`${i+1}. ${s}`).join("\n"),adaptation:"Mantieni ciascuna frase originale e riordina le parole."},omitted:true,verify(ex){assert.equal(ex.type,"reorder");if(ex.type==="reorder"){assert.deepEqual(ex.items.map(x=>normalized(x.answer)),en.slice(0,10).map(normalized));}}},
 {name:"spagnolo scelta multipla 12 numerate",input:{...identity,lang:"es",type:"mc",text:sourceMc,adaptation:"Completa ogni frase con il presente di visitar. Usa due opzioni."},omitted:true,verify(ex){assert.equal(ex.type,"mc");if(ex.type==="mc"){const content=JSON.stringify(ex.items);assert.match(content,/Madrid/i);assert.match(content,/Murcia/i);assert.doesNotMatch(content,/Vigo|Salamanca/i);}}},
 {name:"francese riordino 12 non numerate",input:{...identity,lang:"fr",type:"reorder",text:fr.join("\n"),adaptation:"Conserva le frasi francesi originali nello stesso ordine."},omitted:true,verify(ex){assert.equal(ex.type,"reorder");if(ex.type==="reorder"){assert.deepEqual(ex.items.map(x=>normalized(x.answer)),fr.slice(0,10).map(normalized));}}},
 {name:"francese riordino esattamente 10",input:{...identity,lang:"fr",type:"reorder",text:fr.slice(0,10).map((s,i)=>`${i+1}. ${s}`).join("\n"),adaptation:"Conserva le frasi francesi originali nello stesso ordine."},omitted:false},
 {name:"inglese confine dentro una frase con due lacune",input:{...identity,lang:"en",type:"mc",text:boundary,adaptation:"Completa ciascun verbo al presente. Mantieni l'ordine delle lacune."},omitted:true,verify(ex){assert.equal(ex.type,"mc");if(ex.type==="mc"){assert.equal(count(ex),10);assert.doesNotMatch(JSON.stringify(ex.items.at(-1)),/write|writes/i);}}},
];
await Promise.all(tasks.map(async ({name,input,omitted,verify})=>{
  try {
    const result=await generateInclusiveExerciseWithLimit(input);
    assert.equal(result.wasTruncated,omitted,`${name}: avviso errato`);
    assert.equal(count(result.exercise),10,`${name}: il numero di domande deve essere 10`);
    verify?.(result.exercise);
    console.log(`IA reale: ${name}: prime 10 in ordine, avviso=${omitted}, nessun dato salvato.`);
  } catch(err) {
    console.error(`IA reale: ${name}: ${err instanceof Error?err.message:String(err)}`);
    process.exitCode=1;
  }
}));
