# Lingue Facili — adattamento BES

## Nuova richiesta (25 novembre 2026) — numero reale di domande (≤10), traduzione opzioni MC e stile Widget equazioni
- [x] Analizzare `Widget-metacognitivo-per-il-calcolo-di-equazioni` e mappare token, componenti ed eccezioni richieste.
- [x] Garantire che sotto o pari a 10 domande l'IA adatti esclusivamente quelle presenti nell'originale senza aggiungerne altre; oltre 10 usa le prime 10 e avvisa con pop-up.
- [x] Aggiungere la traduzione italiana delle opzioni di risposta nella scelta multipla (pagina 3), compresi i passi progressivi e il fallback on-demand per le schede storiche.
- [x] Uniformare stile, palette (`#8B3A1A`, `#FAF8F5`, `#F2E7DE`, `#2E2118`), focus, righello e Alto Contrasto al Widget equazioni mantenendo invariati barra accessibilità e ritaglio.
- [x] Superare `pnpm check`, 62 test unitari (`pnpm test`), `pnpm build`, verifica IA in memoria e suite E2E desktop/mobile senza modificare il database.
- [x] Aggiornare guide, skill `lingue-facili` e pacchetto ZIP dell'anteprima.
- [x] Condividere l'anteprima e ricevere conferma esplicita in un nuovo messaggio.
- [x] Pubblicare in produzione (deployment **9656**, checkpoint applicativo `4f9f9b4`) su `https://lingue-facili.easy-peasy.site`.
- [x] Verificare sito online, `/_health`, asset JS/CSS/PDF byte per byte, test E2E su produzione e conteggio DB in sola lettura (zero modifiche).
- [x] Aggiornare guide, generare e ricostruire in isolamento lo ZIP della produzione 9656 e aggiornare la skill `lingue-facili`.

## Ultima richiesta — prime 10 frasi o domande
- [x] Individuare il blocco attuale e distinguere la produzione già pubblicata dall'anteprima futura.
- [x] Generare automaticamente solo le prime 10 domande o frasi, mantenendo la fonte originale e i contenuti in ordine.
- [x] Segnalare con un pop-up accessibile quando le domande successive non vengono incluse.
- [x] Verificare riordino, scelta multipla, più lacune, le tre lingue e gli esercizi precedenti senza modificare i dati.
- [x] Aggiornare le guide e le skill dell'anteprima.
- [x] Preparare e verificare uno ZIP dell'anteprima senza dati o credenziali.
- [x] Condividere l'anteprima senza pubblicare quando l'utente ha chiesto di sospendere.
- [x] Dopo successiva conferma esplicita, pubblicare la versione approvata in produzione 9248.
- [x] Verificare sito, asset, pop-up e servizio IA senza creare o modificare schede.
- [x] Aggiornare guide, skill e ZIP della produzione 9248.

## Ulteriore richiesta — pulsanti ancora più stretti
- [x] Ridurre leggermente e in egual misura i cinque pulsanti foto e audio.
- [x] Verificare scritte, funzioni e accessibilità a diverse dimensioni, senza usare il database.
- [x] Aggiornare la skill e preparare la nuova anteprima senza pubblicazione.

## Nuova richiesta — pulsanti foto e audio più stretti
- [x] Individuare i cinque pulsanti mostrati nelle fotografie.
- [x] Restringerli tutti in egual misura, mantenendo la disposizione impilata e centrata.
- [x] Verificare che le scritte restino leggibili anche ingrandite e che le funzioni non cambino, compresi gli stati audio temporanei.
- [x] Aggiornare la skill e preparare un'anteprima; non pubblicare senza nuovo consenso.

## Nuova richiesta 14 novembre — foto, audio e pulsanti PDF
- [x] Osservare entrambe le fotografie e individuare i controlli interessati.
- [x] Impilare e centrare i tre comandi foto e i due audio, con scritte maiuscole.
- [x] Rimuovere le icone dei due PDF lasciando scritte centrate e download funzionanti.
- [x] Collaudare con font 80–160%, interlinea fino a 2,6, desktop e cellulare emulato, anche con testo e «SVUOTA» visibili, senza toccare i dati.
- [x] Aggiornare la skill, distinguendo la nuova anteprima dalla produzione 9246.
- [x] Condividere l'anteprima verificata e un'immagine della schermata finale.
- [x] Dopo successiva conferma, i pulsanti sono stati pubblicati nella 9247.

## Richiesta 14 novembre — pulsanti foto e audio uniformi
- [x] Confronto con le foto dell'utente: coppia audio già uniforme e maiuscola, coppia foto da correggere.
- [x] Stessa larghezza per i pulsanti di ciascuna riga (`.lf-equal-actions`) e testo foto in maiuscolo, nomi accessibili naturali.
- [x] Test a 320/390/1440px e 320px/160%, tipi, test unitari e build; nessun overflow.
- [x] Condividere l'anteprima e ricevere il consenso separato per la produzione.
- [x] Pubblicare la versione approvata come produzione 9246 e verificare gli asset online.
- [ ] Limite rilevato dopo il deploy: con testo presente a 320 px e scala 160%, i pulsanti foto diventano molto alti; valutare una nuova anteprima con l'utente. La barra inclusività non è stata modificata in questo rilascio.

## Richiesta 13 novembre — spaziatura CREA ESERCIZIO
- [x] Verificare che l'anteprima sia raggiungibile e distinguerla dalla produzione non aggiornata.
- [x] Aggiungere spazio prima e dopo il pulsante, senza modificare l'aspetto o la logica.
- [x] Verificare layout e interazione su desktop e telefono emulato, con dati sintetici e senza modificare il database.
- [x] Aggiornare la skill.
- [x] Condividere l'anteprima aggiornata.
- [x] Pubblicare la produzione 9221 dopo consenso esplicito e verificarla.

## Richiesta 13 novembre — eccezioni visive da fotografie
- [x] Prima pagina e barra: proporzioni e forma della fotografia Latino Facile, mantenendo nome e funzioni di Lingue Facili.
- [x] Risposte scelta multipla e tessere riordino più chiare, uniformi e leggibili, anche nel PDF.
- [x] Ripristinare il precedente stile del comando Crea un nuovo esercizio.
- [x] Test visivi e funzionali desktop/telefono emulato, anche barra e ritaglio; nessuna modifica al database.
- [x] Aggiornare skill; produzione solo dopo nuovo consenso.
- [ ] Condividere l'anteprima.

## Richiesta 13 novembre — 10 domande, risposte progressive e pulsanti
- [x] Limite massimo 10 frasi/domande per nuove schede, senza troncare le precedenti.
- [x] Risposte progressive con più lacune: scelte soltanto per quella attiva, preservare traduzione, punteggio, salvataggio e PDF (da collaudare).
- [x] Uniformare i pulsanti all'immagine fornita, eccetto quelli della barra accessibilità e della finestra di ritaglio, che restano invariati (da collaudare).
- [x] Test sintetici desktop/mobile, PDF, IA e compatibilità delle schede precedenti senza modificare il database; barra e ritaglio confrontati con la produzione.
- [x] Aggiornare guide e skill distinguendo anteprima da produzione.
- [ ] Condividere anteprima e attendere consenso separato alla pubblicazione.

<!-- lf-scroll-interno-iframe -->
## Tremolio residuo foto → testo (7 novembre 2026)
- [x] Riprodurre con foto da 12 megapixel, iframe in processo separato, CPU rallentata e tocchi reali, nel blog con API simulate.
- [x] Impedire lo scorrimento interno dell'iframe quando la cornice segue l'altezza; riattivarlo negli altri ospiti.
- [x] Inviare subito la crescita che supera l'iframe, anche durante i gesti.
- [x] Nuove prove: `tremolio-foto-blog.stress`, `scroll-interno-iframe`, `schermo-intero-cornice`; suite completa 40/40 senza database.
- [x] Conferma dell'utente e pubblicazione in produzione: deployment 9043, checkpoint 850745d; JS e CSS online identici, byte per byte, alla build provata.
- [x] Verifica sul blog pubblico: blocco della cornice nel post identico al progetto (decodificate le entità HTML); scenario foto → testo con la cornice reale: 0 scorrimenti interni, 0 salti visibili oltre 120 px.
- [ ] Prova sul telefono Android fisico, da parte dell'utente.

## Nuova segnalazione: tremolio nella seconda pagina e nel riordino
- [x] Riprodurre nel blog pubblico, su Android emulato e con API simulate, un ridimensionamento della cornice durante un drag iniziato rapidamente (1163 → 1152 px); i test precedenti attendevano che l'altezza fosse già stabile. Il tremolio completo del telefono reale non è ancora riprodotto.
- [x] Coordinare app e nuova variante della cornice durante gesti, digitazione e scroll: annullare nel parent i resize già in attesa e riprendere dopo l'interazione. La sola app non basta con la cornice precedente. Preservati la cornice originale e il ritaglio.
- [x] Collaudare seconda pagina, scroll e riordino su mobile emulato (anche 320px/160%) e desktop; suite browser, prove specifiche, 34 unit test, TypeScript e build superati senza database. La tastiera e il telefono Android fisici richiedono la prova dell'utente.
- [x] Salvare checkpoint e preparare l'anteprima temporanea dell'app; verificare che la pagina separata con cornice e API simulate rimanga raggiungibile dopo l'anteprima.
- [x] Condividere la copia temporanea della cornice con esercizi e IA simulati; l'utente ha poi richiesto la pubblicazione senza riferire un esito su Android fisico.
- [x] Pubblicare l'app anti-tremolio in produzione: deployment 9035, checkpoint 525f4f2; asset, domini, font e schema verificati.
- [x] Aggiornare nel DOCX allegato solo il Codice 3 e verificare le 15 cornici, l'indice, la formattazione e l'HTML estratto.
- [x] Dopo conferma dell'utente, aggiornare la sola cornice nel post «LINGUE STRANIERE» e verificare nel feed che blocco, testo e immagini corrispondano a quanto approvato.

## Barra standard, riordino mobile e messaggi
- [x] Confrontare la barra con il Widget metacognitivo pubblicato nel blog.
- [x] Stabilizzare le dimensioni della cornice e il trascinamento touch.
- [x] Rendere marroni e in grassetto tutti gli stati della spiegazione IA.
- [x] Collaudare desktop e smartphone con dati simulati, senza database: suite browser completa, test unitari, TypeScript e build superati.
- [x] Salvare un checkpoint descrittivo per l'anteprima.
- [x] Preparare lo ZIP aggiornato dell'anteprima e verificarne la ricostruzione isolata, senza database.
- [x] Condividere l'anteprima e predisporre l'esempio nella copia temporanea della cornice.
- [x] Ricevere la conferma separata e pubblicare in produzione: deployment 9026, checkpoint pre-deploy 7520cb5.
- [x] Collaudare il sito pubblicato con API simulate: barra, stati, cornice, riordino, abbinamenti e flusso; verificare lo schema in sola lettura.
- [x] Aggiornare guide e skill alla produzione 9026.
- [x] Preparare e verificare lo ZIP della produzione 9026: prova di ricostruzione isolata, 34 test e confronto JS/CSS/PDF con la produzione.

## Impaginazione piena del PDF

- [x] Misurare il PDF allegato: item 6 orfano a pagina 2, soglia `ensure()` a 94pt dal fondo contro 50pt del riordino.
- [x] Introdurre `PAGE_BOTTOM = 50` condiviso da `ensure()` e dal salto pagina del riordino, per tutte le tipologie.
- [x] Collaudare con `test-impaginazione-piena.ts` + `verifica-impaginazione-piena.py`: caso di prova ispirato al PDF in 1 pagina, stress MC/TF/riordino senza sovrapposizioni né contenuti sotto il limite nei casi verificati.
- [x] Verificare regressioni: paginazione riordino, alternative, tipo, unit test, build e browser.
- [x] Condividere l'anteprima (checkpoint ec8b4c7), ricevere il consenso separato e pubblicare in produzione (deployment 9017, checkpoint pre-deploy 29e79f1).
- [x] Verificare i due indirizzi, l'apertura nel browser e la corrispondenza di JavaScript, CSS e modulo PDF alla build approvata, senza modificare il database.

## Riordino: tutte le parole dello stesso colore

- [x] Individuare tessere, trascinamento, istruzioni e legenda del PDF.
- [x] Uniformare testo, sfondo e bordo di tutte le tessere, comprese le parole già spostate e il fantasma del trascinamento.
- [x] Rendere coerenti i PDF con e senza risposte, eliminando le istruzioni e la legenda sui colori grammaticali.
- [x] Conservare schema, vecchi esercizi, traduzione, validazione, feedback, punteggio e accessibilità; verificarli nei test con dati simulati.
- [x] Collaudare riordino nelle tre lingue, contrasto, PDF e schermate desktop/mobile con dati sintetici e API intercettate.
- [x] Aggiornare guide e skill, distinguendo l'anteprima dalla precedente produzione 8996 e registrando poi la pubblicazione 9002.
- [x] Preparare un esempio interattivo che utilizza il componente reale, senza chiamate API o dati salvati; verificare che la rotta sia esclusa dalla produzione.
- [x] Predisporre codice, guide e test per il checkpoint dell'anteprima.
- [x] Preparare e verificare lo ZIP di anteprima, includendo guide e test, senza dati o credenziali.
- [x] Condividere l'esempio di anteprima senza salvataggio di dati.
- [x] Ricevere la conferma separata e pubblicare in produzione il deployment 9002 (checkpoint applicativo d0eb270).
- [x] Verificare entrambi gli indirizzi e gli asset pubblicati; ripetere i test di riordino e PDF con API intercettate, senza modificare i dati reali.

## Verifica del blog e pacchetto di produzione

- [x] Confrontare il Codice 3 già presente nell'editor con quello approvato: coincidono esattamente, quindi nessuna ripubblicazione inutile del post.
- [x] Verificare nel post pubblico pulsanti, icone, permessi dell'iframe e ricarica della sola cornice; annotare che Chrome non ha concesso la prova remota dello schermo intero.
- [x] Includere nel repository la copia esatta del Codice 3 trovato nel post.
- [x] Aggiornare le guide alla produzione 8996 e allo stato verificato del blog.
- [x] Salvare un checkpoint e verificare la ricostruzione isolata dello ZIP: dipendenze con lockfile, TypeScript, 34 test e build superati; asset identici alla produzione.
- [x] Preparare per la consegna il pacchetto aggiornato e le skill allineate.

## Pulsanti della cornice come nella foto

- [x] Confrontare la foto allegata con la versione precedente e la cornice attuale.
- [x] Ripristinare i pulsanti compatti con scritte e icone come nella foto, mantenendo i tratti SVG completi e i comandi funzionanti.
- [x] Aggiornare solo il Codice 3 del DOCX e preparare l'HTML estratto.
- [x] Collaudare su desktop e telefono, anche con CSS di Blogger avverso, area tattile estesa, ricarica e schermo intero; anteprima verificata.
- [x] Aggiornare le guide e le skill personali.
- [x] Preparare il checkpoint e i file dell'anteprima, DOCX, HTML e ZIP aggiornati.

## Correzioni: ritaglio, riordino e cornice

- [x] Identificare le due fotografie e le sezioni interessate.
- [x] Evitare sbordamenti nel ritaglio, mantenendo i comandi compatti e simili all'originale; A+ mantiene il font scelto e la logica è invariata.
- [x] Eliminare soltanto la barra «CHI / COSA FA / OGNI QUANTO / IL RESTO» nel riordino, mantenendo tessere e funzioni.
- [x] Rendere ben visibili nella cornice Blogger i pulsanti schermo intero e ricarica, anche nei temi del blog; tratti SVG separati e click funzionanti.
- [x] Aggiornare il Codice 3 nel DOCX delle cornici, senza alterare indice, titoli o altri codici; HTML estratto e verificato.
- [x] Collaudare desktop, telefono, caratteri ingranditi, immagini consecutive e cornice, usando dati sintetici; suite completa superata.
- [x] Aggiornare guide e skill personali per ritaglio, riordino e cornice.
- [x] Salvare il checkpoint e preparare lo ZIP della versione in anteprima; verificare la ricostruzione isolata.
- [x] Condividere l'anteprima dell'app e della cornice.
- [x] Ricevere la conferma separata e pubblicare l'app in produzione: deployment 8996, checkpoint del codice d01f647. Eventuali future modifiche alla cornice richiedono un aggiornamento separato; nel controllo successivo il Codice 3 approvato era già presente nel post.

## Ripristino del ritaglio del Widget metacognitivo — fase precedente

Il successivo adattamento per evitare sbordamenti è documentato nella sezione sopra.

- [x] Confrontare il repository richiesto, la produzione del widget e le dimensioni dei controlli.
- [x] Confermare con l'utente la dimensione originale dei pulsanti (14px alla scala 100%, eccezione al precedente minimo 14pt).
- [x] Ripristinare il componente sorgente identico, conservando la sicurezza di due foto consecutive e la scala originale solo nel ritaglio.
- [x] Verificare aspetto, ingrandimento e funzionamento su desktop, telefono e cornice Blogger con dati sintetici; suite completa superata.
- [x] Aggiornare le guide e la skill Lingue Facili, documentando il limite del widget originale alle scale maggiori.
- [x] Condividere l'anteprima successiva; per la pubblicazione resta necessaria una conferma separata.

- [x] Analizzare app, dati esistenti e salvare lo stato iniziale.
- [x] Definire un percorso rapido e coerente con l'accessibilità esistente.
- [x] Consentire riordino e scelta multipla con 2, 3 o 4 opzioni.
- [x] Consentire istruzioni modificabili, registrazione fino a 30 secondi e caricamento audio (senza i precedenti modelli rapidi).
- [x] Gestire più foto, riconoscimento IA e alternativa OCR.
- [x] Trapiantare il ritaglio originale 8731 della repository Widget metacognitivo, incluse viewport e cornice.
- [x] Verificare geometria, PNG, rotazione, tastiera, touch, mobile e iframe.
- [x] Generare un elemento per volta, rispettare la fonte e includere le traduzioni.
- [x] Mostrare/nascondere la traduzione e mantenere compatibili gli esercizi salvati.
- [x] Conservare PDF completi, dati studente e risposte effettive.
- [x] Completare i nuovi test integrati di IA, foto, registrazione, modalità studente, PDF e schermi mobili.
- [x] Aggiornare documentazione e skill di manutenzione ed esportazione.
- [x] Rigenerare lo ZIP aggiornato e verificarne la ricostruzione da zero (check, 30 test, build e hash client confrontato).
- [x] Consegnare l'anteprima e richiedere separatamente il consenso per la produzione.


## Nuovo percorso richiesto

- [x] Prima pagina come il Widget del blog, senza selettore di lingua.
- [x] Scegliere inglese (bandiera irlandese), spagnolo o francese solo nella pagina 2.
- [x] Trascrizione IA immediata di foto multiple e spiegazione IA obbligatoria, proposta automaticamente e modificabile.
- [x] Preservare gli interventi dell'utente e gestire risposte IA fuori ordine o non disponibili.
- [x] Registrazione istruzioni max 30 s e caricamento audio in formati comuni; nessun pulsante «REGISTRA E TRASCRIVI».
- [x] Eliminare i quattro esempi e coordinare titoli, pulsanti e palette marrone.
- [x] OpenDyslexic e adattamento: la richiesta successiva uniforma la prima pagina e la barra al blog, con scala 80–160%.
- [x] Collaudo desktop, mobile, cornice, OCR, generazione IA reale, voce, file audio, ASCOLTO e compatibilità.
- [x] Aggiornare guide, skill, checkpoint e anteprima.
- [x] Ottenere il consenso separato e pubblicare in produzione (deployment 8979).


## Percorso progressivo — nuova richiesta

- [x] Uniformare prima pagina e barra d'inclusione al Widget del blog, preservando TTS multilingue e accessibilità.
- [x] Mostrare le sezioni nell'ordine lingua → testo/foto → spiegazione e tipo → creazione.
- [x] Limitare a quattro le foto complessive di una scheda; conservare ritaglio e ordine.
- [x] Aggiungere il contatore e il limite di 300 parole a testo e spiegazione, anche lato server.
- [x] Rimuovere il minimo di tre caratteri e le frasi indicate; rinominare sezione e pulsante.
- [x] Confermare la trascrizione IA di microfono e file audio e l'arresto automatico a 30 secondi.
- [x] Collaudare desktop, mobile, tastiera, ritaglio, IA, TTS e PDF senza scrivere esercizi reali.
- [x] Garantire nel percorso e nel ritaglio il minimo di 14 pt anche con A− all'80% o 90% nella versione 8986. Decisione successiva: nel solo ritaglio tornare alle misure originali del widget.
- [x] Aggiornare le guide e la skill con percorso, limiti, accessibilità e audio.
- [x] Preparare l'anteprima senza pubblicare in produzione.
- [x] Verificare il pacchetto esportabile aggiornato ricostruendolo da zero.
- [x] Consegnare l'anteprima, il pacchetto e la skill aggiornati.
- [x] Ottenere il consenso separato e verificare la versione pubblicata in produzione.


## Richiesta: opzioni, ritaglio e microfono nel blog

- [x] Analizzare i tre screenshot e verificare i permessi dell'iframe nel post pubblicato.
- [x] Far scegliere esplicitamente 2, 3 o 4 opzioni prima della proposta IA per la scelta multipla.
- [x] Centrare il titolo e allineare i pulsanti grandi nella versione 8986. Decisione successiva: tornare ai pulsanti compatti identici al widget, senza toccare geometria o `confirm()`.
- [x] Distanziare dai pulsanti audio le scritte superiore e inferiore.
- [x] Collaudare il flusso, il ritaglio, l'accessibilità, l'audio e la cornice senza scrivere dati reali.
- [x] Correggere il blocco intermittente della seconda foto dovuto alla sovrapposizione; collaudare anche con zoom e touch.
- [x] Aggiornare guide, skill e cornice da fornire per il post.
- [x] Ricostruire e verificare lo ZIP aggiornato senza dati né credenziali.
- [x] Salvare un checkpoint e preparare la sola anteprima con indicazioni per il blog.
- [x] Ottenere la conferma separata e pubblicare queste modifiche in produzione (deployment 8986; codice 2577157).
- [x] Verificare gli asset pubblicati e ripetere in produzione le prove simulate per opzioni e ritaglio.
- [x] Aggiornare guide e skill alla versione pubblicata e preparare lo ZIP esportabile.

## 8 novembre 2026 — Intestazione PDF semplificata e riordino completo
- [x] Tolti dai PDF riga sotto il titolo e didascalia segno verde (tutte le lingue, con e senza risposte)
- [x] Nuova prova intestazione PDF: 30/30 passano sul codice nuovo, 30/30 falliscono sul vecchio
- [x] Impaginazione piena, paginazione riordino, riordino uniforme, 34 test unitari, TypeScript, build
- [x] Nuova prova riordino completo: 5/5 modi (mouse e dito, app e blog) in locale e in produzione 9043
- [ ] Pubblicazione in produzione dopo conferma separata
- [ ] Dopo la produzione: README/MANIFESTO/REBUILD, ZIP 9044 e skill


## Iterazione del 13 novembre 2026 — anteprima
- [x] Confrontare il widget pubblicato e la sua lettura con Lingue Facili.
- [x] Conservare la barra lettura file, aggiungere barra nella spiegazione IA, rimuovere barra sotto Crea.
- [x] Aggiornare la frase informativa, rispettare 15 item e verificare il contatore delle foto.
- [x] Armonizzare palette e forme conservando l'accessibilità e i colori esplicitamente richiesti.
- [x] Rendere affidabile la lettura dei testi visibili, rispettando la lingua del contenuto.
- [x] Collaudare l'iframe, la barra, i 15 item e la lettura simulata senza scrivere dati.
- [x] Condividere l'anteprima e attendere consenso separato: versione 9214 pubblicata il 13 novembre 2026.
- [ ] Chiedere una prova di ASCOLTO sul dispositivo fisico; preparare e collaudare lo ZIP aggiornato.

