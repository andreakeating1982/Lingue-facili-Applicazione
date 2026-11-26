# REBUILD — Ricostruire questa identica app

Guida per un agente IA (o per uno sviluppatore): ricostruire **«LINGUE FACILI» identica** partendo da questa repository GitHub, senza inventare nulla. Per creare VARIANTI (es. aggiungere una quarta lingua) leggi `ADATTARE.md`, NON questa guida.

## Cos'è questa app

App didattica **multi-lingua** (INGLESE, FRANCESE, SPAGNOLO). Il docente sceglie la lingua nella seconda pagina, inserisce testo o foto ritagliabili e sceglie **riordino** oppure **scelta multipla con 2/3/4 opzioni**. L'IA prepara una spiegazione modificabile, integrabile con registrazione fino a 30 secondi o file audio; dopo la conferma genera gli item e la traduzione italiana; lo studente vede un elemento alla volta, può mostrare/nascondere la traduzione e scarica PDF con o senza risposte.

Le 5 `ExerciseType` (mc, tf, match, matchIt, reorder) e le vecchie viste vanno conservate: ora `mc` e `reorder` sono anche le due modalità di creazione.

**Principio di fedeltà:** preservare il contenuto e l'ordine originale, non inventare fatti, saltare le istruzioni non destinate agli studenti; correggere solo evidenti errori di lettura o tradurre se richiesto. La correttezza semantica dell'IA non è garantita: il docente controlla sempre.

**Principio architetturale:** TUTTO ciò che dipende dalla lingua del CONTENUTO vive in `shared/languages.ts` (unica fonte di verità per client e server). La UI per l'insegnante resta in italiano.

Stack: Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui + tRPC 11 + Drizzle + PostgreSQL + Express 4 (scaffold web-db-user).

**Versione di questo pacchetto: produzione 9656 del 25 novembre 2026**, codice applicativo del checkpoint `4f9f9b4`, pubblicato su https://lingue-facili.easy-peasy.site dopo l'approvazione dell'anteprima. Rispetto alla precedente 9248: (1) sotto o pari a 10 domande l'IA adatta esclusivamente quelle presenti nell'originale senza aggiungerne altre, avvisando con pop-up solo oltre 10; (2) nella scelta multipla la traduzione facoltativa mostra anche le opzioni in italiano (`optionsTranslationIt` + fallback `exercises.translateOptions`); (3) palette (`#8B3A1A`, `#FAF8F5`, `#F2E7DE`, `#2E2118`), focus `#B71C1C`, righello e Alto Contrasto sono uniformati a `Widget-metacognitivo-per-il-calcolo-di-equazioni`, lasciando invariati barra di accessibilità e finestra di ritaglio.

**Produzione precedente: 9248 del 14 novembre 2026**, codice applicativo del checkpoint `db65943`, pubblicato dopo l'approvazione dell'anteprima. Per le nuove schede, se la fonte supera 10 frasi/domande, generare le prime 10 nell'ordine e avvisare nel pop-up che le successive non sono incluse. Una lacuna MC conta una domanda; se il confine cade in una frase, il server la interrompe prima della prima lacuna esclusa. La fonte integrale è conservata, anche nel campo `sourceText` della scheda salvata. Le vecchie schede non sono accorciate. I limiti di 500 parole per campo e 5 foto restano. Il contenuto è identificato dall'IA: controllare fedeltà e soluzioni; non promettere generazione con IA indisponibile o testo illeggibile.

**Versione precedente 9247:** checkpoint `de74df9`, comprendeva già i pulsanti foto/audio impilati e i PDF senza icone, ma non la selezione automatica. La ricostruzione del pacchetto non autorizza nuove pubblicazioni. L'anteprima condivide il database con la produzione; il collaudo automatizzato intercetta le API e non salva record. Barra inclusività, ritaglio e cornice non sono stati cambiati. Test pulsanti: `cd tests/crop-qa && npm run pulsanti-impilati`; test avviso: `npm run prime-dieci`.

## Prerequisiti

- Node.js **22**
- pnpm **10.4.1** esatto (fornito da `corepack`, vedi campo `packageManager` di `package.json`)
- PostgreSQL raggiungibile (locale, Neon, Render…)
- `EASY_PEASY_API_KEY` per creare nuovi adattamenti e usare la lettura IA delle foto. Senza l'IA non viene costruito un esercizio di ripiego non equivalente.
- Per registrazione e file audio: stessa `EASY_PEASY_API_KEY` e modello multimodale; `ffmpeg-static` (licenza GPL-3.0-or-later) viene installato tramite il postinstall consentito in `package.json` ed è usato via pipe per i formati non nativi e il limite di 30 s. Server Node compatibile, connessione al download del binario e nessuno storage del file; scrittura manuale sempre possibile.

## Passaggi (esatti)

```bash
# 1. Clona la repository
git clone https://github.com/<utente>/lingue-facili.git lingue-facili
cd lingue-facili

# 2. Abilita pnpm alla versione ESATTA di package.json
corepack enable

# 3. Installa le dipendenze riproducibili (mai --no-frozen-lockfile)
pnpm install --frozen-lockfile

# 4. Crea il .env (MAI committato) e impostalo
cp .env.example .env
#   DATABASE_URL=postgres://utente:password@host:5432/db
#   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
#   TRUSTED_ORIGINS=http://localhost:3000

# 5. Crea/aggiorna lo schema del database
#    ⚠️ Su un database VUOTO usa il push DIRETTO dello schema:
npx drizzle-kit push
#    (lo script `pnpm db:push` = generate+migrate è pensato per database
#     con la catena di migrazioni già applicata: su un DB nuovo fallisce
#     perché le migrazioni storiche ereditate non sono riapplicabili)

# 6. Controllo dei tipi (deve passare senza errori)
pnpm check

# 7. Build di produzione (client Vite + server esbuild → dist/)
pnpm build

# 8. Avvio produzione (la piattaforma può impostare PORT, default 3000)
PORT=3000 pnpm start
```

Sviluppo: `pnpm dev` (server Express + Vite HMR sulla porta 3000).

## Contratto di verifica (tutto deve essere VERO dopo la ricostruzione)

1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` restituisce **200** e la shell HTML. Aprire nel browser: prima pagina con dati studente e senza lingue; dopo ENTRA, nella seconda pagina, tre radio con bandiere (Irlanda per inglese, Spagna, Francia). Il solo HTML restituito da curl non contiene l'interfaccia React.
2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/fonts/OpenDyslexic-Regular-v2.woff2` → **200** (idem per `OpenDyslexic-Bold-v2.woff2`).
3. I modelli OCR esistono e si servono: `http://localhost:3000/tessdata/eng.traineddata.gz`, `.../fra...`, `.../spa...` → **200**.
4. Inserisci i dati nella prima pagina e premi ENTRA; scegli inglese, spagnolo o francese nella seconda pagina.
5. In `/setup`: inizialmente mostra solo le lingue; scelta la lingua compare il testo con la dicitura «Puoi aggiungere da 1 a 5 foto». Inserito testo non vuoto appare «SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA» con modalità e poi «CREA L'ESERCIZIO». Testo e spiegazione: massimo 500 parole ciascuno, contatore accessibile; non imporre il vecchio minimo di 3 caratteri. Scegli riordino oppure scelta multipla; in quest'ultimo caso nessun numero è preselezionato e la spiegazione non è richiesta né mostrata finché non si scelgono esplicitamente 2, 3 o 4 opzioni. Correggi la spiegazione proposta, eventualmente registra max 30 s o carica un audio. Allo scadere dei 30 s la registrazione viene trascritta automaticamente dall'IA. Non esistono i quattro suggerimenti. Verifica fedeltà, risposte e traduzioni.
6. Il **riordino** funziona con mouse, dito/penna (tap e drag, multi-touch, scroll bloccato durante il gesto) e tastiera (Enter/Spazio); l'inserimento è consapevole del RIGO: con frase su due righe, il rilascio all'estrema sinistra/fine della SECONDA riga va nella riga giusta. Durante il trascinamento il fantasma segue il dito, il DOM resta stabile e la tessera cambia posizione solo al rilascio; la sincronizzazione altezza è sospesa durante il gesto e riprende dopo. Collaudare anche la cornice con `npm run riordino-cross-origine` in `tests/crop-qa/`, e la compatibilità delle attività storiche con `npm run abbinamento-compatibilita`.
6-bis. Mostra e nascondi la traduzione: ogni nuova domanda parte nascosta. Gli **esercizi vecchi** si aprono ancora e generano i loro PDF; `translationIt` è opzionale per i record storici.
7. Il feedback è quello della lingua scelta (`LANGS[lang].feedbackOK/KO`): «Correct!», «Correct ! Bravo !», «¡Correcto!…».
8. La **barra di accessibilità ha 5 moduli**: FONT, INTERLINEA, RIGHELLO, MODALITÀ, **ASCOLTO** — il pulsante ASCOLTO passa da «Leggi» a «Stop» e ritorna a «Leggi» (clic di prova); la lettura usa la Web Speech API.
9. I PDF si scaricano: intestazione con nome/data/classe, titolo della lingua scelta, font OpenDyslexic incorporato, nessuna sovrapposizione. Nel riordino le parole sono presentate **IN DISORDINE** (mai nell'ordine giusto) e lo STESSO disordine compare in entrambe le versioni; nella versione «con risposte» la soluzione sta vicino alla sua frase e distanziata dalla successiva.
10. La **schermata finale** mostra **5 stelline** proporzionali al punteggio, il testo «Risposte giuste al primo colpo: X su Y» e i pulsanti «SCARICA L'ESERCIZIO SENZA RISPOSTE» (marrone chiaro #B08050) e «SCARICA L'ESERCIZIO CON RISPOSTE» (marrone scuro #5D4037); NON esiste più la scritta «Le risposte sono state salvate…».
11. Cornice dinamica: `cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html` riproduce il blocco pubblicato nel post il 7 novembre 2026 e abbinato all'app dei deploy 9035 e 9043 (cornice invariata); `CODICE-3-BLOGGER-ESATTO.html` è la copia storica precedente. La correzione dello scorrimento precedente è stata confermata dall'utente su Android; verificare le nuove modifiche anche sul dispositivo reale. Nel solo file di prova sostituisci `APP_URL` con l'URL dell'anteprima. Verifica caricamento, altezza, token, ritaglio e annullamento dei resize pendenti durante tocchi e scroll (`npm run cornice-interazione`). **Non modificare il post per la prova.** I test e le limitazioni sono in `tests/crop-qa/README.md`.
12. `pnpm test` passa.

## Mappa dei file essenziali

```
shared/languages.ts                    → ⭐ UNICA FONTE delle lingue: LangCode, LANGS (en/fr/es),
                                         titoli, tipologie, prompt AI, dizionari fallback, PDF
client/src/lib/lang.tsx                → contesto React + localStorage «lingue-facili-lang»
client/src/pages/WelcomePage.tsx       → prima pagina: dati studente, senza selettore lingua
client/src/pages/SetupPage.tsx         → lingua/bandiere, testo/foto, OCR, modalità e spiegazione
client/src/components/AdaptationControls.tsx → campo IA modificabile, registrazione e upload audio
client/src/hooks/useAdaptationDescription.ts → proposta IA con protezione delle modifiche
client/src/components/exercise/TranslationToggle.tsx → traduzione opzionale per item
client/src/hooks/useTeacherVoice.ts    → registrazione max 30 s e caricamento audio max 12 MB
client/src/pages/ExercisePage.tsx      → esercizio interattivo, feedback, PDF (ri-applica la
                                         lingua della RIGA DB, fonte di verità)
client/src/components/exercise/        → McView, TfView, MatchView, MatchItView, ReorderView,
                                         common.tsx (feedback), usePointerDrop.ts
client/src/components/AccessibilityToolbar.tsx → barra di accessibilità (5 moduli, ASCOLTO)
client/src/contexts/AccessibilityContext.tsx   → stato accessibilità centralizzato
client/src/hooks/useAccessibleReadAloud.ts → ASCOLTO sequenziale, lingua dichiarata, voce coerente
client/src/lib/exportWorkout.ts        → PDF (buildWorkoutPdf, "blank" | "answers"), per lingua
client/src/lib/heightSync.ts           → protocollo «labvisivo:height» per l'embed
client/src/lib/ocr.ts                  → un worker Tesseract PER LINGUA (eng/fra/spa)
client/src/components/CropDialog.tsx    → dialogo ritaglio originale 8731 del Widget metacognitivo
client/src/hooks/useCropDialogViewport.ts → posizione e lock del ritaglio in iframe/mobile
client/src/photo-crop.css              → CSS del ritaglio, importato in index.css
client/src/lib/ocrClean.ts, imagePrep.ts, cropBox.ts, upload.ts → OCR foto
client/src/lib/cropBox.test.ts          → geometria, incluse 8 maniglie e limiti
tests/crop-qa/                         → collaudi browser opzionali, immagini sintetiche
client/src/index.css                   → OpenDyslexic @font-face + palette :root
client/public/fonts/                   → font auto-ospitati (ttf/otf + woff2 -v2 per la cornice)
client/public/tessdata/                → modelli Tesseract gz per eng/fra/spa
server/exerciseGen.ts                  → ingresso alla generazione inclusiva
server/inclusivePrompt.ts              → prompt delle due modalità + indicazioni + traduzioni
server/inclusiveGeneration.ts          → validazione strutturale e retry, nessun fallback fuorviante
server/aiAssist.ts                     → descrizione, foto IA, traduzioni e voce
server/audioNormalize.ts                → conversione FFmpeg tramite pipe, nessun file audio salvato
server/routers.ts, db.ts, storage.ts   → tRPC, database (exercises.lang), storage
shared/exercise.ts                     → tipologie, focus, conversioni, validazione dei limiti
shared/textLimits.ts                   → conteggio e limite di 500 parole condivisi tra client/server
cornice-dinamica/                      → embed per Blogger (CODICE-3-ANTI-TREMOLIO-ANDROID.html ⭐ pubblicato + versioni storiche + test);
                                         CODICE-3-BLOGGER-ESATTO.html = copia storica precedente
```

## Invarianti assoluti (NON modificare durante la ricostruzione)

1. **`shared/languages.ts` è l'unica fonte delle lingue**: nessuna stringa di contenuto in lingua hardcodata altrove; le pagine leggono `langConfig(lang)` / `useLang()`.
2. **Colonna `lang`** in `exercises` (NOT NULL DEFAULT 'en'): la riga del DB è la fonte di verità per PDF e pagina finale.
3. **Fedeltà**: preservare il significato e gli elementi della fonte; non convertire le istruzioni in item, correggere solo errori evidenti e tradurre quando il docente lo chiede. Verifica umana indispensabile.
4. **Errore IA esplicito**: se la generazione fallisce non produrre un esercizio sostitutivo semanticamente diverso; consentire di riprovare.
5. **Feedback**: sempre da `LANGS[lang].feedbackOK/feedbackKO` — MAI stringhe di feedback hardcodate nelle viste.
6. **OCR: un worker Tesseract PER LINGUA** in `client/src/lib/ocr.ts` (bug storico: una mappa unica per tutte le lingue faceva leggere il francese con il modello inglese).
7. **Palette** `client/src/index.css` `:root`: crema #f8f1e4, inchiostro #2E2018, primario marrone #5D4037, card #ffffff, bordi #DEDBD6. **OpenDyslexic** ovunque (UI, PDF, cornice), auto-ospitato. Prima pagina e barra compatte come le app del blog, con scala 80–160%; nel percorso operativo mantenere almeno 14 pt. Nel ritaglio, per esplicita scelta dell'utente, replicare le misure del widget originale (14px a scala 100% per i pulsanti), con bersagli alti almeno 44px. `AccessibilityContext.tsx` applica alla radice `(56/3)*Math.max(1,fontScale)` mentre `--lf-scale` conserva la scala scelta; `photo-crop.css` compensa localmente la radice solo per il ritaglio.
8. **Due modalità**: nuovi item `reorder` e `mc` con esattamente 2/3/4 opzioni e una risposta corretta; per MC non preselezionare il numero e avviare/mostrare la spiegazione solo dopo la scelta esplicita. Preservare schema e viste delle 5 tipologie storiche. La traduzione è opzionale per le vecchie schede e generata per quelle nuove.
9. **ASCOLTO** (`useAccessibleReadAloud.ts`): coda sequenziale dei soli contenuti visibili, interfaccia italiana e contenuti didattici con `lang` esplicito; una voce stabile per lingua, Stop, cancellazione e stato di lettura ottimistico. Le voci dipendono dal browser e dal dispositivo.
10. **Protocollo iframe:** `heightSync.ts` conserva il token `?cornice=` durante la navigazione e coordina altezza e `labvisivo:interaction` con la variante `CODICE-3-ANTI-TREMOLIO-ANDROID.html`. La cornice sospende anche un resize già in attesa mentre l'utente interagisce o scorre e richiede una misura aggiornata dopo. Le vecchie cornici ignorano il nuovo messaggio: non assumere che basti cambiare l'app. Testare con API simulate e poi su Android reale; il post si aggiorna soltanto con conferma separata.
11. **Interfaccia coerente**: conservare i simboli di lingua già presenti e usare messaggi chiari e positivi; non aggiungere decorazioni che compromettano l'accessibilità.
12. **Privacy e voce**: foto e registrazione sono inviate direttamente all'IA senza essere salvate dall'app; nessuna chiave o registrazione in repository.
13. **PDF in disordine deterministico** (`renderReorder` di `exportWorkout.ts`): `hashStr` (FNV-1a) + `shuffleDeterministic` (Fisher-Yates con PRNG seedato da `item.answer` + testi chip). Lo STESSO disordine nelle due versioni (si può correggere la scheda stampata); se il seme producesse l'ordine giusto (con più di 1 chip), ruota di una posizione. Nella versione «con risposte»: soluzione vicina alla sua frase (`ctx.y -= 18`) e distanziata dalla successiva (`+ 26`).
14. **Inserimento consapevole del RIGO** (`usePointerDrop.ts`): con `flex-wrap` l'inserimento basato solo su x manderebbe sempre alla prima riga; si sceglie prima la RIGA più vicina al dito (y), poi si ordina solo dentro quella riga; oltre l'ultima tessera della riga = fine di QUESTA riga.
15. **Schermata finale** (ExercisePage.tsx): 5 stelle (`Math.round((score/total)*5)`, minimo 1), «Risposte giuste al primo colpo» MANTENUTO, scritta sul salvataggio ELIMINATA. I pulsanti PDF adottano lo stile marrone corrente; «Crea un nuovo esercizio» torna allo stile precedente, testo scuro sottolineato con icona Home.
16. **Ritaglio 8731**: `CropDialog.tsx`, `useCropDialogViewport.ts` e `cropBox.ts` mantengono la logica del Widget metacognitivo (commit `5d7824409c4e445c077123b699b10f2191ff4d9d`). `useCropDialogViewport.ts` e `cropBox.ts` sono identici alla sorgente; `CropDialog.tsx` mantiene la logica e aggiunge span alle etichette. `photo-crop.css` conserva il layout compatto e adegua i token di dimensione alla radice diversa di Lingue Facili. Il testo dei comandi è 14px alla scala 100% su richiesta esplicita e segue A−/A+. Confrontare col widget mediante `npm run confronto-widget`; a 320px e scala 160% la disposizione è volutamente adattata così che le etichette non debordino o si sovrappongano alle icone, senza ridurre il font scelto. Il dialogo ha `z-index: 51` sopra l'overlay `z-50`: è indispensabile se Radix rimonta il fondo dopo il contenuto durante foto consecutive; verificare con `npm run ritaglio-livelli` senza forzare i click. Non riscrivere `confirm()`, rotazione, geometria o hook. `SetupPage` normalizza EXIF/PNG (massimo 2600 px, file 18 MB), mantiene la coda e apre l'originale se la normalizzazione fallisce. L'anteprima delle foto piccole tende a 560px sul lato lungo, nei limiti dello schermo e senza cambiare l'originale; il PNG di uscita ha lato lungo massimo 2200 px. In `heightSync.ts` bloccare ogni `labvisivo:height`/risposta al ping con `data-lf-crop-open`; su `lf:crop-closed` inviare una nuova misura. Collaudare la cornice reale e i touch con `tests/crop-qa/README.md`.
17. **ASCOLTO multilingue:** in `useAccessibleReadAloud.ts`, rispettare `lang` e `data-tts-value-lang`, mantenere separate le lingue e i segmenti da massimo 180 caratteri. Verificare `npm run ascolto` in `tests/crop-qa/`; il test simulato non sostituisce l'ascolto su dispositivi reali.
18. **Spiegazione IA e UI ridimensionabile:** validare il JSON della spiegazione in `aiAssist.ts`, consentire una riprova senza esporre risposte non valide e proteggere le modifiche nel campo docente. Le notifiche rispettano 14 pt; le radio mantengono un'area tattile di 44px. Provare le pagine a 320px e con caratteri al 160% senza scroll orizzontale della pagina; il ritaglio conserva lo stile del widget, adattando la disposizione dei pulsanti solo quando necessario; la sua area fotografica scorre verticalmente.
19. **Sicurezza dei dati:** non usare `pnpm db:reset` se presente in una copia storica, né script che eseguono `DROP TABLE` (incluso `scripts/fix-db.mjs` se presente in una vecchia copia). Il comando di reset è rimosso dalla versione esportata. Operare solo su un DB nuovo e vuoto, oppure chiedere il consenso prima di cambi distruttivi.
20-ter. **Impaginazione PDF:** dalla produzione 9017 si usa `PAGE_BOTTOM = 50` in `client/src/lib/exportWorkout.ts` sia per `ensure()` sia per il controllo dei salti nel riordino; il piè di pagina è a y=24 pt. Conservare questa soglia e verificare che gli elementi non invadano il piè di pagina. Gli item hanno altezze diverse: i test campione non dimostrano che ogni pagina possibile sarà riempita perfettamente. Eseguire `pnpm exec tsx scripts/test-impaginazione-piena.ts` con i font serviti dalla porta 3000 e poi `python3 scripts/verifica-impaginazione-piena.py` (pypdf); sono dati sintetici e non serve il database.
20-bis. **Riordino e cornice**: lasciare assente la barra di aiuto CHI / COSA FA / OGNI QUANTO / IL RESTO; tutte le tessere del riordino devono avere la palette neutra uniforme condivisa fra app e PDF da `REORDER_CHIP_PALETTE`, indipendentemente dal ruolo. Nessuna legenda dei ruoli o istruzione sui colori nel PDF. La copia del post aggiornato è `CODICE-3-ANTI-TREMOLIO-ANDROID.html`: icone da 16px, testi visibili anche su telefono, area tattile estesa, conferma via ping e sospensione dei resize durante l'interazione. Le altre varianti sono storiche. Future modifiche alla cornice richiedono l'aggiornamento separato del post Blogger. Eseguire `npm run riordino-senza-legenda` e `npm run cornice-blog`; `npm run icone-cornice` verifica la precedente versione dedicata.
20. **Progressione e limiti:** `SetupPage` mostra testo/foto solo dopo la lingua e spiegazione/creazione solo dopo testo non vuoto; massimo cinque foto (anche in selezioni successive) e 10 frasi/domande per esercizio; ogni lacuna conta una domanda. Se le domande sono più di 10, creare le prime 10 e mostrare il pop-up di esclusione; non troncare la fonte né le schede precedenti. `server/exerciseLimit.ts`, `inclusiveGeneration.ts` e `SetupPage.tsx` contengono la regola e l'avviso; verificare `npm run prime-dieci` e `server/primeDieci.test.ts`. Scelta multipla con più lacune: opzioni progressive per singolo passo; salvare e conteggiare ogni risposta. Prima pagina e barra seguono l'ultima foto di Latino Facile; le risposte e tessere del riordino sono più chiare e uniformi anche nel PDF. Il comando finale «Crea un nuovo esercizio» torna al link scuro sottolineato con icona Home; la finestra di ritaglio resta invariata. `shared/textLimits.ts` conta al più 500 parole per testo e spiegazione; se foto/audio producono più parole, conservarle visibili e bloccare la creazione finché il docente non riduce il contenuto. Test: `npm run progressivo` e `npm run barra` in `tests/crop-qa/`.

## Verifica della fedeltà della ricostruzione (hash)

```bash
# nel progetto sorgente e nella ricostruzione, stesso Node/pnpm:
pnpm build
sha256sum dist/public/assets/index-*.js
```

Gli hash devono coincidere (stesso codice + lockfile congelato ⇒ stesso bundle). Se differiscono: verifica la versione di Node (22), di pnpm (10.4.1) e che `pnpm-lock.yaml` e `patches/` siano intatti.

<!-- lf-scroll-interno-iframe -->
## Regola da non rimuovere: iframe senza scorrimento interno

`html.lf-embedded:not(.lf-inner-scroll) { overflow: hidden !important; }` in `client/src/index.css` e `reviewInnerScroll` in `client/src/lib/heightSync.ts` evitano che, nel blog su Android, il dito sposti il contenuto dentro l'iframe mentre la cornice lo allunga. Se li modifichi, ripeti `tests/crop-qa/tremolio-foto-blog.stress.mjs` con `LF_SCENARIO=swipe LF_ASSERT=1`.
