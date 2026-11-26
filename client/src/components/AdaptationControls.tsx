import { ListChecks, Mic, Square, Shuffle, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useTeacherVoice } from "@/hooks/useTeacherVoice";
import type { DescriptionStatus } from "@/hooks/useAdaptationDescription";
import { countWords, permitsTextEdit, MAX_EXERCISE_WORDS, MAX_INPUT_CHARACTERS } from "@shared/textLimits";

export type AdaptMode = "reorder" | "mc";
export type OptionCount = 2 | 3 | 4;

export function AdaptationControls({ mode, setMode, count, setCount, instructions, setInstructions, descriptionStatus, onRetry, onApplyPending, disabled, onVoiceBusy }: {
  mode: AdaptMode | null; setMode: Dispatch<SetStateAction<AdaptMode | null>>;
  count: OptionCount | null; setCount: Dispatch<SetStateAction<OptionCount | null>>;
  instructions: string; setInstructions: Dispatch<SetStateAction<string>>;
  descriptionStatus: DescriptionStatus;
  onRetry: () => void;
  onApplyPending: () => boolean;
  disabled: boolean;
  onVoiceBusy: (busy: boolean) => void;
}) {
  const voice = useTeacherVoice(instructions, setInstructions);
  useEffect(() => { onVoiceBusy(voice.state !== "idle"); }, [voice.state, onVoiceBusy]);
  const lock = disabled || voice.state !== "idle";
  const instructionWords = countWords(instructions);
  const instructionTooLong = instructionWords > MAX_EXERCISE_WORDS || instructions.length > MAX_INPUT_CHARACTERS;
  const micBlockedInFrame = (() => {
    try {
      if (window.top === window.self) return false;
      const doc = document as Document & { permissionsPolicy?: { allowsFeature: (name: string) => boolean }; featurePolicy?: { allowsFeature: (name: string) => boolean } };
      const policy = doc.permissionsPolicy ?? doc.featurePolicy;
      return policy ? !policy.allowsFeature("microphone") : false;
    } catch { return false; }
  })();

  return (
    <section className="mt-5 border-t-2 border-[#E8DDD1] pt-5" aria-labelledby="adapt-title">
      <h2 id="adapt-title" className="text-center text-lg font-bold text-[#8B3A1A]">
        <label htmlFor="teacher-adaptation">SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA</label>
      </h2>
      <h3 className="mt-4 text-center text-base font-bold text-[#8B3A1A]">SCEGLI IL TIPO DI ESERCIZIO</h3>

      <fieldset disabled={lock} className="mt-4 min-w-0">
        <legend className="sr-only">Tipo di esercizio</legend>
        <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
          {([
            { value: "mc" as const, title: "SCELTA MULTIPLA", help: "Scegli una risposta corretta", Icon: ListChecks },
            { value: "reorder" as const, title: "RIORDINO DI PAROLE", help: "Metti le parole nell'ordine giusto", Icon: Shuffle },
          ]).map(({ value, title, help, Icon }) => (
            <label
              key={value}
              className={`lf-radio-card flex min-h-[88px] max-w-full cursor-pointer flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 p-[12px] text-center transition-colors focus-within:outline focus-within:outline-3 focus-within:outline-[#B71C1C] ${
                mode === value
                  ? "lf-radio-card-selected border-[#8B3A1A] bg-[#F2E7DE] text-[#2E2118]"
                  : "border-[#D8CABC] bg-[#FFFFFF] text-[#2E2118] hover:border-[#8B3A1A]/60"
              }`}
            >
              <input
                className="lf-choice-radio"
                type="radio"
                name="adapt-mode"
                value={value}
                checked={mode === value}
                onChange={() => {
                  if (value === "mc" && mode !== "mc") setCount(null);
                  setMode(value);
                }}
              />
              <Icon className="size-6 shrink-0 text-[#8B3A1A]" aria-hidden="true" />
              <span className="min-w-[min(100%,8rem)] max-w-full flex-1 [overflow-wrap:anywhere]">
                <span className={`block text-sm font-bold ${mode === value ? "text-[#8B3A1A]" : "text-[#2E2118]"}`}>{title}</span>
                <span className="block text-xs leading-relaxed text-[#66564C]">{help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "mc" && (
        <fieldset disabled={lock} className="mt-4 min-w-0">
          <legend className="mb-2 w-full text-center text-sm font-bold text-[#8B3A1A]">NUMERO DI OPZIONI</legend>
          <div className="flex flex-wrap justify-center gap-2.5">
            {([2, 3, 4] as const).map((n) => (
              <label
                key={n}
                className={`lf-radio-card flex min-h-11 min-w-[94px] max-w-full cursor-pointer flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 px-[12px] py-2 text-sm font-bold transition-colors focus-within:outline focus-within:outline-3 focus-within:outline-[#B71C1C] ${
                  count === n
                    ? "lf-radio-card-selected border-[#8B3A1A] bg-[#F2E7DE] text-[#8B3A1A]"
                    : "border-[#D8CABC] bg-[#FFFFFF] text-[#2E2118] hover:border-[#8B3A1A]/60"
                }`}
              >
                <input className="lf-choice-radio" type="radio" name="option-count" value={n} checked={count === n} onChange={() => setCount(n)} />
                {n} opzioni
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {mode === "mc" && count === null && (
        <p role="status" className="mt-4 text-center text-sm leading-relaxed text-[#66564C]">
          Scegli 2, 3 o 4 opzioni per preparare la spiegazione.
        </p>
      )}

      {(mode !== "mc" || count !== null) && (
        <div className="mt-5">
          <p className="mt-1 text-center text-sm leading-relaxed text-[#66564C]">
            Dopo la scelta, l'IA descrive qui l'esercizio e come adattarlo. Controlla la spiegazione e modificala se vuoi.
          </p>
          <textarea
            id="teacher-adaptation"
            value={instructions}
            disabled={disabled}
            required
            aria-describedby="teacher-word-count"
            aria-invalid={instructionTooLong}
            onChange={(e) => {
              const next = e.target.value;
              if (permitsTextEdit(instructions, next)) setInstructions(next);
              else toast.warning(`Puoi inserire al massimo ${MAX_EXERCISE_WORDS} parole.`);
            }}
            rows={4}
            placeholder="La spiegazione dell'IA comparirà qui. Puoi scrivere o correggere il testo."
            className="mt-3 w-full resize-y rounded-[10px] border-2 border-[#CABEB2] bg-white p-3 text-base leading-relaxed text-[#2E2118] placeholder:text-[#66564C] focus:border-[#8B3A1A]"
          />
          <p id="teacher-word-count" aria-live="polite" className="mt-1.5 text-center text-sm font-bold text-[#66564C]">
            {instructionWords}/{MAX_EXERCISE_WORDS} parole
          </p>
          {instructionTooLong && (
            <p role="alert" className="mt-1 text-center text-sm font-bold text-[#B71C1C]">
              La trascrizione supera il limite: riduci la spiegazione a 500 parole prima di continuare.
            </p>
          )}
          {(descriptionStatus === "waiting" || descriptionStatus === "loading") ? (
            <div role="status" aria-live="polite" className="lf-progress-card mt-3 flex flex-col gap-2 px-5 py-4">
              <p className="lf-description-status flex items-center justify-center gap-2 text-sm font-bold leading-relaxed text-[#8B3A1A]">
                <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" /> L'IA sta preparando la spiegazione…
              </p>
              <div className="lf-progress-track" aria-hidden="true">
                <div className="lf-progress-indeterminate" />
              </div>
            </div>
          ) : (
            descriptionStatus !== "idle" && (
              <p role="status" aria-live="polite" className="lf-description-status mt-2 text-center text-sm font-bold leading-relaxed text-[#8B3A1A]">
                {descriptionStatus === "ready"
                  ? "Spiegazione pronta: controllala e correggila se necessario."
                  : descriptionStatus === "review"
                    ? "Hai modificato il testo mentre l'IA lavorava: le tue parole sono state conservate."
                    : descriptionStatus === "error"
                      ? "L'IA non è riuscita a preparare la spiegazione. Scrivila tu oppure riprova."
                      : ""}
              </p>
            )
          )}
          {descriptionStatus === "error" && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={onRetry}
                disabled={disabled}
                className="rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-4 py-2 font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:brightness-95"
              >
                RIPROVA LA SPIEGAZIONE
              </button>
            </div>
          )}
          {descriptionStatus === "review" && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  if (!onApplyPending()) toast.warning("Il testo è troppo lungo: riducilo prima di aggiungere la proposta.");
                }}
                disabled={disabled}
                className="rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-4 py-2 font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:brightness-95"
              >
                AGGIUNGI LA PROPOSTA DELL'IA
              </button>
            </div>
          )}
          <div className="lf-equal-actions mt-6 flex flex-col items-center gap-2.5">
            <button
              type="button"
              disabled={disabled || voice.state === "requesting" || voice.state === "transcribing"}
              onClick={voice.state === "listening" ? voice.stop : () => void voice.start()}
              aria-pressed={voice.state === "listening"}
              className={`inline-flex min-h-12 max-w-full flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 px-[12px] py-2.5 text-center text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 ${
                voice.state === "listening"
                  ? "lf-recording-btn border-[#B71C1C] bg-[#B71C1C]"
                  : "border-[#8B3A1A] bg-[#8B3A1A]"
              } disabled:opacity-60`}
            >
              {voice.state === "listening" ? (
                <Square className="size-5" aria-hidden="true" />
              ) : voice.state === "transcribing" || voice.state === "requesting" ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Mic className="size-5" aria-hidden="true" />
              )}
              <span>
                {voice.state === "listening"
                  ? "FERMA REGISTRAZIONE"
                  : voice.state === "transcribing"
                    ? "TRASCRIZIONE IA IN CORSO…"
                    : voice.state === "requesting"
                      ? "ATTENDO IL MICROFONO…"
                      : "REGISTRA ISTRUZIONI"}
              </span>
            </button>
            <label
              aria-disabled={disabled || voice.state !== "idle"}
              className={`inline-flex min-h-12 max-w-full cursor-pointer flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-[12px] py-2.5 text-center text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 focus-within:outline focus-within:outline-3 focus-within:outline-[#B71C1C] ${
                disabled || voice.state !== "idle" ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <Upload className="size-5" aria-hidden="true" /> <span>CARICA FILE AUDIO</span>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.opus,.webm,.flac,.aac,.aiff,.amr,.wma,.caf"
                className="sr-only"
                aria-label="Carica file audio con le istruzioni"
                disabled={disabled || voice.state !== "idle"}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void voice.upload(file);
                }}
              />
            </label>
          </div>
          {voice.state === "listening" && (
            <p className="mt-2 text-center text-sm text-[#66564C]" aria-live="polite">
              Registrazione in corso: {voice.remaining} secondi rimanenti.
            </p>
          )}
          <p className="mt-5 text-center text-sm leading-relaxed text-[#66564C]">
            La registrazione audio si ferma e viene trascritta dall'IA dopo 30 secondi. Puoi anche caricare un file audio fino a 12 MB. L'applicazione può preparare massimo 10 frasi o domande alla volta
          </p>
          {micBlockedInFrame && (
            <p className="mt-2 rounded-[10px] border border-[#E5D8C9] bg-[#F4EDE2] p-3 text-xs leading-relaxed text-[#2E2118]">
              Il microfono è bloccato dalla cornice del sito.{" "}
              <a className="font-bold text-[#8B3A1A] underline" href={window.location.href} target="_blank" rel="noopener noreferrer">
                Apri l'app in una nuova scheda
              </a>{" "}
              oppure aggiorna i permessi della cornice. Il testo già inserito qui non viene trasferito automaticamente.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
