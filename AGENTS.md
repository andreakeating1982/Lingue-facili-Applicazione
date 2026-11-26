# AGENTS.md — regole per agenti IA che lavorano in questa repository

Questa è **«LINGUE FACILI»**, app didattica multilingua (Vite + React + tRPC + PostgreSQL) per adattare esercizi BES in **riordino** o **scelta multipla con 2/3/4 opzioni**. Il docente sceglie la lingua solo nella seconda pagina, fornisce testo o foto ritagliabili e verifica/modifica la spiegazione obbligatoria proposta dall'IA. Può registrare 30 secondi o caricare audio; l'IA prepara anche traduzioni italiane, nascoste fino al clic. Lo studente vede un item per volta e scarica i PDF senza/con risposte. Preservare ASCOLTO e le viste delle schede preesistenti. Produzione: https://lingue-facili.easy-peasy.site (le modifiche locali possono non essere ancora pubblicate).

**Stato al 25 novembre 2026:** produzione **9656** (codice applicativo `4f9f9b4`), pubblicata su https://lingue-facili.easy-peasy.site dopo l'anteprima e il consenso esplicito dell'utente. Include: (1) sotto o pari a 10 domande l'IA adatta solo quelle presenti nell'originale senza mai aggiungerne altre, avvisando con pop-up solo oltre 10; (2) nella scelta multipla «Mostra traduzione» espone anche la traduzione italiana delle opzioni (`optionsTranslationIt` + endpoint `exercises.translateOptions` per le schede storiche); (3) stile, palette (`#8B3A1A` primario, `#FAF8F5` card, `#F2E7DE` opzioni/tessere, `#2E2118` inchiostro) e Alto Contrasto sono uniformati a `Widget-metacognitivo-per-il-calcolo-di-equazioni`, lasciando identici barra accessibilità e finestra di ritaglio. L'anteprima condivide il database reale con la produzione; intercettare sempre le API nei collaudi. Qualsiasi nuova pubblicazione richiede nuova anteprima e conferma separata.

## Comandi

```bash
pnpm dev        # sviluppo (porta 3000, server + HMR); non avvia DDL di schema
pnpm check      # controllo dei tipi (tsc --noEmit) — SEMPRE prima di consegnare
pnpm build      # build produzione (client vite + server esbuild → dist/)
pnpm start      # avvio produzione (PORT dalla piattaforma, default 3000)
pnpm test       # test vitest
# Su database NUOVO e vuoto, solo dopo verifica della destinazione: npx drizzle-kit push
# MAI reset, eliminazioni o migrazioni distruttive su dati reali senza consenso.
```

## Mappa dei file (tocca SOLO ciò che serve)

- `client/src/pages/` — WelcomePage (solo dati studente), SetupPage (lingua e bandiere, testo, foto/OCR, modalità e spiegazione obbligatoria), ExercisePage (un item alla volta, traduzione e PDF)
- `client/src/components/exercise/` — McView, TfView, MatchView, MatchItView, ReorderView + usePointerDrop + common.tsx (FEEDBACK_OK/KO)
- `client/src/components/AccessibilityToolbar.tsx` + `client/src/contexts/AccessibilityContext.tsx` — accessibilità
- `client/src/lib/` — exportWorkout.ts (PDF), heightSync.ts (embed), ocr.ts/ocrClean.ts/imagePrep.ts/cropBox.ts/upload.ts (OCR foto)
- `client/src/components/CropDialog.tsx`, `client/src/hooks/useCropDialogViewport.ts`, `client/src/lib/cropBox.ts` — logica di ritaglio originale 8731 del Widget metacognitivo; `client/src/photo-crop.css` — layout adattato alla foto richiesta; test geometrici e browser in `tests/crop-qa/`
- `server/inclusivePrompt.ts` + `inclusiveGeneration.ts` + `exerciseLimit.ts` — prompt, validazione e selezione delle prime 10; `aiAssist.ts` — descrizione preliminare, foto, traduzione e voce; `audioNormalize.ts` — conversione audio FFmpeg in memoria; `server/routers.ts`, `server/db.ts`, `server/storage.ts`
- `client/src/hooks/useAdaptationDescription.ts` — richieste IA con protezione delle modifiche e gestione delle risposte fuori ordine; `useTeacherVoice.ts` — registrazione max 30 s e file audio max 12 MB
- `shared/languages.ts` — ⭐ UNICA FONTE delle lingue (en/fr/es): titoli, tipologie, prompt AI, dizionari fallback, PDF
- `shared/exercise.ts` — tipologie, focus, validazione e conversioni; `shared/textLimits.ts` — contatori e limite di 500 parole condivisi
- `client/src/lib/lang.tsx` — contesto lingua (useLang) + localStorage
- `client/src/hooks/useAccessibleReadAloud.ts` — ASCOLTO: TTS sequenziale con lingue dichiarate e voce stabile per lingua
- `drizzle/` — schema (exercises con colonna `lang`) e migrazioni
- `cornice-dinamica/` — embed Blogger: `CODICE-3-ANTI-TREMOLIO-ANDROID.html` riproduce il codice del post verificato il 7 novembre 2026; `CODICE-3-BLOGGER-ESATTO.html`, dedicata precedente, lite e pagine di test sono riferimenti storici
- `scripts/` — script di verifica (verify-verbatim.mjs, test-*.ts)

## Invarianti assoluti (violazioni = regressione)

1. **Fedeltà alla fonte**: rispettare contenuto e ordine originali; escludere intestazioni/istruzioni dagli item, non inventare fatti, conservare le frasi già complete salvo traduzione richiesta o correzione OCR evidente. L'IA non garantisce esattezza semantica: il docente controlla il risultato.
2. **Errore esplicito IA**: non sostituire in silenzio un'attività richiesta con un ripiego non equivalente; se la generazione fallisce, consentire di correggere e riprovare.
3. **Due modalità**: `reorder` e `mc` con esattamente 2/3/4 opzioni e una risposta corretta nei nuovi esercizi. Per MC nessun numero preselezionato: prima scelta esplicita, poi richiesta e visualizzazione della spiegazione IA. Le 5 tipologie storiche restano leggibili: non cancellarle.
4. **Feedback** SEMPRE da `LANGS[lang].feedbackOK/feedbackKO` (shared/languages.ts): «Correct!», «Correct ! Bravo !», «¡Correcto!…» — MAI stringhe hardcodate nelle viste.
4-bis. **Lingue**: nessuna stringa di CONTENUTO in lingua fuori da `shared/languages.ts`; la riga DB (`exercises.lang`) è la fonte di verità per PDF e pagina finale.
4-ter. **ASCOLTO** (`useAccessibleReadAloud.ts`): lettura sequenziale dei contenuti visibili; interfaccia italiana e testi didattici con `lang` esplicito, una voce coerente per lingua, Stop e cancellazione. Non ripristinare l'euristica che cambia lingua in base a singole parole. Riprodurre `npm run ascolto` in `tests/crop-qa/` e verificare l'audio su dispositivi reali.
5. **Palette allineata al Widget equazioni** (index.css :root): crema `#F8F1E4`, inchiostro `#2E2118`, primario terracotta `#8B3A1A`, card `#FAF8F5`/`#FDFBF8`, bordi `#E5E0D8`, opzioni MC e tessere riordino `#F2E7DE` con bordo `#C9AD9A` e testo `#2E2118`, focus `#B71C1C`. **OpenDyslexic** auto-ospitato; scala 80–160% come nel blog e percorso operativo sempre almeno 14 pt. Barra accessibilità e finestra di ritaglio restano identiche alla produzione (`confronto-pulsanti-eccezioni.e2e.mjs`). Pagine 2 e 3: titoli centrati e maiuscoli, pulsanti centrati.
6. **`labvisivo:height`**: heightSync.ts + token `?cornice=`; coalescere le misure, confermare il valore stabile e sospenderle durante il gesto (`data-lf-gesture`) e il ritaglio. La cornice dedicata deve restare allineata all'app.
7. **Percorso progressivo**: pagina 1 senza lingue; pagina 2 prima lingua (Irlanda per inglese), quindi testo o 1–5 foto, poi «SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA» e «CREA L'ESERCIZIO». Nessun minimo di 3 caratteri: testo vuoto non crea; testo e spiegazione massimo 500 parole con contatori; massimo 10 frasi/domande per esercizio (una lacuna equivale a una domanda); se sono di più, adattare le prime 10 in ordine e avvisare con il pop-up, senza alterare la fonte integrale o le schede precedenti. Se il decimo cade dentro una frase con più lacune, conservarne solo i primi passi; mostrare le opzioni una alla volta. La prima pagina e la barra seguono proporzioni della foto Latino Facile: `lf-home` imposta solo lì la scala base a 16px, con campi ed ENTRA da 14px al 100%. I pulsanti d'azione sono marroni #B8846A; risposte MC e tessere del riordino sono chiare #F0E5DF con testo #5D4037, condivise con il PDF; il comando «Crea un nuovo esercizio» è il precedente testo scuro sottolineato con icona Home. La finestra di ritaglio resta invariata. L'IA propone una spiegazione obbligatoria e modificabile dopo testo/foto e scelta; non sovrascrivere le correzioni umane. Nessun suggerimento predefinito né pulsante «REGISTRA E TRASCRIVI».
8. **IA e privacy**: `server/_core/chat.ts` legge immagini e audio multimodale; non salvare fotografie o audio nell'app e non esporre chiavi o dati personali nei log. Registrazione max 30 s client e server: allo scadere si ferma e si trascrive senza clic. File audio max 12 MB; entrambi trascritti dall'IA. FFmpeg opera via pipe in memoria. Verificare arresto e rilascio microfono con `npm run voce` in `tests/crop-qa/`.
9. **Ritaglio con logica originale**: non riscrivere `confirm`, rotazione, `cropBox` o hook viewport del widget `5d7824409c4e445c077123b699b10f2191ff4d9d`. `CropDialog.tsx` aggiunge solo uno span alle etichette; `photo-crop.css` conserva l'aspetto compatto e dispone l'icona sopra il testo quando lo spazio è insufficiente. Non ridurre il font scelto né ammettere debordi o sovrapposizioni: `npm run ritaglio-layout` e `npm run confronto-widget` verificano entrambi gli aspetti. Mantenere `z-index: 51` sopra l'overlay `z-50`, `MIN_IMG_W=560` nei limiti dello schermo, normalizzazione EXIF/PNG e fallback alla foto originale. Su `data-lf-crop-open` bloccare i ping di altezza; ricalcolare su `lf:crop-closed`. Test: `tests/crop-qa/README.md`.
9-bis. **Riordino e cornice**: durante il trascinamento mantenere fermo il DOM delle parole già piazzate, spostando solo il fantasma e inserendo al rilascio nel rigo scelto; testare con `npm run riordino-mobile-stabile` nella cornice reale simulata. Non reintrodurre la barra CHI / COSA FA / OGNI QUANTO / IL RESTO. Tutte le tessere del riordino hanno la stessa palette neutra `REORDER_CHIP_PALETTE` in app e PDF, anche con ruoli diversi; non ripristinare la legenda dei colori grammaticali. Per il blog usare `CODICE-3-ANTI-TREMOLIO-ANDROID.html`, corrispondente al post verificato il 7 novembre 2026: include standard pulsanti, icone da 16px, etichette visibili e ping di conferma dell'altezza; non confonderlo con la vecchia dedicata. Testare `npm run riordino-senza-legenda` e `npm run cornice-blog`; `npm run icone-cornice` riguarda la vecchia variante. Per future modifiche della cornice aggiornare il post separatamente dall'app e solo con autorizzazione.
9-ter. **Impaginazione PDF:** mantenere `PAGE_BOTTOM = 50` in `client/src/lib/exportWorkout.ts`, condiviso da `ensure()` e dalla paginazione del riordino. Il piè di pagina è a y=24; verificare spazio, assenza di sovrapposizioni e correttezza con `scripts/test-impaginazione-piena.ts` e `scripts/verifica-impaginazione-piena.py`, usando solo fixture sintetiche. Non promettere il riempimento perfetto di qualunque pagina: gli item hanno altezze variabili.
10. **Dati reali**: mai usare `pnpm db:reset`, né eseguire script storici distruttivi come `scripts/fix-db.mjs` se presenti in una vecchia copia. Migrazioni distruttive solo dopo consenso esplicito.

## Flusso di lavoro per ogni modifica

1. Leggi `README.md` e la guida pertinente (`REBUILD.md`, `ADATTARE.md`, `ACCESSIBILITA.md`).
2. Modifica il minimo indispensabile (per varianti di lingua: SOLO i punti di `ADATTARE.md`; per cambiare i testi di una lingua: SOLO `shared/languages.ts`).
3. `pnpm check` (+ `pnpm test` se tocchi server/shared).
4. Collaudare senza alterare dati reali: due modalità, 2/3/4 opzioni, più foto e ritaglio mobile, voce, traduzione mostrata/nascosta, una frase per volta, PDF e schermata finale a 5 stelle. Per le prime 10 eseguire `pnpm test`, `cd tests/crop-qa && npm run prime-dieci` e, se autorizzato, `pnpm exec tsx scripts/test-prime-dieci-ia.ts` con soli dati sintetici, senza salvataggi.
5. Deploy: preview prima; produzione solo dopo checkpoint e conferma dell'utente. Su Render: `git push` (autoDeploy).

## Igiene del repository e del pacchetto

- MAI committare: `.env` (segreti), `node_modules/`, `dist/`, `data/`, `dev-server.log`, `template.json`, `.DS_Store`.
- Mantieni intatti: `pnpm-lock.yaml`, `patches/` (install riproducibile con `--frozen-lockfile`).
- Se modifichi misure di accessibilità, aggiorna `ACCESSIBILITA.md`.
- Se cambi URL dell'app, aggiorna: `cornice-dinamica/*.html` (APP_URL), `RENDER.md`, `README.md`.

## Varianti

Per creare una variante dell'app (nuova lingua straniera: francese, spagnolo, tedesco…; testi; limiti) segui SOLO `ADATTARE.md` — mai riscritture d'architettura.
