import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  ArrowRight,
  Home,
  Languages,
  ListChecks,
  Loader2,
  PartyPopper,
  Puzzle,
  Scale,
  Shuffle,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/lib/lang";
import type { LangCode } from "@shared/languages";
import {
  exerciseSchema,
  repairGluedSegments,
  TYPE_META,
  type Exercise,
} from "@shared/exercise";
import { McView } from "@/components/exercise/McView";
import { TfView } from "@/components/exercise/TfView";
import { MatchView } from "@/components/exercise/MatchView";
import { MatchItView } from "@/components/exercise/MatchItView";
import { ReorderView } from "@/components/exercise/ReorderView";
import { TranslationToggle } from "@/components/exercise/TranslationToggle";
import type { ItemAnswer } from "@/components/exercise/common";

/* Riordino e scelta multipla sono le nuove modalità; le altre icone
   restano per visualizzare correttamente gli esercizi vecchi. */
const TYPE_ICONS = {
  mc: ListChecks,
  tf: Scale,
  match: Puzzle,
  matchIt: Languages,
  reorder: Shuffle,
} as const;

export default function ExercisePage() {
  const search = useSearch();
  const id = useMemo(() => new URLSearchParams(search).get("id") ?? "", [search]);
  const [, navigate] = useLocation();
  const { lang, setLang, L } = useLang();

  const { data: row, isLoading, refetch } = trpc.exercises.get.useQuery(
    { id },
    { enabled: !!id }
  );

  const exercise: Exercise | null = useMemo(() => {
    if (!row) return null;
    const parsed = exerciseSchema.safeParse(row.exercise);
    return parsed.success ? parsed.data : null;
  }, [row]);

  /* Lingua dell'esercizio: la riga del database è la fonte di verità (serve
     al PDF, alle viste e al titolo finale), anche se nel frattempo si è
     cambiato il selettore della prima pagina. */
  const rowLang = (row as { lang?: string } | undefined)?.lang;
  const exLang: LangCode =
    rowLang === "fr" || rowLang === "es" || rowLang === "en" ? rowLang : lang;
  useEffect(() => {
    if (exLang !== lang) setLang(exLang);
  }, [exLang, lang, setLang]);

  const [answers, setAnswers] = useState<ItemAnswer[]>([]);
  const [locked, setLocked] = useState(false);
  const [done, setDone] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<"blank" | "answers" | null>(null);
  /* Item effettivamente mostrato: avanza SOLO quando si preme AVANTI.
     Se derivasse da answers.length, appena risolta la frase 1 la vista si
     rimonterebbe sulla frase 2 con locked=true: parole spente, né click né
     drag (il bug «la seconda frase non funziona»). */
  const [displayIdx, setDisplayIdx] = useState(0);

  const saveAnswers = trpc.exercises.saveAnswers.useMutation();

  /* Nuovo esercizio (id diverso): azzera lo stato */
  useEffect(() => {
    setAnswers([]);
    setLocked(false);
    setDone(false);
    setDisplayIdx(0);
  }, [row?.id]);

  const student = useMemo(
    () => ({
      cognome: row?.studentCognome ?? "",
      nome: row?.studentNome ?? "",
      data: row?.studentData ?? "",
      classe: row?.studentClasse ?? "",
    }),
    [row]
  );

  const meta = exercise ? TYPE_META[exercise.type] : null;
  /* Tipologie a coppie (match e matchIt: solo esercizi vecchi): progresso =
     coppie abbinate, senza blocchi intermedi né AVANTI tra una coppia e l'altra. */
  const isPairType = exercise?.type === "match" || exercise?.type === "matchIt";
  const itemTotal = !exercise ? 0 : isPairType ? exercise.pairs.length : exercise.items.length;
  const total = exercise?.type === "mc"
    ? exercise.items.reduce((n, item) => n + (item.steps?.length ?? 1), 0)
    : itemTotal;

  const score = useMemo(
    () => answers.reduce((n, a) => n + (a.steps ? a.steps.filter(s => s.ok && s.attempts === 0).length : Number(a.ok && a.attempts === 0)), 0),
    [answers]
  );

  /* mc/tf/reorder: registra la risposta e lascia l'item a schermo (verde +
     AVANTI). L'item successivo appare solo dopo AVANTI. */
  const onSolved = useCallback(
    (result: ItemAnswer) => {
      setAnswers((a) => [...a, result]);
      setLocked(true);
    },
    []
  );

  /* match: ogni coppia giusta viene solo registrata — lo studente continua
     subito con la coppia successiva, senza blocchi intermedi. */
  const onPairMatched = useCallback((result: ItemAnswer) => {
    setAnswers((a) => [...a, result]);
  }, []);

  const avanti = () => {
    window.dispatchEvent(new Event("ascolto:contenuto-cambiato"));
    if (answers.length >= itemTotal) {
      setDone(true);
    } else {
      setDisplayIdx(answers.length);
      setLocked(false);
    }
  };

  useEffect(() => {
    if (done && itemTotal > 0 && answers.length === itemTotal && id) {
      saveAnswers.mutate({ id, answers: { items: answers, score } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const download = async (withAnswers: boolean) => {
    if (!exercise || !meta) return;
    setPdfBusy(withAnswers ? "answers" : "blank");
    try {
      /* La libreria PDF si carica solo al download, non all'apertura
         dell'esercizio: l'avvio è più leggero sui dispositivi mobili. */
      const { buildWorkoutPdf, downloadBlob } = await import("@/lib/exportWorkout");
      const blob = await buildWorkoutPdf({
        exercise,
        student,
        withAnswers,
        answers,
        lang: exLang,
      });
      const name = `${L.filePrefix}-${exercise.type}${withAnswers ? "-con-risposte" : ""}-${(student.nome || "esercizio").replace(/\s+/g, "-")}.pdf`;
      downloadBlob(blob, name);
      toast.success(withAnswers ? "PDF con le tue risposte scaricato" : "PDF dell'esercizio scaricato");
    } catch (err) {
      console.error(err);
      toast.error("Non sono riuscito a creare il PDF. Riprova.");
    } finally {
      setPdfBusy(null);
    }
  };

  /* -------------------- Stati di caricamento / errore -------------------- */
  if (!id) {
    return (
      <Shell>
        <p className="text-center text-sm text-muted-foreground">
          Nessun esercizio selezionato.{" "}
          <button className="font-bold underline" onClick={() => navigate("/setup")}>
            Torna alla schermata 2
          </button>
        </p>
      </Shell>
    );
  }
  if (isLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="size-9 animate-spin text-[#8B3A1A]" aria-hidden="true" />
          <p className="text-sm font-bold text-muted-foreground">Carico l'esercizio…</p>
        </div>
      </Shell>
    );
  }
  if (!exercise || !meta) {
    return (
      <Shell>
        <p className="text-center text-sm text-muted-foreground">
          Esercizio non trovato o non valido.{" "}
          <button className="font-bold underline" onClick={() => navigate("/setup")}>
            Creane uno nuovo
          </button>
        </p>
      </Shell>
    );
  }

  const Icon = TYPE_ICONS[exercise.type];
  const stepIndex = answers.length;
  const completedQuestions = answers.reduce((n, answer) => n + (answer.steps?.length ?? 1), 0);

  /* -------------------- Schermata finale -------------------- */
  if (done) {
    const stars = Math.max(1, Math.round((score / Math.max(total, 1)) * 5));
    return (
      <Shell>
        <div className="card-paper lf-feedback-card mx-auto mt-2 max-w-xl rounded-[18px] p-[16px] text-center sm:p-6">
          <div className="lf-party-badge mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-[#EEE2D5]">
            <PartyPopper className="size-8 text-[#8B3A1A]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[#8B3A1A]">{L.finishTitle}</h1>

          <div className="my-4 flex max-w-full flex-wrap justify-center gap-[6px]">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={"size-9 " + (s <= stars ? "fill-[#FFB300] text-[#FFB300]" : "text-[#D6CEC4]")}
                aria-hidden="true"
              />
            ))}
          </div>

          <p className="mb-5 text-sm text-[#2E2118]">
            Risposte giuste al primo colpo:{" "}
            <b className="text-[#8B3A1A]">{score}</b> su <b>{total}</b>
          </p>

          <div className="mx-auto flex max-w-sm flex-col gap-3">
            <button
              onClick={() => download(false)}
              disabled={pdfBusy !== null}
              aria-busy={pdfBusy === "blank"}
              className="lf-pdf-action flex min-h-12 max-w-full flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-[14px] py-3 text-center text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 disabled:opacity-50"
            >
              SCARICA L'ESERCIZIO SENZA RISPOSTE
            </button>
            <button
              onClick={() => download(true)}
              disabled={pdfBusy !== null}
              aria-busy={pdfBusy === "answers"}
              className="lf-pdf-action flex min-h-12 max-w-full flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-[14px] py-3 text-center text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 disabled:opacity-50"
            >
              SCARICA L'ESERCIZIO CON RISPOSTE
            </button>
            <p role="status" aria-live="polite" className="sr-only">{pdfBusy ? "Creazione del PDF in corso." : ""}</p>
          </div>
        </div>

        <button
          onClick={() =>
            navigate(
              `/setup?cognome=${encodeURIComponent(student.cognome)}&nome=${encodeURIComponent(student.nome)}&data=${encodeURIComponent(student.data)}&classe=${encodeURIComponent(student.classe)}`
            )
          }
          className="lf-new-exercise mx-auto mt-4 flex min-h-11 items-center justify-center gap-2 bg-transparent px-3 py-2 text-sm font-bold text-[#8B3A1A] underline underline-offset-4 hover:opacity-85"
        >
          <Home className="size-4" aria-hidden="true" /> Crea un nuovo esercizio
        </button>
      </Shell>
    );
  }

  /* -------------------- Esercizio attivo -------------------- */
  const idx = Math.min(displayIdx, itemTotal - 1);

  return (
    <div className="lf-flow-page paper-grain mx-auto w-full max-w-2xl px-[16px] pb-16 pt-4">
      <h1 className="mb-3 text-center text-lg font-bold text-[#8B3A1A]">{meta.it}</h1>
      {/* Banner studente + progresso nello stile .clone-student-header del Widget equazioni */}
      <div className="card-paper lf-student-header mb-4 flex flex-wrap items-center gap-3 rounded-[14px] p-3.5">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-[12px]"
          style={{ backgroundColor: meta.soft, color: meta.dark }}
        >
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#66564C]" aria-live="polite">
            <strong className="font-bold text-[#2E2118]">{student.nome} {student.cognome}</strong>
            {student.classe ? ` · ${student.classe}` : ""} ·{" "}
            {isPairType
              ? `Coppie abbinate: ${stepIndex} di ${total}`
              : `Esercizio ${Math.min(idx + 1, itemTotal)} di ${itemTotal}`}
          </p>
          <div className="mt-2 flex gap-1.5">
            {Array.from({ length: total }, (_, i) => {
              const doneDot = i < completedQuestions;
              const currentDot = !isPairType && i === completedQuestions;
              return (
                <span
                  key={i}
                  data-dot-state={doneDot ? "done" : currentDot ? "current" : "todo"}
                  className="h-2.5 flex-1 rounded-full"
                  style={{
                    backgroundColor: doneDot ? meta.color : currentDot ? meta.soft : "#E8DDD1",
                    border: currentDot ? `2px solid ${meta.color}` : undefined,
                  }}
                  aria-hidden="true"
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Item corrente nello stile .clone-step-card del Widget equazioni */}
      <div className="card-paper lf-step-card rounded-[14px] p-[16px] sm:p-5">
        {exercise.type === "mc" && (
          <McView
            key={idx}
            item={exercise.items[idx]}
            locked={locked}
            onSolved={onSolved}
          />
        )}
        {exercise.type === "tf" && (
          <TfView key={idx} item={exercise.items[idx]} locked={locked} onSolved={onSolved} />
        )}
        {exercise.type === "match" && (
          <MatchView
            pairs={exercise.pairs}
            locked={locked}
            onPair={onPairMatched}
            onAllDone={() => setLocked(true)}
          />
        )}
        {exercise.type === "matchIt" && (
          <MatchItView
            pairs={exercise.pairs}
            locked={locked}
            onPair={onPairMatched}
            onAllDone={() => setLocked(true)}
          />
        )}
        {exercise.type === "reorder" && (
          <ReorderView key={idx} item={exercise.items[idx]} locked={locked} onSolved={onSolved}
            translationControl={<TranslationToggle key={`reorder-${idx}`} translation={exercise.items[idx].translationIt} source={exercise.items[idx].answer} lang={exLang} />} />
        )}

        {locked && (
          <button
            onClick={avanti}
            className="mx-auto mt-5 flex max-w-full flex-wrap items-center gap-[8px] rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-[18px] py-3.5 text-lg font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95"
          >
            {answers.length >= itemTotal ? "FINISCO" : "AVANTI"}
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="lf-flow-page paper-grain mx-auto w-full max-w-2xl px-[16px] py-10">{children}</div>;
}
