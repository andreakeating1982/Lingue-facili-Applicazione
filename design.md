# Lingue Facili — adattamento accessibile

## Direzione
L'app riprende la prima pagina e la barra compatte del Widget metacognitivo e delle altre app del blog: stesse capsule, colori, spazi, disposizione a due colonne dei dati studente, icona libro e pulsante ENTRA. Nessun selettore di lingua nella prima pagina. Dalla seconda pagina mostrare progressivamente: lingua → testo o foto riconosciuta → sezione «SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA» con scelta del tipo, spiegazione e audio → creazione. La leggibilità e la sicurezza d'uso restano centrali; nel ritaglio i comandi mantengono aspetto e dimensioni del Widget metacognitivo per quanto possibile, correggendo gli sbordamenti a zoom elevato come richiesto. Non introdurre fotografie decorative nelle schermate operative.

## Destinatari e azione
Il docente seleziona nella seconda pagina inglese con bandiera irlandese, spagnolo o francese; aggiunge testo o più foto, sceglie riordino o 2/3/4 risposte e controlla una spiegazione proposta dall'IA. Può modificarla scrivendo, registrando fino a 30 secondi o caricando un file audio. Lo studente svolge un elemento alla volta, può mostrare o nascondere la traduzione e scarica il PDF.

## Palette e tipografia
- Sfondo: #F8F1E4; superficie: bianco; testo: #2E2018.
- Azione principale: marrone scuro #5D4037; azioni secondarie #805B46; bordi #D6CEC4; superfici #FAF8F5 / #F0E5DF.
- Nel riordino tutte le tessere usano lo stesso stile chiaro: sfondo #F0E5DF, testo #5D4037 e bordo #D4B2A0, indipendentemente dal ruolo grammaticale. Le parole già inserite e la tessera trascinata conservano la stessa palette; il PDF usa gli stessi colori. Titoli, comandi e superfici delle pagine 2 e 3 restano coordinati sulla scala dei marroni.
- OpenDyslexic auto-ospitato ovunque; nel percorso operativo il testo resta almeno 14 pt anche quando si seleziona l'80% o il 90%. Nel solo ritaglio, su esplicita scelta dell'utente, le etichette hanno le misure del widget originale: 14px alla scala 100%, scalabili da A−/A+. Come nel blog, A− e A+ regolano la scala dall'80% al 160%, con il limite minimo per il percorso; prima pagina e barra mantengono il formato compatto richiesto. Titoli della seconda e terza pagina centrati e maiuscoli; gruppi di pulsanti centrati. La prima pagina mantiene due colonne, salvo zoom elevato e schermi stretti. I controlli visivamente compatti della barra conservano lo stile del blog ma hanno aree di tocco invisibili di 44 px sui dispositivi tattili. Nell'ultima foto ENTRA è 14px bianco su #B8846A: l'aspetto è stato mantenuto su richiesta, ma il contrasto di circa 3,2:1 è inferiore alla soglia 4,5:1 per testo normale; documentare il limite senza dichiarare conformità WCAG.

## Nuova anteprima — limite automatico e avviso
Quando un nuovo esercizio supera 10 frasi o domande, adattare soltanto le prime 10 in ordine e lasciare fuori le successive senza cancellare il testo sorgente. Dopo la generazione mostrare un pop-up modale chiaro, con titolo, spiegazione e solo pulsante CONTINUA: l'utente viene informato prima di aprire la scheda. Il pop-up segue palette marrone, OpenDyslexic, alto contrasto, caratteri e interlinea scelti, tastiera e focus. Deve adattarsi a telefoni e zoom, anche scorrendo se necessario. Nessun pop-up quando non è stata tralasciata alcuna domanda.

## Composizione e accessibilità
- Colonna centrale, larghezza massima coerente con l'app esistente; sezioni ordinate anche a 360–390px.
- Controlli ben etichettati, radio o pulsanti con stato annunciato, bersagli tattili di almeno 44px e focus visibile.
- Traduzione inizialmente nascosta con pulsante esplicito e aria-expanded; messaggi di stato leggibili e annunciati.
- Mantenere ASCOLTO, contrasto, righello, scala caratteri, trascinamento e alternativa touch/tastiera.
- Foto: limite complessivo di cinque per esercizio, con stesso ritaglio originale, ordine, scorrimento mobile e senza modificare `confirm()` o la matematica del box. Testo ed eventuale spiegazione: massimo 500 parole ciascuno, con contatori accessibili.
- Mostrare subito la spiegazione preparata dall'IA nello stesso campo modificabile, con stato di caricamento e recupero manuale in caso di errore. Mai sovrascrivere silenziosamente una modifica dell'utente. Eliminare i quattro suggerimenti e il pulsante «REGISTRA E TRASCRIVI».

## Iterazione del 13 novembre — coerenza e lettura
Confronto con il Widget metacognitivo pubblicato e la sua repository (commit 3a7e776): mantenere sfondo crema, superfici bianche, bordi caldi e comandi marroni arrotondati. Uniformare i comandi della seconda pagina alle capsule del widget, senza modificare i colori fissati per PDF, tessere e ritaglio. Barra di riconoscimento file invariata; durante la spiegazione usare una card interna con la scritta già presente e una barra indeterminata, senza barra aggiuntiva sotto CREA. ASCOLTO legge solo elementi visibili, in sequenza come il widget; conserva una voce coerente per lingua e associa esplicitamente lingua italiana all'interfaccia e lingua selezionata ai contenuti didattici.

## Iterazione — foto pulsante e risposte progressive
I pulsanti dell'app assumono il riferimento allegato: marrone #B8846A, testo bianco OpenDyslexic in grassetto, angoli 10px, senza bordo o ombra marcata; mantenere focus visibile, stato attivo distinguibile e indicazioni corretto/errato. Eccezioni attuali: la barra della prima pagina segue la successiva foto di Latino Facile; tutti i controlli del ritaglio rimangono invariati. Scelte MC e tessere di riordino sono chiare; il comando finale torna allo stile testuale precedente. Non cambiare la cornice esterna Blogger senza consenso né la geometria del ritaglio. Nelle frasi con più lacune mostrare soltanto le opzioni della lacuna attiva: risolta una, rivelare la successiva, mantenendo le lacune future vuote e la traduzione senza soluzioni. Massimo 10 frasi/domande per i nuovi esercizi; preservare gli esercizi storici.

## Iterazione — eccezioni visive sulla base delle foto (13 novembre)
La prima pagina riprende proporzioni, caratteri compatti, campi, pulsante ENTRA e barra a capsule arrotondate della fotografia Latino Facile, senza copiare titolo o dati personali: mantenere LINGUE FACILI e le sue funzionalità. Scala variabile 80–160%, lettura, focus e bersagli tattili continuano a funzionare. Le scelte multiple e tutte le tessere del solo riordino sono in una tinta crema-rosata più chiara del marrone generale, con testo scuro ben leggibile e feedback visibile; condividere la tinta delle tessere anche con il PDF e preservare drag e palette uniforme. Il comando finale Crea un nuovo esercizio torna al precedente link scuro sottolineato con icona Home. La finestra del ritaglio e la cornice non cambiano. Il limite 10 e le risposte progressive restano invariati.

## Iterazione — pulsanti foto e audio uniformi (14 novembre)
Nella seconda pagina le coppie SCATTA UNA FOTO / CARICA FOTO O PDF e REGISTRA ISTRUZIONI / CARICA FILE AUDIO hanno la stessa larghezza all'interno della rispettiva coppia tramite `.lf-equal-actions`; i nomi visibili dei comandi foto sono in maiuscolo. **Limite della versione pubblicata 9246:** con testo inserito compare anche «Svuota» nella stessa riga: a 320 px e scala 160% i due comandi foto sono larghi circa 57 px e alti circa 627 px. Non assumere che vadano automaticamente a tutta larghezza; correggere solo in una nuova anteprima, senza cambiare il ritaglio o la barra a insaputa dell'utente.

## Nuova anteprima — pulsanti impilati e PDF senza icone (14 novembre)
Dalle fotografie dell'utente: nella seconda pagina disporre verticalmente i tre comandi SCATTA UNA FOTO, CARICA FOTO O PDF e SVUOTA, e sotto i due comandi audio. Ogni pulsante ha la stessa larghezza del gruppo, testo maiuscolo centrato e icona già esistente centrata sopra il testo; su telefono utilizzare lo spazio disponibile e su desktop mantenere il gruppo centrato. Tutti i testi dei comandi foto, audio e PDF seguono l'interlinea scelta nella barra. Il terzo comando compare solo quando c'è contenuto da svuotare, come prima. Nella schermata finale togliere le sole icone dei due pulsanti PDF, lasciando diciture centrate, colori, accessibilità e funzioni di download invariati. Non intervenire su barra, ritaglio, cornice, database o altri elementi.

## Ulteriore anteprima — pulsanti ancora un po' più stretti (14 novembre)
Ridurre leggermente e in egual misura i tre pulsanti foto e i due audio rispetto all'anteprima precedente: larghezza di base al 78% dello spazio disponibile, massimo 390 px, adattabile al testo ingrandito. Restano centrati, impilati, con le stesse icone e diciture. Non modificare altri pulsanti, barra, ritaglio, cornice o funzionalità.

## Nuova anteprima — pulsanti foto e audio più stretti (14 novembre)
Dalle due fotografie: restringere tutti e cinque i pulsanti foto e audio, conservando la stessa larghezza fra loro, la colonna centrata e le diciture leggibili; non modificare i due pulsanti PDF che non compaiono nelle nuove fotografie. In quella precedente anteprima la larghezza era l'85% dello spazio disponibile, al massimo 425px; con caratteri ingranditi può allargarsi un poco, fino allo spazio disponibile, per le diciture temporanee. Le parole più lunghe possono andare a capo con sillabazione se necessario. Mantenere intatti funzioni, colori, icone, barra, crop e cornice.

## Iterazione — spazio intorno alla creazione
Sulla seconda pagina separare leggermente il comando «CREA L'ESERCIZIO» dal messaggio audio che lo precede e dal bordo inferiore della scheda, senza cambiare l'aspetto del pulsante, l'ordine dei controlli, le funzionalità o la finestra di ritaglio. Gli spazi devono restare proporzionati anche con caratteri ingranditi e su schermo stretto.

## Verifiche
Controllare la schermata docente, la schermata studente, ritaglio e PDF su desktop e telefono. Verificare tastiera, stato delle scelte, un item per volta, traduzioni nascoste e ripristino per ogni item.

## Iterazione — barra standard e riordino su cellulare
- Allineare visivamente la barra al Widget metacognitivo realmente pubblicato nel blog, mantenendo i cinque gruppi, il TTS multilingue, gli stati accessibili e l'area tattile. Le dimensioni della barra seguono la scala del widget (base 16 px), senza abbassare il minimo 14 pt delle pagine didattiche.
- Prevenire oscillazioni nel riordino, conservando trascinamento, tocco e tastiera. Verificare l'app vera anche nella cornice del blog, con esercizi sintetici, su più larghezze e zoom.
- Nella posizione indicata dalla foto, tutti gli stati della spiegazione IA usano marrone scuro e grassetto; non cambiare il contenuto dei messaggi.


## Iterazione — riferimento foto e audio
- Ritaglio: riprodurre il widget sorgente del repository richiesto, commit `5d7824409c4e445c077123b699b10f2191ff4d9d`: titolo centrato, pulsanti marroni compatti, distribuiti su una o più righe come nella sorgente; font originale 14px al 100% per espressa scelta dell'utente. Il percorso didattico conserva il minimo 14pt, mentre nel crop il font segue la scala originale dell'accessibilità. Non toccare `confirm()`, viewport, maniglie o geometria. Il dialogo resta sopra l'overlay anche con foto consecutive (`z-index: 51` contro `z-50`). A 320px con scala 160% evitare sovrapposizioni e sbordamenti di icone ed etichette senza ridurre il carattere scelto; in orizzontale il corpo del dialogo scorre.
- Riordino: la legenda visiva «CHI / COSA FA / OGNI QUANTO / IL RESTO» resta rimossa. Su richiesta successiva tutte le parole hanno lo stesso colore neutro anche nel PDF, senza legenda dei ruoli né indicazioni di aiuti cromatici; conservare traduzione, feedback e comandi.
- Testata della cornice Blogger: mantenere le icone Schermo intero e Ricarica pienamente visibili anche con temi che alterano gli stili SVG. Dopo il rifiuto dell'ingrandimento precedente, seguire la foto allegata: pulsanti compatti chiari con bordo sottile originale, angoli arrotondati, icone sottili e le scritte «Schermo intero» e «Ricarica»; evitare contorni scuri o icone ingrandite. Conservare tratti SVG fratelli e funzionalità accessibili; su telefono disporre il gruppo a capo quando necessario senza tagliarlo.
- In scelta multipla non preselezionare nessun numero: attendere una scelta esplicita tra 2, 3 o 4 prima di richiedere e mostrare la spiegazione IA. L'alternativa riordino non richiede questa scelta.
- Creare spazio sopra e sotto il gruppo REGISTRA ISTRUZIONI / CARICA FILE AUDIO per separarlo dai messaggi circostanti.
- Al controllo documentato del 7 novembre 2026 la cornice del post consentiva `camera; microphone`; verificare eventuali cambiamenti successivi. Non modificare il blog senza autorizzazione esplicita.

