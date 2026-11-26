/**
 * Lingua selezionata dell'app: contesto React + localStorage.
 *
 * La lingua si sceglie nella seconda pagina (SetupPage) e viene usata da
 * tutto il flusso (esercizio, PDF, OCR, generazione AI). Quando
 * l'esercizio è caricato dal database la riga sa già la sua lingua e la
 * pagina esercizio la ri-applica (fonte di verità = riga DB).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LANG_CODES, langConfig, type LangCode, type LangConfig } from "@shared/languages";

const STORAGE_KEY = "lingue-facili-lang";

function readLang(): LangCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (LANG_CODES as string[]).includes(v)) return v as LangCode;
  } catch {
    /* storage non disponibile */
  }
  return "en";
}

interface LangCtx {
  lang: LangCode;
  /** Config completa della lingua attiva. */
  L: LangConfig;
  setLang: (l: LangCode) => void;
}

const Ctx = createContext<LangCtx>({ lang: "en", L: langConfig("en"), setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(readLang);

  const setLang = (l: LangCode) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage non disponibile */
    }
    setLangState(l);
  };

  /* Il titolo del documento segue la lingua. */
  useEffect(() => {
    document.title = "Lingue Facili";
  }, []);

  return <Ctx.Provider value={{ lang, L: langConfig(lang), setLang }}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}
