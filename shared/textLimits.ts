/** Limiti comuni al modulo studente/docente e alle API dell'app. */
export const MAX_EXERCISE_WORDS = 500;
// Soltanto una protezione tecnica contro input anomali, non il vecchio
// limite di 6000/2000 caratteri: la regola visibile rimane 500 parole.
export const MAX_INPUT_CHARACTERS = 100_000;

// Una parola contiene lettere o cifre. Apostrofi e trattini interni restano
// parte della stessa parola; segni isolati e lacune ___ non sono parole.
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+(?:['’\u2010\u2011-][\p{L}\p{M}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return Array.from(text.matchAll(WORD_PATTERN)).length;
}

/** Tronca soltanto suggerimenti generati dall'IA, mai le note del docente. */
export function firstWords(text: string, maxWords: number): string {
  if (maxWords <= 0) return "";
  const matches = Array.from(text.matchAll(WORD_PATTERN));
  if (matches.length <= maxWords) return text;
  return text.slice(0, matches[maxWords].index).trimEnd();
}

/** Un input scritto o incollato non può creare una 301ª parola.
 * Una trascrizione IA ricevuta oltre il limite rimane visibile e può essere
 * corretta: in tal caso si consentono modifiche che non aumentano le parole. */
export function permitsTextEdit(previous: string, next: string): boolean {
  if (next.length > MAX_INPUT_CHARACTERS && next.length > previous.length) return false;
  const nextWords = countWords(next);
  const previousWords = countWords(previous);
  return nextWords <= MAX_EXERCISE_WORDS || (previousWords > MAX_EXERCISE_WORDS && nextWords <= previousWords);
}

