/* Verifica con IA reale (SOLO in memoria, zero scritture su database):
   1) < 10 domande (numerato e non numerato) -> adatta SOLO quelle presenti, wasTruncated=false
   2) = 10 domande -> adatta tutte le 10, wasTruncated=false
   3) > 10 domande -> adatta solo le prime 10, wasTruncated=true
   4) scelta multipla -> optionsTranslationIt presente e valido per tutte le opzioni
*/
import "dotenv/config";
import assert from "node:assert/strict";
import { generateInclusiveExerciseWithLimit } from "../server/inclusiveGeneration";
import type { GenerateInput } from "../shared/exercise";

const base = { cognome: "", nome: "", data: "", classe: "" };

async function main() {
  // 1a. Meno di 10 domande NON numerate (3 frasi in inglese, MC a 3 opzioni)
  const en3Input: GenerateInput = {
    ...base,
    lang: "en",
    type: "mc",
    optionsCount: 3,
    text: "She ___ to school every morning.\nThey ___ football on Saturdays.\nHe ___ a book before bed.",
    adaptation: "Completa le frasi con la forma corretta del presente semplice.",
  };
  const en3 = await generateInclusiveExerciseWithLimit(en3Input);
  assert.equal(en3.wasTruncated, false, "3 frasi non numerate non devono attivare troncamento");
  assert.equal(en3.exercise.type, "mc");
  assert.equal(en3.exercise.items.length, 3, `Attese esattamente 3 domande, ricevute ${en3.exercise.items.length}`);
  for (const [idx, it] of en3.exercise.items.entries()) {
    assert.ok(it.translationIt?.includes("___"), `Domanda ${idx + 1}: manca translationIt con ___`);
    assert.equal(it.options.length, 3);
    assert.equal(it.optionsTranslationIt?.length, 3, `Domanda ${idx + 1}: manca optionsTranslationIt per le 3 opzioni`);
  }
  console.log("OK <10 non numerato (EN, 3 frasi MC + traduzione opzioni):", en3.exercise.items.map(i => ({ options: i.options, tr: i.optionsTranslationIt })));

  // 1b. Meno di 10 frasi numerate (4 frasi in francese, riordino)
  const fr4Input: GenerateInput = {
    ...base,
    lang: "fr",
    type: "reorder",
    optionsCount: 3,
    text: "1. Elle mange une pomme rouge.\n2. Nous allons au parc ensemble.\n3. Tu lis un livre intéressant.\n4. Ils habitent à Lyon.",
    adaptation: "Riordina le parole di ciascuna frase.",
  };
  const fr4 = await generateInclusiveExerciseWithLimit(fr4Input);
  assert.equal(fr4.wasTruncated, false, "4 frasi numerate non devono attivare troncamento");
  assert.equal(fr4.exercise.type, "reorder");
  assert.equal(fr4.exercise.items.length, 4, `Attese esattamente 4 frasi, ricevute ${fr4.exercise.items.length}`);
  console.log("OK <10 numerato (FR, 4 frasi riordino):", fr4.exercise.items.length);

  // 2. Esattamente 10 domande in spagnolo -> tutte e 10 adattate, wasTruncated = false
  const es10Lines = [
    "1. Yo ___ en Madrid.",
    "2. Tú ___ español muy bien.",
    "3. Ella ___ una manzana.",
    "4. Nosotros ___ en la escuela.",
    "5. Ellos ___ el autobús.",
    "6. Mi hermano ___ música.",
    "7. María ___ temprano.",
    "8. Vosotros ___ agua.",
    "9. El gato ___ en el sofá.",
    "10. Mis amigos ___ al cine.",
  ].join("\n");
  const es10 = await generateInclusiveExerciseWithLimit({
    ...base,
    lang: "es",
    type: "mc",
    optionsCount: 2,
    text: es10Lines,
    adaptation: "Completa con il verbo coniugato al presente.",
  });
  assert.equal(es10.wasTruncated, false, "Esattamente 10 domande non devono mostrare avviso di taglio");
  assert.equal(es10.exercise.type, "mc");
  assert.equal(es10.exercise.items.length, 10, `Attese 10 domande, ricevute ${es10.exercise.items.length}`);
  assert.ok(es10.exercise.items.every(i => i.optionsTranslationIt?.length === 2), "Tutte le 10 domande devono avere optionsTranslationIt");
  console.log("OK =10 numerato (ES, 10 domande MC, wasTruncated=false)");

  // 3. Oltre 10 domande (12 domande) -> solo le prime 10 adattate, wasTruncated = true
  const es12Lines = es10Lines + "\n11. Pedro ___ por la mañana.\n12. Lucía ___ una carta.";
  const es12 = await generateInclusiveExerciseWithLimit({
    ...base,
    lang: "es",
    type: "mc",
    optionsCount: 2,
    text: es12Lines,
    adaptation: "Completa con il verbo coniugato al presente.",
  });
  assert.equal(es12.wasTruncated, true, "12 domande devono attivare wasTruncated=true");
  assert.equal(es12.exercise.type, "mc");
  assert.equal(es12.exercise.items.length, 10, `Attese le prime 10 domande su 12, ricevute ${es12.exercise.items.length}`);
  console.log("OK >10 numerato (ES, 12 -> prime 10 domande MC, wasTruncated=true)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
