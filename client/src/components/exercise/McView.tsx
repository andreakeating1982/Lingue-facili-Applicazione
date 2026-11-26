import { useMemo, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { repairGluedSegments, type McItem } from "@shared/exercise";
import { FeedbackBanner, type ItemAnswer } from "./common";
import { TranslationToggle } from "./TranslationToggle";
import { useLang } from "@/lib/lang";

const GROUP_COLORS = { A: "#3949ab", B: "#00796b" } as const;

/**
 * Scelta multipla: frase con eventuale spazio vuoto, traduzione italiana della
 * domanda + traduzione italiana delle opzioni di risposta, e opzioni a pulsanti.
 */
export function McView({
  item,
  locked,
  onSolved,
  translationControl,
}: {
  item: McItem;
  locked: boolean;
  onSolved: (result: ItemAnswer) => void;
  translationControl?: ReactNode;
}) {
  const { lang } = useLang();
  const [wrong, setWrong] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState<"ok" | "ko" | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [doneSteps, setDoneSteps] = useState<NonNullable<ItemAnswer["steps"]>>([]);

  const segments = useMemo(() => repairGluedSegments(item.segments), [item.segments]);
  const blankCount = useMemo(() => segments.filter((s) => s.t === "blank").length, [segments]);
  const steps = useMemo(
    () =>
      item.steps?.length
        ? item.steps
        : [{ options: item.options, optionsTranslationIt: item.optionsTranslationIt, correct: item.correct }],
    [item]
  );
  const legacyMultiBlank = blankCount > 1 && steps.length === 1;
  const active = steps[Math.min(stepIdx, steps.length - 1)];
  const stepFinished = locked || stepDone;

  const sourceText = useMemo(
    () => segments.map((seg) => (seg.t === "blank" ? "___" : seg.v)).join(""),
    [segments]
  );

  const pick = (opt: string) => {
    if (stepFinished || wrong.includes(opt)) return;
    if (opt === active.correct) {
      const next = [...doneSteps, { ok: true, attempts, value: opt }];
      setDoneSteps(next);
      setStatus("ok");
      if (stepIdx + 1 >= steps.length) {
        onSolved({
          ok: true,
          attempts: next.reduce((sum, s) => sum + s.attempts, 0),
          value: next.map((s) => s.value).join(" / "),
          ...(steps.length > 1 ? { steps: next } : {}),
        });
      } else {
        setStepDone(true);
      }
    } else {
      setWrong((w) => [...w, opt]);
      setAttempts((a) => a + 1);
      setStatus("ko");
    }
  };

  const nextStep = () => {
    window.dispatchEvent(new Event("ascolto:contenuto-cambiato"));
    setStepIdx((n) => n + 1);
    setStepDone(false);
    setWrong([]);
    setAttempts(0);
    setStatus(null);
  };

  let blankPosition = -1;
  return (
    <div>
      <p className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-[#8B3A1A]">
        Scegli una risposta corretta.
      </p>
      {steps.length > 1 && (
        <p className="mb-2 text-center text-sm font-bold text-[#8B3A1A]" aria-live="polite">
          Domanda {Math.min(stepIdx + 1, steps.length)} di {steps.length}
        </p>
      )}
      {legacyMultiBlank && (
        <p role="note" className="mb-3 rounded-[10px] border border-[#E5D8C9] bg-[#F4EDE2] px-3 py-2 text-center text-sm text-[#2E2118]">
          Questa scheda precedente ha più spazi vuoti ma un solo gruppo di opzioni salvate: la risposta completa il primo spazio.
        </p>
      )}

      {translationControl ?? (
        <TranslationToggle
          key={`mc-tr-${stepIdx}`}
          translation={item.translationIt}
          source={sourceText}
          lang={lang}
          options={active.options}
          optionsTranslation={active.optionsTranslationIt}
        />
      )}

      {/* Frase con eventuali spazi vuoti */}
      <div
        lang={lang}
        className="lf-question-box rounded-[14px] border border-[#E5E0D8] bg-[#FAF8F5] px-4 py-4 text-center text-xl leading-relaxed sm:px-5 sm:text-2xl"
      >
        {segments.map((seg, i) => {
          if (seg.t === "blank") {
            blankPosition++;
            const filled = doneSteps[blankPosition]?.value;
            const current = !filled && blankPosition === stepIdx && !locked;
            return (
              <span
                key={i}
                aria-label={
                  filled
                    ? steps.length > 1
                      ? `risposta ${blankPosition + 1}: ${filled}`
                      : filled
                    : steps.length > 1
                      ? `spazio ${blankPosition + 1} da completare`
                      : "spazio da completare"
                }
                className={
                  "mx-1 inline-block min-w-[4.5rem] rounded-[10px] border-2 px-3 py-0.5 text-center font-bold transition-all " +
                  (filled
                    ? "pop-in border-[#258142] bg-[#E8F5E9] text-[#1B5E20]"
                    : current
                      ? "border-[#8B3A1A] bg-[#F2E7DE] text-[#8B3A1A]"
                      : "border-dashed border-[#B89D8B] bg-[#F4EDE2] text-[#66564C]")
                }
              >
                {filled ? filled : "___"}
              </span>
            );
          }
          if (seg.t === "subject") {
            const c = GROUP_COLORS[seg.group];
            return (
              <span
                key={i}
                className="mx-0.5 inline-block rounded-[8px] px-2 py-0.5 font-bold text-white"
                style={{ backgroundColor: c }}
              >
                {seg.v}
              </span>
            );
          }
          return <span key={i}>{seg.v}</span>;
        })}
      </div>

      {/* Opzioni */}
      <div
        className={
          "mt-5 grid gap-3 " +
          (active.options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")
        }
      >
        {active.options.map((opt, i) => {
          const isWrong = wrong.includes(opt);
          const isRight = stepFinished && opt === active.correct;
          return (
            <button
              key={opt}
              lang={lang}
              data-tts-label={opt}
              data-answer-status={isRight ? "correct" : isWrong ? "wrong" : undefined}
              disabled={stepFinished || isWrong}
              onClick={() => pick(opt)}
              className={
                "lf-choice-option group relative flex min-h-16 max-w-full flex-wrap items-center justify-center gap-[10px] rounded-[12px] border-2 px-[14px] py-3.5 text-center text-xl font-bold transition-all " +
                (isRight
                  ? "pop-in border-[#258142] bg-[#E8F5E9] text-[#1B5E20]"
                  : isWrong
                    ? "shake cursor-not-allowed border-[#B71C1C] bg-[#FBE7E1] text-[#7A1C1C] line-through opacity-75"
                    : "border-[#C9AD9A] bg-[#F2E7DE] text-[#2E2118] hover:-translate-y-0.5 hover:border-[#8B3A1A]")
              }
            >
              <span
                aria-hidden="true"
                className={
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold " +
                  (isRight
                    ? "border-[#258142] bg-[#258142] text-white"
                    : isWrong
                      ? "border-[#B71C1C] bg-[#B71C1C] text-white"
                      : "border-[#C9AD9A] bg-[#FAF8F5] text-[#8B3A1A]")
                }
              >
                {isRight ? (
                  <Check className="size-5" aria-hidden="true" />
                ) : isWrong ? (
                  <X className="size-5" aria-hidden="true" />
                ) : (
                  ["A", "B", "C", "D"][i]
                )}
              </span>
              <span className="min-w-0 max-w-full [overflow-wrap:anywhere]">{opt}</span>
            </button>
          );
        })}
      </div>

      <FeedbackBanner state={status} />
      {stepDone && !locked && (
        <button
          type="button"
          onClick={nextStep}
          className="mx-auto mt-5 flex max-w-full flex-wrap items-center justify-center gap-2 rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-5 py-3 text-lg font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95"
        >
          PROSSIMA DOMANDA
        </button>
      )}
    </div>
  );
}
