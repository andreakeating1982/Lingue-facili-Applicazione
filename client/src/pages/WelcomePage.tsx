import { useEffect, useState } from "react";
import { useLocation } from "wouter";

/** Formatta la data di oggi in formato italiano gg/mm/aaaa */
function getOggi(): string {
  const oggi = new Date();
  const gg = String(oggi.getDate()).padStart(2, "0");
  const mm = String(oggi.getMonth() + 1).padStart(2, "0");
  const aaaa = oggi.getFullYear();
  return `${gg}/${mm}/${aaaa}`;
}

/**
 * Prima pagina allineata a Widget-metacognitivo-per-il-calcolo-di-equazioni:
 * card #FAF8F5, bordo #E5E0D8, icona libro #F0E5DF/#8B3A1A, griglia 2x2 e
 * pulsante ENTRA (#8B3A1A attivo, #98644E disabilitato) + nota PRIVACY E IA.
 */
function loadSavedStudent() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("lingue-facili-studente") : null;
    if (!raw) return {};
    return JSON.parse(raw) as Partial<{ cognome: string; nome: string; data: string; classe: string }>;
  } catch {
    return {};
  }
}

export default function WelcomePage() {
  const [, navigate] = useLocation();
  const [cognome, setCognome] = useState(() => loadSavedStudent().cognome || "");
  const [nome, setNome] = useState(() => loadSavedStudent().nome || "");
  const [data, setData] = useState(() => loadSavedStudent().data || getOggi());
  const [classe, setClasse] = useState(() => loadSavedStudent().classe || "");

  /* Sulla prima pagina lo sfondo documento è bianco come nella cornice del blog,
     così il margine inferiore della cornice ha lo stesso colore della pagina. */
  useEffect(() => {
    document.documentElement.classList.add("lf-welcome-top", "lf-home");
    return () => {
      document.documentElement.classList.remove("lf-welcome-top", "lf-home");
    };
  }, []);

  const entra = () => {
    const params = new URLSearchParams();
    if (cognome.trim()) params.set("cognome", cognome.trim());
    if (nome.trim()) params.set("nome", nome.trim());
    if (data.trim()) params.set("data", data.trim());
    if (classe.trim()) params.set("classe", classe.trim());
    try {
      localStorage.setItem(
        "lingue-facili-studente",
        JSON.stringify({
          cognome: cognome.trim(),
          nome: nome.trim(),
          data: data.trim(),
          classe: classe.trim(),
        })
      );
    } catch {
      /* storage non disponibile: la query string basta */
    }
    navigate(`/setup?${params.toString()}`);
  };

  const canEnter = Boolean(nome.trim() && cognome.trim());

  return (
    <div className="lf-welcome flex flex-col items-center bg-background px-4 pb-8 sm:pb-12">
      <div className="flex w-full flex-col items-center pt-4 sm:pt-8">
        <div className="lf-welcome-card flex w-full max-w-[400px] flex-col items-center rounded-[20px] border border-[#E5E0D8] bg-[#FAF8F5] p-5 text-center shadow-[0_8px_25px_rgba(43,36,33,0.06)] md:p-6">
          {/* Icona libro — identica al Widget metacognitivo per il calcolo di equazioni */}
          <div className="lf-welcome-book mb-3 flex size-[44px] items-center justify-center rounded-[12px] bg-[#F0E5DF]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8B3A1A"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="12" y1="6" x2="12" y2="18" />
            </svg>
          </div>

          <h1 className="mb-1 text-lg font-bold tracking-wide text-[#2E2118]">
            LINGUE FACILI
          </h1>
          <p className="lf-welcome-sub mb-4 text-[11px] tracking-wide text-[#66564C]">
            ESERCIZI STRUTTURATI DI <strong className="font-bold text-[#8B3A1A]">LINGUE STRANIERE</strong>
          </p>

          {/* Cognome e Nome */}
          <div className="lf-student-grid mb-2 grid w-full grid-cols-2 gap-2">
            <input
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              placeholder="Cognome"
              aria-label="Cognome"
              autoComplete="family-name"
              className="min-h-[44px] min-w-0 w-full rounded-[10px] border border-[#D6CEC4] bg-[#FAF8F5] px-1.5 py-2.5 text-center text-[#2E2118] outline-none transition-all placeholder:text-[#66564C] focus:border-[#D4B2A0] sm:px-3"
              style={{ fontSize: "calc(14px * var(--lf-scale, 1))" }}
            />
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              aria-label="Nome"
              autoComplete="given-name"
              className="min-h-[44px] min-w-0 w-full rounded-[10px] border border-[#D6CEC4] bg-[#FAF8F5] px-1.5 py-2.5 text-center text-[#2E2118] outline-none transition-all placeholder:text-[#66564C] focus:border-[#D4B2A0] sm:px-3"
              style={{ fontSize: "calc(14px * var(--lf-scale, 1))" }}
            />
          </div>

          {/* Data e Classe */}
          <div className="lf-student-grid mb-2 grid w-full grid-cols-2 gap-2">
            <input
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="Data (es. 31/07/2026)"
              aria-label="Data"
              className="min-h-[44px] min-w-0 w-full rounded-[10px] border border-[#D6CEC4] bg-[#FAF8F5] px-1.5 py-2.5 text-center text-[#2E2118] outline-none transition-all placeholder:text-[#66564C] focus:border-[#D4B2A0] sm:px-3"
              style={{ fontSize: "calc(14px * var(--lf-scale, 1))" }}
            />
            <input
              value={classe}
              onChange={(e) => setClasse(e.target.value)}
              placeholder="Classe (es. 2A)"
              aria-label="Classe"
              className="min-h-[44px] min-w-0 w-full rounded-[10px] border border-[#D6CEC4] bg-[#FAF8F5] px-1.5 py-2.5 text-center text-[#2E2118] outline-none transition-all placeholder:text-[#66564C] focus:border-[#D4B2A0] sm:px-3"
              style={{ fontSize: "calc(14px * var(--lf-scale, 1))" }}
            />
          </div>

          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              if (canEnter) entra();
            }}
          >
            <button
              type="submit"
              disabled={!canEnter}
              aria-label="Entra e prepara l'esercizio"
              className="lf-enter-btn min-h-[44px] w-full rounded-[10px] py-2.5 font-bold tracking-wider text-white transition-all duration-200"
              style={{
                fontSize: "calc(14px * var(--lf-scale, 1))",
                lineHeight: "calc(20px * var(--lf-scale, 1))",
                backgroundColor: canEnter ? "#8B3A1A" : "#98644E",
                opacity: 1,
              }}
            >
              ENTRA
            </button>
          </form>

          <details className="lf-privacy mt-2.5 w-full text-center text-[#2E2118]" style={{ fontSize: "calc(12px * var(--lf-scale, 1))", lineHeight: 1.5 }}>
            <summary className="cursor-pointer font-normal uppercase underline underline-offset-3">
              PRIVACY E IA
            </summary>
            <p className="mt-2 text-center normal-case text-[#66564C] [overflow-wrap:anywhere]">
              Le foto, la registrazione vocale e il testo dell'esercizio possono essere inviati all'IA per la trascrizione e l'adattamento didattico. Non includere dati personali nel testo o nelle immagini.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
