import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CropDialog } from "@/components/CropDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdaptationControls, type AdaptMode, type OptionCount } from "@/components/AdaptationControls";
import { photoAsDataUrl } from "@/lib/photoRead";
import { normalizePhoto } from "@/lib/imagePrep";
import { cleanOcrText } from "@/lib/ocrClean";
import { useLang } from "@/lib/lang";
import { useAdaptationDescription } from "@/hooks/useAdaptationDescription";
import { useCropDialogViewport } from "@/hooks/useCropDialogViewport";
import { LANG_LABELS, type LangCode } from "@shared/languages";
import { countWords, permitsTextEdit, MAX_EXERCISE_WORDS, MAX_INPUT_CHARACTERS } from "@shared/textLimits";

const MAX_PHOTOS = 5;
const isPhotoFile = (file: File) => file.type.startsWith("image/") || /\.(?:jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name);

const LANGUAGE_ORDER: LangCode[] = ["en", "es", "fr"];
const FLAG_FILES: Record<LangCode, string> = { en: "ie", es: "es", fr: "fr" };

export default function SetupPage() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const student = useMemo(
    () => ({
      cognome: params.get("cognome") ?? "",
      nome: params.get("nome") ?? "",
      data: params.get("data") ?? "",
      classe: params.get("classe") ?? "",
    }),
    [params]
  );
  const [, navigate] = useLocation();
  const { lang, setLang, L } = useLang();

  /* I vecchi link con ?lang= continuano a funzionare. I nuovi accessi dalla
     prima pagina richiedono invece una scelta esplicita qui. */
  const [selectedLang, setSelectedLang] = useState<LangCode | null>(() => {
    const q = params.get("lang");
    return q === "en" || q === "fr" || q === "es" ? q : null;
  });
  useEffect(() => {
    if (selectedLang && selectedLang !== lang) setLang(selectedLang);
  }, [selectedLang, lang, setLang]);

  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "generating">("idle");
  const [limitedExerciseId, setLimitedExerciseId] = useState<string | null>(null);
  // Riusa la misura già collaudata del viewport visibile nell'iframe del blog:
  // un modale centrato sull'intera cornice alta potrebbe essere fuori schermo.
  const limitDialogViewport = useCropDialogViewport(limitedExerciseId !== null);
  const [mode, setMode] = useState<AdaptMode | null>(null);
  // Nessuna opzione è preselezionata: nel caso MC il docente deve indicarla.
  const [optionsCount, setOptionsCount] = useState<OptionCount | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  // Prenota i posti prima di avviare la coda: vale anche per foto incollate,
  // scattate una alla volta o scelte in più caricamenti successivi.
  const [photoCount, setPhotoCount] = useState(0);
  const photoCountRef = useRef(0);
  const activePhotoRef = useRef(false);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const generate = trpc.exercises.generate.useMutation({
    onSuccess: (data) => {
      // L'esercizio è già stato creato: informare prima di aprirlo, senza
      // chiedere conferma preventiva e senza modificare il testo originale.
      if (data.wasTruncated) setLimitedExerciseId(data.id);
      else navigate(`/exercise?id=${data.id}`);
    },
    onError: (err) => {
      setPhase("idle");
      toast.error("Non sono riuscito a creare l'esercizio. " + (err.message || ""), {
        duration: 7000,
      });
    },
  });
  const readPhoto = trpc.exercises.readPhoto.useMutation();

  /* Foto in ordine: ogni immagine viene ritagliata e letta prima della
     successiva, senza sovrascrivere il testo già scritto o riconosciuto. */
  const addSource = (addition: string) => {
    setText((previous) => {
      const combined = [previous.trim(), addition.trim()].filter(Boolean).join("\n");
      // Il testo letto da foto/PDF non viene tagliato: se supera il limite,
      // resta visibile finché il docente lo riduce prima della generazione.
      if (countWords(combined) > MAX_EXERCISE_WORDS) queueMicrotask(() => toast.warning(`Il testo acquisito supera ${MAX_EXERCISE_WORDS} parole: riducilo prima di creare l'esercizio.`));
      if (combined.length > MAX_INPUT_CHARACTERS) queueMicrotask(() => toast.warning("Il testo acquisito è troppo lungo: riducilo prima di continuare."));
      return combined;
    });
  };
  const releaseActivePhoto = () => {
    if (!activePhotoRef.current) return;
    activePhotoRef.current = false;
    photoCountRef.current = Math.max(0, photoCountRef.current - 1);
    setPhotoCount(photoCountRef.current);
  };
  const clearSource = () => {
    setText("");
    photoCountRef.current = 0;
    setPhotoCount(0);
  };
  const enqueueFiles = (files: File[]) => {
    if (!files.length) return;
    if (!selectedLang) { toast.error("Scegli prima la lingua dell'esercizio."); return; }
    const accepted: File[] = [];
    let rejectedPhotos = 0;
    for (const file of files) {
      if (isPhotoFile(file)) {
        if (photoCountRef.current >= MAX_PHOTOS) { rejectedPhotos++; continue; }
        photoCountRef.current += 1;
      }
      accepted.push(file);
    }
    setPhotoCount(photoCountRef.current);
    if (rejectedPhotos) toast.warning(`Puoi aggiungere fino a ${MAX_PHOTOS} foto per esercizio. Le foto in più non sono state aggiunte.`);
    if (accepted.length) setFileQueue((previous) => [...previous, ...accepted]);
  };
  const runOcr = async (file: File | Blob) => {
    setOcrBusy(true);
    setOcrProgress(0);
    try {
      let result = "";
      try {
        const image = await photoAsDataUrl(file);
        result = (await readPhoto.mutateAsync({ image, lang: selectedLang ?? lang })).text.trim();
        if (!result) throw new Error("foto non leggibile");
        toast.success("Foto letta con l'IA: controlla il testo e le figure riconosciute.");
      } catch {
        /* L'OCR locale è un'alternativa trasparente, non riconosce le figure. */
        const { ocrImage } = await import("@/lib/ocr");
        result = cleanOcrText(await ocrImage(file, setOcrProgress, L.tessLang));
        if (!result) throw new Error("nessun testo riconosciuto");
        toast.warning("Lettura IA non disponibile: ho usato il riconoscimento locale. Controlla il testo e descrivi eventuali immagini.");
      }
      addSource(result);
      activePhotoRef.current = false; // Foto letta: il posto rimane occupato.
    } catch {
      releaseActivePhoto();
      toast.error("Non riesco a leggere la foto. Riprova con un'immagine più nitida oppure scrivi il testo.");
    } finally {
      setOcrBusy(false);
      setOcrProgress(0);
    }
  };

  const handlePickedFile = (f: File) => {
    activePhotoRef.current = isPhotoFile(f);
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (f.type.startsWith("text/") || ext === "txt" || ext === "md" || f.type === "application/pdf" || ext === "pdf") {
      setOcrBusy(true);
      void (async () => {
        try {
          const content = f.type === "application/pdf" || ext === "pdf"
            ? cleanOcrText(await (await import("@/lib/ocr")).ocrPdf(f, setOcrProgress, L.tessLang))
            : (await f.text()).trim();
          if (!content) throw new Error("documento vuoto");
          addSource(content);
          toast.success("Testo aggiunto: controllalo prima di creare l'esercizio.");
        } catch { toast.error("Non sono riuscito a leggere questo file. Riprova o scrivi il testo."); }
        finally { setOcrBusy(false); setOcrProgress(0); }
      })();
      return;
    }
    if (!isPhotoFile(f)) {
      toast.error("Formato non supportato: usa una foto, un PDF o un file di testo.");
      return;
    }
    // Stessa preparazione della sorgente: orientamento EXIF e PNG lossless
    // prima di aprire il ritaglio. La coda attende fino alla fine del lavoro.
    setOcrBusy(true);
    void (async () => {
      try {
        if (f.size > 18 * 1024 * 1024) {
          releaseActivePhoto();
          toast.error("La foto supera 18 MB: scegli una versione più leggera.");
          return;
        }
        const straight = await normalizePhoto(f);
        setCropUrl(URL.createObjectURL(straight));
      } catch {
        // Come nel Widget sorgente: se la normalizzazione non è supportata,
        // apri comunque la foto originale e lascia disponibile la rotazione.
        setCropUrl(URL.createObjectURL(f));
        toast.warning("Non ho potuto orientare automaticamente la foto: puoi ruotarla nel ritaglio.");
      } finally {
        setOcrBusy(false);
      }
    })();
  };

  useEffect(() => {
    if (!fileQueue.length || cropUrl || ocrBusy || phase !== "idle") return;
    const next = fileQueue[0];
    setFileQueue((previous) => previous.slice(1));
    handlePickedFile(next);
  // La coda prosegue solo dopo ritaglio e lettura della foto precedente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileQueue, cropUrl, ocrBusy, phase]);

  const onCropConfirm = (croppedFile: File) => {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(null);
    void runOcr(croppedFile);
  };

  const closeCrop = () => {
    if (cropUrl) URL.revokeObjectURL(cropUrl);
    setCropUrl(null);
    releaseActivePhoto();
  };

  /* ---------------- Drag & drop sulla card testo ---------------- */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = Array.from(e.dataTransfer.files ?? []);
    if (items.length > 0) {
      enqueueFiles(items);
      return;
    }
    const dropped = e.dataTransfer.getData("text/plain");
    if (dropped.trim()) {
      addSource(dropped);
    }
  };

  /* ---------------- Incolla immagine con Ctrl+V ---------------- */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            enqueueFiles([file]);
          }
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selectedLang]);

  const sourceWordCount = countWords(text);
  const hasSource = text.trim().length > 0;
  const textOk = hasSource && sourceWordCount <= MAX_EXERCISE_WORDS && text.length <= MAX_INPUT_CHARACTERS;
  const busy = phase !== "idle" || ocrBusy || !!cropUrl || fileQueue.length > 0;
  const explanation = useAdaptationDescription({
    text, lang: selectedLang, mode, optionsCount, paused: busy || voiceBusy,
  });
  const explanationPending = explanation.status === "waiting" || explanation.status === "loading";
  const explanationWithinLimit = countWords(explanation.value) <= MAX_EXERCISE_WORDS && explanation.value.length <= MAX_INPUT_CHARACTERS;

  /* La spiegazione è obbligatoria: viene proposta dall'IA, ma l'insegnante
     può correggerla o scriverla lui se il servizio non è disponibile. */
  const onCreate = () => {
    if (!textOk) {
      toast.error(hasSource ? `Riduci il testo a un massimo di ${MAX_EXERCISE_WORDS} parole.` : "Scrivi o acquisisci il testo dell'esercizio.");
      return;
    }
    if (!selectedLang || !mode) {
      toast.error("Scegli la lingua e il tipo di esercizio.");
      return;
    }
    if (mode === "mc" && optionsCount === null) {
      toast.error("Scegli 2, 3 o 4 opzioni di risposta.");
      return;
    }
    if (!explanation.value.trim() || countWords(explanation.value) > MAX_EXERCISE_WORDS || explanation.value.length > MAX_INPUT_CHARACTERS) {
      toast.error(`Controlla la spiegazione: può contenere fino a ${MAX_EXERCISE_WORDS} parole.`);
      return;
    }
    if (phase !== "idle" || ocrBusy || cropUrl || fileQueue.length || voiceBusy || explanationPending) return;
    setPhase("generating");
    generate.mutate({
      ...student,
      text: text.trim(),
      type: mode,
      // Per il riordino il campo è ignorato dal server; conserviamo il
      // valore storico soltanto per compatibilità con lo schema API.
      optionsCount: mode === "mc" ? optionsCount! : 3,
      adaptation: explanation.value.trim(),
      lang: selectedLang,
    });
  };

  return (
    <div className="lf-flow-page paper-grain mx-auto w-full max-w-3xl px-[16px] pb-14 pt-4">
      <section className="card-paper mb-5 p-[16px] sm:p-5" aria-labelledby="language-title">
        <h1 id="language-title" className="text-center text-lg font-bold text-[#8B3A1A]">SCEGLI LA LINGUA</h1>
        <fieldset disabled={busy || voiceBusy} className="mt-4 min-w-0">
          <legend className="sr-only">Lingua dell'esercizio</legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {LANGUAGE_ORDER.map((code) => (
              <label
                key={code}
                className={`lf-radio-card flex min-h-14 max-w-full cursor-pointer flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 px-[12px] py-3 text-center font-bold transition-colors focus-within:outline focus-within:outline-3 focus-within:outline-[#B71C1C] ${
                  selectedLang === code
                    ? "lf-radio-card-selected border-[#8B3A1A] bg-[#F2E7DE] text-[#8B3A1A]"
                    : "border-[#D8CABC] bg-[#FFFFFF] text-[#2E2118] hover:border-[#8B3A1A]/60"
                }`}
              >
                <input type="radio" name="exercise-language" value={code} checked={selectedLang === code} onChange={() => { setSelectedLang(code); setLang(code); }} className="lf-choice-radio" />
                <img src={`/flags/${FLAG_FILES[code]}.svg`} width="32" height="24" className="h-6 w-8 shrink-0 rounded-sm object-cover" alt="" aria-hidden="true" />
                <span>{LANG_LABELS[code].nome}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* Il testo compare soltanto dopo la scelta della lingua. */}
      {selectedLang && <div
        className={
          "card-paper relative mb-5 p-[16px] transition-colors sm:p-5 " +
          (dragOver ? "border-[#8B3A1A] bg-[#F8F1E4]" : "")
        }
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="mb-3 text-center">
          <h2 className="text-lg font-bold text-[#8B3A1A]">IL TESTO DELL'ESERCIZIO</h2>
        </div>

        <div className="lf-equal-actions mb-3 flex flex-col items-center gap-2.5">
          <label className="flex min-h-12 max-w-full cursor-pointer flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-[12px] py-2.5 text-xs font-bold uppercase text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 focus-within:outline focus-within:outline-3 focus-within:outline-[#B71C1C]">
            <Camera className="size-4" aria-hidden="true" /> <span>Scatta una foto</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy || voiceBusy || !selectedLang}
              className="sr-only"
              onChange={(e) => {
                enqueueFiles(Array.from(e.target.files ?? []));
                e.currentTarget.value = "";
              }}
            />
          </label>
          <label className="flex min-h-12 max-w-full cursor-pointer flex-wrap items-center justify-center gap-[8px] rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-[12px] py-2.5 text-xs font-bold uppercase text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 focus-within:outline focus-within:outline-3 focus-within:outline-[#B71C1C]">
            <ImageIcon className="size-4" aria-hidden="true" /> <span>Carica foto o PDF</span>
            <input
              type="file"
              accept="image/*,application/pdf,.txt,.md"
              multiple
              disabled={busy || voiceBusy || !selectedLang}
              className="sr-only"
              onChange={(e) => {
                enqueueFiles(Array.from(e.target.files ?? []));
                e.currentTarget.value = "";
              }}
            />
          </label>
          {(text.length > 0 || photoCount > 0) && (
            <button
              type="button"
              disabled={busy || voiceBusy}
              onClick={clearSource}
              className="flex min-h-12 items-center gap-1.5 rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-3 py-2.5 text-xs font-bold uppercase text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95"
            >
              <Trash2 className="size-4" aria-hidden="true" /> <span>Svuota</span>
            </button>
          )}
        </div>

        <p className="mb-2 text-center text-xs leading-relaxed text-[#66564C]">Puoi aggiungere da 1 a {MAX_PHOTOS} foto</p>
        {photoCount > 0 && <p className="mb-2 text-center text-xs text-[#66564C]" aria-live="polite">Foto selezionate: {photoCount}/{MAX_PHOTOS}</p>}
        {fileQueue.length > 0 && <p className="mb-2 text-center text-xs font-bold text-[#8B3A1A]" aria-live="polite">File ancora da leggere: {fileQueue.length}</p>}
        <textarea
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            if (permitsTextEdit(text, next)) setText(next);
            else toast.warning(`Puoi inserire al massimo ${MAX_EXERCISE_WORDS} parole.`);
          }}
          disabled={busy || voiceBusy}
          aria-describedby="exercise-word-count"
          aria-invalid={sourceWordCount > MAX_EXERCISE_WORDS || text.length > MAX_INPUT_CHARACTERS}
          rows={8}
          placeholder="Incolla o scrivi qui l'esercizio originale, oppure aggiungi una o più foto."
          aria-label="Testo dell'esercizio originale"
          data-tts-value-lang={selectedLang}
          className="w-full resize-y rounded-[10px] border-2 border-[#CABEB2] bg-white p-3 text-base leading-relaxed text-[#2E2118] outline-none placeholder:text-[#66564C] focus:border-[#8B3A1A]"
        />
        <p id="exercise-word-count" className="mt-1.5 text-center text-xs font-bold text-[#66564C]" aria-live="polite">
          {sourceWordCount}/{MAX_EXERCISE_WORDS} parole
        </p>
        {(sourceWordCount > MAX_EXERCISE_WORDS || text.length > MAX_INPUT_CHARACTERS) && <p role="alert" className="mt-1 text-center text-xs font-bold text-[#B71C1C]">Il testo acquisito è troppo lungo: riducilo prima di creare l'esercizio.</p>}

        {/* Sempre sotto il testo che si sta leggendo, anche dalla seconda foto:
            non deve comparire sotto CREA L'ESERCIZIO. */}
        {ocrBusy && (
          <div role="status" aria-live="polite" className="lf-progress-card mt-3 flex flex-col gap-2 px-5 py-4">
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-[#8B3A1A]">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Sto leggendo il file…
            </p>
            <div className="lf-progress-track" aria-hidden="true">
              {ocrProgress > 0 ? (
                <div className="lf-progress-fill" style={{ width: `${Math.round(ocrProgress * 100)}%` }} />
              ) : (
                <div className="lf-progress-indeterminate" />
              )}
            </div>
          </div>
        )}

        {hasSource && <><AdaptationControls mode={mode} setMode={setMode} count={optionsCount} setCount={setOptionsCount}
          instructions={explanation.value} setInstructions={explanation.setValue} descriptionStatus={explanation.status}
          onRetry={explanation.retry} onApplyPending={explanation.applyPending} disabled={busy} onVoiceBusy={setVoiceBusy} />

        {/* Generazione in un unico passaggio IA, con respiro sopra e sotto. */}
        <div className="lf-create-action mt-7 mb-5 text-center">
          <button
            onClick={onCreate}
            disabled={!textOk || !selectedLang || !mode || (mode === "mc" && optionsCount === null) || !explanation.value.trim() || !explanationWithinLimit || busy || voiceBusy || explanationPending}
            className="inline-flex min-h-12 max-w-full flex-wrap items-center gap-[8px] rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-[20px] py-3.5 text-sm font-bold tracking-wide text-white shadow-[0_2px_6px_rgba(43,36,33,0.14)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {phase === "idle" ? (
              <>
                <Sparkles className="size-5" aria-hidden="true" /> CREA L'ESERCIZIO
              </>
            ) : (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                CREO L'ESERCIZIO…
              </>
            )}
          </button>
        </div></>}

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[16px] border-4 border-dashed border-[#8B3A1A] bg-[#F8F1E4]/85">
            <p className="flex items-center gap-2 text-sm font-bold text-[#8B3A1A]">
              <Upload className="size-5" aria-hidden="true" /> Rilascia qui il file
            </p>
          </div>
        )}
      </div>}

      <CropDialog open={!!cropUrl} imageUrl={cropUrl} onConfirm={onCropConfirm} onClose={closeCrop} />
      <AlertDialog open={limitedExerciseId !== null}>
        <AlertDialogContent
          className="lf-alert-dialog z-[80] flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-3 overflow-hidden rounded-[16px] border-2 border-[#8B3A1A] bg-[#FAF8F5] px-4 py-4 text-[#2E2118]"
          style={{
            top: limitDialogViewport ? limitDialogViewport.top + limitDialogViewport.height / 2 : undefined,
            maxHeight: limitDialogViewport ? Math.max(1, limitDialogViewport.height - 16) : undefined,
            visibility: limitDialogViewport ? "visible" : "hidden",
          }}
        >
          <AlertDialogHeader
            className="min-h-0 min-w-0 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#B71C1C]"
            role="region" aria-label="Testo completo dell'avviso" tabIndex={0}
          >
            <AlertDialogTitle className="min-w-0 text-center font-bold text-[#8B3A1A] [overflow-wrap:anywhere]">AVVISO</AlertDialogTitle>
            <AlertDialogDescription className="min-w-0 text-center text-[#2E2118] [hyphens:auto] [overflow-wrap:anywhere]" style={{ lineHeight: "var(--lf-lh, 1.65)" }}>
              L'esercizio contiene più di 10 frasi o domande. Sono state adattate solo le prime 10: le successive non sono incluse nella scheda. Puoi creare un altro esercizio con quelle rimanenti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="shrink-0 sm:justify-center">
            <AlertDialogAction
              type="button"
              className="min-h-11 rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-6 py-3 font-bold text-white hover:brightness-95"
              onClick={() => { if (limitedExerciseId) navigate(`/exercise?id=${encodeURIComponent(limitedExerciseId)}`); }}
            >
              CONTINUA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
