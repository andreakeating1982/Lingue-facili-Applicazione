/* PDF sintetici delle nuove schede limitate, nessun database e nessuna IA.
   pnpm exec tsx scripts/test-prime-dieci-pdf.ts */
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { validateInclusiveResult } from "../server/inclusiveGeneration";
import { buildWorkoutPdf } from "../client/src/lib/exportWorkout";
import type { Exercise, GenerateInput, ItemAnswer } from "../shared/exercise";
import type { LangCode } from "../shared/languages";

const base:GenerateInput={text:"Fonte sintetica.",type:"mc",lang:"en",optionsCount:2,nome:"",cognome:"",data:"",classe:"",adaptation:"Prova."};
const mkMc=(i:number)=>({segments:[{t:"text",v:`FRAMMENTO${i} She `},{t:"blank"},{t:"text",v:" today."}],options:["works","work"],correct:"works",translationIt:`Lei ___ oggi numero ${i}.`});
const boundary={segments:[{t:"text",v:"FRAMMENTO10 She "},{t:"blank"},{t:"text",v:" a book and "},{t:"blank"},{t:"text",v:" ESCLUSA11."}], options:["reads","read"],correct:"reads",steps:[{options:["reads","read"],correct:"reads"},{options:["writes","write"],correct:"writes"}],translationIt:"Lei ___ un libro e ___ ESCLUSA11."};
const mc=validateInclusiveResult({type:"mc",hasMoreItems:true,items:[...Array.from({length:9},(_,i)=>mkMc(i+1)),boundary]},base);
const reordered=Array.from({length:12},(_,i)=>({chips:[{t:`PARTE${i+1}`,role:"subject"},{t:"works.",role:"verb"}],answer:`PARTE${i+1} works.`,translationIt:`Parte ${i+1} lavora.`}));
const reorder=validateInclusiveResult({type:"reorder",hasMoreItems:true,items:reordered},{...base,type:"reorder"});
assert.equal(mc.wasTruncated,true);assert.equal(reorder.wasTruncated,true);
const student={nome:"Prova",cognome:"Sintetica",data:"14/11/2026",classe:"2A"};
const out="/tmp/lingue-prime-dieci-pdf";mkdirSync(out,{recursive:true});
for(const lang of ["en","fr","es"] as LangCode[]){
  for(const [mode,exercise] of [["mc",mc.exercise],["reorder",reorder.exercise]] as Array<[string,Exercise]>){
    const items=exercise.type==="mc"?exercise.items:exercise.type==="reorder"?exercise.items:[];
    const answers:ItemAnswer[]=items.map(item=>({ok:true,attempts:0,value:"correct" in item?item.correct:item.answer}));
    for(const withAnswers of [false,true]){
      const blob=await buildWorkoutPdf({exercise,student,lang,withAnswers,answers:withAnswers?answers:undefined});
      const path=`${out}/${lang}-${mode}-${withAnswers?"con":"senza"}.pdf`;
      writeFileSync(path,Buffer.from(await blob.arrayBuffer()));console.log(path);
    }
  }
}
