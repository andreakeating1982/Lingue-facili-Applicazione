import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

/**
 * Trascinamento universale basato su Pointer Events: funziona con mouse,
 * penna e DITO. Il drag & drop HTML5 nativo (draggable/dragstart/drop) non
 * esiste sui dispositivi touch — tablet e smartphone non generano mai quegli
 * eventi — quindi il gesto è gestito a mano:
 *  - pointerdown (sulla tessera): parte il potenziale trascinamento;
 *  - pointermove (a livello di FINESTRA): oltre 5px di spostamento nasce il
 *    "fantasma" del chip che segue il puntatore, si evidenzia il bersaglio
 *    sotto il dito (elementFromPoint + closest(dropSelector)) e parte il
 *    riordino live, se la vista lo implementa;
 *  - pointerup (a livello di FINESTRA): se il puntatore è sopra un bersaglio
 *    si chiama onDrop.
 *
 * ROBUSTEZZA NEL MONDO REALE (tablet, LIM, browser vari):
 *  1. I listener di gesto stanno su WINDOW, non sul pulsante: il dito può
 *     passare sui vuoti tra le parole, sullo sfondo del riquadro e anche
 *     fuori dai bordi senza che il gesto muoia (il pointer capture si perde
 *     appena il riordino sposta il nodo, o su alcuni browser non parte).
 *  2. UN SOLO GESTO ALLA VOLTA in tutta la pagina: un pointerup/pointercancel
 *     di un ALTRO dito (palmo appoggiato, secondo alunno sulla LIM) viene
 *     ignorato e non termina il trascinamento in corso.
 *  3. touchmove è bloccato dal TOCCO (non solo dal movimento): lo scroll non
 *     può più «rubare» il dito nei primi millimetri con un pointercancel.
 *  4. Se il browser annulla comunque il gesto a metà (pointercancel), lo
 *     chiudiamo nell'ultimo punto valido invece di abbandonare la parola.
 * Un tocco FERMO resta un clic: le viste mantengono il piazzamento/
 * selezione al tocco come alternativa al trascinamento.
 */

/* Un solo gesto di trascinamento alla volta in tutta la pagina. Con scadenza
   di sicurezza: se un gesto «fantasma» restasse aperto, dopo 5s un nuovo
   tocco può comunque partire. */
let gestoAttivo: { pid: number; t: number } | null = null;
const GESTO_TTL_MS = 5000;

export function usePointerDrop(
  dropSelector: string,
  /* x e y sono le coordinate del puntatore al rilascio: servono per
     inserire la chip NELLA POSIZIONE GIUSTA (prima o dopo la tessera
     sotto il dito) e non sempre in coda. */
  onDrop: (idx: number, target: Element, x: number, y: number) => void,
  /* Callback opzionale DURANTE il trascinamento (a ogni movimento oltre
     la soglia): serve per il riordino «live» delle tessere già piazzate,
     che fanno spazio in tempo reale mentre il dito va da una parte
     all'altra del riquadro. */
  onMove?: (idx: number, target: Element, x: number, y: number) => void
) {
  const [ghost, setGhost] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [over, setOver] = useState<Element | null>(null);
  const st = useRef<{ idx: number; sx: number; sy: number; lx: number; ly: number; moved: boolean; pid: number; enabled: boolean } | null>(null);
  const cleanupGesture = useRef<(() => void) | null>(null);
  const clickResetTimer = useRef<number | undefined>(undefined);
  const overRef = useRef<Element | null>(null);
  const lastDrag = useRef(false);
  // Se il browser perde il gesto (ad esempio passa a un'altra app Android),
  // pulire anche il fantasma e il lock, senza piazzare parole per errore.
  useEffect(() => {
    const cancel = () => {
      if (!st.current) return;
      cleanupGesture.current?.();
      cleanupGesture.current = null;
      overRef.current = null;
      // Un eventuale click sintetico del rilascio non deve spostare la parola
      // dopo l'annullamento; il flag si azzera comunque per il tocco seguente.
      lastDrag.current = true;
      window.clearTimeout(clickResetTimer.current);
      clickResetTimer.current = window.setTimeout(() => { lastDrag.current = false; }, 400);
      setGhost(null);
      setOver(null);
    };
    window.addEventListener("lf:cancel-gesture", cancel);
    return () => {
      window.removeEventListener("lf:cancel-gesture", cancel);
      cleanupGesture.current?.();
      window.clearTimeout(clickResetTimer.current);
    };
  }, []);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  /* touch-action:none evita che il dito faccia scorrere la pagina già dalla
     pressione; user-select/callout evitano selezione di testo e menu iOS
     sulla pressione lunga durante il trascinamento. */
  const chipStyle: CSSProperties = {
    touchAction: "none",
    WebkitTouchCallout: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  /* Hit test «perdonabile»: se il dito non cade esattamente su una card
     (dita grosse, bordi, gap tra le card) accettiamo la più vicina entro
     20px dal suo rettangolo. */
  const hitTest = (x: number, y: number): Element | null => {
    const el = document.elementFromPoint(x, y);
    const hit = (el?.closest(dropSelector) as Element | null) ?? null;
    if (hit) return hit;
    let best: Element | null = null;
    let bestD = Infinity;
    for (const card of Array.from(document.querySelectorAll(dropSelector))) {
      const r = card.getBoundingClientRect();
      if (x < r.left - 20 || x > r.right + 20 || y < r.top - 20 || y > r.bottom + 20) continue;
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = card;
      }
    }
    return best;
  };

  /* --- Listener di GESTO su window: indipendenti dal nodo della tessera --- */
  const gestoMove = (e: PointerEvent) => {
    const s = st.current;
    if (!s || s.pid !== e.pointerId || !s.enabled) return;
    if (!s.moved && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < 5) return;
    s.moved = true;
    s.lx = e.clientX;
    s.ly = e.clientY;
    lastDrag.current = true;
    setGhost({ idx: s.idx, x: e.clientX, y: e.clientY });
    const hit = hitTest(e.clientX, e.clientY);
    overRef.current = hit;
    setOver(hit);
    if (onMoveRef.current && hit) {
      onMoveRef.current(s.idx, hit, e.clientX, e.clientY);
    }
  };

  /* Chiusura comune di pointerup e pointercancel. `alRilascio` = true per il
     pointerup (le coordinate del puntatore sono attendibili), false per il
     cancel (spesso con coordinate inaffidabili: vale l'ultimo bersaglio). */
  const chiusura = (e: PointerEvent, alRilascio: boolean) => {
    const s = st.current;
    st.current = null;
    gestoAttivo = null;
    stacca();
    cleanupGesture.current = null;
    document.documentElement.removeAttribute("data-lf-gesture");
    window.dispatchEvent(new Event("lf:gesture-end"));
    setGhost(null);
    const lastOver = overRef.current;
    overRef.current = null;
    setOver(null);
    /* Il click sintetico che segue il rilascio arriva subito; su alcuni
       browser touch però può non arrivare affatto. Un reset di sicurezza
       evita che il prossimo TAP vero venga scambiato per il click del
       trascinamento e «mangiato». */
    window.clearTimeout(clickResetTimer.current);
    clickResetTimer.current = window.setTimeout(() => {
      lastDrag.current = false;
    }, 400);
    if (!s || !s.moved) return; /* tocco fermo: se arriva, il click decide */
    // Su pointercancel le coordinate possono essere nulle: usa l'ultimo
    // punto reale sia per il bersaglio sia per l'indice d'inserimento.
    const x = alRilascio ? e.clientX : s.lx;
    const y = alRilascio ? e.clientY : s.ly;
    const target = (alRilascio ? null : lastOver) ?? hitTest(x, y) ?? lastOver;
    if (target) onDropRef.current(s.idx, target, x, y);
  };

  const gestoUp = (e: PointerEvent) => {
    const s = st.current;
    /* Rilascio di un ALTRO dito (palmo, secondo alunno sulla LIM): non deve
       MAI terminare il gesto della mano che sta trascinando. */
    if (!s || s.pid !== e.pointerId) return;
    chiusura(e, true);
  };

  const gestoCancel = (e: PointerEvent) => {
    const s = st.current;
    if (!s || s.pid !== e.pointerId) return;
    /* Il browser ha annullato il gesto (scroll, swipe di sistema, dito uscito
       dallo schermo): se il trascinamento era partito lo concludiamo comunque
       nell'ultimo punto valido invece di abbandonare la parola a metà strada
       (che l'utente vedrebbe come «la parola è tornata dov'era»). */
    chiusura(e, false);
  };

  /* Blocca lo scroll touch per tutto il tempo in cui un dito è su una
     tessera, FIN DAL TOCCO: senza questo, lo scroll può «rubare» il gesto
     nei primi millimetri (pointercancel) prima che il trascinamento sia
     considerato partito. */
  const gestoTouch = (e: TouchEvent) => {
    if (st.current && e.cancelable) e.preventDefault();
  };

  const attacca = () => {
    window.addEventListener("pointermove", gestoMove, { passive: true });
    window.addEventListener("pointerup", gestoUp);
    window.addEventListener("pointercancel", gestoCancel);
    window.addEventListener("touchmove", gestoTouch, { passive: false });
  };
  const stacca = () => {
    window.removeEventListener("pointermove", gestoMove);
    window.removeEventListener("pointerup", gestoUp);
    window.removeEventListener("pointercancel", gestoCancel);
    window.removeEventListener("touchmove", gestoTouch);
  };

  const chipProps = (idx: number, enabled: boolean) => ({
    style: chipStyle,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || st.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      /* Un solo gesto alla volta: un secondo dito non parte mentre un altro
         trascina. La scadenza TTL evita blocchi permanenti se un gesto
         «fantasma» non si chiudesse mai. */
      const ora = Date.now();
      if (gestoAttivo && gestoAttivo.pid !== e.pointerId && ora - gestoAttivo.t < GESTO_TTL_MS) return;
      gestoAttivo = { pid: e.pointerId, t: ora };
      /* Il timer del gesto precedente non deve azzerare il flag durante il
         nuovo drag: potrebbe altrimenti far scattare il clic al rilascio. */
      window.clearTimeout(clickResetTimer.current);
      lastDrag.current = false;
      st.current = { idx, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, pid: e.pointerId, enabled };
      // Durante il gesto la cornice non deve cambiare altezza sotto il dito.
      document.documentElement.setAttribute("data-lf-gesture", "");
      cleanupGesture.current = () => {
        stacca();
        const s = st.current;
        st.current = null;
        if (s && gestoAttivo?.pid === s.pid) gestoAttivo = null;
        document.documentElement.removeAttribute("data-lf-gesture");
        window.dispatchEvent(new Event("lf:gesture-end"));
      };
      /* La cattura resta utile (retargeting su vecchi browser) ma NON è più
         indispensabile: il gesto vive sui listener di window. */
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer sintetici (test) o browser che la rifiutano */
      }
      attacca();
    },
  });

  /** Consuma il clic sintetico generato alla fine di un vero trascinamento. */
  const consumeClick = (): boolean => {
    const was = lastDrag.current;
    lastDrag.current = false;
    return was;
  };

  return { chipProps, ghost, over, consumeClick };
}

/*
 * Indice di inserimento consapevole del RIGO: con flex-wrap le tessere vanno
 * a capo e le righe condividono la stessa fascia orizzontale; un inserimento
 * basato solo su x manderebbe sempre all'inizio della PRIMA riga quando il
 * dito è all'estrema sinistra di una riga successiva (e renderebbe ambigua
 * la «fine» dell'ultima riga). Si sceglie quindi la RIGA più vicina al dito
 * e si ordina solo al suo interno per x.
 */
export function insertionIndexAt(x: number, y: number, chips: Element[]): number {
  if (chips.length === 0) return 0;
  const rects = chips.map((el) => el.getBoundingClientRect());
  /* Righe: raggruppa le tessere per centro verticale (entro 3/4 di altezza). */
  const rowCenters: number[] = [];
  const rows: number[][] = [];
  for (let i = 0; i < chips.length; i++) {
    const r = rects[i];
    const cy = r.top + r.height / 2;
    let k = rowCenters.findIndex((c) => Math.abs(c - cy) < r.height * 0.75);
    if (k === -1) {
      rowCenters.push(cy);
      rows.push([i]);
    } else {
      rows[k].push(i);
    }
  }
  /* Riga più vicina al dito (gestisce anche il vuoto tra le righe). */
  let bestRow = 0;
  let bestD = Infinity;
  for (let k = 0; k < rowCenters.length; k++) {
    const d = Math.abs(rowCenters[k] - y);
    if (d < bestD) {
      bestD = d;
      bestRow = k;
    }
  }
  const line = rows[bestRow];
  /* Dentro la riga: prima della tessera il cui centro sta alla destra del dito. */
  for (const i of line) {
    const r = rects[i];
    if (x < r.left + r.width / 2) return i;
  }
  /* Oltre l'ultima tessera della riga: FINE di QUESTA riga (non della frase). */
  return line[line.length - 1] + 1;
}

/** Stile condiviso del "fantasma" che segue il dito/cursore. */
export const GHOST_STYLE: CSSProperties = {
  position: "fixed",
  transform: "translate(-50%, -60%) rotate(-2deg)",
  zIndex: 60,
  pointerEvents: "none",
};
