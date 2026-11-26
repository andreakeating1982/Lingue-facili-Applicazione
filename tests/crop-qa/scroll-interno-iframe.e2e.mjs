import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Regressione del tremolio Android nella seconda pagina (foto → testo):
// quando il contenuto supera l'iframe, il documento interno NON deve scorrere da
// solo (il dito sposterebbe il contenuto nell'iframe e poi la cornice lo farebbe
// «saltare» indietro). Lo scorrimento interno si riattiva soltanto se l'ospite
// non segue l'altezza (schermo intero o embed senza protocollo).
// Il post è copiato in memoria con la cornice indicata; API tutte simulate.
const BLOG = process.env.LF_BLOG ?? 'https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html';
const BASE = (process.env.CROP_QA_BASE_URL ?? 'https://lingue-facili.easy-peasy.site').replace(/\/$/, '');
const VARIANT = process.env.LF_CORNICE_VARIANT;
const mock = (x) => JSON.stringify([{ result: { data: { json: x } } }]);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...SITE_ISOLATION_ARGS] });
try {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 393, height: 852 }, locale: 'it-IT' });
  await context.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.includes('/api/trpc/')) return route.abort('blockedbyclient');
    return route.fulfill({ status: 200, contentType: 'application/json', body: mock(path.includes('describeAdaptation') ? { description: 'Riordina le frasi.' } : { ok: true }) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (VARIANT) {
    const r = await context.request.get(`${BLOG}?m=1`);
    assert.ok(r.ok());
    const html = await r.text(), marker = html.indexOf('CORNICE DINAMICA');
    const start = html.lastIndexOf('<!--====', marker), app = html.indexOf('var APP_URL', marker), end = html.indexOf('</script>', app);
    assert.ok(start >= 0 && app > marker && end > app, 'Cornice non trovata');
    const raw = await fs.readFile(VARIANT, 'utf8');
    const APP_URL_RE = /var APP_URL = 'https?:\/\/[^']+';/;
    assert.ok(APP_URL_RE.test(raw), 'APP_URL non trovato nella variante');
    const modified = raw.replace(APP_URL_RE, `var APP_URL = '${BASE}/';`);
    assert.ok(modified.includes(`var APP_URL = '${BASE}/';`), 'APP_URL non aggiornato');
    await page.route('**/2026/09/lingue-straniere.html*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html.slice(0, start) + modified + html.slice(end + '</script>'.length) }));
  }
  await page.goto(BLOG, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const frame = page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
  await frame.getByLabel('Nome', { exact: true }).waitFor({ timeout: 45000 });
  let child = page.frames().find((f) => f.url().startsWith(BASE));
  assert.ok(child, 'iframe app non trovato');
  const token = new URL(child.url()).searchParams.get('cornice');
  assert.ok(token);
  await child.goto(`${BASE}/setup?cognome=Fittizio&nome=Esempio&data=07%2F11%2F2026&classe=2A&lang=en&cornice=${encodeURIComponent(token)}`);
  const source = frame.getByRole('textbox', { name: "Testo dell'esercizio originale" });
  await source.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);

  const iframeEl = page.locator('.lf-cornice.lf-lingue-facili iframe');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cdp = await context.newCDPSession(page);
  const drag = async (x, y0, y1, steps, delay) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 + ((y1 - y0) * i) / steps), id: 1 }] });
      await sleep(delay);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const state = async () => ({
    parentScroll: await page.evaluate(() => Math.round(scrollY)),
    iframeHeight: Math.round(await iframeEl.evaluate((e) => e.getBoundingClientRect().height)),
    inner: await child.evaluate(() => ({
      scrollY: Math.round(scrollY), viewport: innerHeight, content: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      overflow: getComputedStyle(document.documentElement).overflowY, innerScrollClass: document.documentElement.classList.contains('lf-inner-scroll'),
      embedded: document.documentElement.classList.contains('lf-embedded'),
    })),
  });
  await page.evaluate(() => { const f = document.querySelector('.lf-cornice.lf-lingue-facili iframe'); window.scrollTo({ top: Math.max(0, f.getBoundingClientRect().top + scrollY - 60), behavior: 'instant' }); });
  await page.waitForTimeout(600);

  // A. Il testo compare (la pagina cresce di oltre 1000 px) mentre il dito è appoggiato.
  const before = await state();
  assert.equal(before.inner.embedded, true, 'L\'app non si riconosce embedded');
  assert.equal(before.inner.overflow, 'hidden', 'Il documento dell\'iframe deve avere overflow hidden');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 196, y: 640, id: 1 }] });
  await source.fill('Today the students read many interesting books.\nMy sister always plays tennis on Saturday morning.\nWe are going to visit our grandparents next week.');
  let mid = null;
  for (let i = 1; i <= 40; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 196, y: 640 - i * 8, id: 1 }] });
    await sleep(60);
    if (i === 20) mid = await state();
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(mid.inner.content > mid.inner.viewport + 300 || mid.iframeHeight >= mid.inner.content - 6, `Il contenuto non è cresciuto durante il tocco: ${JSON.stringify(mid)}`);
  assert.equal(mid.inner.scrollY, 0, `Il documento interno è scorso mentre il dito era appoggiato: ${JSON.stringify(mid)}`);
  assert.equal(mid.inner.innerScrollClass, false, 'Lo scorrimento interno non deve attivarsi con una cornice che segue');
  assert.ok(mid.parentScroll > before.parentScroll + 100, `Il dito non ha fatto scorrere la pagina del blog: ${before.parentScroll} → ${mid.parentScroll}`);
  // Dopo il rilascio la cornice si adegua e il contenuto non salta.
  let after = null;
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    after = await state();
    if (after.iframeHeight >= after.inner.content - 6) break;
  }
  assert.ok(after.iframeHeight >= after.inner.content - 6, `La cornice non ha seguito il contenuto: ${JSON.stringify(after)}`);
  assert.equal(after.inner.scrollY, 0);
  assert.equal(after.inner.innerScrollClass, false);

  // B. Un ospite che NON segue l'altezza (schermo intero, altre pagine): lo scorrimento interno si riattiva.
  await page.addStyleTag({ content: '.lf-cornice.lf-lingue-facili .lf-iframe{height:700px !important}' });
  await page.waitForTimeout(500);
  const frozen = await state();
  assert.ok(frozen.inner.content > frozen.inner.viewport + 300, 'Il test non ha creato contenuto tagliato');
  let enabled = null;
  for (let i = 0; i < 70; i++) { await sleep(100); enabled = await state(); if (enabled.inner.innerScrollClass) break; }
  assert.equal(enabled.inner.innerScrollClass, true, `Lo scorrimento interno non si è riattivato con un ospite che non segue: ${JSON.stringify(enabled)}`);
  assert.notEqual(enabled.inner.overflow, 'hidden', 'Con lf-inner-scroll il documento non deve più essere bloccato');
  await page.evaluate(() => { const f = document.querySelector('.lf-cornice.lf-lingue-facili iframe'); window.scrollTo({ top: Math.max(0, f.getBoundingClientRect().top + scrollY - 20), behavior: 'instant' }); });
  await page.waitForTimeout(300);
  await drag(196, 700, 400, 12, 16);
  await page.waitForTimeout(900);
  const scrolledInside = await state();
  assert.ok(scrolledInside.inner.scrollY > 100, `Nello schermo intero il contenuto deve scorrere dentro l'iframe: ${JSON.stringify(scrolledInside)}`);

  // C. Quando l'ospite torna a seguire l'altezza, lo scorrimento interno si spegne.
  await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('height:700px !important')) s.remove(); });
  await page.evaluate((token) => document.querySelector('.lf-cornice.lf-lingue-facili iframe').contentWindow.postMessage({ type: 'labvisivo:ping', cornice: token }, '*'), token);
  let restored = null;
  for (let i = 0; i < 80; i++) { await sleep(100); restored = await state(); if (!restored.inner.innerScrollClass && restored.inner.scrollY === 0) break; }
  assert.equal(restored.inner.innerScrollClass, false, `Lo scorrimento interno non è tornato disattivato: ${JSON.stringify(restored)}`);
  assert.equal(restored.inner.scrollY, 0);

  // D. Il messaggio esplicito della cornice (schermo intero) lo attiva subito e lo spegne all'uscita.
  await iframeEl.evaluate((e) => e.contentWindow.postMessage({ type: 'labvisivo:fullscreen', active: true }, '*'));
  await page.waitForTimeout(250);
  assert.equal((await state()).inner.innerScrollClass, true, 'Il messaggio fullscreen non attiva lo scorrimento interno');
  await iframeEl.evaluate((e) => e.contentWindow.postMessage({ type: 'labvisivo:fullscreen', active: false }, '*'));
  await page.waitForTimeout(400);
  assert.equal((await state()).inner.innerScrollClass, false, 'All\'uscita dallo schermo intero lo scorrimento interno deve spegnersi');

  // E. Un ospite che NON parla il protocollo della cornice (nessun token, nessun ping, altezza fissa):
  // nessuno adegua l'iframe, quindi lo scorrimento interno deve restare quello di sempre.
  const hostPage = await context.newPage();
  await hostPage.route('**/__ospite-senza-protocollo.html', (route) => route.fulfill({
    status: 200, contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><iframe id="f" src="${BASE}/setup?cognome=Fittizio&nome=Esempio&data=07%2F11%2F2026&classe=2A&lang=en" style="display:block;width:100%;height:600px;border:0"></iframe></body>`,
  }));
  await hostPage.goto('https://blogdelprofessoreandreacentinaro.blogspot.com/__ospite-senza-protocollo.html', { waitUntil: 'domcontentloaded' });
  const hostFrame = hostPage.frameLocator('#f');
  await hostFrame.getByRole('textbox', { name: "Testo dell'esercizio originale" }).waitFor({ timeout: 45000 });
  const plain = hostPage.frames().find((f) => f.url().startsWith(BASE));
  assert.ok(plain, 'iframe senza protocollo non trovato');
  await hostPage.waitForTimeout(1500);
  const plainState = await plain.evaluate(() => ({
    embedded: document.documentElement.classList.contains('lf-embedded'),
    innerScrollClass: document.documentElement.classList.contains('lf-inner-scroll'),
    overflowY: getComputedStyle(document.documentElement).overflowY,
    token: new URLSearchParams(location.search).get('cornice'),
    content: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight), viewport: innerHeight,
  }));
  assert.equal(plainState.embedded, true);
  assert.equal(plainState.token, null);
  assert.ok(plainState.content > plainState.viewport + 100, `Il test richiede contenuto più alto dell'iframe: ${JSON.stringify(plainState)}`);
  assert.equal(plainState.innerScrollClass, true, `Un ospite senza protocollo deve poter scorrere l'iframe: ${JSON.stringify(plainState)}`);
  assert.notEqual(plainState.overflowY, 'hidden');
  const hostCdp = await context.newCDPSession(hostPage);
  await hostCdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 196, y: 500, id: 1 }] });
  for (let i = 1; i <= 12; i++) { await hostCdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 196, y: 500 - i * 25, id: 1 }] }); await sleep(16); }
  await hostCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await hostPage.waitForTimeout(900);
  const plainScrolled = await plain.evaluate(() => Math.round(scrollY));
  assert.ok(plainScrolled > 100, `Senza il protocollo il contenuto deve scorrere dentro l'iframe: ${plainScrolled}`);
  await hostPage.close();

  assert.deepEqual(errors, []);
  console.log('Scorrimento interno dell\'iframe: bloccato quando la cornice segue, attivo nello schermo intero e negli ospiti senza protocollo (app simulata).');
  await context.close();
} finally {
  await browser.close();
}

