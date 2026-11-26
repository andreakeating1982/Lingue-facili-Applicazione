import { useCallback, useEffect, useRef, useState } from "react";

/** ASCOLTO: lettura sequenziale ispirata al Widget metacognitivo 9213.
 * Le zone didattiche dichiarano la loro lingua tramite lang; l'interfaccia è
 * italiana. Non affidarsi a indizi lessicali per cambiare voce a ogni frase. */
type Language = "it" | "en" | "fr" | "es";
type Segment = { text: string; language: Language };
const TAGS_TO_SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CANVAS", "SVG", "IFRAME"]);
const BLOCKS = new Set(["DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "SECTION", "ARTICLE", "HEADER", "MAIN", "FOOTER", "UL", "OL", "TABLE", "TR", "BR"]);
const LOCALE: Record<Language, string> = { it: "it-IT", en: "en-US", fr: "fr-FR", es: "es-ES" };

function languageOf(value: string | null | undefined, fallback: Language): Language {
  const primary = (value || "").toLowerCase().split(/[-_]/)[0];
  return primary === "it" || primary === "en" || primary === "fr" || primary === "es" ? primary : fallback;
}
function naturalCase(text: string): string {
  return text.replace(/\p{Lu}{2,}/gu, word => word.toLocaleLowerCase()).replace(/\s+/g, " ").trim();
}

/** Raccoglie SOLO quanto attualmente visibile, anche pulsanti e campi come nel
 * widget; non include mai traduzioni chiuse, toolbar o input file/password. */
export function readableSegments(root: HTMLElement = document.body): Segment[] {
  const result: Segment[] = [];
  let buffer = "";
  let current: Language = "it";
  const flush = () => {
    const text = naturalCase(buffer);
    if (text) result.push({ text, language: current });
    buffer = "";
  };
  const append = (text: string, language: Language) => {
    if (!text) return;
    if (buffer && current !== language) flush();
    current = language;
    buffer += text;
  };
  const announce = (text: string, language: Language = "it") => {
    flush();
    append(text, language);
    flush();
  };
  const walk = (node: Node, inherited: Language) => {
    if (node.nodeType === Node.TEXT_NODE) { append(node.textContent || "", inherited); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (TAGS_TO_SKIP.has(el.tagName) || el.getAttribute("role") === "toolbar") return;
    if (el.hidden || el.hasAttribute("inert") || el.getAttribute("aria-hidden") === "true" || el.classList.contains("sr-only")) return;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden") return;
    const language = languageOf(el.getAttribute("lang"), inherited);

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const input = el as HTMLInputElement;
      if (["hidden", "file", "password", "radio", "checkbox"].includes(input.type)) return;
      const label = input.getAttribute("aria-label")?.trim() || input.labels?.[0]?.textContent?.trim() || input.getAttribute("placeholder")?.trim() || "Campo di testo";
      announce(`Campo ${label}.`, "it");
      if (input.value.trim()) announce(input.value.trim(), languageOf(input.dataset.ttsValueLang, language));
      return;
    }
    if (el.tagName === "SELECT") {
      const selected = (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim();
      if (selected) announce(selected, language);
      return;
    }
    if (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button") {
      const label = el.dataset.ttsLabel || el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "";
      const clean = label.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D✓✎✨▸▶]+/u, "").replace(/\s+/g, " ").trim();
      if (clean) {
        announce(el.tagName === "A" ? "Collegamento." : "Pulsante.", "it");
        announce(clean, language);
        if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") announce("Non disponibile.", "it");
      }
      return;
    }
    // La lacuna grafica resta una pausa nella frase straniera: non viene letta
    // la risposta corretta e non si cambia voce a metà della stessa frase.
    if (el.getAttribute("aria-label") === "spazio da completare") { append(" … ", language); return; }
    if (el.classList.contains("katex")) {
      const formula = el.querySelector(".katex-html") as HTMLElement | null;
      if (formula?.innerText) append(formula.innerText, language);
      return;
    }
    const block = BLOCKS.has(el.tagName);
    if (block) flush();
    for (const child of Array.from(el.childNodes)) walk(child, language);
    if (block) flush();
  };
  walk(root, "it");
  flush();
  return result;
}

/** Segmenti brevi: evitano interruzioni dei motori vocali su mobile. */
export function splitForSpeech(text: string): string[] {
  const max = 180;
  const out: string[] = [];
  let rest = text.replace(/\s+/g, " ").trim();
  while (rest.length > max) {
    const prefix = rest.slice(0, max + 1);
    const mark = [...prefix.matchAll(/[.!?;:]\s+/g)].pop();
    let cut = mark && mark.index! >= max / 2 ? mark.index! + 1 : prefix.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}
function selectVoice(voices: SpeechSynthesisVoice[], lang: Language): SpeechSynthesisVoice | null {
  const candidates = voices.filter(voice => languageOf(voice.lang, "it") === lang && voice.lang.toLowerCase().startsWith(lang));
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    return (/natural|neural|premium|enhanced/.test(name) ? 5 : 0) + (/google|microsoft|apple/.test(name) ? 3 : 0) + (voice.localService ? 1 : 0);
  };
  return [...candidates].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0] ?? null;
}

export function useAccessibleReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const timer = useRef<number | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const clearWatchdog = () => { if (timer.current !== null) window.clearTimeout(timer.current); timer.current = null; };
  // Come nel widget di riferimento: molti browser caricano la lista voci in
  // modo asincrono; chiedila all'avvio, prima del clic dell'utente su Leggi.
  useEffect(() => {
    if (supported) window.speechSynthesis.getVoices();
  }, [supported]);
  const stop = useCallback(() => {
    if (!supported) return;
    generation.current++;
    active.current = false;
    clearWatchdog();
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => {
    window.addEventListener("ascolto:contenuto-cambiato", stop);
    return () => { window.removeEventListener("ascolto:contenuto-cambiato", stop); generation.current++; active.current = false; clearWatchdog(); if (supported) window.speechSynthesis.cancel(); };
  }, [stop, supported]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (active.current) { stop(); return; }
    const chunks = readableSegments().flatMap(segment => splitForSpeech(segment.text).map(text => ({ ...segment, text })));
    if (!chunks.length) return;
    const synth = window.speechSynthesis;
    // Una voce fissa per lingua durante tutta la lettura. Se non è disponibile
    // una voce specifica, lasciar scegliere al browser in base al locale.
    const voices = synth.getVoices();
    const chosen = Object.fromEntries((["it", "en", "fr", "es"] as Language[]).map(lang => [lang, selectVoice(voices, lang)])) as Record<Language, SpeechSynthesisVoice | null>;
    const id = ++generation.current;
    synth.cancel();
    active.current = true;
    setSpeaking(true);
    const next = (index: number) => {
      if (!active.current || generation.current !== id) return;
      clearWatchdog();
      if (index >= chunks.length) { active.current = false; setSpeaking(false); return; }
      const chunk = chunks[index];
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = LOCALE[chunk.language];
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (chosen[chunk.language]) utterance.voice = chosen[chunk.language];
      let finished = false;
      const advance = () => {
        if (finished || !active.current || generation.current !== id) return;
        finished = true;
        next(index + 1);
      };
      utterance.onend = advance;
      utterance.onerror = event => {
        if (event.error === "interrupted" || event.error === "canceled") {
          if (active.current && generation.current === id) { active.current = false; clearWatchdog(); setSpeaking(false); }
        } else advance();
      };
      synth.speak(utterance);
      // Solo per motori che non inviano onend: non saltare mentre stanno
      // ancora parlando; la verifica dopo 4 secondi evita falsi avvii lenti.
      const checkIdle = () => {
        if (finished || !active.current || generation.current !== id) return;
        if (!synth.speaking && !synth.pending) advance();
        else timer.current = window.setTimeout(checkIdle, 1000);
      };
      timer.current = window.setTimeout(checkIdle, 4000);
    };
    next(0);
  }, [supported, stop]);
  return { speaking, supported, toggle, stop };
}

