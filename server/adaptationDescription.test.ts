import { beforeEach, describe, expect, it, vi } from "vitest";

const { chatCompletion } = vi.hoisted(() => ({ chatCompletion: vi.fn() }));
vi.mock("./_core/chat", () => ({ chatCompletion, chatVision: vi.fn(), chatAudioTranscription: vi.fn() }));
import { describeExerciseAdaptation } from "./aiAssist";

beforeEach(() => chatCompletion.mockReset());

describe("spiegazione preliminare dell'adattamento", () => {
  it("descrive contenuto e scelta multipla con il numero di opzioni scelto", async () => {
    chatCompletion.mockResolvedValueOnce(JSON.stringify({ description: "L'esercizio chiede di completare i verbi. Adattalo a scelta multipla con due opzioni." }));
    const description = await describeExerciseAdaptation({
      text: "1. Ella ___ una manzana. (come / comen)", lang: "es", mode: "mc", optionsCount: 2,
    });
    expect(description).toContain("due opzioni");
    const options = chatCompletion.mock.calls[0][0];
    expect(options.messages[1].content).toContain("SCELTA MULTIPLA con esattamente 2 opzioni");
    expect(options.messages[1].content).toContain("Ella ___ una manzana");
    expect(options.messages[0].content).toContain("non inventare");
  });

  it("usa il riordino, include le indicazioni già fornite e non espone blocchi markdown", async () => {
    chatCompletion.mockResolvedValueOnce('```json\n{"description":"Riconosco frasi al presente. Riordina le parole."}\n```');
    const description = await describeExerciseAdaptation({
      text: "I eat an apple.", lang: "en", mode: "reorder", optionsCount: 3,
      teacherNotes: "Usa solo frasi al presente.",
    });
    expect(description).toBe("Riconosco frasi al presente. Riordina le parole.");
    const prompt = chatCompletion.mock.calls[0][0].messages[1].content;
    expect(prompt).toContain("RIORDINO DELLE PAROLE");
    expect(prompt).toContain("Usa solo frasi al presente.");
  });

  it("mostra errore quando l'IA non fornisce testo", async () => {
    chatCompletion.mockResolvedValue("   ");
    await expect(describeExerciseAdaptation({ text: "Je parle.", lang: "fr", mode: "reorder", optionsCount: 3 })).rejects.toThrow("non ha prodotto una spiegazione");
    expect(chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("non mostra frammenti di ragionamento: ritenta e usa soltanto il JSON valido", async () => {
    chatCompletion.mockResolvedValueOnce("* Explains original task? Yes. * Expl")
      .mockResolvedValueOnce(JSON.stringify({ description: "L'esercizio contiene una frase. Riordina le parole." }));
    const result = await describeExerciseAdaptation({ text: "I eat.", lang: "en", mode: "reorder", optionsCount: 3 });
    expect(result).toBe("L'esercizio contiene una frase. Riordina le parole.");
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(chatCompletion.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(2000);
  });

  it("rifiuta JSON vuoti o privi di descrizione invece di mostrarli all'utente", async () => {
    chatCompletion.mockResolvedValueOnce('{"description":""}').mockResolvedValueOnce('{"answer":"yes"}');
    await expect(describeExerciseAdaptation({ text: "Je parle.", lang: "fr", mode: "reorder", optionsCount: 3 })).rejects.toThrow("spiegazione valida");
  });
});

