# LINGUE FACILI

> **Produzione 9656 — 25 novembre 2026:** dopo la condivisione dell'anteprima e la conferma esplicita dell'utente, è stata pubblicata la versione del checkpoint applicativo `4f9f9b4` su https://lingue-facili.easy-peasy.site (`index-BFweEuRA.js`, `index-Crp9A1I8.css`, `exportWorkout-DcbHt53y.js` verificati byte per byte).
> 1. **Numero esatto di domande (≤ 10 senza aggiunte):** se l'originale contiene meno di 10 domande o frasi (es. 2, 3, 5 o 10), l'IA adatta esclusivamente quelle presenti senza inventarne altre per arrivare a 10 e senza mostrare il pop-up; solo oltre 10 adatta le prime 10 in ordine e mostra il pop-up di avviso.
> 2. **Traduzione italiana delle opzioni (pagina 3, scelta multipla):** aprendo «MOSTRA TRADUZIONE», oltre alla domanda tradotta compaiono anche le **OPZIONI IN ITALIANO** (A, B, C, D) del solo passo attivo; per le schede storiche prive di opzioni tradotte vengono richieste su clic senza modificare il database.
> 3. **Stile e colori uniformati a `Widget-metacognitivo-per-il-calcolo-di-equazioni`:** carta `#F8F1E4`, card `#FAF8F5`/`#FDFBF8`, inchiostro `#2E2118`, primario terracotta `#8B3A1A` (contrasto bianco ~7,2:1), opzioni MC e tessere riordino chiare `#F2E7DE` con testo `#2E2118` e bordo `#C9AD9A`, focus `#B71C1C`, righello e Alto Contrasto (`#000000`/`#111111`/`#ffdb7b`/`#ffdf80`) allineati al Widget equazioni. I pulsanti della barra di accessibilità e della finestra di ritaglio restano identici alla precedente produzione.

> **Produzione 9248 — 14 novembre 2026:** dopo l'anteprima condivisa e la conferma esplicita dell'utente, è stata pubblicata la versione del checkpoint applicativo `db65943` su https://lingue-facili.easy-peasy.site. Se una nuova fonte contiene più di 10 frasi o domande, la scheda viene adattata usando le prime 10 nell'ordine originale e un pop-up informa che le successive sono escluse. In scelta multipla ogni lacuna conta come una domanda. Il testo sorgente resta integro; se il limite cade in una frase con più lacune, la scheda conserva i primi passaggi e tronca la frase prima della prima lacuna esclusa. Le schede precedenti non vengono modificate. Restano i limiti di 500 parole per campo e 5 foto; il riconoscimento dipende dall'IA e il docente deve verificare risultato e soluzioni. Se l'IA non riesce o la fonte è illeggibile viene mostrato un errore.
>
> La versione mantiene i cinque pulsanti foto/audio impilati, centrati e della stessa larghezza, e i due pulsanti PDF senza icona della precedente 9247. Barra, ritaglio e cornice non sono stati modificati. L'anteprima e la produzione condividono il database: generare effettivamente una scheda in anteprima la salva normalmente; i collaudi UI hanno intercettato le API e non hanno modificato schede. Le prove mobili sono emulazioni, non verifiche su telefoni fisici.

> **Produzione storica 9246 — 14 novembre 2026:** pubblicata dopo la conferma dell'anteprima, codice applicativo del checkpoint `10e54ca`. I due comandi foto e i due comandi audio hanno la stessa larghezza all'interno delle rispettive coppie; i nomi visibili dei comandi foto sono in maiuscolo. La barra di inclusività e il ritaglio **non sono stati modificati** in questo aggiornamento. Restano massimo 500 parole per campo, 5 foto e **10 frasi/domande**, contando ogni lacuna separatamente; le opzioni delle frasi con più lacune appaiono progressivamente. ASCOLTO, PDF e cornice mantengono le funzioni precedenti.
>
> **Limite osservato nella storica 9246:** a 320 px con testo sorgente presente e scala 160%, i due comandi foto condividevano la riga con «Svuota» e diventavano molto stretti e alti. La successiva 9247 li ha disposti in verticale; resta necessaria una verifica sul dispositivo reale. Il test `pulsanti-uguali.e2e.mjs` non verifica questo stato, il gruppo audio o la scala 160%, nonostante le vecchie diciture nel suo output.

> **Produzione storica 9214 — 13 novembre 2026:** checkpoint `3d36b77`, limite storico di 15 item, superato dal limite corrente di 10. Introduceva le barre interne e ASCOLTO sequenziale con lingua dichiarata. Le voci disponibili dipendono dal dispositivo; l'ascolto reale va verificato separatamente.

> **Produzione 9035 con cornice anti-tremolio Android (l'app è poi passata alla 9043, vedi la correzione più sotto):** l'app e la cornice `cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html` sono state pubblicate separatamente dopo le conferme dell'utente. La cornice coincide con il post «LINGUE STRANIERE» aggiornato il 7 novembre 2026 alle 19:50:28 UTC; il resto del post è invariato. Le prove emulate non sostituiscono una verifica su Android fisico.

<!-- lf-scroll-interno-iframe --> > **Correzione del tremolio residuo su Android (7 novembre 2026). Stato: pubblicata in produzione (deployment 9043, checkpoint 850745d).**
> **Intestazione PDF semplificata (8 novembre 2026). Stato: pubblicata in produzione (deployment 9049, checkpoint 1c34723).** Sotto il titolo dei PDF (tutte le lingue, con e senza risposte) non compaiono più la riga «<tipologia> · <italiano> [- CON LE RISPOSTE]» né la didascalia «Il segno verde…»; vengono subito i dati dello studente, poi punteggio (solo con risposte) e consegna. Il riordino è provato per intero con mouse e dito (nuova prova `tests/crop-qa/riordino-completo.e2e.mjs`, 5 modi, app locale e produzione). L'utente ha confermato la scomparsa del tremolio sul telefono Android fisico.
 Nel flusso foto → testo, con il dito sullo schermo, l'iframe restava più basso del contenuto (circa 1259 px contro circa 2512 px) e il documento interno scorreva da solo fino a 836 px; solo dopo circa 5,9 s la cornice lo allungava e il contenuto «saltava». Ora `html.lf-embedded` ha `overflow: hidden` (`index.css`) e `heightSync.ts` invia subito la sola crescita che supera l'iframe, anche durante tocchi e digitazione; lo scorrimento interno (`lf-inner-scroll`) torna attivo solo se l'ospite non segue l'altezza. **La cornice del blog e il Codice 3 del DOCX non cambiano.** Le prove emulate non sostituiscono Android fisico.

App web didattica inclusiva **multi-lingua** che unifica in un'unica applicazione le due app della famiglia «Facile»:

- **INGLESE FACILE** (repo: `andreakeating1982/INGLESE-FACILE`)
- **FRANCESE FACILE** (repo: `andreakeating1982/FRANCESE-FACILE`)

e aggiunge lo **SPAGNOLO FACILE** con le stesse funzionalità.

La prima pagina raccoglie i dati dello studente; la seconda procede per passi: scegliere **inglese con bandiera irlandese, spagnolo o francese** → inserire il testo oppure da **1 a 5 foto** → nella sezione **SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA**, scegliere riordino o scelta multipla con 2, 3 o 4 opzioni e verificare la spiegazione modificabile → **CREA L'ESERCIZIO**. Testo e spiegazione hanno ciascuno un contatore e un limite di **500 parole**; non esiste un minimo di tre caratteri e la creazione non è disponibile con testo vuoto. Le istruzioni vocali, registrate per massimo 30 secondi o caricate da file, sono trascritte mediante IA. Lo studente vede una domanda alla volta, può mostrare o nascondere la traduzione e scarica il PDF OpenDyslexic con o senza risposte. **Il docente deve sempre verificare la fedeltà e le soluzioni generate dall'IA.**

## Architettura multi-lingua

Tutto ciò che dipende dalla lingua del CONTENUTO vive in **`shared/languages.ts`** (unica fonte di verità, usata da client e server):

| Area | Come cambia con la lingua |
|---|---|
| Prima pagina | Identica nello schema alle app del blog: dati studente e pulsante ENTRA, senza selettore lingua |
| Setup | Passi progressivi: lingua, testo o 1–5 foto, spiegazione IA modificabile e scelta della modalità, creazione; due contatori da 500 parole |
| Esercizi | Pulsanti TRUE/FALSE → VRAI/FAUX → VERDADERO/FALSO, colonna ENGLISH → FRANÇAIS → ESPAÑOL, CHECK → VÉRIFIE → COMPRUEBA, feedback (Correct!/Correct ! Bravo !/¡Correcto!) |
| PDF | Titolo, istruzioni standard, soluzione VERO/FALSO, piè di pagina, nome file |
| IA (`server/aiAssist.ts`, `inclusivePrompt.ts`, `inclusiveGeneration.ts`) | Prima spiega il compito in un campo modificabile; dopo conferma genera adattamento e traduzioni |
| Errore IA | Nessun esercizio di ripiego presentato come equivalente: viene mostrato un errore e si può riprovare |
| Foto e OCR | Lettura IA multimodale; se non disponibile, OCR Tesseract locale per lingua (`eng`/`fra`/`spa`) |

La lingua viaggia: **selettore della seconda pagina → localStorage (`lingue-facili-lang`) → richiesta di generazione → colonna `lang` del database** (la riga dell'esercizio è la fonte di verità per PDF e pagina finale, così si può cambiare lingua tra un esercizio e l'altro senza stravolgere il lavoro in corso).

La UI per l'insegnante resta **in italiano** (stesso principio di `ADATTARE.md`).

## Adattamento inclusivo

- **Riordino**: una frase per volta, con tutte le tessere dello stesso colore neutro, tocco, trascinamento e tastiera. Durante il drag il fantasma segue il dito e la frase rimane ferma; la parola viene inserita al rilascio nella riga desiderata. Nell'iframe le misure sono coalescenti e sospese durante il gesto, così il contenuto può stabilizzarsi senza ridimensionamenti continui. La barra «CHI / COSA FA / OGNI QUANTO / IL RESTO» resta rimossa; la stessa palette uniforme è usata nel PDF, senza legenda dei ruoli. Restano istruzioni e traduzione facoltativa. Le frasi complete vanno mantenute, salvo esplicita traduzione o correzione di evidenti errori; eventuali ordini alternativi proposti e validati sono accettati.
- **Scelta multipla**: una domanda per volta, esattamente 2, 3 o 4 opzioni selezionate esplicitamente dal docente e una soluzione attesa per i nuovi esercizi. Nessun numero è preselezionato: la spiegazione IA viene richiesta e mostrata solo dopo la scelta.
- **Prime 10 con avviso (produzione 9248)**: sopra le 10 frasi/domande si creano le prime 10 senza cambiare la fonte e si avvisa nel pop-up; ogni lacuna di scelta multipla conta come domanda. Per i casi ambigui il riconoscimento è affidato all'IA e richiede il controllo del docente. Test: `pnpm test` e `cd tests/crop-qa && npm run prime-dieci`; le prove IA reali con dati sintetici e senza salvataggi sono in `scripts/test-prime-dieci-ia.ts`.
- **Spiegazione modificabile**: l'IA descrive il contenuto e come adattarlo dopo la scelta della modalità; controlla e correggi il campo prima di creare l'esercizio. I messaggi di stato sotto il contatore sono tutti in marrone e grassetto. Nessun suggerimento a pulsante. Se la spiegazione non è disponibile, puoi scriverla manualmente o riprovare.
- **Fonte e traduzione**: non trasformare titoli o istruzioni in domande, preservare gli elementi dell'originale; traduzione italiana inizialmente nascosta e attivabile con un pulsante. L'IA può commettere errori, anche di significato o nelle opzioni: il docente deve controllare.
- **Audio e privacy**: registrazione max 30 secondi oppure caricamento fino a 12 MB (MP3 e altri formati comuni; quelli non nativi vengono convertiti in memoria con FFmpeg). La registrazione si interrompe e viene trascritta dall'IA automaticamente allo scadere dei 30 secondi anche se non si preme Stop. L'IA trascrive entrambi gli input nel campo modificabile. Foto e audio vengono elaborati dal servizio IA senza salvare i file; evita dati personali nelle foto e indicazioni. Il testo dell'esercizio e gli esiti vengono salvati nel database quando si crea la scheda.

Le 5 `ExerciseType` (mc, tf, match, matchIt, reorder) e le viste rimangono nello schema per la compatibilità con le schede precedenti; ora `mc` e `reorder` sono disponibili anche per le nuove.

## Foto e ritaglio: logica del Widget metacognitivo

Il ritaglio proviene dalla [repository Widget metacognitivo per il calcolo di espressioni](https://github.com/andreakeating1982/Widget-metacognitivo-per-il-calcolo-di-espressioni), commit `5d7824409c4e445c077123b699b10f2191ff4d9d`: `useCropDialogViewport.ts` e `cropBox.ts` sono identici ai file della sorgente; `CropDialog.tsx` conserva la logica originale e aggiunge soltanto un contenitore alle etichette dei quattro pulsanti. `photo-crop.css` mantiene lo stile compatto del widget e compensa localmente la diversa dimensione radice di Lingue Facili: su esplicita scelta dell'utente i pulsanti usano 14px alla scala 100% (come il widget), anziché il precedente minimo di 14pt; A−/A+ continuano a funzionare e i pulsanti conservano un'altezza minima di 44px. La finestra, il titolo e i quattro comandi sono stati confrontati direttamente con il widget pubblico. Su richiesta, a schermo stretto e font ingrandito le icone possono disporsi sopra le etichette: il testo resta della dimensione scelta e non deborda né si sovrappone, pur conservando capsule e colori originali. In orizzontale 568×320 la foto è visibile inizialmente solo in parte e il corpo del dialogo si può scorrere. La finestra resta sopra lo sfondo anche quando si aprono rapidamente più foto in sequenza. Offre selezione libera con maniglie, tastiera, rotazione, **CHIUDI** e **RITAGLIA**, mantiene la pagina sottostante ferma su telefono e funziona nella cornice Blogger. Prima del dialogo la foto viene orientata e convertita in PNG, con lato massimo 2600 px e limite di 18 MB; se la normalizzazione non è disponibile si apre la foto originale. Le foto piccole vengono ingrandite solo nell'anteprima verso 560 px sul lato lungo, compatibilmente con la larghezza disponibile: le proporzioni e il ritaglio percentuale restano invariati. Il ritaglio produce PNG e limita il lato lungo a 2200 px. Segue la lettura IA, con OCR locale alternativo. Si possono aggiungere fino a cinque foto complessive per esercizio, anche con caricamenti separati: quelle in più vengono rifiutate e l'utente viene avvisato. Le foto scelte insieme vengono elaborate in ordine; annullare il ritaglio libera il relativo posto.

La suite riproducibile con immagini sintetiche è descritta in `tests/crop-qa/README.md` e non crea esercizi né modifica dati reali. Nel server di sviluppo, `/anteprima-riordino` mostra un esempio interattivo locale del vero componente, senza IA o salvataggi; la rotta è esclusa dalla build di produzione.

## Funzionalità ereditate dalle app originali

- Adattamento dell'originale con controllo strutturale e retry IA; fedeltà e correttezza semantica richiedono verifica del docente
- **OCR** da più foto, screenshot (Ctrl+V) e PDF, con dialogo di ritaglio; riconoscimento IA con alternativa Tesseract per le foto
- Spiegazione proposta dall'IA e modificabile; registrazione con permesso del microfono o caricamento di file audio
- **PDF OpenDyslexic** con e senza risposte e punteggio; nel riordino tutte le tessere hanno lo stesso colore. Impaginazione più compatta dalla produzione 9017: `PAGE_BOTTOM = 50` limita il contenuto rispetto al piè di pagina; il cambio pagina dipende dall'altezza stimata di ogni elemento
- **Accessibilità**: OpenDyslexic auto-ospitato; scala regolabile dall'80% al 160% come nel blog. Nel percorso didattico il testo non scende sotto 14 pt, anche con A− all'80% o al 90%. Il ritaglio fa eccezione su scelta esplicita: usa le misure originali del widget. Prima pagina e barra seguono lo stile compatto del blog; i pulsanti della barra hanno area tattile estesa. Barra con dimensioni, interlinea, contrasto, righello e **Ascolto** multilingue.
- **Cornice dinamica per Blogger**: `cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html` è la copia esatta del blocco pubblicato nel post «LINGUE STRANIERE» il 7 novembre 2026 alle 19:50:28 UTC (SHA-256 `3782b7aa77137861794b826ca41be0f9fda42537ee0e1e239ccb897ca4170098`), identica al Codice 3 del DOCX aggiornato. Collabora con `heightSync.ts` per annullare i resize pendenti durante tocchi, digitazione, drag e scroll, poi richiede una misura aggiornata. Conserva aspetto e permessi. La sola app corretta con la vecchia cornice non risolveva il caso riprodotto; ora sono entrambe pubblicate. `CODICE-3-BLOGGER-ESATTO.html` conserva la copia storica precedente, così come `embed-lingue-facili-dedicata.html` e la variante lite. Future modifiche al post richiedono conferma e operazione separata.

## Sviluppo

```bash
pnpm install --frozen-lockfile
pnpm dev        # sviluppo; non avvia migrazioni automatiche sul database
pnpm check      # TypeScript
pnpm test       # generazione, descrizione IA, audio e geometria del ritaglio
pnpm build      # build produzione
# Solo su un database NUOVO e vuoto, dopo aver verificato la destinazione:
# npx drizzle-kit push
# NON eseguire reset, migrazioni distruttive o push su dati esistenti senza autorizzazione.
```

## Guide incluse nel pacchetto (per agenti IA e sviluppatori)

| Guida | Quando usarla |
|---|---|
| `REBUILD.md` | Ricostruire l'app IDENTICA dalla repository GitHub |
| `ADATTARE.md` | Creare VARIANTI (quarta lingua, testi, limiti, clone mono-lingua) |
| `RENDER.md` | Trasferire da Easy-Peasy AI a Render via GitHub |
| `ACCESSIBILITA.md` | ♿ Misure di accessibilità con «dove nel codice» e guida al riuso su altre app |
| `AGENTS.md` | Regole operative per agenti IA che lavorano in questa repo |
| `MANIFESTO-ESPORTAZIONE.md` | Contenuto dello ZIP, privacy, versione pubblicata e limiti del trasferimento |
| `cornice-dinamica/README.md` | Cornice dinamica per Blogger (inclusa nel pacchetto) |
| `materiali-blog/` | Presentazione Word e copertina clay 16:9: materiali separati, non usati dal codice dell'app |

## Aggiungere una quarta lingua

Procedura completa in `ADATTARE.md`: estendere la configurazione in `shared/languages.ts`, i validatori dei nuovi endpoint in `server/routers.ts`, il rilevamento ASCOLTO e i modelli OCR. Verificare entrambe le modalità, foto, traduzione e PDF prima di distribuire.
