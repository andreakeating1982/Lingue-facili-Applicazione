/* Debug: perché i fallback mc/tf/reorder falliscono sul testo puntinato? */
const TEXT_PHOTO =
  "1. Kate ............... a brother. 2. I ............... two sisters. 3. Susan ............... a new umbrella. 4. Peter ............... a cat.";

function rawSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const parts = rawSentences(TEXT_PHOTO);
console.log("frasi grezze:", JSON.stringify(parts, null, 1));
const withWords = parts.map((s) => [s.split(/\s+/).length, s]);
console.log("conteggio parole per frase:", withWords.map(([n, s]) => `${n}: ${s}`));
const usable = parts.filter((s) => s.split(/\s+/).length >= 4);
console.log("utilizzabili (>=4 parole):", usable.length);
