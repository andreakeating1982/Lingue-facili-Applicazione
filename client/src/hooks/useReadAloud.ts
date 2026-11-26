import { useCallback, useEffect, useState } from "react";

/**
 * Lettura ad alta voce (Text-to-Speech) per l'inclusione (DSA/BES).
 *
 * Legge il contenuto testuale dell'intera pagina usando l'API Web Speech
 * (`speechSynthesis`). Il pulsante "Ascolto → Leggi" nella barra di
 * accessibilità avvia/interrompe la lettura.
 *
 * ⭐ LINGUE FACILI — RICONOSCIMENTO AUTOMATICO DELLA LINGUA:
 * l'app è multilingua (inglese, francese, spagnolo + interfaccia italiana),
 * quindi la lettura NON è fissa su una sola voce:
 *  - il testo viene diviso in frasi;
 *  - per OGNI frase si rileva la lingua (accenti tipici: ñ/¿/¡ → spagnolo,
 *    ç/à/è/ê → francese; parole caratteristiche: the/and → inglese,
 *    el/los/está → spagnolo, le/les/très → francese, per/che/è → italiano);
 *  - in caso di ambiguità (frase senza segnali distintivi, es. "Maria is" vs
 *    "María es") vince la lingua preferita scelta nella seconda pagina
 *    o quella dell'esercizio corrente;
 *  - per ogni lingua si sceglie la MIGLIORE voce disponibile (neurale/naturale
 *    se presente) e le si assegna il codice lang corretto (it-IT, en-US,
 *    fr-FR, es-ES).
 * Così l'interfaccia viene letta in italiano e il testo/esercizio nella sua
 * lingua, senza che l'utente debba configurare nulla.
 *
 * Accorgimenti per una lettura naturale, completa e corretta (ereditati
 * dall'app di riferimento Latino Facile):
 *  - legge TUTTA la pagina (header + contenuto), non solo il <main>;
 *  - converte le formule KaTeX dal loro LaTeX in italiano parlato (ramo
 *    presente per compatibilità: nelle pagine lingua non ci sono formule);
 *  - converte gli esponenti/pedici Unicode nel testo ("x²" → "x al quadrato");
 *  - legge le date in forma naturale ("01/09/2026" → "primo settembre duemilaventisei");
 *  - converte le parole MAIUSCOLE in minuscolo (gli engine TTS leggono le
 *    parole tutte maiuscole con accenti sbagliati o lettera per lettera);
 *  - ignora toolbar, pulsanti, campi, canvas e tutto ciò che è nascosto
 *    visivamente (aria-hidden, .sr-only) o solo per screen reader.
 */

export type LangTts = "it" | "en" | "fr" | "es";

// ────────────────────────────────────────────────────────────────────────────
// Riconoscimento automatico della lingua (per singola frase)
// ────────────────────────────────────────────────────────────────────────────

/** Caratteri quasi univoci, valgono più di qualsiasi parola. */
const STRONG_MARKS: Array<[RegExp, LangTts, number]> = [
  [/[ñ¿¡]/g, "es", 5],
  [/[çàùèêôœâ]/g, "fr", 5],
  [/[áíóú]/g, "es", 3],
];

/** Parole caratteristiche (sull'intera frase, pesate sul numero di eventi). */
const HINT_WORDS: Array<[RegExp, LangTts, number]> = [
  // Inglese: parole funzione molto frequenti e quasi assenti altrove
  [/\b(the|and|she|his|her|they|with|every|never|always|because|very|after|before|study|school|house)\b/g, "en", 2],
  [/\b(is|are|of|to|in|it)\b/g, "en", 0.6],
  // Spagnolo
  [/\b(los|las|unos|unas|está|están|más|día|días|porque|muy|también|hoy|mucho|cada|para|pero|desde|ella|ellos)\b/g, "es", 2],
  [/\b(el|es|un|una|con|que|por|como|pero)\b/g, "es", 0.6],
  // Francese
  [/\b(les|des|une|est|elle|elles|très|pour|avec|dans|mais|jour|jours|toujours|jamais|parce|après|avant|école|maison)\b/g, "fr", 2],
  [/\b(le|la|un|que|pour|par|plus|très)\b/g, "fr", 0.6],
  // Italiano (interfaccia e istruzioni)
  [/\b(per|con|che|del|della|dei|delle|sono|più|ogni|non|come|nella|dall|all|questo|questa|testo|esercizio)\b/g, "it", 2],
  [/\b(il|lo|un|di|e|è|al)\b/g, "it", 0.6],
];

/** Apostrofo francese/elisione ("l'amico", "d'eau") e "l'" sono deboli. */

function detectLanguage(raw: string, prefer?: LangTts): LangTts {
  const text = raw.toLowerCase();
  const score: Record<LangTts, number> = { it: 0, en: 0, fr: 0, es: 0 };

  for (const [re, lang, w] of STRONG_MARKS) {
    const m = text.match(re);
    if (m) score[lang] += m.length * w;
  }
  for (const [re, lang, w] of HINT_WORDS) {
    const m = text.match(re);
    if (m) score[lang] += Math.min(m.length, 6) * w; // satura: 6 parole bastano
  }
  // Leggero vantaggio alla lingua preferita (selettore dell'app): decide i pareggi.
  if (prefer) score[prefer] += 0.8;

  let best: LangTts = prefer ?? "it";
  let bestScore = prefer ? score[prefer] : 0;
  for (const lang of ["it", "en", "fr", "es"] as LangTts[]) {
    if (score[lang] > bestScore) {
      best = lang;
      bestScore = score[lang];
    }
  }
  return best;
}

// ────────────────────────────────────────────────────────────────────────────
// Scelta della voce per lingua (cache separata per ciascuna)
// ────────────────────────────────────────────────────────────────────────────

const voicesByLang = new Map<LangTts, SpeechSynthesisVoice | null>();

/** Punteggio per scegliere la voce meno "robotica" possibile per una lingua. */
function scoreVoice(v: SpeechSynthesisVoice, lang: LangTts): number {
  const name = (v.name || "").toLowerCase();
  let score = 0;
  if (/\b(google|microsoft|apple)\b/.test(name)) score += 4;
  if (/natural|neural|premium|enhanced|online|multilingual|expressive/.test(name)) score += 5;
  if (
    /elsa|diego|isabella|federica|luca|bianca|giorgio|paola|carla|francesca|alice|emma|elena|marco|giulia|alessio|stefano|giovanni|ilaria|aria|jenny|guy|ryan|sonia|libby|thomas|amelie|audrey|paul|hortense|chloe|helene|laura|elvira|alvaro|monica|pablo|dalia|jorge|sabina/.test(
      name,
    )
  )
    score += 2;
  if (v.localService) score += 1;
  // Preferisci la variante "principale" della lingua (en-US/en-GB, fr-FR, es-ES).
  const vLang = (v.lang || "").toLowerCase().replace("_", "-");
  const primary: Record<LangTts, string[]> = {
    it: ["it-it"],
    en: ["en-us", "en-gb"],
    fr: ["fr-fr"],
    es: ["es-es"],
  };
  if (primary[lang].includes(vLang)) score += 2;
  return score;
}

function pickBestVoice(lang: LangTts): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefix = lang;
  const pool = voices.filter((v) => (v.lang || "").toLowerCase().startsWith(prefix));
  const usable = pool.length ? pool : voices; // se manca una voce della lingua, il browser ne userà una di default
  return [...usable].sort((a, b) => scoreVoice(b, lang) - scoreVoice(a, lang))[0] ?? null;
}

function loadVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  for (const lang of ["it", "en", "fr", "es"] as LangTts[]) {
    if (!voicesByLang.has(lang)) voicesByLang.set(lang, pickBestVoice(lang));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Conversione LaTeX → italiano parlato
// (mantenuta dall'app di riferimento: inutilizzata nelle pagine lingua, ma
//  utile per eventuali adattamenti futuri con formule)
// ────────────────────────────────────────────────────────────────────────────

const IT_NUMBERS: Record<number, string> = {
  0: "zero", 1: "uno", 2: "due", 3: "tre", 4: "quattro", 5: "cinque",
  6: "sei", 7: "sette", 8: "otto", 9: "nove", 10: "dieci", 11: "undici",
  12: "dodici", 13: "tredici", 14: "quattordici", 15: "quindici",
  16: "sedici", 17: "diciassette", 18: "diciotto", 19: "diciannove",
  20: "venti", 30: "trenta", 40: "quaranta", 50: "cinquanta",
  60: "sessanta", 70: "settanta", 80: "ottanta", 90: "novanta",
};

function integerToItalian(n: number): string {
  if (n < 0) return "meno " + integerToItalian(-n);
  if (n < 20) return IT_NUMBERS[n] ?? String(n);
  if (n < 100) {
    const tens = Math.floor(n / 10) * 10;
    const units = n % 10;
    let word = IT_NUMBERS[tens] ?? String(tens);
    if (units === 0) return word;
    if (units === 1 || units === 8) word = word.slice(0, -1);
    const unitWord = units === 3 ? "tré" : IT_NUMBERS[units] ?? String(units);
    return word + unitWord;
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const h = hundreds === 1 ? "cento" : (IT_NUMBERS[hundreds] ?? String(hundreds)) + "cento";
    return rest === 0 ? h : h + integerToItalian(rest);
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const t = thousands === 1 ? "mille" : integerToItalian(thousands) + "mila";
    return rest === 0 ? t : t + integerToItalian(rest);
  }
  // Numeri ancora più grandi: lettura a cifre separate (raro nell'app).
  return String(n);
}

function numberToItalian(numStr: string): string {
  const s = numStr.trim();
  if (s === "") return "";
  if (s.includes(".")) {
    const [intPart, decPart] = s.split(".");
    const intWords = integerToItalian(parseInt(intPart || "0", 10));
    const decWords = (decPart || "")
      .split("")
      .map((d) => IT_NUMBERS[Number(d)] ?? d)
      .join(" ");
    return intWords + " virgola " + decWords;
  }
  const n = parseInt(s, 10);
  if (!isNaN(n)) return integerToItalian(n);
  return s;
}

/** Converte una data "gg/mm/aaaa" in italiano parlato (es. "01/09/2026" → "primo settembre duemilaventisei"). */
function formatDateItalian(value: string): string | null {
  const m = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12) return null;
  const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const dayWord = day === 1 ? "primo" : integerToItalian(day);
  return `${dayWord} ${MONTHS[month - 1]} ${integerToItalian(year)}`;
}

function exponentToItalian(arg: string): string {
  const t = arg.trim();
  const n = parseInt(t, 10);
  if (!isNaN(n)) {
    const map: Record<number, string> = {
      0: "alla zero", 1: "alla prima", 2: "al quadrato", 3: "al cubo",
      4: "alla quarta", 5: "alla quinta", 6: "alla sesta", 7: "alla settima",
      8: "all'ottava", 9: "alla nona", 10: "alla decima",
    };
    if (map[n]) return map[n];
    return "alla " + integerToItalian(n);
  }
  return "alla " + t;
}

function subscriptToItalian(arg: string): string {
  const t = arg.trim();
  const n = parseInt(t, 10);
  if (!isNaN(n)) return IT_NUMBERS[n] ?? t;
  return t;
}

/** Converte una stringa LaTeX in italiano parlato. */
function latexToSpeech(latex: string): string {
  let s = latex
    .replace(/\\left|\\right|\\displaystyle|\\textstyle/gi, "")
    .replace(/\\[,;:!]|\\\s|\\quad|\\qquad/gi, " ")
    .trim();
  if (!s) return "";

  let i = 0;
  const n = s.length;

  function parseExpr(): string {
    let out = "";
    while (i < n) {
      const c = s[i];

      if (c === "\\") {
        i++;
        let cmd = "";
        while (i < n && /[a-zA-Z]/.test(s[i])) { cmd += s[i]; i++; }

        if (cmd === "dfrac" || cmd === "frac") {
          let num = "", den = "";
          if (s[i] === "{") { i++; num = parseExpr(); if (s[i] === "}") i++; }
          if (s[i] === "{") { i++; den = parseExpr(); if (s[i] === "}") i++; }
          out += " " + num.trim() + " fratto " + den.trim() + " ";
        } else if (cmd === "sqrt") {
          let inner = "";
          if (s[i] === "{") { i++; inner = parseExpr(); if (s[i] === "}") i++; }
          out += " radice quadrata di " + inner.trim() + " ";
        } else if (cmd === "Delta") {
          out += " delta ";
        } else if (cmd === "cdot" || cmd === "times") {
          out += " per ";
        } else if (cmd === "pm") {
          out += " più o meno ";
        } else if (cmd === "mp") {
          out += " meno o più ";
        } else if (cmd === "neq" || cmd === "ne") {
          out += " diverso da ";
        } else if (cmd === "leq" || cmd === "le") {
          out += " minore o uguale a ";
        } else if (cmd === "geq" || cmd === "ge") {
          out += " maggiore o uguale a ";
        } else if (cmd === "lt") {
          out += " minore ";
        } else if (cmd === "gt") {
          out += " maggiore ";
        } else if (cmd === "approx") {
          out += " circa ";
        } else if (cmd === "infty") {
          out += " infinito ";
        } else {
          out += " " + cmd + " ";
        }
        continue;
      }

      if (c === "^" || c === "_") {
        const isExp = c === "^";
        i++;
        let arg = "";
        if (s[i] === "{") {
          // Leggiamo il contenuto GREZZO (es. "4", "2"), non la forma già
          // parlata: serve a exponentToItalian per riconoscere l'ordinale.
          arg = readRawGroup();
        } else if (i < n) {
          arg = s[i];
          i++;
        }
        out += isExp ? " " + exponentToItalian(arg) + " " : " " + subscriptToItalian(arg) + " ";
        continue;
      }

      if (c === "{") { i++; continue; }
      if (c === "}") { break; }

      if (c === "=") { out += " uguale "; i++; continue; }
      if (c === "+") { out += " più "; i++; continue; }
      if (c === "-") { out += " meno "; i++; continue; }
      if (c === "(" || c === ")") { out += " "; i++; continue; }
      if (c === ",") { out += " virgola "; i++; continue; }

      if (/[0-9]/.test(c)) {
        let num = "";
        while (i < n && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
        out += " " + numberToItalian(num) + " ";
        continue;
      }

      if (/[a-zA-Z]/.test(c)) {
        let word = "";
        while (i < n && /[a-zA-Z]/.test(s[i])) { word += s[i]; i++; }
        out += " " + word + " ";
        continue;
      }

      // Carattere sconosciuto (spazi, ecc.)
      i++;
    }
    return out;
  }

  /** Legge il contenuto GREZZO (senza conversione) di un gruppo {...}. */
  function readRawGroup(): string {
    i++; // salta "{"
    let depth = 1;
    let content = "";
    while (i < n && depth > 0) {
      const ch = s[i];
      if (ch === "{") { depth++; content += ch; i++; }
      else if (ch === "}") { depth--; if (depth > 0) content += ch; i++; }
      else { content += ch; i++; }
    }
    return content;
  }

  return parseExpr().replace(/\s+/g, " ").trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Esponenti e pedici Unicode nel testo (es. "x²", "t₁")
// ────────────────────────────────────────────────────────────────────────────

const UNICODE_SUPERSCRIPT: Record<string, string> = {
  "⁰": " alla zero", "¹": " alla prima", "²": " al quadrato", "³": " al cubo",
  "⁴": " alla quarta", "⁵": " alla quinta", "⁶": " alla sesta",
  "⁷": " alla settima", "⁸": " all'ottava", "⁹": " alla nona",
};

const UNICODE_SUBSCRIPT: Record<string, string> = {
  "₀": " zero", "₁": " uno", "₂": " due", "₃": " tre", "₄": " quattro",
  "₅": " cinque", "₆": " sei", "₇": " sette", "₈": " otto", "₉": " nove",
};

function normalizeUnicodeMath(text: string): string {
  return text
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (m) => UNICODE_SUPERSCRIPT[m])
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (m) => UNICODE_SUBSCRIPT[m]);
}

/**
 * Porta il testo a un caso "naturale" per il TTS: le parole tutte MAIUSCOLE
 * vengono lette dagli engine con accenti sbagliati o lettera per lettera
 * (es. "LINGUE FACILI" letto lettera per lettera). Le convertiamo in minuscolo.
 */
function toNaturalCase(text: string): string {
  return text
    .replace(/Δ/g, "delta")
    .replace(/\p{Lu}{2,}/gu, (w) => w.toLowerCase())
    .replace(/\bE\b/g, "e");
}

/**
 * Estrae il testo leggibile della pagina attraversando i nodi di testo del DOM
 * (senza mutare la UI). Usa i nodi di testo e NON `innerText` su un clone
 * staccato, che accorpava le parole senza spazi. Salta anche tutto ciò che è
 * nascosto visivamente (aria-hidden, .sr-only): è rumore per l'ascolto.
 */
function getReadableText(): string {
  const EXCLUDE_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "BUTTON", "CANVAS", "SVG", "IFRAME",
  ]);
  const BLOCK_TAGS = new Set([
    "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "SECTION",
    "ARTICLE", "HEADER", "MAIN", "FOOTER", "UL", "OL", "TABLE", "TR", "BR",
  ]);

  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.replace(/\s+/g, " ").trim();
      if (t) parts.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (EXCLUDE_TAGS.has(el.tagName)) return;
    if (el.getAttribute("role") === "toolbar") return;
    // Nascosti visivamente o solo per screen reader: nessun rumore vocale.
    if (el.getAttribute("aria-hidden") === "true") return;
    if (el.classList.contains("sr-only")) return;

    // Campi di input: leggiamo etichetta (aria-label/placeholder) e valore.
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const input = el as HTMLInputElement;
      const label = input.getAttribute("aria-label")?.trim()
        || input.getAttribute("placeholder")?.trim()
        || "";
      const value = input.value?.trim() || "";
      const pieces: string[] = [];
      if (label) pieces.push(label);
      if (value && value !== label) pieces.push(formatDateItalian(value) ?? value);
      if (pieces.length) parts.push(" " + pieces.join(" ") + " ");
      return;
    }
    if (el.tagName === "SELECT") {
      const sel = el as HTMLSelectElement;
      const opt = sel.options[sel.selectedIndex]?.text?.trim() || "";
      if (opt) parts.push(" " + opt + " ");
      return;
    }

    // Formula KaTeX: convertiamo il LaTeX in italiano parlato (nella pagina
    // lingua il ramo non viene mai eseguito).
    if (el.classList.contains("katex")) {
      let spoken = "";
      try {
        const annotation = el.querySelector(".katex-mathml annotation");
        const latex = annotation?.textContent?.trim() || "";
        if (latex) spoken = latexToSpeech(latex);
      } catch {
        spoken = "";
      }
      if (!spoken) {
        // Fallback: leggiamo solo la forma resa visivamente (senza MathML).
        const html = el.querySelector(".katex-html") as HTMLElement | null;
        spoken = html?.innerText?.replace(/\s+/g, " ").trim() || "";
      }
      if (spoken) parts.push(" " + spoken + " ");
      return; // non scendiamo in .katex-html / .katex-mathml
    }

    const isBlock = BLOCK_TAGS.has(el.tagName);
    if (isBlock) parts.push(" ");
    for (const child of Array.from(el.childNodes)) walk(child);
    if (isBlock) parts.push(" ");
  };

  walk(document.body);

  let text = parts.join(" ").replace(/\s+/g, " ").trim();
  text = normalizeUnicodeMath(text);
  text = toNaturalCase(text);
  return text;
}

/** Divide il testo in frasi (per pause naturali e robustezza sui browser). */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?;:¡¿])\s+/);
  const chunks: string[] = [];
  const MAX = 220;
  // Non unire frasi corte: potrebbero essere in lingue diverse e richiedere
  // voci differenti. Frasi molto lunghe sono spezzate senza perdere parole.
  for (const raw of parts) {
    let part = raw.trim();
    while (part.length > MAX) {
      const lastSpace = part.lastIndexOf(" ", MAX);
      const end = lastSpace > 0 ? lastSpace : MAX;
      chunks.push(part.slice(0, end).trim());
      part = part.slice(end).trim();
    }
    if (part) chunks.push(part);
  }
  return chunks.length ? chunks : [text];
}

const UTTER_LANG: Record<LangTts, string> = {
  it: "it-IT",
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
};

export interface UseReadAloudResult {
  speaking: boolean;
  supported: boolean;
  toggle: () => void;
  stop: () => void;
}

/**
 * @param prefer lingua preferita (del contenuto): decide le frasi ambigue.
 *               È la lingua scelta nel selettore 🇬🇧🇫🇷🇪🇸 o quella
 *               dell'esercizio corrente; le frasi riconoscibili restano
 *               comunque lette con la LORO lingua (riconoscimento automatico).
 */
export function useReadAloud(prefer?: LangTts): UseReadAloudResult {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Carica le voci (su alcuni browser arrivano in modo asincrono).
  useEffect(() => {
    if (!supported) return;
    const load = () => loadVoices();
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  // Interrompe la lettura quando il componente si smonta.
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  // ♿ Sincronizzazione dello stato: alcuni browser (soprattutto in ambienti
  // headless o con voci remote) NON scattano gli eventi onstart/onend.
  // Mentre siamo "in lettura" sondeamo lo stato reale dell'engine: quando
  // non c'è più nulla in corso (né speaking né pending) la lettura è
  // finita → il pulsante torna "Leggi" anche senza eventi.
  useEffect(() => {
    if (!supported || !speaking) return;
    const id = window.setInterval(() => {
      const s = window.speechSynthesis;
      if (!s.speaking && !s.pending) setSpeaking(false);
    }, 500);
    return () => window.clearInterval(id);
  }, [supported, speaking]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (window.speechSynthesis.speaking) {
      stop();
      return;
    }

    const text = getReadableText();
    if (!text) return;

    loadVoices();

    const chunks = splitSentences(text);
    const total = chunks.length;

    window.speechSynthesis.cancel(); // evita sovrapposizioni

    // ♿ Stato ottimistico: il pulsante passa subito a "Stop", senza
    // attendere l'evento onstart (che in alcuni browser non scatta mai).
    // Il ritorno a "Leggi" è garantito da onend/onerror dell'ultima frase
    // E dalla sonda periodica sopra (nel caso gli eventi non arrivino).
    setSpeaking(true);

    chunks.forEach((chunk, index) => {
      // ⭐ Riconoscimento automatico: ogni frase nella SUA lingua
      // (i pareggi vanno alla lingua preferita passata dall'app).
      const lang = detectLanguage(chunk, prefer);
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = UTTER_LANG[lang];
      utterance.rate = 0.95;
      utterance.pitch = 1;
      const voice = voicesByLang.get(lang) ?? null;
      if (voice) utterance.voice = voice;

      if (index === total - 1) {
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
      } else {
        // Se una frase intermedia fallisce, prosegue con le successive.
        utterance.onerror = () => undefined;
      }

      window.speechSynthesis.speak(utterance);
    });
  }, [supported, stop, prefer]);

  return { speaking, supported, toggle, stop };
}
