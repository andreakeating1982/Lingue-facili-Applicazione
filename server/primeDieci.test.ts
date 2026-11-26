import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateInput } from "../shared/exercise";

// API IA e database sono simulati. I test non leggono né scrivono dati reali.
vi.mock("./db", () => ({ db: null }));
vi.mock("./_core/chat", () => ({ chatCompletion: vi.fn(), chatVision: vi.fn(), chatAudioTranscription: vi.fn() }));

import { chatCompletion } from "./_core/chat";
import { numberedSourceHint } from "./exerciseLimit";
import { validateInclusiveResult, generateInclusiveExerciseWithLimit } from "./inclusiveGeneration";
import { appRouter } from "./routers";

const base: GenerateInput = { cognome:"", nome:"", data:"", classe:"", type:"mc", lang:"en", optionsCount:2, text:"One sentence.", adaptation:"Completa la frase." };
const mc = (i: number) => ({ segments:[{t:"text",v:`Question ${i}: She `},{t:"blank"},{t:"text",v:" today."}], options:["works","work"], optionsTranslationIt:["lavora","lavorano"], correct:"works", translationIt:`Domanda ${i}: lei ___ oggi.` });
const reorder = (i: number) => ({ chips:[{t:`Name${i}`,role:"subject"},{t:"works.",role:"verb"}], answer:`Name${i} works.`, translationIt:`Nome ${i} lavora.` });
const numbered = (n: number) => Array.from({length:n}, (_,i)=>`${i+1}. Name${i+1} ___ today.`).join("\n");
const questions = (exercise: ReturnType<typeof validateInclusiveResult>["exercise"]) => exercise.type === "mc"
  ? exercise.items.reduce((sum,item) => sum + Math.max(1,item.segments.filter(s => s.t === "blank").length),0)
  : exercise.type === "reorder" ? exercise.items.length : 0;

beforeEach(() => vi.mocked(chatCompletion).mockReset());

describe("prime dieci frasi o domande", () => {
  for (const n of [1, 9, 10]) {
    it(`non taglia né segnala ${n} domande`, () => {
      const input = {...base,text:numbered(n)};
      const result = validateInclusiveResult({type:"mc",hasMoreItems:false,items:Array.from({length:n},(_,i)=>mc(i+1))},input);
      expect(result.wasTruncated).toBe(false);
      expect(questions(result.exercise)).toBe(n);
    });
  }
  for (const n of [11, 15, 30]) {
    it(`mantiene le prime 10 di ${n} domande numerate, nell'ordine`, () => {
      const input = {...base,text:numbered(n)};
      const result = validateInclusiveResult({type:"mc",hasMoreItems:true,items:Array.from({length:n},(_,i)=>mc(i+1))},input);
      expect(result.wasTruncated).toBe(true);
      expect(questions(result.exercise)).toBe(10);
      if (result.exercise.type !== "mc") throw new Error("tipo errato");
      const content = JSON.stringify(result.exercise);
      expect(content).toContain("Question 1:");
      expect(content).toContain("Question 10:");
      expect(content).not.toContain("Question 11:");
      expect(input.text).toBe(numbered(n));
    });
  }
  it("taglia le frasi di riordino in ordine e conserva soltanto le prime 10", () => {
    const input: GenerateInput = {...base,type:"reorder",text:numbered(15)};
    const result = validateInclusiveResult({type:"reorder",hasMoreItems:true,items:Array.from({length:15},(_,i)=>reorder(i+1))},input);
    expect(result.wasTruncated).toBe(true);
    if (result.exercise.type !== "reorder") throw new Error("tipo errato");
    expect(result.exercise.items.map(x=>x.answer)).toEqual(Array.from({length:10},(_,i)=>`Name${i+1} works.`));
  });
  it("non avvisa per dieci frasi di riordino", () => {
    const input: GenerateInput = {...base,type:"reorder",text:numbered(10)};
    const result = validateInclusiveResult({type:"reorder",hasMoreItems:false,items:Array.from({length:10},(_,i)=>reorder(i+1))},input);
    expect(result.wasTruncated).toBe(false);
  });
  it("avvisa per testo non numerato quando l'IA rileva domande successive", () => {
    const result = validateInclusiveResult({type:"mc",hasMoreItems:true,items:Array.from({length:10},(_,i)=>mc(i+1))},{...base,text:"Un elenco di frasi non numerate fornito dal docente."});
    expect(result.wasTruncated).toBe(true);
    expect(questions(result.exercise)).toBe(10);
  });
  it("riconosce più di dieci frasi non numerate anche se l'IA restituisce solo dieci", () => {
    const text=Array.from({length:12},(_,i)=>`Name${i+1} works.`).join("\n");
    const input:GenerateInput={...base,type:"reorder",text};
    const result=validateInclusiveResult({type:"reorder",hasMoreItems:false,items:Array.from({length:10},(_,i)=>reorder(i+1))},input);
    expect(result.wasTruncated).toBe(true);
    expect(questions(result.exercise)).toBe(10);
  });
  it("riconosce lacune non numerate anche se l'IA restituisce già solo le prime 10", () => {
    const text=Array.from({length:12},(_,i)=>`Name${i+1} ___ today.`).join("\n");
    const result=validateInclusiveResult({type:"mc",hasMoreItems:false,items:Array.from({length:10},(_,i)=>mc(i+1))},{...base,text});
    expect(result.wasTruncated).toBe(true);
    expect(questions(result.exercise)).toBe(10);
  });
  it("non segnala esclusioni per dieci frasi non numerate", () => {
    const text=Array.from({length:10},(_,i)=>`Name${i+1} works.`).join("\n");
    const input:GenerateInput={...base,type:"reorder",text};
    expect(validateInclusiveResult({type:"reorder",hasMoreItems:false,items:Array.from({length:10},(_,i)=>reorder(i+1))},input).wasTruncated).toBe(false);
  });
  it("riconosce un'undicesima domanda in output anche se l'IA non la segnala", () => {
    const result = validateInclusiveResult({type:"mc",hasMoreItems:false,items:Array.from({length:11},(_,i)=>mc(i+1))},base);
    expect(result.wasTruncated).toBe(true);
    expect(questions(result.exercise)).toBe(10);
  });
  it("riprova se mancano parti delle prime 10 righe numerate", () => {
    expect(() => validateInclusiveResult({type:"mc",hasMoreItems:true,items:Array.from({length:8},(_,i)=>mc(i+1))},{...base,text:numbered(11)})).toThrow(/almeno 10 righe/);
  });
  it("non confonde un elenco numerico ripetuto e ambiguo con un'unica sequenza di item", () => {
    expect(numberedSourceHint("1. domanda ___\n1. risposta a\n2. risposta b\n1. altra ___", "mc")).toBeNull();
  });
  it("conta separatamente le lacune, ma una frase di riordino resta un solo item", () => {
    const source = "1. She ___ and ___ today.\n2. He ___ today.\n3. They ___ today.";
    expect(numberedSourceHint(source,"mc")?.questionCount).toBe(4);
    expect(numberedSourceHint(source,"reorder")?.questionCount).toBe(3);
  });
  for (const prior of [8, 9]) {
    it(`taglia correttamente una frase con tre lacune dopo ${prior} domande precedenti`, () => {
      const triple = {segments:[{t:"text",v:"She "},{t:"blank"},{t:"text",v:" and "},{t:"blank"},{t:"text",v:" and "},{t:"blank"},{t:"text",v:" at home."}],options:["reads","read"],correct:"reads",steps:[{options:["reads","read"],correct:"reads"},{options:["writes","write"],correct:"writes"},{options:["sleeps","sleep"],correct:"sleeps"}],translationIt:"Lei ___ e ___ e ___ a casa.",source:"She reads and writes and sleeps at home."};
      const result = validateInclusiveResult({type:"mc",hasMoreItems:true,items:[...Array.from({length:prior},(_,i)=>mc(i+1)),triple]},base);
      expect(result.wasTruncated).toBe(true);
      expect(questions(result.exercise)).toBe(10);
      if (result.exercise.type !== "mc") throw new Error("tipo errato");
      const last = result.exercise.items.at(-1)!;
      expect(last.segments.filter(s=>s.t==="blank")).toHaveLength(10-prior);
      expect(last.translationIt).not.toContain("casa");
      expect(last.translationIt).toContain("…");
      expect(last.source).toBeUndefined();
      if (prior === 9) expect(last.steps).toBeUndefined();
      else expect(last.steps).toHaveLength(2);
    });
  }
  it("gestisce 11 lacune nella stessa frase prima di applicare lo schema", () => {
    const steps = Array.from({length:11},()=>({options:["works","work"],correct:"works"}));
    const segments = Array.from({length:11},(_,i)=>[{t:"text",v:`s${i+1} `},{t:"blank"}]).flat();
    const result = validateInclusiveResult({type:"mc",hasMoreItems:true,items:[{segments,options:steps[0].options,correct:"works",steps,translationIt:Array(11).fill("___").join(" e ")}]},base);
    expect(result.wasTruncated).toBe(true);
    if (result.exercise.type !== "mc") throw new Error("tipo errato");
    expect(result.exercise.items[0].steps).toHaveLength(10);
    expect(questions(result.exercise)).toBe(10);
  });
  it("non indovina se la traduzione non consente di separare le lacune escluse", () => {
    const broken = {segments:[{t:"text",v:"He "},{t:"blank"},{t:"text",v:" and "},{t:"blank"}], options:["works","work"],correct:"works",steps:[{options:["works","work"],correct:"works"},{options:["works","work"],correct:"works"}],translationIt:"Lui ___ e lavora."};
    expect(() => validateInclusiveResult({type:"mc",hasMoreItems:true,items:[...Array.from({length:9},(_,i)=>mc(i+1)),broken]},base)).toThrow(/traduzione.*lacune successive/i);
  });
  it("la generazione IA richiede il metadato e ritenta se manca", async () => {
    const valid={type:"mc",hasMoreItems:true,items:Array.from({length:11},(_,i)=>mc(i+1))};
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify({type:"mc",items:valid.items})).mockResolvedValueOnce(JSON.stringify(valid));
    const result = await generateInclusiveExerciseWithLimit({...base,text:numbered(11)});
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(result.wasTruncated).toBe(true);
    expect(questions(result.exercise)).toBe(10);
  });
  it("l'endpoint restituisce l'avviso e salva solo la scheda ridotta con database disabilitato", async () => {
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify({type:"mc",hasMoreItems:true,items:Array.from({length:11},(_,i)=>mc(i+1))}));
    const caller=appRouter.createCaller({} as Parameters<typeof appRouter.createCaller>[0]);
    const result=await caller.exercises.generate({...base,text:numbered(11)});
    expect(result.wasTruncated).toBe(true);
    expect(questions(result.exercise)).toBe(10);
    expect(result.id).toBeTruthy();
  });
  it("non aggiunge domande per arrivare a 10 quando l'originale ne presenta meno di 10 (numerato)", async () => {
    const padded = {type:"mc",hasMoreItems:false,items:Array.from({length:10},(_,i)=>mc(i+1))};
    const exact3 = {type:"mc",hasMoreItems:false,items:Array.from({length:3},(_,i)=>mc(i+1))};
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify(padded)).mockResolvedValueOnce(JSON.stringify(exact3));
    const result = await generateInclusiveExerciseWithLimit({...base,text:numbered(3)});
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(result.wasTruncated).toBe(false);
    expect(questions(result.exercise)).toBe(3);
  });
  it("non aggiunge domande per arrivare a 10 quando l'originale ne presenta meno di 10 (non numerato)", async () => {
    const padded = {type:"mc",hasMoreItems:false,items:Array.from({length:10},(_,i)=>mc(i+1))};
    const exact2 = {type:"mc",hasMoreItems:false,items:Array.from({length:2},(_,i)=>mc(i+1))};
    vi.mocked(chatCompletion).mockResolvedValueOnce(JSON.stringify(padded)).mockResolvedValueOnce(JSON.stringify(exact2));
    const result = await generateInclusiveExerciseWithLimit({
      ...base,
      text: "She ___ every morning.\nHe ___ every evening.",
    });
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(result.wasTruncated).toBe(false);
    expect(questions(result.exercise)).toBe(2);
  });
});
