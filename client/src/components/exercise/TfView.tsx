import { useState } from "react";
import { useLang } from "@/lib/lang";
import { Check, X } from "lucide-react";
import { repairGluedSegments, type TfItem } from "@shared/exercise";
import { FeedbackBanner, ItemBadge } from "./common";
import type { ItemAnswer } from "./common";

/**
 * Vero o falso: frase con la parola chiave evidenziata in giallo,
 * due grossi pulsanti VERO (verde ✓) e FALSO (corallo ✗) nella lingua scelta.
 */
export function TfView({
  item,
  locked,
  onSolved,
}: {
  item: TfItem;
  locked: boolean;
  onSolved: (result: ItemAnswer) => void;
}) {
  const { L, lang } = useLang();
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [status, setStatus] = useState<"ok" | "ko" | null>(null);

  const choose = (answerTrue: boolean) => {
    if (solved || locked) return;
    if (answerTrue === item.isTrue) {
      setSolved(true);
      setStatus("ok");
      onSolved({ ok: true, attempts, value: answerTrue ? L.tfTrue : L.tfFalse });
    } else {
      setAttempts((a) => a + 1);
      setStatus("ko");
    }
  };

  /* Evidenzia la frase chiave (prima occorrenza, case-insensitive) e ripara
     i confini incollati (es. «John»+«and» → «John and»). */
  const idx = item.sentence.toLowerCase().indexOf(item.highlight.toLowerCase());
  const fixed = repairGluedSegments([
    { t: "pre", v: idx >= 0 ? item.sentence.slice(0, idx) : item.sentence },
    { t: "mid", v: idx >= 0 ? item.sentence.slice(idx, idx + item.highlight.length) : "" },
    { t: "after", v: idx >= 0 ? item.sentence.slice(idx + item.highlight.length) : "" },
  ]);
  const before = fixed[0].v ?? "";
  const mid = fixed[1].v ?? "";
  const after = fixed[2].v ?? "";

  return (
    <div>
      <p lang={lang} className="rounded-[14px] bg-[#FFFDF6] px-4 py-4 text-xl leading-relaxed">
        {before}
        {mid && <span className="hl-word">{mid}</span>}
        {after}
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-4" role="group" aria-label={`${L.tfTrue} o ${L.tfFalse}`}>
        <button
          onClick={() => choose(true)}
          disabled={locked || solved}
          className={
            "flex items-center gap-3 rounded-2xl border-[3px] px-8 py-4 text-2xl font-bold transition-all " +
            (solved && item.isTrue
              ? "border-[#00695c] bg-[#E2F3EF] text-[#004d40]"
              : "border-[#00695c] bg-[#E2F3EF] text-[#004d40] hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50")
          }
        >
          <Check className="size-7" aria-hidden="true" /> {L.tfTrue}
        </button>
        <button
          onClick={() => choose(false)}
          disabled={locked || solved}
          className={
            "flex items-center gap-3 rounded-2xl border-[3px] px-8 py-4 text-2xl font-bold transition-all " +
            (solved && !item.isTrue
              ? "border-[#b71c1c] bg-[#FDF0EE] text-[#a51818]"
              : "border-[#b71c1c] bg-[#FDF0EE] text-[#a51818] hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50")
          }
        >
          <X className="size-7" aria-hidden="true" /> {L.tfFalse}
        </button>
      </div>

      {status === "ko" && <div className="shake"><FeedbackBanner state="ko" /></div>}
      {solved && <FeedbackBanner state="ok" />}
    </div>
  );
}

/* Re-export per l'uso nel parent senza import extra */
export { ItemBadge };
