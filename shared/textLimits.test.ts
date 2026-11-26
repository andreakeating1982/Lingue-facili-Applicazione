import { describe, expect, it } from "vitest";
import { countWords, firstWords, permitsTextEdit, MAX_EXERCISE_WORDS } from "./textLimits";
import { generateInputSchema } from "./exercise";

const words = (n: number) => Array.from({ length: n }, (_, i) => `parola${i + 1}`).join(" ");

describe("limite condiviso di 500 parole", () => {
  it("conta parole, numeri e apostrofi senza contare i soli segni", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  ___ / …  ")).toBe(0);
    expect(countWords("1. L’esercizio è blue-green; don't stop!")).toBe(6);
  });
  it("non permette la 501ª parola nelle modifiche manuali", () => {
    expect(permitsTextEdit("", words(MAX_EXERCISE_WORDS))).toBe(true);
    expect(permitsTextEdit(words(MAX_EXERCISE_WORDS), `${words(MAX_EXERCISE_WORDS)} altra`)).toBe(false);
    expect(permitsTextEdit(words(MAX_EXERCISE_WORDS), `${words(MAX_EXERCISE_WORDS)} estesa`)).toBe(false);
    expect(permitsTextEdit(words(MAX_EXERCISE_WORDS), words(MAX_EXERCISE_WORDS).replace(`parola${MAX_EXERCISE_WORDS}`, `parola${MAX_EXERCISE_WORDS}estesa`))).toBe(true);
  });
  it("consente di correggere le trascrizioni lunghe senza perdere parole", () => {
    expect(permitsTextEdit(words(MAX_EXERCISE_WORDS + 5), words(MAX_EXERCISE_WORDS + 4))).toBe(true);
    expect(permitsTextEdit(words(MAX_EXERCISE_WORDS + 5), words(MAX_EXERCISE_WORDS + 6))).toBe(false);
    expect(firstWords(`${words(MAX_EXERCISE_WORDS)} finale`, MAX_EXERCISE_WORDS)).toBe(words(MAX_EXERCISE_WORDS));
  });
  it("accetta testo da 1 o 2 caratteri e fino a 500 parole anche oltre i vecchi 6000 caratteri", () => {
    const longWords = Array.from({ length: MAX_EXERCISE_WORDS }, (_, i) => `${"lunghissima".repeat(3)}${i}`).join(" ");
    for (const text of ["a", "ok", longWords]) {
      expect(generateInputSchema.safeParse({ text, type: "reorder", lang: "en" }).success).toBe(true);
    }
    expect(longWords.length).toBeGreaterThan(6000);
    expect(generateInputSchema.safeParse({ text: "  ", type: "reorder" }).success).toBe(false);
    expect(generateInputSchema.safeParse({ text: words(MAX_EXERCISE_WORDS + 1), type: "reorder" }).success).toBe(false);
    expect(generateInputSchema.safeParse({ text: "x", adaptation: words(MAX_EXERCISE_WORDS + 1), type: "reorder" }).success).toBe(false);
  });
});

