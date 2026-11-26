# Pacchetto esportabile — LINGUE FACILI

> **Pacchetto della produzione 9656, 25 novembre 2026:** questa copia contiene il codice applicativo `4f9f9b4` pubblicato su https://lingue-facili.easy-peasy.site dopo approvazione dell'anteprima. Include: (1) adattamento del solo numero reale di domande presenti nell'originale sotto o pari a 10 senza aggiungerne altre (oltre 10 usa le prime 10 con pop-up); (2) traduzione italiana delle opzioni nella scelta multipla (pagina 3, con fallback per schede storiche); (3) stile e colori uniformati a `Widget-metacognitivo-per-il-calcolo-di-equazioni` (`#8B3A1A`, `#FAF8F5`, `#F2E7DE`, `#2E2118`, Alto Contrasto `#000000`/`#ffdb7b`/`#ffdf80`), con barra di accessibilità e finestra di ritaglio invariate.
>
> **Produzione precedente 9248, 14 novembre 2026:** pubblicata su https://lingue-facili.easy-peasy.site dal checkpoint `db65943` dopo approvazione dell'anteprima. Adatta le prime 10 frasi/domande quando la fonte ne contiene altre e mostra un pop-up sulle esclusioni. Ogni lacuna MC vale una domanda; la fonte resta integrale e le schede già salvate restano intatte. Riconoscimento e correttezza dipendono dall'IA: il docente verifica. Continuano ad applicarsi i limiti di 500 parole per campo e 5 foto.
>
> La produzione mantiene i cinque pulsanti foto/audio impilati e più stretti e i pulsanti PDF senza icone della precedente 9247. Barra, ritaglio e cornice non sono stati cambiati. Le prove mobile sono emulazioni, e la sintesi vocale simulata non sostituisce l'ascolto reale. Anteprima e produzione condividono il database; creare davvero una scheda in anteprima la salva normalmente. Nuovi deploy richiedono consenso separato.

> **Produzione 9035 con cornice anti-tremolio Android (l'app è poi passata alla 9043, vedi la correzione più sotto).** L'app e la cornice `cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html` sono state pubblicate dopo conferme distinte. Il blocco pubblicato il 7 novembre 2026 alle 19:50:28 UTC è identico alla cornice del Codice 3 del DOCX aggiornato; `CODICE-3-BLOGGER-ESATTO.html` è la copia storica precedente. Le prove emulate non garantiscono tutti i telefoni fisici.

<!-- lf-scroll-interno-iframe --> > **Correzione del tremolio residuo su Android (7 novembre 2026). Stato: pubblicata in produzione (deployment 9043, checkpoint 850745d).**
> **Intestazione PDF semplificata (8 novembre 2026). Stato: pubblicata in produzione (deployment 9049, checkpoint 1c34723).** Sotto il titolo dei PDF (tutte le lingue, con e senza risposte) non compaiono più la riga «<tipologia> · <italiano> [- CON LE RISPOSTE]» né la didascalia «Il segno verde…»; vengono subito i dati dello studente, poi punteggio (solo con risposte) e consegna. Il riordino è provato per intero con mouse e dito (nuova prova `tests/crop-qa/riordino-completo.e2e.mjs`, 5 modi, app locale e produzione). L'utente ha confermato la scomparsa del tremolio sul telefono Android fisico.
 Nel flusso foto → testo, con il dito sullo schermo, l'iframe restava più basso del contenuto (circa 1259 px contro circa 2512 px) e il documento interno scorreva da solo fino a 836 px; solo dopo circa 5,9 s la cornice lo allungava e il contenuto «saltava». Ora `html.lf-embedded` ha `overflow: hidden` (`index.css`) e `heightSync.ts` invia subito la sola crescita che supera l'iframe, anche durante tocchi e digitazione; lo scorrimento interno (`lf-inner-scroll`) torna attivo solo se l'ospite non segue l'altezza. **La cornice del blog e il Codice 3 del DOCX non cambiano.** Le prove emulate non sostituiscono Android fisico.

Il precedente deployment **9017**, con codice applicativo del checkpoint **ec8b4c7** (pre-deploy **29e79f1**), ha introdotto un'impaginazione più compatta. Il PDF usa la soglia inferiore condivisa `PAGE_BOTTOM = 50` in `exportWorkout.ts`, che consente un'impaginazione più compatta prima del piè di pagina; i salti effettivi dipendono dall'altezza degli item. Restano le tessere del riordino dello stesso colore nell'app e nel PDF, introdotte nella precedente produzione 9002 (checkpoint d0eb270). Il precedente deployment 8996 proveniva dal checkpoint d01f647. Include il ritaglio simile al Widget metacognitivo senza sbordamenti e il riordino senza barra di aiuto. Il frammento storico del post pubblico (feed delle 12:44:43 UTC) è conservato in `cornice-dinamica/CODICE-3-BLOGGER-ESATTO.html`, SHA-256 `6b058fc82c9ef56c9d3f9dce302dff7803d84221ebdc35faa88566ff9262ecc1`. Dopo l'approvazione separata il post è stato aggiornato alle 19:50:28 UTC: il blocco corrente è identico a `CODICE-3-ANTI-TREMOLIO-ANDROID.html`, SHA-256 `3782b7aa77137861794b826ca41be0f9fda42537ee0e1e239ccb897ca4170098`. L'app e la cornice del blog restano componenti distinti. Il pacchetto comprende il codice dell'app, `pnpm-lock.yaml` e `patches/`, schema PostgreSQL, font OpenDyslexic, bandiere SVG con licenza, modelli OCR `eng/fra/spa`, `render.yaml`, cornici e guide per IA e sviluppatori. L'installazione di `ffmpeg-static` scarica il binario necessario a convertire audio (licenza GPL-3.0-or-later).

## Da dove partire

1. `README.md` — funzionalità e comandi.
2. `REBUILD.md` — ricostruzione della stessa app dalla propria repository GitHub.
3. `ADATTARE.md` — come creare varianti senza cambiare inutilmente l'architettura.
4. `RENDER.md` — procedura GitHub → Render e configurazione dell'embed.
5. `ACCESSIBILITA.md` — ♿ misure accessibili, file e indicazioni di riuso.
6. `AGENTS.md` — invarianti e cautele per agenti IA.
7. `cornice-dinamica/` — `CODICE-3-ANTI-TREMOLIO-ANDROID.html` è la cornice identica al post pubblico; `CODICE-3-BLOGGER-ESATTO.html` e le altre varianti sono riferimenti storici.
8. `tests/crop-qa/README.md` — prove riproducibili con foto sintetiche e IA simulata.
9. `RAPPORTO-COLLAUDO.md` — esiti verificati e limiti del controllo finale, inclusi IA e PDF.
10. `materiali-blog/` — presentazione Word e copertina clay 16:9, fornite come materiali separati; non sono componenti dell'app e non vengono pubblicate automaticamente.

## Ritaglio originale

L'hook viewport e la geometria sono identici alla repository `andreakeating1982/Widget-metacognitivo-per-il-calcolo-di-espressioni`, commit `5d7824409c4e445c077123b699b10f2191ff4d9d`; il componente conserva la logica e aggiunge span alle etichette. Il CSS mantiene lo stile originale, con pulsanti 14px al 100% per esplicita scelta dell'utente e bersaglio alto almeno 44px; a 160% su schermi stretti dispone le icone sopra il testo per evitare il debordo presente nella sorgente. L'integrazione con la coda foto e la cornice è specifica di questa app. Vedi `REBUILD.md` per limiti, fallback e test.

## Privacy e sicurezza

Il pacchetto **non contiene il database, schede, fotografie degli studenti o credenziali**; `.env.example` è un modello senza valori. Sono esclusi dipendenze installate, build, log, dati temporanei, `template.json`, le copie obsolete della cornice Inglese Facile e lo script storico distruttivo `scripts/fix-db.mjs`; il comando di reset è stato rimosso da `package.json`. I due materiali di presentazione nella cartella `materiali-blog/` sono quelli già consegnati in precedenza e non pubblicano né modificano il post. I test forniti utilizzano dati e immagini sintetiche; il test di impaginazione usa un'anagrafica e frasi inventate. La creazione del pacchetto non cambia né cancella i dati esistenti.

**Ricostruire il software non trasferisce automaticamente le schede già salvate.** Un eventuale trasferimento di dati reali richiede un piano specifico e l'autorizzazione del proprietario. Per l'IA su Render serve una credenziale valida abilitata all'uso esterno: verificare la disponibilità prima del trasferimento e non pubblicarla nella repository. Non eseguire reset o modifiche distruttive su un database con dati senza consenso esplicito.

La pubblicazione su Render non è stata eseguita dal pacchetto; seguire `RENDER.md` e verificare sul proprio account. Il Blueprint `free` è solo per test: il relativo database ha una scadenza e i dati possono essere eliminati. Prima di utilizzare dati scolastici reali servono una configurazione persistente e backup adeguati: vedere la [documentazione ufficiale](https://render.com/docs/free).

