import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Eraser } from "lucide-react";
import { REORDER_CHIP_PALETTE, type ReorderItem } from "@shared/exercise";
import { FeedbackBanner } from "./common";
import type { ItemAnswer } from "./common";
import { GHOST_STYLE, insertionIndexAt, usePointerDrop } from "./usePointerDrop";
import { useLang } from "@/lib/lang";

/* Lo stesso aspetto per ogni parola, indipendentemente dal ruolo grammaticale.
   La palette è condivisa con il PDF; lo stile dei gesti resta invariato. */
const REORDER_CHIP_STYLE = {
  backgroundColor: REORDER_CHIP_PALETTE.bg,
  borderColor: REORDER_CHIP_PALETTE.border,
  color: REORDER_CHIP_PALETTE.text,
} as const;

function shuffleIndices(n: number, avoid: string[], texts: string[]): number[] {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase().replace(/\.$/, "");
  const target = norm(avoid.join(" "));
  for (let t = 0; t < 12; t++) {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (n < 2 || norm(idx.map((i) => texts[i]).join(" ")) !== target) return idx;
  }
  return Array.from({ length: n }, (_, i) => i);
}

function sameSentence(a: string, b: string): boolean {
  /* La punteggiatura è attaccata alle tessere: se un complemento finale
     cambia posizione, il punto può trovarsi a metà. Confronta le parole,
     non la posizione dei segni, così l'ordine alternativo resta possibile. */
  const norm = (s: string) =>
    s.replace(/[.,;:!?¿¡]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return norm(a) === norm(b);
}

/**
 * Riordino delle parole: tutte le tessere hanno lo stesso colore. Si
 * TRASCINANO dal banco all'area risposta (mouse e dito, con
 * ghost che segue il puntatore) oppure si toccano per piazzarle, poi il
 * pulsante di verifica nella lingua scelta (CHECK / VÉRIFIE / COMPRUEBA).
 */
export function ReorderView({
  item,
  locked,
  onSolved,
  translationControl,
}: {
  item: ReorderItem;
  locked: boolean;
  onSolved: (result: ItemAnswer) => void;
  translationControl?: ReactNode;
}) {
  const { L, lang } = useLang();
  const texts = useMemo(() => item.chips.map((c) => c.t), [item]);
  const bank0 = useMemo(
    () => shuffleIndices(item.chips.length, item.chips.map((c) => c.t), texts),
    [item, texts]
  );
  const [bank, setBank] = useState<number[]>(bank0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [status, setStatus] = useState<"ok" | "ko" | null>(null);

  const place = (idx: number) => {
    if (solved || locked) return;
    /* guardie: anche un doppio click veloce non deve duplicare la chip */
    setBank((b) => (b.includes(idx) ? b.filter((i) => i !== idx) : b));
    setPlaced((p) => (p.includes(idx) ? p : [...p, idx]));
  };
  /* Posizione di inserimento: si sceglie la RIGA più vicina al dito (la
     frase può andare a capo) e al suo interno la chip va PRIMA della prima
     tessera il cui centro sta alla sua destra, altrimenti in fondo a quella
     riga. Le tessere ignorano la chip stessa mentre viene trascinata
     (data-dragging) per non «riprendersi» da sola. */
  const insertionAt = (x: number, y: number): number => {
    const chips = Array.from(
      document.querySelectorAll<HTMLElement>("[data-pos]:not([data-dragging])")
    );
    return insertionIndexAt(x, y, chips);
  };
  const remove = (pos: number) => {
    if (solved || locked) return;
    setPlaced((p) => {
      const idx = p[pos];
      if (idx === undefined || !p.includes(idx)) return p;
      setBank((b) => (b.includes(idx) ? b : [...b, idx]));
      return p.filter((_, i) => i !== pos);
    });
  };
  /* Trascinamento dal BANCO (mouse, penna e dito): al rilascio la chip si
     inserisce nella posizione esatta tra le tessere già piazzate; il tocco
     fermo resta un clic e piazza in coda come prima. */
  const { chipProps, ghost, over, consumeClick } = usePointerDrop(
    '[data-drop="reorder-area"],[data-pos]',
    (idx, _target, x, y) => {
      if (solved || locked) return;
      /* Piazziamo solo se il dito è davvero dentro (o appena ai bordi del)
         riquadro risposta: così un rilascio sul banco — o un piccolo
         «frullino» della parola sul banco — non deve piazzare la parola in
         una posizione sbagliata della frase (spesso in fondo). */
      const areaEl = document.querySelector('[data-drop="reorder-area"]');
      if (!areaEl) return;
      const ar = areaEl.getBoundingClientRect();
      if (y < ar.top - 24 || y > ar.bottom + 24) return;
      setBank((b) => (b.includes(idx) ? b.filter((i) => i !== idx) : b));
      setPlaced((p) => {
        if (p.includes(idx)) return p;
        const next = [...p];
        next.splice(insertionAt(x, y), 0, idx);
        return next;
      });
    }
  );

  /* Mantieni fermi i nodi mentre il dito si muove: riordinare il DOM a ogni
     pointermove può far saltare le righe, perdere la cattura del dito e far
     ricalcolare continuamente l'altezza della cornice mobile. Il fantasma
     segue il dito; al rilascio inseriamo la tessera nella riga desiderata. */
  const movePlacedAt = (idx: number, x: number, y: number) => {
    const chips = Array.from(
      document.querySelectorAll<HTMLElement>('[data-drop="reorder-area"] [data-pos]')
    ).filter((chip) => chip.dataset.chipId !== String(idx));
    const at = insertionIndexAt(x, y, chips);
    setPlaced((p) => {
      const from = p.indexOf(idx);
      if (from === -1) return p;
      const others = p.filter((_, i) => i !== from);
      const next = [...others.slice(0, at), idx, ...others.slice(at)];
      return next.every((v, i) => v === p[i]) ? p : next;
    });
  };
  const {
    chipProps: placedProps,
    ghost: placedGhost,
    over: placedOver,
    consumeClick: consumePlacedClick,
  } = usePointerDrop(
    '[data-pos],[data-drop="reorder-area"],[data-drop="reorder-bank"]',
    (idx, target, x, y) => {
      if (solved || locked) return;
      const pos = placed.indexOf(idx);
      if (pos === -1) return;
      if (target.getAttribute("data-pos") === null) {
        const bankEl = target.closest('[data-drop="reorder-bank"]');
        if (bankEl) {
          const r = bankEl.getBoundingClientRect();
          /* Il ritorno al banco vale solo se il dito è DAVVERO dentro il
             banco: rilasciare nel vuoto tra riquadro e banco non deve
             «mandare la parola via» per sbaglio. */
          if (y >= r.top && y <= r.bottom) {
            remove(pos);
            return;
          }
        }
      }
      movePlacedAt(idx, x, y);
    }
  );
  const areaHot =
    !solved &&
    !locked &&
    (!!over || (!!placedOver && !!placedOver.closest('[data-drop="reorder-area"]')));

  const check = () => {
    if (placed.length !== item.chips.length || solved || locked) return;
    const sentence = placed.map((i) => texts[i]).join(" ");
    /* Va bene la frase ORIGINALE del testo, ma anche gli ORDINI ALTERNATIVI
       grammaticalmente corretti registrati in alsoCorrect (es. il soggetto
       spostato prima o dopo il verbo in spagnolo): sono la stessa frase. */
    const matched = [item.answer, ...(item.alsoCorrect ?? [])].find((candidate) => sameSentence(sentence, candidate));
    if (matched) {
      setSolved(true);
      setStatus("ok");
      /* Conserva l'ordine scelto dallo studente con la punteggiatura della
         frase riconosciuta, per riportarlo fedelmente nel PDF. */
      onSolved({ ok: true, attempts, value: matched });
    } else {
      setAttempts((a) => a + 1);
      setStatus("ko");
    }
  };

  const complete = placed.length === item.chips.length;

  return (
    <div>
      <p className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-[#8B3A1A]">
        Riordina le parole e verifica la frase.
      </p>
      {translationControl}

      {/* Area risposta */}
      <div
        data-drop="reorder-area"
        className={
          "min-h-[64px] rounded-[14px] border-[2px] border-dashed p-3 transition-all " +
          (areaHot
            ? "border-[#8B3A1A] bg-[#F2E7DE] ring-4 ring-[#8B3A1A]/25"
            : "border-[#8B3A1A] bg-[#FAF8F5]")
        }
        aria-label="Area dove comporre la frase"
      >
        {placed.length === 0 ? (
          <p className="py-2 text-center text-sm text-[#66564C]">
            Le parole vanno qui, nell'ordine giusto…
          </p>
        ) : (
          <div className={status === "ko" ? "shake flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
            {placed.map((idx, pos) => {
              const dragging = placedGhost?.idx === idx;
              const pointer = placedProps(idx, !solved && !locked);
              return (
                <button
                  /* La chiave identifica sempre la stessa parola, anche
                     dopo l'inserimento finale in una posizione diversa. */
                  key={idx}
                  data-pos={pos}
                  data-chip-id={idx}
                  data-dragging={dragging || undefined}
                  aria-label={`Parola ${texts[idx]}, posizione ${pos + 1}`}
                  lang={lang}
                  data-tts-label={texts[idx]}
                  onClick={() => {
                    if (consumePlacedClick()) return; /* era un trascinamento */
                    remove(pos);
                  }}
                  disabled={solved || locked}
                  {...pointer}
                  style={{ ...pointer.style, ...REORDER_CHIP_STYLE }}
                  className={"chip-word lf-reorder-chip" + (dragging ? " opacity-30" : "") + (placedOver?.getAttribute("data-chip-id") === String(idx) && !dragging ? " ring-2 ring-[#8B3A1A]" : "")}
                  title="Trascinala liberamente a destra o sinistra · tocca per rimetterla nel banco"
                >
                  {texts[idx]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pulsante di verifica (CHECK / VÉRIFIE / COMPRUEBA) */}
      {!solved && <div className="mt-3 flex flex-wrap justify-center gap-3">
        <button
          onClick={check}
          disabled={!complete || solved || locked}
          className="flex max-w-full flex-wrap items-center gap-2 rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-4 py-3 text-lg font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 sm:px-8"
        >
          <Check className="size-6 shrink-0" aria-hidden="true" /> <span className="whitespace-nowrap">{L.checkBtn}</span>
        </button>
        {placed.length > 0 && !solved && (
          <button
            onClick={() => {
              setBank((b) => [...b, ...placed]);
              setPlaced([]);
              setStatus(null);
            }}
            className="flex max-w-full flex-wrap items-center gap-2 rounded-[12px] border-2 border-[#8B3A1A] bg-[#8B3A1A] px-4 py-3 text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:brightness-95"
          >
            <Eraser className="size-4 shrink-0" aria-hidden="true" /> <span className="whitespace-nowrap">Svuota</span>
          </button>
        )}
      </div>}

      {/* Dopo la risposta corretta, lascia in vista solo la frase e AVANTI. */}
      {!solved && <div data-drop="reorder-bank" className="lf-reorder-bank mt-4 rounded-[14px] border border-[#E5E0D8] bg-[#F8F1E4] p-3">
        <div className="flex flex-wrap justify-center gap-2.5">
          {bank.map((idx) => {
            const pointer = chipProps(idx, !solved && !locked);
            return <span
              key={idx}
              role="button"
              tabIndex={0}
              aria-label={`Parola ${texts[idx]}`}
              lang={lang}
              data-tts-label={texts[idx]}
              {...pointer}
              style={{ ...pointer.style, ...REORDER_CHIP_STYLE }}
              onClick={() => {
                if (consumeClick()) return;
                place(idx);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  place(idx);
                }
              }}
              className="chip-word lf-reorder-chip select-none"
            >
              {texts[idx]}
            </span>;
          })}
          {bank.length === 0 && (
            <span className="py-1 text-sm text-muted-foreground">Tutte le parole sono state piazzate</span>
          )}
        </div>
      </div>}

      {status === "ko" && <FeedbackBanner state="ko" />}
      {solved && <FeedbackBanner state="ok" />}

      {/* Il chip "fantasma" segue il dito/cursore durante il trascinamento
          (dal banco e dalle tessere già piazzate) */}
      {(ghost ?? placedGhost) &&
        createPortal(
          (() => {
            const g = ghost ?? placedGhost!;
            return (
              <div
                style={{ ...GHOST_STYLE, ...REORDER_CHIP_STYLE, left: g.x, top: g.y }}
                className="chip-word lf-reorder-chip scale-110 opacity-95 shadow-lg"
                aria-hidden="true"
              >
                {texts[g.idx]}
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
}
