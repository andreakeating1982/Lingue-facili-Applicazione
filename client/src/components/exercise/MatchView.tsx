import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import type { MatchPair } from "@shared/exercise";
import { FeedbackBanner, LETTERS } from "./common";
import type { ItemAnswer } from "./common";
import { GHOST_STYLE, usePointerDrop } from "./usePointerDrop";
import { useLang } from "@/lib/lang";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Abbinamento parola → immagine: griglia di 6 immagini (A–F) con lettera
 * dorata + banco di parole mescolate. Si TRASCINA la parola sull'immagine
 * (mouse e dito) oppure si tocca la parola e poi l'immagine — feedback
 * immediato per ogni coppia.
 */
export function MatchView({
  pairs,
  locked,
  onPair,
  onAllDone,
}: {
  pairs: MatchPair[];
  locked: boolean;
  onPair: (result: ItemAnswer) => void;
  onAllDone: () => void;
}) {
  const { lang } = useLang();
  const bank = useMemo(() => shuffle(pairs.map((_, i) => i)), [pairs]);
  const [selected, setSelected] = useState<number | null>(null);
  const [matched, setMatched] = useState<Record<number, boolean>>({});
  const [wrongByPair, setWrongByPair] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<"ok" | "ko" | null>(null);
  const matchedCount = useRef(0);
  const allDone = useRef(false);
  /* Trascinamento universale (mouse, penna e dito): la parola rilasciata su
     una card prova l'abbinamento; il tocco fermo resta un clic (seleziona). */
  const { chipProps, ghost, over, consumeClick } = usePointerDrop("[data-card]", (idx, el) =>
    attempt(idx, Number(el.getAttribute("data-card")))
  );
  const overIdx = over ? Number(over.getAttribute("data-card")) : null;

  useEffect(() => {
    if (locked) return;
    if (Object.keys(matched).length === pairs.length && pairs.length > 0 && !allDone.current) {
      allDone.current = true;
      onAllDone();
    }
  }, [matched, pairs.length, locked, onAllDone]);

  const attempt = (chipPairIdx: number, cardIdx: number) => {
    if (locked || matched[cardIdx]) return;
    if (chipPairIdx === cardIdx) {
      const newMatched = { ...matched, [cardIdx]: true };
      setMatched(newMatched);
      setStatus("ok");
      matchedCount.current += 1;
      onPair({
        ok: true,
        attempts: wrongByPair[cardIdx] ?? 0,
        value: `${pairs[cardIdx].word} → ${LETTERS[cardIdx]}`,
      });
      setSelected(null);
    } else {
      setWrongByPair((w) => ({ ...w, [chipPairIdx]: (w[chipPairIdx] ?? 0) + 1 }));
      setStatus("ko");
    }
  };

  const allMatched = Object.keys(matched).length === pairs.length;

  return (
    <div>
      {/* Griglia immagini */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pairs.map((pair, i) => {
          const isMatched = !!matched[i];
          return (
            <button
              key={i}
              data-card={i}
              onClick={() => selected !== null && attempt(selected, i)}
              disabled={isMatched || locked}
              className={
                "relative flex flex-col items-center rounded-[16px] border-[3px] bg-[#FAF8F5] p-2 transition-all " +
                (isMatched
                  ? "border-[#00695c] bg-[#E2F3EF]"
                  : overIdx === i
                    ? "border-[#00796b] bg-[#F0E5DF] ring-4 ring-[#00796b]/30"
                    : "border-[#D6CEC4] hover:border-[#00796b]")
              }
              aria-label={`Immagine ${LETTERS[i]}${isMatched ? " — abbinata" : ""}`}
            >
              <img
                src={pair.imageUrl}
                alt={pair.word}
                className="h-24 w-full rounded-[10px] object-contain sm:h-28"
                draggable={false}
              />
              <span
                className="mt-1 flex size-7 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: isMatched ? "#00695c" : "#c9a227" }}
              >
                {isMatched ? <Check className="size-4" aria-hidden="true" /> : LETTERS[i]}
              </span>
              {isMatched && (
                <span className="pop-in absolute -top-2 right-2 rounded-full bg-[#00695c] px-2 py-0.5 text-base font-bold text-white">
                  {pair.word}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Banco delle parole */}
      <div className="mt-5 rounded-[14px] bg-[#F8F1E4] p-3">
        <p className="mb-2 text-center text-xs font-bold text-[#004d40]">LE PAROLE</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {bank.map((idx) => {
            const isUsed = !!matched[idx];
            return (
              <span
                key={idx}
                role="button"
                tabIndex={isUsed || locked ? -1 : 0}
                aria-label={`Parola ${pairs[idx].word}`}
                lang={lang}
                data-tts-label={pairs[idx].word}
                {...chipProps(idx, !isUsed && !locked)}
                onClick={() => {
                  if (isUsed || locked) return;
                  if (consumeClick()) return;
                  if (selected === idx) setSelected(null);
                  else setSelected(idx);
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isUsed && !locked) {
                    e.preventDefault();
                    setSelected((s) => (s === idx ? null : idx));
                  }
                }}
                aria-pressed={selected === idx}
                className={
                  "chip-word chip-pur select-none " +
                  (isUsed ? "invisible" : "") +
                  (selected === idx ? " ring-4 ring-[#00796b]/50" : "")
                }
              >
                {pairs[idx].word}
              </span>
            );
          })}
        </div>
      </div>

      {status === "ko" && <div className="shake"><FeedbackBanner state="ko" /></div>}
      {status === "ok" && !allMatched && <FeedbackBanner state="ok" />}
      {allMatched && <FeedbackBanner state="ok" />}

      {/* La parola "fantasma" segue il dito/cursore durante il trascinamento */}
      {ghost &&
        createPortal(
          <div
            style={{ ...GHOST_STYLE, left: ghost.x, top: ghost.y }}
            className="chip-word chip-pur scale-110 opacity-95 shadow-lg"
            aria-hidden="true"
          >
            {pairs[ghost.idx].word}
          </div>,
          document.body
        )}
    </div>
  );
}
