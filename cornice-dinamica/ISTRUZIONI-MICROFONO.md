# Lingue Facili nel blog: microfono e fotocamera

## Verifica del post attuale

Nel controllo del 7 novembre 2026, il post [LINGUE STRANIERE](https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html) conteneva già `allow="camera; microphone"` e il Codice 3 aggiornato: non serve aggiungere nuovamente l'attributo in quel post se è ancora presente. L'utente deve comunque autorizzare il browser; in quella verifica non è stata effettuata una nuova registrazione reale.

## Diagnosi precedente — 6 novembre 2026

Nel post [LINGUE STRANIERE](https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html), il 6 novembre 2026 la cornice di Lingue Facili non aveva l'attributo `allow`: nel browser controllato, il sito ospitante consentiva il microfono ma la cornice incorporata bloccava sia microfono sia fotocamera. Un aggiornamento della sola app non modifica automaticamente il codice già incollato nel post.

## Correzione minima del codice già presente

1. Apri il post in modifica e passa alla visualizzazione **HTML**.
2. Cerca l'elemento `<iframe` della cornice **Lingue Facili** (è quello con `class="lf-iframe"` e `title="Lingue Facili — app in cornice"`).
3. Aggiungi **all'interno del tag di apertura**, senza cancellare o sostituire `src`, `class`, `title` e altri attributi:

   ```html
   allow="camera; microphone"
   ```

   Per esempio, il tag può apparire così; rispetta comunque gli altri attributi eventualmente già presenti nel post:

   ```html
   <iframe class="lf-iframe" title="Lingue Facili — app in cornice" src="about:blank" allow="camera; microphone"></iframe>
   ```

4. Salva/aggiorna il post, riaprilo e autorizza microfono o fotocamera se il browser lo richiede. Se il permesso era già stato negato, riabilitalo nelle impostazioni del sito del browser e controlla i permessi del dispositivo.
5. Rientra nell'app dal blog e prova **REGISTRA ISTRUZIONI**; puoi anche aprire [l'app direttamente](https://lingue-facili.easy-peasy.site/) per distinguere un problema del blog da uno del dispositivo.

**Alternativa:** sostituisci l'intera vecchia cornice di Lingue Facili con il contenuto di `embed-lingue-facili-dedicata.html`, già comprensivo dell'attributo. Non sostituire il resto del post. Dopo il salvataggio, verifica che Blogger abbia mantenuto l'attributo; l'autorizzazione nell'iframe non sostituisce il consenso dell'utente nel browser.

È stata provata una cornice cross-origin simulata: senza l'attributo entrambi i permessi risultano bloccati; con l'attributo il microfono sintetico registra e la trascrizione simulata funziona. Il post reale non è stato modificato o pubblicato da questo collaudo.

