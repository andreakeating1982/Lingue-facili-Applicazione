import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Esercizio di RIORDINO COMPLETO (3 frasi) risolto come lo risolverebbe uno studente.
//  - computer fisso: mouse vero (page.mouse), app diretta e dentro la cornice del blog;
//  - cellulare: dito vero (Input.dispatchTouchEvent), app diretta e dentro la cornice del blog
//    (iframe di un'altra origine, in processo separato come su Android, CPU 4 volte più lenta);
//  - cellulare piccolo (320 px) con testo al 160 %.
// Si prova: trascinamento dal banco con inserimento nella posizione esatta, tocco (o Invio) per
// piazzare, tocco per rimettere nel banco, spostamento di una parola già piazzata, errore con
// verifica e correzione, «Svuota», AVANTI, schermata finale e salvataggio delle risposte.
// Tutte le API sono simulate: nessuna scheda reale viene creata, letta o modificata.
//
//   CROP_QA_BASE_URL=https://lingue-facili.easy-peasy.site node riordino-completo.e2e.mjs
//   LF_MODES=cellulare-dito-blog node riordino-completo.e2e.mjs   (un solo modo)
//   LF_PACE=500 node riordino-completo.e2e.mjs   (mezzo secondo in più tra i gesti, come una persona)
//
// Nel blog la parte del documento oltre il fondo dell'iframe è tagliata (overflow: hidden) finché la
// cornice non lo allunga, e la riga di stato della cornice sposta la pagina nei primi secondi. Una
// persona aspetta che tutto si assesti prima di afferrare una parola: la prova fa lo stesso, ma
// MISURA quanto la parola resta tagliata e fallisce se il contenuto resta irraggiungibile.

const BASE = (process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const CORNICE = process.env.LF_CORNICE_VARIANT ?? new URL('../../cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html', import.meta.url);
const BLOG = 'http://localhost:3000/__qa_riordino_completo';
const ONLY = (process.env.LF_MODES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const SHOTS = process.env.LF_SHOTS ?? '/tmp';
const PACE = Number(process.env.LF_PACE ?? 0);
const response = (x) => JSON.stringify([{ result: { data: { json: x } } }]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Parole tutte diverse dentro ogni frase: l'etichetta «Parola X» identifica una sola tessera.
const SENTENCES = [
  'My younger sister always plays tennis with her friends on Saturday morning.',
  'We are going to visit our grandparents tomorrow.',
  'They were watching a film when the lights went out.',
];
const exercise = {
  type: 'reorder',
  items: SENTENCES.map((answer) => ({
    answer,
    chips: answer.split(' ').map((t, i) => ({ t, role: i === 0 ? 'subject' : i === 1 ? 'verb' : 'other' })),
  })),
};

const PIXEL = devices['Pixel 7'];
const MODES = [
  { name: 'computer-mouse-app-diretta', kind: 'mouse', blog: false, vp: { width: 1440, height: 900 } },
  { name: 'computer-mouse-blog', kind: 'mouse', blog: true, vp: { width: 1440, height: 900 } },
  { name: 'cellulare-dito-app-diretta', kind: 'touch', blog: false, device: PIXEL },
  { name: 'cellulare-dito-blog', kind: 'touch', blog: true, device: PIXEL, cpu: 4 },
  { name: 'cellulare-piccolo-dito-blog', kind: 'touch', blog: true, device: { ...PIXEL, viewport: { width: 320, height: 640 } }, scale: 1.6, cpu: 4 },
].filter((m) => ONLY.length === 0 || ONLY.includes(m.name));

const bankOf = (root) => root.locator('[data-drop="reorder-bank"]');
const areaOf = (root) => root.locator('[data-drop="reorder-area"]');
const bankChip = (root, w) => bankOf(root).getByRole('button', { name: `Parola ${w}`, exact: true });
const placedChip = (root, w) => areaOf(root).getByRole('button', { name: new RegExp(`^Parola ${escapeRe(w)}, posizione \\d+$`) });
const placedOrder = (root) => areaOf(root).locator('[data-pos]').evaluateAll((els) => els.map((e) => e.textContent.trim()));

// Attende che l'elemento sia interamente dentro l'iframe del blog e che la pagina non si sposti più
// (250 ms). Misura per quanto è rimasto tagliato; oltre 8 s il contenuto sarebbe irraggiungibile.
async function waitInsideFrame(ctx, locator, label) {
  if (!ctx.mode.blog) return;
  const frame = ctx.page.locator('.lf-cornice.lf-lingue-facili iframe');
  const name = label ?? String(locator).slice(0, 90);
  const t0 = Date.now();
  let insideSince = null, prev = '', stableSince = Date.now();
  for (;;) {
    const f = await frame.boundingBox();
    const b = await locator.boundingBox();
    const key = f ? `${Math.round(f.y)}/${Math.round(f.height)}` : '';
    if (key !== prev) { prev = key; stableSince = Date.now(); }
    const inside = Boolean(f && b && b.y >= f.y + 2 && b.y + b.height <= f.y + f.height - 2);
    if (inside) { if (insideSince === null) insideSince = Date.now(); } else insideSince = null;
    if (inside && Date.now() - stableSince >= 250) break;
    if (Date.now() - t0 > 8000) assert.fail(`${ctx.mode.name}: «${name}» resta tagliata fuori dall'iframe per più di 8 s`);
    await ctx.page.waitForTimeout(50);
  }
  const clipped = insideSince - t0;
  if (clipped > 300) ctx.stats.clipWaits++;
  ctx.stats.clipWaitMax = Math.max(ctx.stats.clipWaitMax, clipped);
}

async function tapOrClick(ctx, locator, label) {
  await waitInsideFrame(ctx, locator, label);
  if (ctx.kind === 'touch') await locator.tap();
  else await locator.click();
  await ctx.page.waitForTimeout(120 + PACE);
}

// Gesto con il dito o con il mouse veri, in coordinate della finestra principale.
async function gesture(ctx, from, to, { steps = 10, hold = 0 } = {}) {
  const { page } = ctx;
  if (ctx.kind === 'mouse') {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    if (hold) await page.waitForTimeout(hold);
    await page.mouse.up();
  } else {
    const pt = (x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id: 1 });
    await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(from.x, from.y)] });
    for (let i = 1; i <= steps; i++) {
      await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps)] });
    }
    if (hold) await page.waitForTimeout(hold);
    await ctx.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.waitForTimeout(150 + PACE);
}

// Porta il fondo dell'area risposta a circa il 45 % della finestra: sotto restano le parole del banco.
async function arrange(ctx, area) {
  const a = await area.boundingBox();
  assert.ok(a, 'area risposta non visibile');
  const delta = a.y + a.height - ctx.vp.height * 0.45;
  if (Math.abs(delta) > 4) await ctx.page.evaluate((d) => window.scrollBy(0, d), delta);
  await ctx.page.waitForTimeout(100);
}

async function dropPoint(ctx, area, before) {
  const a = await area.boundingBox();
  const chips = area.locator('[data-pos]');
  const n = await chips.count();
  if (n === 0) return { x: a.x + a.width / 2, y: a.y + Math.min(a.height / 2, 30) };
  if (before !== undefined) {
    const b = await placedChip(ctx.root, before).boundingBox();
    assert.ok(b, `tessera «${before}» non visibile`);
    return { x: b.x + b.width * 0.25, y: b.y + b.height / 2 };
  }
  const l = await chips.nth(n - 1).boundingBox();
  return { x: Math.min(l.x + l.width + 24, a.x + a.width - 4), y: l.y + l.height / 2 };
}

// Sposta una tessera GIÀ piazzata davanti a un'altra, trascinandola dentro l'area.
async function movePlaced(ctx, word, before) {
  const area = areaOf(ctx.root);
  await waitInsideFrame(ctx, placedChip(ctx.root, word), word);
  if (before !== undefined) await waitInsideFrame(ctx, placedChip(ctx.root, before), before);
  await arrange(ctx, area);
  const f = await placedChip(ctx.root, word).boundingBox();
  assert.ok(f, `tessera piazzata «${word}» non visibile`);
  const to = await dropPoint(ctx, area, before);
  await gesture(ctx, { x: f.x + f.width / 2, y: f.y + f.height / 2 }, to);
  ctx.stats.moves++;
}

// Trascina una parola dal banco: in coda oppure davanti a un'altra già piazzata.
// Se la parola non è raggiungibile col dito senza scorrere, ripiega sul tocco e, se serve, sullo spostamento.
async function placeWord(ctx, word, before) {
  const area = areaOf(ctx.root), src = bankChip(ctx.root, word);
  await waitInsideFrame(ctx, src, word);
  await arrange(ctx, area);
  const s = await src.boundingBox();
  const reachable = s && s.y >= 4 && s.y + s.height <= ctx.vp.height - 4;
  if (!reachable) {
    ctx.stats.fallbackTaps++;
    await tapOrClick(ctx, src);
    if (before !== undefined) await movePlaced(ctx, word, before);
    return;
  }
  const to = await dropPoint(ctx, area, before);
  await gesture(ctx, { x: s.x + s.width / 2, y: s.y + s.height / 2 }, to);
  ctx.stats.drags++;
}

async function expectOrder(ctx, words, label) {
  let got;
  for (let i = 0; i < 25; i++) {
    got = await placedOrder(ctx.root);
    if (JSON.stringify(got) === JSON.stringify(words)) return;
    await ctx.page.waitForTimeout(100);
  }
  assert.deepEqual(got, words, `${ctx.mode.name}: ${label}`);
}

async function check(ctx) {
  await tapOrClick(ctx, ctx.root.getByRole('button', { name: 'CHECK', exact: true }));
}

async function solved(ctx, last = false) {
  await bankOf(ctx.root).waitFor({ state: 'detached', timeout: 5000 });
  await tapOrClick(ctx, ctx.root.getByRole('button', { name: last ? 'FINISCO' : 'AVANTI', exact: true }));
}

async function throttleAll(context, page, rate) {
  const targets = [page];
  const child = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(BASE));
  if (child) targets.push(child);
  for (const t of targets) {
    try { const s = await context.newCDPSession(t); await s.send('Emulation.setCPUThrottlingRate', { rate }); } catch { /* la CPU resta normale */ }
  }
}

// LocalNetworkAccessChecks: il blog simulato sta su localhost e l'app locale su 127.0.0.1; senza questa
// opzione Chromium blocca l'iframe (non serve, né cambia nulla, con la produzione).
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...SITE_ISOLATION_ARGS, '--disable-features=LocalNetworkAccessChecks'] });
const summary = [];
try {
  for (const mode of MODES) {
    const options = mode.kind === 'touch' ? { ...mode.device } : { viewport: mode.vp };
    const context = await browser.newContext(options);
    const vp = options.viewport;
    if (mode.scale) {
      await context.addInitScript(({ s }) => localStorage.setItem('lf_access', JSON.stringify({ fontScale: s, lineHeight: 1.65, ruler: false, mode: 'normale' })), { s: mode.scale });
    }
    let saved = null;
    const unexpected = [];
    await context.route('**/api/**', async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch { /* corpo non JSON */ }
      const ok = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: response(x) });
      if (path.includes('exercises.get')) return ok({ id: 'mock-completo', studentNome: 'Prova', studentCognome: 'Sintetica', studentClasse: '2A', studentData: '07/11/2026', lang: 'en', exercise });
      if (path.includes('exercises.saveAnswers')) { saved = body?.['0']?.json ?? body?.json ?? {}; return ok({ ok: true }); }
      if (path.includes('exercises.translate')) return ok({ translation: 'Traduzione di prova.' });
      unexpected.push(path);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    let root = page;
    if (mode.blog) {
      const raw = await fs.readFile(CORNICE, 'utf8');
      const APP = `${BASE}/exercise?id=mock-completo`;
      const fragment = raw.replace(/var APP_URL = 'https?:\/\/[^']+';/, `var APP_URL = '${APP}';`);
      assert.ok(fragment.includes(`var APP_URL = '${APP}';`), 'APP_URL non sostituito nella cornice');
      const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Blog simulato</title></head><body style="margin:0;font-family:Georgia,serif"><main style="max-width:760px;margin:0 auto;padding:12px"><h1>LINGUE STRANIERE</h1><p>Testo del post prima della cornice.</p>${fragment}<p>Testo del post dopo la cornice.</p></main></body></html>`;
      await page.route(BLOG, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
      await page.goto(BLOG, { waitUntil: 'domcontentloaded' });
      root = page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
    } else {
      await page.goto(`${BASE}/exercise?id=mock-completo`, { waitUntil: 'domcontentloaded' });
    }
    await bankOf(root).waitFor({ timeout: 45000 });
    const appFrame = mode.blog ? page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(`${BASE}/exercise`)) : page.mainFrame();
    assert.ok(appFrame, `${mode.name}: frame dell'app non trovato`);
    await appFrame.evaluate(() => document.fonts.ready);
    if (mode.cpu) await throttleAll(context, page, mode.cpu);

    const ctx = {
      mode, page, root, vp, kind: mode.kind,
      cdp: mode.kind === 'touch' ? await context.newCDPSession(page) : null,
      stats: { drags: 0, moves: 0, taps: 0, keys: 0, fallbackTaps: 0, clipWaitMax: 0, clipWaits: 0 },
    };
    const t0 = Date.now();

    // ---- Frase 1: trascinamenti dal banco, errore, verifica, correzione spostando una tessera nell'area
    {
      const W = SENTENCES[0].split(' ');
      const wrong = [...W.slice(0, -2), W[W.length - 1], W[W.length - 2]];
      for (const w of wrong) await placeWord(ctx, w);
      await expectOrder(ctx, wrong, 'frase 1: ordine sbagliato costruito coi trascinamenti');
      await check(ctx);
      await areaOf(root).locator('.shake').first().waitFor({ timeout: 4000 });
      assert.equal(await bankOf(root).count(), 1, `${mode.name}: una frase sbagliata non deve risultare risolta`);
      await movePlaced(ctx, W[W.length - 2], W[W.length - 1]);
      await expectOrder(ctx, W, 'frase 1: dopo lo spostamento nell\'area');
      await check(ctx);
      await solved(ctx);
    }

    // ---- Frase 2: tocco (o Invio) per piazzare, tocco per togliere, inserimenti nel mezzo
    {
      const V = SENTENCES[1].split(' ');
      const rest = V.filter((_, i) => i !== 3 && i !== 5);
      for (const [i, w] of rest.entries()) {
        if (ctx.kind === 'mouse' && !mode.blog && i === 0) {
          await bankChip(root, w).focus();
          await page.keyboard.press('Enter');
          ctx.stats.keys++;
          await page.waitForTimeout(120);
        } else {
          await tapOrClick(ctx, bankChip(root, w));
          ctx.stats.taps++;
        }
      }
      await expectOrder(ctx, rest, 'frase 2: parole piazzate col tocco');
      await tapOrClick(ctx, placedChip(root, V[6]));
      ctx.stats.taps++;
      await expectOrder(ctx, rest.filter((w) => w !== V[6]), 'frase 2: parola rimessa nel banco col tocco');
      assert.equal(await bankChip(root, V[6]).count(), 1, `${mode.name}: la parola tolta deve tornare nel banco`);
      await placeWord(ctx, V[3], V[4]);
      await placeWord(ctx, V[5], V[7]);
      await placeWord(ctx, V[6], V[7]);
      await expectOrder(ctx, V, 'frase 2: inserimenti nel mezzo');
      await check(ctx);
      await solved(ctx);
    }

    // ---- Frase 3: «Svuota» e poi tutti i trascinamenti in ordine
    {
      const U = SENTENCES[2].split(' ');
      for (const w of [U[9], U[8], U[6]]) { await tapOrClick(ctx, bankChip(root, w)); ctx.stats.taps++; }
      await tapOrClick(ctx, root.getByRole('button', { name: 'Svuota', exact: true }));
      await expectOrder(ctx, [], 'frase 3: area vuota dopo Svuota');
      assert.equal(await bankOf(root).getByRole('button').count(), U.length, `${mode.name}: dopo Svuota tutte le parole tornano nel banco`);
      for (const w of U) await placeWord(ctx, w);
      await expectOrder(ctx, U, 'frase 3: trascinamenti in ordine');
      await check(ctx);
      await solved(ctx, true);
    }

    // ---- Schermata finale e salvataggio (simulato)
    await root.getByText(/Risposte giuste al primo colpo/).waitFor({ timeout: 8000 });
    const finalText = await root.locator('body').innerText();
    assert.match(finalText, /Risposte giuste al primo colpo:\s*2\s*su\s*3/, `${mode.name}: punteggio finale`);
    for (let i = 0; i < 40 && !saved; i++) await page.waitForTimeout(100);
    assert.ok(saved, `${mode.name}: risposte non inviate`);
    const items = saved.answers?.items ?? [];
    assert.equal(items.length, 3);
    assert.equal(saved.answers.score, 2);
    items.forEach((it, i) => { assert.equal(it.ok, true); assert.equal(it.value, SENTENCES[i], `${mode.name}: risposta ${i + 1} salvata`); });
    assert.deepEqual(items.map((it) => it.attempts), [1, 0, 0], `${mode.name}: tentativi per frase`);

    // ---- Controlli di pulizia
    assert.equal(await root.locator('html').getAttribute('data-lf-gesture'), null, `${mode.name}: gesto rimasto attivo`);
    assert.equal(await root.locator('body > .chip-word[aria-hidden="true"]').count(), 0, `${mode.name}: tessera fantasma rimasta`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${mode.name}: debordo orizzontale di ${overflow}px`);
    assert.deepEqual(errors, [], `${mode.name}: errori di pagina`);
    assert.deepEqual(unexpected.filter((p) => /exercises\./.test(p)), [], `${mode.name}: chiamate API inattese`);
    await page.screenshot({ path: `${SHOTS}/lf-riordino-completo-${mode.name}.png` });

    const st = ctx.stats;
    assert.ok(st.clipWaitMax <= 3500, `${mode.name}: una parola o un pulsante è rimasto tagliato fuori dall'iframe per ${st.clipWaitMax} ms (oltre 3,5 s)`);
    const line = `OK ${mode.name}: ${st.drags} trascinamenti dal banco, ${st.moves} spostamenti nell'area, ${st.taps} tocchi/clic, ${st.keys} da tastiera, ${st.fallbackTaps} con ripiego; attesa massima per contenuto tagliato dall'iframe ${st.clipWaitMax} ms (${st.clipWaits} attese oltre 300 ms); 3 frasi in ordine, punteggio 2/3, risposte salvate (simulate) in ${((Date.now() - t0) / 1000).toFixed(0)}s`;
    summary.push(line);
    console.log(line);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`RIORDINO COMPLETO: ${summary.length} modi su ${MODES.length} superati (${BASE}).`);

