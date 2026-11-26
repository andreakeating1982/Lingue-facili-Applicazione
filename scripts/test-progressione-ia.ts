/* IA reale, una fonte sintetica, nessun salvataggio nel database. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { generateInclusiveExercise } from '../server/inclusiveGeneration';
import type { GenerateInput } from '../shared/exercise';
const input: GenerateInput = { text:'1. She (reads / read) a book and (writes / write) a letter every day.', type:'mc', lang:'en', optionsCount:2, nome:'',cognome:'',data:'',classe:'',adaptation:'Mantieni la frase completa, senza cambiare le parole, e fai scegliere i due verbi uno dopo l’altro.' };
const ex=await generateInclusiveExercise(input);
assert.equal(ex.type,'mc');
if(ex.type==='mc') {assert.equal(ex.items.length,1); assert.equal(ex.items[0].steps?.length,2); assert.equal(ex.items[0].segments.filter(s=>s.t==='blank').length,2); console.log('IA reale: una frase, due lacune e due gruppi di opzioni distinti validati. Nessun dato salvato.');}

