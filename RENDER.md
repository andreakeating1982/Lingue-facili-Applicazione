# RENDER — Trasferire «LINGUE FACILI» da Easy-Peasy AI a Render

Obiettivo: pubblicare la stessa app su Render (https://*.onrender.com) partendo da una repository GitHub, senza perdere funzionalità. Il pacchetto contiene già `render.yaml` (Blueprint) che crea automaticamente database PostgreSQL + Web Service.

**Stato di questo pacchetto:** codice della produzione **9656** del 25 novembre 2026 di Easy-Peasy (checkpoint `4f9f9b4`), con numero reale di domande ($\le 10$ senza aggiunte; $> 10$ prime 10 con avviso), traduzione italiana delle opzioni nella scelta multipla e stile uniformato a `Widget-metacognitivo-per-il-calcolo-di-equazioni`. La richiesta di uno ZIP non autorizza la pubblicazione su Render o altrove. Richiedere sempre consenso separato prima di pubblicare una nuova destinazione o versione.

---

## Passo 1 — Crea la repository GitHub

```bash
# dentro la cartella del progetto (estratta da questo pacchetto ZIP)
git init
git add .
git commit -m "Lingue Facili — versione esportabile"
# crea la repo (vuota) su https://github.com/new, poi:
git remote add origin https://github.com/<utente>/lingue-facili.git
git branch -M main
git push -u origin main
```

⚠️ Verifica che NON siano stati committati `.env`, `node_modules/`, `dist/`, `data/` o dati degli studenti. La repository può essere pubblica o privata purché Render abbia accesso: [documentazione ufficiale Git provider](https://render.com/docs/git-provider). Controlla i requisiti correnti del tuo account su Render.

## Passo 2 — Deploy con Blueprint (consigliato)

1. Vai su https://dashboard.render.com → **New +** → **Blueprint**.
2. Collega la repository GitHub del passo 1.
3. Render legge `render.yaml` e crea automaticamente:
   - database PostgreSQL gratuito `lingue-facili-db` (regione Frankfurt);
   - Web Service Node `lingue-facili` con `DATABASE_URL` già collegato e `BETTER_AUTH_SECRET` generato;
   - build `corepack enable && pnpm install --frozen-lockfile && pnpm build`, avvio `pnpm start`.
4. Clicca **Apply** e attendi il primo build.

> **Attenzione ai dati degli studenti:** il Blueprint è impostato su `plan: free` solo per prove, non per l'uso scolastico reale. Secondo la [documentazione ufficiale Render](https://render.com/docs/free), il database gratuito scade dopo 30 giorni e, terminato l'ulteriore periodo indicato da Render, può essere eliminato insieme ai dati. Anche il filesystem del servizio è temporaneo. Prima di usare dati reali verifica le condizioni aggiornate e predisponi un database persistente e un piano di backup adatto; non affidarti allo ZIP per conservare le schede.

## Passo 3 — Valorizza le variabili nel dashboard

Render può richiedere le variabili `sync: false` durante la creazione del Blueprint; altrimenti impostale in Dashboard → Web Service → **Environment**:

| Variabile | Valore |
|---|---|
| `TRUSTED_ORIGINS` | `https://lingue-facili.onrender.com` (il dominio creato da Render; obbligatorio per cookie/auth corretti) |
| `EASY_PEASY_API_KEY` | Credenziale valida per l'endpoint Easy-Peasy usato dall'app, necessaria per generazione IA, lettura IA delle foto e trascrizione remota. Impostarla come segreto solo se disponibile e abilitata per l'uso esterno: non copiare né esporre la chiave della piattaforma. Senza chiave, la lettura foto può ripiegare su OCR locale e le schede già presenti sul database Render restano accessibili; i nuovi esercizi non vengono generati. |

Salva: il servizio si ridistribuisce da solo.

## Passo 4 — Migrazioni del database (solo al primo deploy)

Il database di Render è vuoto: crea le tabelle con drizzle-kit dal tuo computer usando la **External Database URL** del database (Dashboard → lingue-facili-db → Connections):

```bash
DATABASE_URL="postgres://<utente>:<password>@<host-external>/<db>" npx drizzle-kit push
```

⚠️ Usare questo comando solo su un database **nuovo e vuoto**, dopo aver verificato la destinazione. Non lanciare `pnpm db:reset`, script storici come `scripts/fix-db.mjs` né modifiche distruttive su dati esistenti senza l'esplicito consenso del proprietario. `pnpm db:push` richiede la catena storica delle migrazioni. Non incollare mai l'URL con password in chat o repository.

Verifica: `curl -s -o /dev/null -w '%{http_code}' https://lingue-facili.onrender.com/` → 200 per la shell HTML; apri poi l'URL nel browser per vedere «LINGUE FACILI»; il selettore delle 3 lingue è nella seconda pagina, dopo ENTRA. Su un database di prova separato puoi creare un esercizio sintetico (il risultato viene salvato nella tabella `exercises`). Lo ZIP non trasferisce i record preesistenti: per migrare dati reali serve una procedura di esportazione/importazione e consenso specifici.

## Alternativa manuale (senza Blueprint)

Dashboard → **New +** → **Web Service** → collega la repo → Runtime **Node** →
- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- Start command: `pnpm start`
- Environment: `NODE_VERSION=22`, `DATABASE_URL` (PostgreSQL creato a parte), `BETTER_AUTH_SECRET` (generateValue o `openssl rand -base64 32`), `TRUSTED_ORIGINS`, `EASY_PEASY_API_KEY`. Registrazione max 30 s e file audio vengono trascritti con input audio multimodale usando la stessa chiave, senza storage esterno; la scrittura resta alternativa. `ffmpeg-static` deve scaricare il binario durante l'installazione su un server Node compatibile; è incluso nelle dipendenze autorizzate da pnpm.

## Troubleshooting frequente

| Problema | Causa e soluzione |
|---|---|
| Build fallisce su pnpm | `corepack enable` mancante nel build command, oppure `pnpm-lock.yaml` assente/obsolete: usa `--frozen-lockfile` con il lockfile del pacchetto |
| «relation "user" does not exist» | Migrazioni non eseguite: rifai il **Passo 4** |
| Cookie/auth non funzionano | `TRUSTED_ORIGINS` non impostato sul dominio Render esatto (con https) |
| «Cannot find module …» in build | `patches/` o `pnpm-lock.yaml` mancanti dalla repo: ricommit dal pacchetto |
| Prima richiesta lentissima | Normali sul free tier: il servizio dorme e si risveglia (~30-60 s) |
| Deploy statico invece di Node | Runtime scelto «Static Site»: ricrea il servizio con Runtime **Node** |
| Nuovi esercizi non generati | Verificare `EASY_PEASY_API_KEY`, connettività e limiti del provider. Non inventare un esercizio di ripiego spacciandolo per l'adattamento richiesto. |

## Aggiornare l'embed nel blog dopo il trasferimento

Parti da `cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html`, corrispondente alla cornice del post verificata il 7 novembre 2026; `CODICE-3-BLOGGER-ESATTO.html` è una copia storica precedente. In una copia per Render cambia `APP_URL` con il nuovo dominio **e aggiorna anche i due URL assoluti `@font-face`** (`OpenDyslexic-Regular-v2.woff2` e `Bold-v2.woff2`) allo stesso dominio. Le varianti `embed-lingue-facili-dedicata.html` e `-lite.html` sono storiche e non coincidono con la cornice pubblicata; nel file lite i font derivano da `APP_URL`. Aggiorna poi il post Blogger in vista HTML solo quando desiderato e autorizzato. Verifica CORS `/fonts`, caricamento e ritaglio nella cornice. Il protocollo `labvisivo:height` usa il token e filtra i messaggi per sorgente dell'iframe.

**Stato della guida:** il Blueprint e la ricostruzione sono predisposti; la pubblicazione su Render e l'uso della chiave in un ambiente esterno devono essere verificati sul tuo account. Questo pacchetto non effettua alcun deploy.

## Differenze Easy-Peasy AI ↔ Render

| | Easy-Peasy AI (attuale) | Render |
|---|---|---|
| URL | `lingue-facili.easy-peasy.site` (Cloud Run) | `lingue-facili.onrender.com` |
| Database | fornito dalla piattaforma | PostgreSQL gratuito creato dal Blueprint |
| Chiave IA | gestita dalla piattaforma | `EASY_PEASY_API_KEY` necessaria per i nuovi adattamenti |
| Aggiornamenti | deploy dalla chat | `git push` → autoDeploy |
