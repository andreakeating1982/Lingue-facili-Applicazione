import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { trpc } from "@/lib/trpc";
import type { LangCode } from "@shared/languages";
import type { AdaptMode, OptionCount } from "@/components/AdaptationControls";
import { countWords, firstWords, MAX_EXERCISE_WORDS } from "@shared/textLimits";

export type DescriptionStatus = "idle" | "waiting" | "loading" | "ready" | "review" | "error";
const NOTES_LABEL = "INDICAZIONI DEL DOCENTE: ";

/** Conserva le indicazioni scritte o dettate; non troncarle per far posto all'IA. */
function combine(suggestion: string, notes: string): string | null {
  if (!notes.trim()) return firstWords(suggestion, MAX_EXERCISE_WORDS).trim();
  const suffix = `\n\n${NOTES_LABEL}${notes.trim()}`;
  const available = MAX_EXERCISE_WORDS - countWords(suffix);
  // Non tagliare mai le note del docente per far spazio al suggerimento IA.
  if (available < 1) return null;
  return firstWords(suggestion, available).trimEnd() + suffix;
}

export function useAdaptationDescription({
  text, lang, mode, optionsCount, paused,
}: {
  text: string;
  lang: LangCode | null;
  mode: AdaptMode | null;
  optionsCount: OptionCount | null;
  paused: boolean;
}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<DescriptionStatus>("idle");
  const [pending, setPending] = useState("");
  const [attempt, setAttempt] = useState(0);
  const request = trpc.exercises.describeAdaptation.useMutation();
  const requestRef = useRef(request.mutateAsync);
  requestRef.current = request.mutateAsync;
  const valueRef = useRef(value);
  valueRef.current = value;
  const previousSuggestion = useRef("");
  const edited = useRef(false);
  const revision = useRef(0);
  const completedKey = useRef("");
  const currentKey = useMemo(() => JSON.stringify({
    text: text.trim(), lang, mode, optionsCount: mode === "mc" ? optionsCount : null,
  }), [text, lang, mode, optionsCount]);
  const keyRef = useRef(currentKey);
  keyRef.current = currentKey;

  /** Anche la trascrizione vocale usa questa funzione: è un intervento umano. */
  const setManualValue: Dispatch<SetStateAction<string>> = useCallback((action) => {
    edited.current = true;
    revision.current += 1;
    setValue((previous) => {
      const next = typeof action === "function" ? action(previous) : action;
      valueRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    // Scelta multipla: non inviare alcuna richiesta finché il docente non
    // sceglie esplicitamente quante opzioni desidera.
    if (!lang || !mode || (mode === "mc" && optionsCount === null) || !text.trim() || countWords(text) > MAX_EXERCISE_WORDS || paused) {
      if (!paused) setStatus("idle");
      return;
    }
    if (completedKey.current === currentKey) return;
    let cancelled = false;
    setPending("");
    setStatus("waiting");
    const timer = window.setTimeout(() => {
      const snapshotRevision = revision.current;
      const current = valueRef.current.trim();
      // Se il docente ha soltanto aggiunto righe alla proposta precedente,
      // passiamo come note le aggiunte, non tutto il vecchio suggerimento.
      let notes = edited.current ? current : "";
      if (notes && previousSuggestion.current && notes.startsWith(previousSuggestion.current)) {
        notes = notes.slice(previousSuggestion.current.length).trim();
        if (notes.startsWith(NOTES_LABEL)) notes = notes.slice(NOTES_LABEL.length).trim();
      }
      if (countWords(notes) > MAX_EXERCISE_WORDS) { setStatus("idle"); return; }
      setStatus("loading");
      void requestRef.current({
        text: text.trim(), lang, mode,
        // Per il riordino il numero di opzioni non è rilevante, ma lo schema
        // di questa API storica richiede comunque un valore valido.
        optionsCount: mode === "mc" ? optionsCount! : 3,
        ...(notes ? { teacherNotes: notes } : {}),
      }).then((result) => {
        if (cancelled || keyRef.current !== currentKey) return;
        completedKey.current = currentKey;
        const suggestion = result.description.trim();
        if (!suggestion) throw new Error("Spiegazione non disponibile");
        // Se l'utente ha scritto mentre l'IA lavorava, non sovrascrivere mai.
        const merged = revision.current === snapshotRevision ? combine(suggestion, notes) : null;
        if (merged === null) {
          setPending(suggestion);
          setStatus("review");
          return;
        }
        previousSuggestion.current = suggestion;
        edited.current = !!notes;
        valueRef.current = merged;
        setValue(merged);
        setStatus("ready");
      }).catch(() => {
        if (!cancelled && keyRef.current === currentKey) setStatus("error");
      });
    }, 1000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [currentKey, lang, mode, optionsCount, paused, text, attempt]);

  const retry = useCallback(() => {
    completedKey.current = "";
    setAttempt((n) => n + 1);
  }, []);

  const applyPending = useCallback(() => {
    const merged = combine(pending, valueRef.current.trim());
    if (merged === null) return false;
    previousSuggestion.current = pending;
    edited.current = true;
    valueRef.current = merged;
    revision.current += 1;
    setValue(merged);
    setPending("");
    setStatus("ready");
    return true;
  }, [pending]);

  return { value, setValue: setManualValue, status, pending, retry, applyPending };
}

