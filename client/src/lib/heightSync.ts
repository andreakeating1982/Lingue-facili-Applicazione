/**
 * Sincronizzazione altezza per embed iframe (protocollo `labvisivo:height`).
 *
 * Quando l'app è caricata dentro un iframe (es. cornice dinamica su Blogger
 * o su un sito), invia al parent l'altezza reale del documento così la
 * cornice può adattarsi automaticamente al contenuto (resize automatico).
 *
 * Il parent ascolta messaggi del tipo:
 *   { type: "labvisivo:height", height: <numero> }
 */

function currentHeight(): number {
  const docEl = document.documentElement;
  const body = document.body;
  /* IMPORTANTE: NON usare documentElement.scrollHeight come riferimento
     assoluto. Quando il contenuto è più corto dell'iframe, lo scrollHeight
     del documento resta "gonfiato" all'altezza del viewport dell'iframe
     (mai meno), quindi la cornice dinamica non potrebbe MAI restringersi
     e la prima pagina mostrerebbe un grande vuoto (prima sotto la card,
     poi sopra). Usiamo invece l'altezza reale del contenuto (body +
     offsetHeight del documento) e aggiungiamo documentElement.scrollHeight
     SOLO quando il contenuto supera davvero il viewport. */
  const viewportH = window.innerHeight || (docEl ? docEl.clientHeight : 0);
  let h = Math.max(
    body ? body.scrollHeight : 0,
    body ? body.offsetHeight : 0,
    docEl ? docEl.offsetHeight : 0
  );
  if (docEl && docEl.scrollHeight > viewportH) {
    h = Math.max(h, docEl.scrollHeight);
  }
  return h;
}

function viewportHeight(): number {
  return window.innerHeight || document.documentElement.clientHeight || 0;
}

/** Il contenuto è più alto dell'iframe: una parte è tagliata finché la cornice non lo allunga. */
function isClipped(): boolean {
  return currentHeight() > viewportHeight() + 6;
}

function isLocked(): boolean {
  const root = document.documentElement;
  return root.hasAttribute("data-lf-crop-open") || root.hasAttribute("data-lf-gesture");
}

/**
 * L'iframe NON deve scorrere da solo mentre la cornice ne adegua l'altezza.
 * Su Android, se il contenuto supera anche di pochi pixel l'iframe (ad esempio
 * quando il testo letto da una foto allunga la pagina mentre il dito è sullo
 * schermo), il documento interno diventa scorrevole: il dito sposta il contenuto
 * dentro l'iframe, la cornice poi lo allunga e il contenuto «salta» indietro;
 * con un margine minimo il gesto viene inoltre trattenuto dall'iframe e la
 * pagina del blog non scorre più. Con `overflow: hidden` ogni gesto passa alla
 * pagina ospite. Lo scorrimento interno si riattiva SOLO se l'ospite non segue
 * l'altezza (schermo intero della cornice o embed senza il protocollo): vedi
 * `reviewInnerScroll` e il messaggio `labvisivo:fullscreen`.
 */
const INNER_SCROLL_CLASS = "lf-inner-scroll";
const INNER_SCROLL_GRACE_MS = 3000;
// Dopo l'ultimo tocco/tasto la cornice ha bisogno di circa un secondo (misura,
// conferma e applicazione): finché non è passato abbastanza tempo non si riattiva.
const INNER_SCROLL_IDLE_MS = 2500;
// Un ospite che parla il protocollo della cornice passa il token nell'URL e/o invia
// un ping periodico (ogni 3 s). Senza nessuno dei due (altro sito, iframe a altezza
// fissa) nessuno adegua l'altezza: lo scorrimento interno resta quello di sempre.
const HOST_PING_FRESH_MS = 8000;
let innerScrollTimer: number | undefined;
let parentFullscreen = false;
let lastInteractionAt = 0;
let lastPingAt = 0;

function setInnerScroll(enabled: boolean): void {
  document.documentElement.classList.toggle(INNER_SCROLL_CLASS, enabled);
}

function clearInnerScrollTimer(): void {
  window.clearTimeout(innerScrollTimer);
  innerScrollTimer = undefined;
}

function hostFollowsHeight(): boolean {
  return !!corniceToken() || Date.now() - lastPingAt < HOST_PING_FRESH_MS;
}

function reviewInnerScroll(): void {
  if (window.self === window.top) return;
  if (parentFullscreen || !hostFollowsHeight()) { clearInnerScrollTimer(); setInnerScroll(true); return; }
  if (!isClipped()) { clearInnerScrollTimer(); setInnerScroll(false); return; }
  // La cornice normale adegua l'iframe in meno di un secondo. Se, senza dita
  // sullo schermo, resta più bassa del contenuto, l'ospite non la sta seguendo.
  // L'attesa NON va rinnovata a ogni misura (il ping della cornice arriva ogni
  // 3 s): parte alla prima osservazione e si annulla solo se l'iframe si adegua.
  if (innerScrollTimer !== undefined) return;
  innerScrollTimer = window.setTimeout(() => {
    innerScrollTimer = undefined;
    if (interactionActive || isLocked() || Date.now() - lastInteractionAt < INNER_SCROLL_IDLE_MS) {
      reviewInnerScroll();
      return;
    }
    setInnerScroll(isClipped());
  }, INNER_SCROLL_GRACE_MS);
}

// Token univoco della cornice (parametro ?cornice=... nell'URL dell'iframe).
// La cornice dinamica genera un token per OGNI istanza e lo ripassa qui;
// l'app lo rispecchia nei messaggi di altezza, così la cornice accetta solo
// i messaggi del PROPRIO iframe (impermeabilità tra più cornici nella stessa
// pagina, es. blog con più app didattiche embeddate).
// La navigazione React può togliere ?cornice= dalla query: conservare il
// token iniziale per l'intera vita dell'iframe e per i messaggi di attività.
let initialCorniceToken = "";
function corniceToken(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("cornice") || initialCorniceToken;
  } catch {
    return initialCorniceToken;
  }
}

let interactionActive = false;
let lastSentHeight: number | undefined;
let lastSentToken = "";

function sendHeight(token: string = corniceToken(), force = false): boolean {
  // Attivo solo quando siamo dentro un iframe (non come pagina principale)
  if (window.self === window.top) return false;
  // Il body fixed del cropper non rappresenta l'altezza dell'app e durante il
  // trascinamento di una tessera le misure intermedie non servono.
  if (isLocked()) return false;
  const height = currentHeight();
  if (height <= 100) return false;
  // Mentre l'utente tocca, scorre o digita non si comunicano riduzioni né
  // assestamenti: si invia soltanto una CRESCITA che altrimenti resterebbe
  // tagliata (l'iframe non scorre più da solo). Una crescita non sposta nulla
  // di ciò che si vede, perché il contenuto resta ancorato in alto.
  if (interactionActive && height <= viewportHeight() + 6) return false;
  // La cornice già ignora differenze inferiori a 2px. Non ripetere misure
  // uguali causate dal resize del suo stesso iframe; un ping forza la risposta.
  if (!force && token === lastSentToken && lastSentHeight !== undefined &&
      Math.abs(height - lastSentHeight) < 2) return false;
  const msg: { type: string; height: number; cornice?: string } = {
    type: "labvisivo:height",
    height,
  };
  if (token) msg.cornice = token;
  window.parent.postMessage(msg, "*");
  lastSentHeight = height;
  lastSentToken = token;
  return true;
}

// La cornice del blog filtra tre aumenti consecutivi per evitare loop: inviare
// ogni ResizeObserver durante i rapidi tocchi delle tessere può farle scambiare
// cambi reali per un loop, lasciando l'iframe troppo basso. Coalescere le misure
// e confermare il valore stabile una seconda volta evita falsi positivi e
// permette alla cornice di verificare anche i salti grandi.
let settleTimer: number | undefined;
let confirmTimer: number | undefined;
let forceNextHeight = false;
function queueHeight(token: string = corniceToken(), force = false): void {
  window.clearTimeout(settleTimer);
  window.clearTimeout(confirmTimer);
  reviewInnerScroll();
  if (isLocked()) return;
  // Un resize successivo non deve annullare la risposta esplicita a un ping.
  forceNextHeight ||= force;
  settleTimer = window.setTimeout(() => {
    const forced = forceNextHeight;
    forceNextHeight = false;
    if (sendHeight(token, forced)) {
      // I salti grandi della cornice richiedono una conferma dello stesso valore.
      confirmTimer = window.setTimeout(() => sendHeight(token, true), 120);
    }
  }, 180);
}

/**
 * La sola sospensione locale non annulla un resize già IN CODA nel parent.
 * Avvisare quindi la cornice prima di ogni gesto/digitazione: la nuova cornice
 * cancella il suo timer pendente, aspetta la fine dell'interazione e richiede
 * una misura aggiornata. La vecchia cornice ignora questo messaggio aggiuntivo.
 * Nessun testo o dato personale viene inviato: soltanto stato e token.
 */
function initInteractionSignals(): void {
  const pointers = new Set<number>();
  let touches = 0;
  let releaseTimer: number | undefined;
  let heartbeatTimer: number | undefined;
  let lastPointerActivity = Date.now();
  const root = document.documentElement;

  const notify = (active: boolean) => {
    const token = corniceToken();
    const msg: { type: string; active: boolean; cornice?: string } = {
      type: "labvisivo:interaction",
      active,
    };
    if (token) msg.cornice = token;
    window.parent.postMessage(msg, "*");
  };
  const held = () => pointers.size > 0 || touches > 0 ||
    root.hasAttribute("data-lf-crop-open") || root.hasAttribute("data-lf-gesture");
  const begin = () => {
    lastInteractionAt = Date.now();
    window.clearTimeout(releaseTimer);
    window.clearTimeout(settleTimer);
    window.clearTimeout(confirmTimer);
    forceNextHeight = false;
    if (interactionActive) return;
    interactionActive = true;
    notify(true);
    // Un gesto può durare più di alcuni secondi: il parent non deve scadere
    // mentre il dito è ancora appoggiato. Il watchdog del parent recupera in
    // caso di pagina chiusa o eventi di fine mancanti.
    heartbeatTimer = window.setInterval(() => {
      // Se un browser perde definitivamente pointerup/touchend, non lasciare
      // la cornice bloccata per sempre. Il crop aperto resta invece protetto.
      const stuck = (pointers.size > 0 || touches > 0 || root.hasAttribute("data-lf-gesture")) &&
        !root.hasAttribute("data-lf-crop-open") && Date.now() - lastPointerActivity > 30000;
      if (stuck) {
        pointers.clear();
        touches = 0;
        window.dispatchEvent(new Event("lf:cancel-gesture"));
        releaseLater(0);
        return;
      }
      notify(true);
    }, 2000);
  };
  const releaseLater = (delay = 260) => {
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      if (held()) return;
      lastInteractionAt = Date.now();
      if (interactionActive) {
        interactionActive = false;
        window.clearInterval(heartbeatTimer);
        notify(false);
      }
      // Il contenuto può essere cresciuto durante il gesto: inviarlo anche se
      // coincide con l'ultima misura che la vecchia cornice potrebbe aver perso.
      queueHeight(corniceToken(), true);
    }, delay);
  };
  const pulse = (delay = 260) => { begin(); releaseLater(delay); };

  window.addEventListener("pointerdown", (event) => {
    pointers.add(event.pointerId);
    lastPointerActivity = Date.now();
    begin();
  }, { capture: true, passive: true });
  window.addEventListener("pointermove", (event) => {
    if (pointers.has(event.pointerId)) lastPointerActivity = Date.now();
  }, { capture: true, passive: true });
  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    releaseLater();
  };
  window.addEventListener("pointerup", endPointer, { capture: true, passive: true });
  window.addEventListener("pointercancel", endPointer, { capture: true, passive: true });
  // Android può annullare pointer mentre continua uno scroll touch: aspettare
  // il vero touchend, non considerare il dito rilasciato al pointercancel.
  window.addEventListener("touchstart", (event) => {
    touches = event.touches.length;
    lastPointerActivity = Date.now();
    begin();
  }, { capture: true, passive: true });
  window.addEventListener("touchmove", () => {
    if (touches > 0) lastPointerActivity = Date.now();
  }, { capture: true, passive: true });
  const endTouch = (event: TouchEvent) => {
    touches = event.touches.length;
    releaseLater();
  };
  window.addEventListener("touchend", endTouch, { capture: true, passive: true });
  window.addEventListener("touchcancel", endTouch, { capture: true, passive: true });
  window.addEventListener("keydown", () => pulse(450), { capture: true });
  window.addEventListener("input", () => pulse(450), { capture: true });
  window.addEventListener("change", () => pulse(), { capture: true });
  window.addEventListener("focusin", () => pulse(), { capture: true });
  window.addEventListener("scroll", () => pulse(260), { passive: true });
  window.addEventListener("blur", () => {
    pointers.clear();
    touches = 0;
    window.dispatchEvent(new Event("lf:cancel-gesture"));
    releaseLater();
  });
  window.addEventListener("pagehide", () => {
    window.clearInterval(heartbeatTimer);
    if (interactionActive) notify(false);
  });
  // Il cropper possiede un lock indipendente e può restare aperto a lungo;
  // osservare solo gli attributi, senza alterare le sue funzioni di ritaglio.
  const observer = new MutationObserver(() => {
    if (held()) begin();
    else releaseLater();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["data-lf-crop-open", "data-lf-gesture"] });
}

export function initHeightSync(): void {
  // IMPORTANTE: quando l'app è dentro un iframe a altezza automatica
  // (cornice dinamica), la pagina deve seguire l'altezza del CONTENUTO.
  // Il classico `min-h-screen` (100vh) creerebbe un loop infinito:
  //   iframe = misurato → viewport = iframe → misurato = viewport + barra → …
  // Con la classe `lf-embedded` il CSS disattiva i 100vh (vedi index.css).
  if (window.self !== window.top) {
    initialCorniceToken = corniceToken();
    document.documentElement.classList.add("lf-embedded");
    initInteractionSignals();
    // Rete di sicurezza: se l'ospite smette di rispondere (ping assenti, iframe
    // rimasto troppo basso) lo scorrimento interno torna disponibile da solo.
    reviewInnerScroll();
    window.setInterval(reviewInnerScroll, 2500);
  }

  // Risponde al "ping" della cornice dinamica (embed Blogger): la cornice
  // può richiedere l'altezza in ogni momento con { type: "labvisivo:ping" }.
  // Se il ping porta il token della cornice, lo rispecchiamo nella risposta.
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !e.data) return;
    if (e.data.type === "labvisivo:ping") {
      const token = typeof e.data.cornice === "string" ? e.data.cornice : corniceToken();
      if (token) initialCorniceToken = token;
      lastPingAt = Date.now();
      queueHeight(token, true);
    } else if (e.data.type === "labvisivo:fullscreen" && typeof e.data.active === "boolean") {
      // Schermo intero della cornice: l'iframe occupa lo schermo e il contenuto
      // deve scorrere al suo interno. Le cornici precedenti non inviano questo
      // messaggio: per loro vale il controllo temporizzato di reviewInnerScroll.
      parentFullscreen = e.data.active;
      reviewInnerScroll();
      if (!parentFullscreen) queueHeight(corniceToken(), true);
    }
  });

  // Invia subito (prima del rendering completo) e a caricamento avvenuto
  queueHeight();
  window.addEventListener("load", () => queueHeight());
  window.addEventListener("resize", () => queueHeight());
  // Dopo il rilascio o la chiusura del cropper, misurare il layout reale.
  window.addEventListener("lf:gesture-end", () => queueHeight());
  window.addEventListener("lf:crop-closed", () => requestAnimationFrame(() => queueHeight()));

  // Osserva i cambi di layout: testo incollato, check fattibilità, generazione
  // AI, passaggi di esercizio, dialoghi, toolbar accessibilità…
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => queueHeight());
    if (document.documentElement) ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    // Invia anche quando un dialogo si apre/chiude (il body cambia dimensione)
    setTimeout(() => queueHeight(), 250);
  }

  // Retry: font e contenuti asincroni possono cambiare l'altezza dopo
  // l'evento "load" (es. generazione AI dell'esercizio)
  setTimeout(queueHeight, 500);
  setTimeout(queueHeight, 1500);
}
