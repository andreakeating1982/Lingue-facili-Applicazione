# ADATTARE — Creare varianti di «LINGUE FACILI»

**Regola d'oro: MAI riscrivere l'architettura inutilmente.** Conservare le due modalità (`reorder` e `mc` con 2/3/4 opzioni), input foto/voce, traduzione facoltativa, PDF, accessibilità e cornice. Le 5 `ExerciseType` restano nello schema per la compatibilità. Dopo ogni variante: `pnpm check && pnpm test && pnpm build`, test desktop/mobile e preview; produzione solo dopo conferma separata.

**Principio architetturale da rispettare sempre:** tutto ciò che dipende dalla lingua del CONTENUTO vive in `shared/languages.ts` (unica fonte di verità, client e server). La UI per l'insegnante resta in italiano.

**Sorgente di questa variante: produzione 9656 del 25 novembre 2026**, codice applicativo `4f9f9b4`. Le fonti fino a 10 domande adattano solo quelle presenti nell'originale senza mai aggiungerne altre; oltre 10 generano le prime 10 e un pop-up segnala quelle escluse. Nella scelta multipla «Mostra traduzione» include le opzioni tradotte in italiano; stile e palette sono uniformati al Widget equazioni (`#8B3A1A`, `#FAF8F5`, `#F2E7DE`, `#2E2118`). I cinque pulsanti foto/audio restano impilati e di pari larghezza; barra inclusività e ritaglio restano invariati salvo richiesta esplicita. Non pubblicare nuove varianti senza una nuova anteprima e approvazione.

---

## Scenario 1 (principale): aggiungere una QUARTA lingua (es. TEDESCO)

Obiettivo: il selettore della seconda pagina include anche la nuova lingua, con bandiera, e tutto il flusso funziona. La prima pagina resta senza selettore; estendere solo i punti necessari.

### Punti da modificare, in ordine

| # | File | Cosa fare |
|---|---|---|
| 1 | `shared/languages.ts` | Aggiungi il codice a `LangCode`, `LANG_CODES`, `LANG_LABELS`, `LANG_ACCENT`; crea `const DE: LangConfig = {...}` copiando EN come base (~200 righe: `appTitle` «DEUTSCH LEICHT» o «TEDESCO FACILE», sottotitolo, welcomeTesti, cropHint, placeholder testo, feedbackOK/KO, checkBtn, istruzioni PDF, `typeCards` (servono solo agli esercizi vecchi), persona ed esempi del prompt AI, dizionari di riserva) e registrala in `LANGS`. Aggiorna il selettore `LANGUAGE_ORDER`/`FLAG_FILES` in SetupPage e aggiungi il file SVG in `client/public/flags/` con la relativa licenza. |
| 2 | `client/public/tessdata/` | Scarica il modello da [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (es. `deu.traineddata`), comprimilo con gzip e mettilo accanto a eng/fra/spa. |
| 3 | `client/src/lib/ocr.ts` | Aggiungi la lingua alla mappa dei worker (es. `deu`). Ricorda: **un worker PER lingua** (invariante 6 di REBUILD.md). |
| 4 | `shared/exercise.ts`, `server/routers.ts`, `client/src/pages/SetupPage.tsx`, `ExercisePage.tsx` | Estendi tutte le enum/guardie esplicite en/fr/es e `langConfig` in `shared/languages.ts`; verifica l'inoltro della lingua ai prompt IA e il ripristino dalla riga DB. |
| 5 | `client/src/hooks/useAccessibleReadAloud.ts` (ASCOLTO) | Estendi tipi e mappa BCP-47 per la nuova lingua; marca frasi e opzioni con `lang` e il testo sorgente con `data-tts-value-lang`. Mantieni la coda sequenziale e una voce per lingua. |
| 6 | `cornice-dinamica/` | Per l'embed attuale usa `CODICE-3-ANTI-TREMOLIO-ANDROID.html`: serve l'APP, non una lingua. Se cambia l'URL, aggiorna `APP_URL` e i due URL dei font come spiegato in `RENDER.md`. |

### Test rapidi della nuova lingua

- ASCOLTO: verifica tre frasi con `lang` dichiarato, interfaccia italiana, sequenza delle voci e Stop; prova anche su un dispositivo reale.
- OCR: fotografa una scheda nella nuova lingua → trascrizione con accenti corretti.
- PDF: titolo e istruzioni della nuova lingua; nessun residuo.

---

## Scenario 2: cambiare i TESTI di una lingua esistente (titoli, tipologie, feedback, prompt)

Tocca SOLO `shared/languages.ts`. Esempi: cambiare il titolo («SPAGNOLO FACILE» → «ESPAÑOL FÁCIL»), rinominare una tipologia, cambiare feedback, aggiungere argomenti ai placeholder/chip dei focus. Nessun'altra file va toccato: le pagine leggono tutto via `langConfig()`/`useLang()`.

⚠️ Se cambi `appTitle`, aggiorna anche: `client/index.html` (`<title>`), la cornice in `cornice-dinamica/` (`<p class="lf-titolo">`) e il DOCX dei codici embed (Codice 3), se usato.

---

## Scenario 3: cambiare i LIMITI di input o le regole di fattibilità

I limiti correnti della produzione 9248 sono **testo non vuoto**, **massimo 500 parole** nel testo originale e nella spiegazione, **massimo 5 foto** e **10 frasi/domande** per scheda nuova; ogni lacuna di scelta multipla conta una domanda. Per più di 10, mantenere le prime 10 in ordine e mostrare il pop-up: il resto non entra nella scheda, ma il testo sorgente rimane integro. La costante e il taglio sono in `server/exerciseLimit.ts`, il prompt e la validazione in `inclusivePrompt.ts`/`inclusiveGeneration.ts`, l'avviso in `SetupPage.tsx`. Le schede precedenti restano intatte. Conteggio parole e protezione di 100.000 caratteri: `shared/textLimits.ts`; il limite foto è nella UI. Se foto/audio superano 500 parole conservarli visibili e chiedere di ridurre il testo. Il riconoscimento dipende dall'IA: controllare sempre risultato e soluzioni. L'endpoint storico `checkTypes` non è il percorso corrente.

---

## Scenario 4: clonare l'app in una MONO-lingua (es. solo Spagnolo)

Se serve una variante a lingua singola, NON eliminare il layer `languages.ts`: configura il solo codice richiesto in `LANG_CODES` e nel selettore `LANGUAGE_ORDER` della seconda pagina, preselezionalo e nascondi il selettore se non serve. Verifica i validatori e i prompt IA. Titolo PDF: `LANGS[lang].appTitle`.

---

## Checklist finale di QUALSIASI variante

- [ ] `pnpm check` e `pnpm build` senza errori
- [ ] Per OGNI lingua: generare sia riordino sia scelta multipla (2/3/4), verificando che l'IA attenda la scelta esplicita del numero; verificare fonte, numero item/opzioni, traduzioni e una domanda alla volta
- [ ] Un esercizio VECCHIO salvato (altra tipologia) si apre ancora e genera il suo PDF
- [ ] Feedback e colonna sinistra matchIt nella lingua scelta; colonna ITALIANO intatta
- [ ] Selettore lingua aggiornato; passaggio da una lingua all'altra pulito (localStorage + riga DB)
- [ ] PDF con il titolo della lingua; parole del riordino IN DISORDINE, con lo stesso stile neutro e lo STESSO disordine nelle due versioni; nessun residuo del vecchio titolo (`grep -rn "VECCHIOTITOLO" client/src server shared cornice-dinamica` → zero risultati)
- [ ] Barra accessibilità con 5 moduli, ASCOLTO Leggi/Stop funzionante (anche per la nuova lingua se aggiunta)
- [ ] Ritaglio 8731 con logica del Widget metacognitivo e layout personalizzato: foto, otto maniglie, tastiera, ruota, PNG e cornice mobile; seguire `tests/crop-qa/README.md` e preservare `data-lf-crop-open`/`lf:crop-closed`
- [ ] Preview verificata; eventuale produzione solo dopo checkpoint e consenso esplicito successivo
- [ ] Cornice dinamica testata nel browser (copiala in `client/public/test-cornice.html`)

## Cosa NON cambiare MAI (in qualunque variante)

La fedeltà alla fonte verificata dal docente, le due modalità di creazione, il numero selezionabile di opzioni, la traduzione nascosta fino alla richiesta, le tipologie storiche, la palette, OpenDyslexic, la logica del ritaglio originale 8731 con hook, layout accessibile e coda foto, `labvisivo:height`, ASCOLTO, i PDF con e senza risposte, le cinque stelle, i pulsanti marroni e la colonna `lang` nel database.
