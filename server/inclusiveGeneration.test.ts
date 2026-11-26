import { describe, expect, it } from "vitest";
import { exerciseSchema, type GenerateInput } from "../shared/exercise";
import { validateInclusiveExercise, validateInclusiveResult } from "./inclusiveGeneration";
import { inclusivePrompt } from "./inclusivePrompt";

const base: GenerateInput = { text: "Yo ___ en Madrid.", type: "mc", lang: "es", optionsCount: 2, nome: "", cognome: "", data: "", classe: "", adaptation: "Due verbi al presente." };
const item = { segments: [{t:"text",v:"Yo "},{t:"blank"},{t:"text",v:" en Madrid."}], options:["vivo","vive"], correct:"vivo", translationIt:"Io ___ a Madrid." };

describe("adattamento inclusivo", () => {
  it("accetta una sola domanda con due opzioni e traduzione", () => {
    const ex = validateInclusiveExercise({type:"mc",items:[item]}, base);
    expect(ex.type).toBe("mc");
    if (ex.type === "mc") { expect(ex.items).toHaveLength(1); expect(ex.items[0].options).toHaveLength(2); expect(ex.items[0].translationIt).toContain("___"); }
  });
  it("impone esattamente il numero di opzioni selezionato", () => {
    expect(() => validateInclusiveExercise({type:"mc",items:[item]}, {...base,optionsCount:3})).toThrow(/esattamente 3/);
  });
  it("rifiuta duplicati e una risposta non presente", () => {
    expect(() => validateInclusiveExercise({type:"mc",items:[{...item,options:["vivo","VIVO"]}]}, base)).toThrow(/diverse/);
    expect(() => validateInclusiveExercise({type:"mc",items:[{...item,correct:"viviamo"}]}, base)).toThrow(/non coincide/);
  });
  it("impone una sola risposta corretta per nuovi esercizi", () => {
    expect(() => validateInclusiveExercise({type:"mc",items:[{...item,alsoCorrect:["vive"]}]}, base)).toThrow(/sola risposta/);
  });
  it("non rivela la soluzione nella traduzione di una frase con vuoto", () => {
    expect(() => validateInclusiveExercise({type:"mc",items:[{...item,translationIt:"Io vivo a Madrid."}]}, base)).toThrow(/mantenere il vuoto/);
  });
  it("richiede la traduzione solo per nuove schede", () => {
    const {translationIt: _, ...old} = item;
    expect(exerciseSchema.safeParse({type:"mc",items:[old]}).success).toBe(true);
    expect(() => validateInclusiveExercise({type:"mc",items:[old]}, base)).toThrow(/traduzione/);
  });
  it("accetta riordino a due parole e scarta alternative con parole diverse", () => {
    const input: GenerateInput = {...base,type:"reorder",lang:"en"};
    const result = validateInclusiveExercise({type:"reorder",items:[{chips:[{t:"She",role:"subject"},{t:"works.",role:"verb"}],answer:"She works.",translationIt:"Lei lavora.",alsoCorrect:["They work."]}]}, input);
    expect(result.type).toBe("reorder");
    if (result.type === "reorder") expect(result.items[0].alsoCorrect).toBeUndefined();
  });
  it("rifiuta un risultato che salta le frasi numerate chiaramente riconoscibili", () => {
    const source = {...base, text:"1. Yo ___ en Madrid.\n2. Ella ___ una manzana."};
    expect(() => validateInclusiveExercise({type:"mc",items:[item]}, source)).toThrow(/almeno 2 righe/);
  });
  it("non trasforma le istruzioni in frasi di riordino", () => {
    const instruction = "Complete the sentences.";
    const value = {chips:instruction.split(" ").map(t=>({t,role:"other"})),answer:instruction,translationIt:"Completa le frasi."};
    expect(() => validateInclusiveExercise({type:"reorder",items:[value]}, {...base,type:"reorder"})).toThrow(/istruzione/);
  });
  it("si ferma e chiede chiarimenti per una fonte illeggibile", () => {
    expect(() => validateInclusiveExercise({error:"La seconda frase non è leggibile."}, base)).toThrow(/non è leggibile/);
  });
  it("accetta 10 domande e taglia automaticamente un'undicesima", () => {
    const exact = validateInclusiveResult({type:"mc",items:Array(10).fill(item)}, base);
    expect(exact.wasTruncated).toBe(false);
    const limited = validateInclusiveResult({type:"mc",items:Array(11).fill(item)}, base);
    expect(limited.wasTruncated).toBe(true);
    if (limited.exercise.type === "mc") expect(limited.exercise.items).toHaveLength(10);
  });
  it("riconosce una fonte numerata più lunga anche se l'IA restituisce già solo 10 item", () => {
    const source = {...base, text:Array.from({length:11}, (_,i) => `${i+1}. Yo ___ en Madrid.`).join("\n")};
    const result = validateInclusiveResult({type:"mc",hasMoreItems:false,items:Array(10).fill(item)}, source);
    expect(result.wasTruncated).toBe(true);
    if (result.exercise.type === "mc") expect(result.exercise.items).toHaveLength(10);
  });
  it("accetta le lacune a passi separati e rifiuta passi mancanti o traduzioni che rivelano risposte", () => {
    const multiple = {...item, segments:[{t:"text",v:"Yo "},{t:"blank"},{t:"text",v:" y "},{t:"blank"},{t:"text",v:"."}], steps:[{options:item.options,correct:item.correct},{options:["estudio","estudia"],correct:"estudio"}], translationIt:"Io ___ e ___."};
    expect(validateInclusiveExercise({type:"mc",items:[multiple]}, base).type).toBe("mc");
    expect(() => validateInclusiveExercise({type:"mc",items:[{...multiple,steps:undefined}]}, base)).toThrow(/ogni lacuna/);
    expect(() => validateInclusiveExercise({type:"mc",items:[{...multiple,translationIt:"Io ___ e studio."}]}, base)).toThrow(/mantenere il vuoto/);
    expect(() => validateInclusiveExercise({type:"mc",items:[{...multiple,segments:[{t:"text",v:"Yo "},{t:"blank"},{t:"text",v:" y (estudio/estudia) "},{t:"blank"}]}]}, base)).toThrow(/alternative.*soltanto/);
    const limited = validateInclusiveResult({type:"mc",items:Array(6).fill(multiple)}, base);
    expect(limited.wasTruncated).toBe(true);
    if (limited.exercise.type === "mc") expect(limited.exercise.items).toHaveLength(5);
    expect(exerciseSchema.safeParse({type:"mc",items:Array(15).fill(item)}).success).toBe(true);
  });
  it("valida optionsTranslationIt allineato al numero di opzioni e ai passi progressivi", () => {
    const withOptionsTr = { ...item, optionsTranslationIt: ["abito", "abita"] };
    const ex = validateInclusiveExercise({ type: "mc", items: [withOptionsTr] }, base);
    expect(ex.type).toBe("mc");
    if (ex.type === "mc") expect(ex.items[0].optionsTranslationIt).toEqual(["abito", "abita"]);
    expect(() =>
      validateInclusiveExercise({ type: "mc", items: [{ ...item, optionsTranslationIt: ["abito", "abita", "abitano"] }] }, base)
    ).toThrow(/ciascuna delle 2 opzioni/i);
  });
  it("propaga richiesta del docente, lingua, opzioni tradotte e divieto di aggiungere domande fino a 10", () => {
    const p = inclusivePrompt({...base,adaptation:"Coniuga i verbi."});
    expect(p.user).toContain("Coniuga i verbi.");
    expect(p.user).toContain("EXACTLY 2");
    expect(p.user).toContain("Spanish");
    expect(p.user).toContain("translationIt");
    expect(p.user).toContain("optionsTranslationIt");
    expect(p.system).toContain("NEVER add, invent, or extrapolate extra sentences or questions to reach 10");
    expect(p.user).toContain("DO NOT invent or append any additional items");
    expect(p.user).toContain("FIRST 10 genuine questions");
    expect(p.user).toContain("hasMoreItems");
    expect(p.user).toContain("return only the first 10 questions");
  });
});

