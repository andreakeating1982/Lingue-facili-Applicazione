import { CheckCircle2, XCircle } from "lucide-react";
import type { Answers } from "@shared/exercise";
import { useLang } from "@/lib/lang";

export type ItemAnswer = Answers["items"][number];

export const LETTERS = "ABCDEF" as const;

/** Banner grande di feedback immediato (verde = corretto, rosso = riprova),
    allineato ai colori di verifica del Widget equazioni. */
export function FeedbackBanner({ state }: { state: "ok" | "ko" | null }) {
  const { L } = useLang();
  if (!state) return null;
  const ok = state === "ok";
  return (
    <div
      role="status"
      aria-live="assertive"
      data-feedback={ok ? "ok" : "ko"}
      className={
        "lf-feedback-banner pop-in mx-auto mt-4 flex w-fit max-w-full items-center gap-3 rounded-[12px] border-2 px-5 py-3 text-lg font-bold shadow-sm " +
        (ok
          ? "border-[#258142] bg-[#E8F5E9] text-[#1B5E20]"
          : "border-[#B71C1C] bg-[#FBE7E1] text-[#8B1E1E]")
      }
    >
      {ok ? (
        <CheckCircle2 className="size-7 shrink-0" aria-hidden="true" />
      ) : (
        <XCircle className="size-7 shrink-0" aria-hidden="true" />
      )}
      <span>{ok ? L.feedbackOK : L.feedbackKO}</span>
    </div>
  );
}

/** Badge numerico/circolare dell'item (come nel PDF e nei pezzi del Widget). */
export function ItemBadge({ n, color = "#8B3A1A" }: { n: number | string; color?: string }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}
