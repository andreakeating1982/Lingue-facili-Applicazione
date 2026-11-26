/**
 * Esempio locale per provare la vista reale del riordino senza IA né database.
 * La rotta è registrata solo in sviluppo, mai nella build di produzione.
 */
import { useState } from "react";
import { ReorderView } from "@/components/exercise/ReorderView";
import type { ReorderItem } from "@shared/exercise";

const example: ReorderItem = {
  chips: [
    { t: "She", role: "subject" },
    { t: "often", role: "adverb" },
    { t: "eats", role: "verb" },
    { t: "apples.", role: "other" },
  ],
  answer: "She often eats apples.",
  translationIt: "Lei mangia spesso le mele.",
};

export default function PreviewReorder() {
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState(false);
  return (
    <main className="lf-flow-page mx-auto w-full max-w-2xl px-[16px] pb-16 pt-4">
      <h1 className="mb-3 text-center text-lg font-bold text-[#5D4037]">RIORDINA LE PAROLE</h1>
      <p className="mb-4 text-center text-sm leading-[1.6] text-[#5A4A38]">
        Esempio di anteprima: prova le tessere. Non vengono creati esercizi né salvati dati.
      </p>
      <div className="card-paper p-[16px] sm:p-5">
        <ReorderView key={attempt} item={example} locked={false} onSolved={() => setFinished(true)} />
        {finished && (
          <button
            type="button"
            onClick={() => { setFinished(false); setAttempt(n => n + 1); }}
            className="mx-auto mt-5 flex min-h-11 items-center justify-center rounded-2xl bg-[#805B46] px-5 py-3 text-sm font-bold text-white hover:bg-[#5D4037]"
          >
            RIPROVA L'ESEMPIO
          </button>
        )}
      </div>
      <a href="/" className="mx-auto mt-5 block w-fit text-center text-sm font-bold text-[#5D4037] underline">
        Vai all'anteprima completa di Lingue Facili
      </a>
    </main>
  );
}

