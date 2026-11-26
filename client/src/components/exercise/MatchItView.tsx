import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import type { MatchItPair } from "@shared/exercise";
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

const GOLD = "#c9a227";
const TEAL = "#00695c";
const INDIGO = "#3949AB";
const GOLD_C = "#B8860B";

/**
 * Quinta tipologia — abbinamento lingua straniera ↔ italiano: due colonne, a
 * sinistra le parole/frasi nella lingua scelta numerate 1-6, a destra le
 * traduzioni italiane
 * mescolate con lettere A-F. Si TOCCA la card straniera e poi quella italiana
 * (o viceversa), oppure si TRASCINA la card italiana su quella straniera —
 * feedback immediato per ogni coppia, come nell'abbinamento con le immagini.
 */
export function MatchItView({
  pairs,
  locked,
  onPair,
  onAllDone,
}: {
  pairs: MatchItPair[];
  locked: boolean;
  onPair: (result: ItemAnswer) => void;
  onAllDone: () => void;
}) {
  const { L, lang } = useLang();
  /* Ordine delle card italiane, fisso per sessione */
  const itOrder = useMemo(() => shuffle(pairs.map((_, i) => i)), [pairs]);
  /* Slot (lettera) di ogni coppia: posizione nella colonna italiana */
  const slotOf = useMemo(() => {
    const m: number[] = [];
    itOrder.forEach((pairIdx, slot) => {
      m[pairIdx] = slot;
    });
    return m;
  }, [itOrder]);

  const [selected, setSelected] = useState<{ side: "en" | "it"; idx: number } | null>(null);
  const [matched, setMatched] = useState<Record<number, boolean>>({});
  const [wrongByPair, setWrongByPair] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<"ok" | "ko" | null>(null);
  const allDone = useRef(false);

  /* Trascinamento universale (mouse, penna e dito): la card italiana rilasciata
     su una card straniera prova l'abbinamento; il tocco fermo resta un clic. */
  const { chipProps, ghost, over, consumeClick } = usePointerDrop("[data-en-card]", (idx, el) =>
    attempt(Number(el.getAttribute("data-en-card")), idx)
  );
  const overIdx = over ? Number(over.getAttribute("data-en-card")) : null;

  useEffect(() => {
    if (locked) return;
    if (Object.keys(matched).length === pairs.length && pairs.length > 0 && !allDone.current) {
      allDone.current = true;
      onAllDone();
    }
  }, [matched, pairs.length, locked, onAllDone]);

  const attempt = (enIdx: number, itIdx: number) => {
    if (locked || matched[enIdx]) return;
    if (enIdx === itIdx) {
      setMatched((m) => ({ ...m, [enIdx]: true }));
      setStatus("ok");
      onPair({
        ok: true,
        attempts: wrongByPair[enIdx] ?? 0,
        value: `${pairs[enIdx].en} → ${LETTERS[slotOf[enIdx]] ?? "?"}`,
      });
      setSelected(null);
    } else {
      setWrongByPair((w) => ({ ...w, [enIdx]: (w[enIdx] ?? 0) + 1 }));
      setStatus("ko");
    }
  };

  const allMatched = Object.keys(matched).length === pairs.length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {/* Colonna FRANCESE (1-6) — bersaglio del trascinamento */}
        <div className="flex flex-col gap-2.5" role="group" aria-label={`Parole e frasi ${L.linguaNome}`}>
          {/* Intestazione colonna: ENGLISH / FRANÇAIS / ESPAÑOL */}
          <p className="text-center text-xs font-bold tracking-wide text-[#8A6400]">{L.colTarget}</p>
          {pairs.map((pair, i) => {
            const isMatched = !!matched[i];
            const isSelected = selected?.side === "en" && selected.idx === i;
            return (
              <button
                key={i}
                data-en-card={i}
                lang={lang}
                data-tts-label={pair.en}
                onClick={() => {
                  if (isMatched || locked) return;
                  if (selected?.side === "it") attempt(selected.idx, i);
                  else setSelected(isSelected ? null : { side: "en", idx: i });
                }}
                disabled={isMatched || locked}
                aria-label={`${L.linguaNome.charAt(0).toUpperCase() + L.linguaNome.slice(1)} ${i + 1}: ${pair.en}${isMatched ? " — abbinata" : ""}`}
                aria-pressed={isSelected}
                className={
                  "flex items-center gap-2.5 rounded-[14px] border-[3px] bg-[#FAF8F5] p-2.5 text-left transition-all " +
                  (isMatched
                    ? "border-[#00695c] bg-[#E2F3EF]"
                    : overIdx === i
                      ? "border-[#B8860B] bg-[#FFF6DC] ring-4 ring-[#B8860B]/30"
                      : isSelected
                        ? "border-[#3949AB] bg-[#E8EAF6] ring-4 ring-[#3949AB]/40"
                        : "border-[#D6CEC4] hover:border-[#B8860B]")
                }
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: isMatched ? TEAL : INDIGO }}
                >
                  {isMatched ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 text-base font-bold leading-snug text-[#2e2018]">
                  {pair.en}
                </span>
              </button>
            );
          })}
        </div>

        {/* Colonna ITALIANA (A-F, mescolata) — card trascinabili */}
        <div className="flex flex-col gap-2.5" role="group" aria-label="Traduzioni italiane">
          <p className="text-center text-xs font-bold tracking-wide text-[#8A6400]">ITALIANO</p>
          {itOrder.map((pairIdx, slot) => {
            const pair = pairs[pairIdx];
            const isMatched = !!matched[pairIdx];
            const isSelected = selected?.side === "it" && selected.idx === pairIdx;
            return (
              <span
                key={pairIdx}
                role="button"
                tabIndex={isMatched || locked ? -1 : 0}
                aria-label={`Italiano ${LETTERS[slot]}: ${pair.it}`}
                {...chipProps(pairIdx, !isMatched && !locked)}
                onClick={() => {
                  if (isMatched || locked) return;
                  if (consumeClick()) return;
                  if (selected?.side === "en") attempt(selected.idx, pairIdx);
                  else setSelected(isSelected ? null : { side: "it", idx: pairIdx });
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isMatched && !locked) {
                    e.preventDefault();
                    setSelected((s) =>
                      s?.side === "it" && s.idx === pairIdx ? null : { side: "it", idx: pairIdx }
                    );
                  }
                }}
                aria-pressed={isSelected}
                className={
                  "flex select-none items-center gap-2.5 rounded-[14px] border-[3px] bg-[#FAF8F5] p-2.5 text-left transition-all " +
                  (isMatched
                    ? "border-[#00695c] bg-[#E2F3EF]"
                    : isSelected
                      ? "border-[#B8860B] bg-[#FFF6DC] ring-4 ring-[#B8860B]/50"
                      : "border-[#D6CEC4] hover:border-[#B8860B]")
                }
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: isMatched ? TEAL : GOLD }}
                >
                  {isMatched ? <Check className="size-4" aria-hidden="true" /> : LETTERS[slot]}
                </span>
                <span className="min-w-0 flex-1 text-base font-bold leading-snug text-[#2e2018]">
                  {pair.it}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {status === "ko" && (
        <div className="shake">
          <FeedbackBanner state="ko" />
        </div>
      )}
      {status === "ok" && !allMatched && <FeedbackBanner state="ok" />}
      {allMatched && <FeedbackBanner state="ok" />}

      {/* La card "fantasma" segue il dito/cursore durante il trascinamento */}
      {ghost &&
        createPortal(
          <div
            style={{ ...GHOST_STYLE, left: ghost.x, top: ghost.y }}
            className="max-w-[240px] rounded-[14px] border-[3px] border-[#B8860B] bg-[#FFF6DC] px-3 py-2 text-base font-bold text-[#2e2018] opacity-95 shadow-lg"
            aria-hidden="true"
          >
            {pairs[ghost.idx].it}
          </div>,
          document.body
        )}
    </div>
  );
}
