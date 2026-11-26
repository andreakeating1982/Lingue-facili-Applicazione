import { useEffect, useId, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { LangCode } from "@shared/languages";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

/** Nascosta per impostazione iniziale; mostra la traduzione italiana della
 *  domanda e, nella scelta multipla, anche la traduzione italiana delle opzioni
 *  di risposta del passo corrente. Per le vecchie schede prive di traduzioni
 *  salvate, le richiede su clic senza toccare il database. */
export function TranslationToggle({
  translation,
  source,
  lang,
  options,
  optionsTranslation,
}: {
  translation?: string;
  source: string;
  lang: LangCode;
  options?: string[];
  optionsTranslation?: string[];
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const [cachedText, setCachedText] = useState<string | undefined>(translation);
  const [cachedOptions, setCachedOptions] = useState<string[] | undefined>(optionsTranslation);

  const optionsKey = options ? options.join("\u0001") : "";
  const hasMatchingOptionsTranslation = Boolean(
    options && cachedOptions && cachedOptions.length === options.length
  );

  // Quando nella scelta multipla si avanza al passo successivo (es. seconda lacuna),
  // chiudi la traduzione del passo precedente e carica quella del nuovo passo.
  useEffect(() => {
    setShown(false);
    setCachedOptions(optionsTranslation);
  }, [optionsKey, optionsTranslation]);

  useEffect(() => {
    if (translation) setCachedText(translation);
  }, [translation]);

  const askText = trpc.exercises.translate.useMutation({
    onSuccess: (res) => {
      setCachedText(res.translation);
      setShown(true);
    },
    onError: () => toast.error("Non sono riuscito a caricare la traduzione."),
  });

  const askOptions = trpc.exercises.translateOptions.useMutation({
    onSuccess: (res) => {
      setCachedOptions(res.translations);
      setShown(true);
    },
    onError: () => {
      if (!cachedText && !translation) {
        toast.error("Non sono riuscito a caricare la traduzione delle opzioni.");
      }
    },
  });

  const text = cachedText ?? translation;
  const optTranslations = hasMatchingOptionsTranslation ? cachedOptions : optionsTranslation;
  const needsOptions = Boolean(options && options.length >= 2 && (!optTranslations || optTranslations.length !== options.length));
  const loading = askText.isPending || (askOptions.isPending && !text);

  const toggle = () => {
    window.dispatchEvent(new Event("ascolto:contenuto-cambiato"));
    if (shown) {
      setShown(false);
      return;
    }
    if (text) {
      setShown(true);
      if (needsOptions && options && !askOptions.isPending) {
        askOptions.mutate({ text: source, options, lang });
      }
      return;
    }
    if (!askText.isPending) {
      askText.mutate({ text: source, lang });
    }
    if (needsOptions && options && !askOptions.isPending) {
      askOptions.mutate({ text: source, options, lang });
    }
  };

  return (
    <div className="mb-3 text-center">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-expanded={shown}
        aria-controls={id}
        className="inline-flex min-h-11 max-w-full flex-wrap items-center justify-center gap-2 rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Languages className="size-4" aria-hidden="true" />
        )}
        <span>{shown ? "Nascondi traduzione" : "Mostra traduzione"}</span>
      </button>

      <div
        id={id}
        hidden={!shown || !text}
        lang="it"
        aria-live="polite"
        className="lf-translation-panel mt-2.5 rounded-[10px] border border-[#E5D8C9] border-l-4 border-l-[#8B3A1A] bg-[#F4EDE2] px-4 py-3 text-center text-base leading-relaxed text-[#2E2118]"
      >
        {shown && text && (
          <>
            <p className="font-normal text-[#2E2118]">{text}</p>
            {options && optTranslations && optTranslations.length === options.length && (
              <div className="mt-3 border-t border-[#DFCDBE] pt-2.5">
                <p className="mb-1.5 text-sm font-bold uppercase tracking-wide text-[#8B3A1A]">
                  Opzioni in italiano:
                </p>
                <ul className="mx-auto flex max-w-md flex-col gap-1.5 text-left">
                  {optTranslations.map((trOpt, idx) => (
                    <li
                      key={`${OPTION_LETTERS[idx] ?? idx}-${trOpt}`}
                      className="lf-option-translation flex items-baseline gap-2 rounded-[8px] border border-[#E5D8C9] bg-[#FAF8F5] px-3 py-1.5 text-base text-[#2E2118]"
                    >
                      <span className="shrink-0 font-bold text-[#8B3A1A]">
                        {OPTION_LETTERS[idx] ?? idx + 1}:
                      </span>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{trOpt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {options && (!optTranslations || optTranslations.length !== options.length) && askOptions.isPending && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-[#66564C]">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>Carico la traduzione delle opzioni…</span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
