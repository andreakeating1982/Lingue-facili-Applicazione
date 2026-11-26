# CORNICE DINAMICA — LINGUE FACILI (embed per Blogger)

Questa cartella contiene la **cornice dinamica** dell'app LINGUE FACILI: un blocco HTML+CSS+JS autosufficiente che incornicia l'app dentro un post del blog, con altezza che si adatta da sola al contenuto.

La cornice è **dedicata** e **impermeabile**: URL, titolo e font sono fissi e puntano a `https://lingue-facili.easy-peasy.site`; ogni istanza trova i PROPRI elementi (scoping via `document.currentScript`), rinomina i propri id con un token univoco e accetta solo i messaggi di altezza del PROPRIO iframe. Puoi incollare più cornici nella stessa pagina senza conflitti.

## Contenuto della cartella

| File | Descrizione |
|---|---|
| `CODICE-3-ANTI-TREMOLIO-ANDROID.html` | ⭐ **Da usare:** copia esatta del blocco HTML/CSS/JS pubblicato nel post «LINGUE STRANIERE» il 7 novembre 2026 alle 19:50:28 UTC. SHA-256 `3782b7aa77137861794b826ca41be0f9fda42537ee0e1e239ccb897ca4170098`. Identico al Codice 3 del DOCX aggiornato. |
| `CODICE-3-BLOGGER-ESATTO.html` | Copia **storica precedente**, osservata nel feed delle 12:44:43 UTC. SHA-256 `6b058fc82c9ef56c9d3f9dce302dff7803d84221ebdc35faa88566ff9262ecc1`. |
| `embed-lingue-facili-dedicata.html` | Versione dedicata precedente, conservata per i test storici; NON è la copia dell'ultima cornice pubblicata. |
| `embed-lingue-facili-lite.html` | **Versione leggera (~5 KB)**: iframe + altezza dinamica, senza testata/statistiche |
| `ISTRUZIONI-MICROFONO.md` | Diagnosi e procedura per aggiornare i permessi della cornice già inserita nel blog |
| `test-dedicata.html` | **Pagina di test**: simula un post Blogger con la cornice dedicata |
| `test-impermeabile.html` | **Test di impermeabilità**: 2 cornici + una «cornice ladra» che prova ad agganciare le altre |

## Come si usa in Blogger

1. Apri il post → passa alla vista **HTML**.
2. Incolla l'intero contenuto di `CODICE-3-ANTI-TREMOLIO-ANDROID.html` per riprodurre la cornice pubblicata. `CODICE-3-BLOGGER-ESATTO.html`, `embed-lingue-facili-dedicata.html` e la variante lite sono versioni precedenti. Conserva gli altri contenuti del post.
3. Pubblica. Fatto: l'altezza si adatta da sola, i font OpenDyslexic arrivano dall'app (auto-ospitati, CORS aperto).

Per dettatura e registrazione vocale l'iframe contiene `allow="camera; microphone"`: eventuali vecchie cornici che ne sono prive vanno aggiornate nel post, perché una modifica all'app non può cambiarne l'HTML. Nel controllo del 7 novembre 2026 il post «LINGUE STRANIERE» conteneva già l'attributo e il Codice 3 approvato. Il browser deve comunque ottenere il permesso dell'utente e il sito ospitante non deve bloccare il microfono. In caso di blocco, aprire l'app fuori dalla cornice.

La versione ora pubblicata sul blog conserva lo standard CSS per i pulsanti e aggiunge il coordinamento anti-tremolio con l'app. Dopo conferma dell'utente il blocco è stato sostituito nel post; il feed pubblico è stato confrontato byte per byte con il file sopra e con il DOCX. Su richiesta la testata riprende la foto dell'utente: pulsanti chiari compatti alti circa 32px, bordo originale chiaro, icone SVG da 16px con tratto sottile e scritte «Schermo intero» / «Ricarica» visibili anche su telefono. Su schermo stretto il gruppo può andare a capo rispetto al titolo; le due azioni restano affiancate. Un'area invisibile estende verticalmente il bersaglio di ogni pulsante fino ad almeno 44px senza modificarne l'aspetto. Nella cornice aggiornata ogni icona usa un unico `<path>` chiuso; alcune regole dello standard sono limitate a `.lf-cornice` e altre a `.lf-lingue-facili`. L'HTML punta alla **produzione**: le modifiche dell'app in anteprima non compaiono nel blog finché non vengono approvate e pubblicate. Per cambiare la testata, sostituire manualmente il codice della cornice già presente nel post. Il test storico `npm run icone-cornice` in `tests/crop-qa/` riguarda la versione precedente e non verifica il blocco esatto del blog; per la cornice aggiornata usare `npm run cornice-blog` nella stessa cartella.

## Come si usa in un sito proprio

Puoi servire i file dal tuo server o testare in locale servendoli dalla cartella `client/public/` dell'app (es. copia i file in `client/public/cornice-test/` e apri `http://localhost:3000/cornice-test/test-dedicata.html`).

## Se cambia l'URL dell'app

Cambia `APP_URL` in tutte le varianti HTML utilizzate, compresa `CODICE-3-ANTI-TREMOLIO-ANDROID.html`. Nella **dedicata** e nella cornice pubblicata cambia anche i due URL assoluti `@font-face` Regular/Bold al nuovo dominio; nella **lite** i font derivano automaticamente da `APP_URL`. Aggiorna il codice già incollato nel blog e verifica CORS `/fonts` e apertura del ritaglio. Il protocollo `labvisivo:height` usa il token e filtra i messaggi per sorgente dell'iframe.

## Protocollo di comunicazione

- L'app misura la propria altezza e la invia con `{ type: "labvisivo:height", height, cornice }` (vedi `client/src/lib/heightSync.ts`).
- La cornice risponde al ping `{ type: "labvisivo:ping", cornice }` rinviando l'altezza corrente.
- Filtro anti-intrusi: la cornice accetta solo messaggi con `e.source === iframe.contentWindow` e (se presente) token `cornice` corrispondente.
- Anti-tremolio: nessuna transizione CSS sull'altezza, debounce 200 ms, silenzio nei 300 ms post-applicazione, clamp 100–15000 px, conferma per salti > 2×, congelamento dopo 3 crescite consecutive. App e cornice usano anche `labvisivo:interaction` per annullare i resize pendenti e richiedere una misura fresca dopo gesto, digitazione e scroll.

## Titolo testata

Il titolo «LINGUE FACILI» è in **OpenDyslexic Bold** (17px, letter-spacing 2px, colore inchiostro #2e2018), sulla stessa riga dei pulsanti «Schermo intero» e «Ricarica», tutto centrato.

<!-- lf-scroll-interno-iframe -->
## Coordinamento con l'app (7 novembre 2026)

La cornice non è cambiata. Quando l'app è in un iframe e l'ospite la segue (token `?cornice=` nell'URL o ping negli ultimi 8 s), l'app imposta `overflow: hidden` sul documento: i gesti passano alla pagina del blog e il contenuto non scorre dentro l'iframe mentre l'altezza viene adeguata. Se una cornice o un embed non segue l'altezza, lo scorrimento interno si riattiva da solo dopo almeno 3 s di contenuto troncato senza tocchi. Una cornice può anche inviare `{ type: 'labvisivo:fullscreen', active: true|false }` per riattivarlo subito. Non sostituire l'altezza dell'iframe con un valore fisso senza ritestare con `tests/crop-qa/tremolio-foto-blog.stress.mjs`.
