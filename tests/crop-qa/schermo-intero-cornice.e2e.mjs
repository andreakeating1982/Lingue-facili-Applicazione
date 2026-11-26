import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Schermo intero REALE della cornice (pulsante «Schermo intero»): l'iframe occupa lo
// schermo e il contenuto deve poter scorrere al suo interno; all'uscita torna a
// seguire l'altezza senza scorrimento interno. App e API simulate.
const BLOG = process.env.LF_BLOG ?? 'https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html';
const BASE = (process.env.CROP_QA_BASE_URL ?? 'https://lingue-facili.easy-peasy.site').replace(/\/$/, '');
const VARIANT = process.env.LF_CORNICE_VARIANT;
const mock = (x) => JSON.stringify([{ result: { data: { json: x } } }]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...SITE_ISOLATION_ARGS] });
try {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 393, height: 852 }, locale: 'it-IT' });
  await context.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.includes('/api/trpc/')) return route.abort('blockedbyclient');
    return route.fulfill({ status: 200, contentType: 'application/json', body: mock(path.includes('describeAdaptation') ? { description: 'Riordina le frasi.' } : { ok: true }) });
  });
  const page = await context.newPage();
  if (VARIANT) {
    const r = await context.request.get(`${BLOG}?m=1`);
    const html = await r.text(), marker = html.indexOf('CORNICE DINAMICA');
    const start = html.lastIndexOf('<!--====', marker), app = html.indexOf('var APP_URL', marker), end = html.indexOf('</script>', app);
    const modified = (await fs.readFile(VARIANT, 'utf8')).replace(/var APP_URL = 'https?:\/\/[^']+';/, `var APP_URL = '${BASE}/';`);
    await page.route('**/2026/09/lingue-straniere.html*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html.slice(0, start) + modified + html.slice(end + '</script>'.length) }));
  }
  await page.goto(BLOG, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const frame = page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
  await frame.getByLabel('Nome', { exact: true }).waitFor({ timeout: 45000 });
  const child = page.frames().find((f) => f.url().startsWith(BASE));
  const token = new URL(child.url()).searchParams.get('cornice');
  await child.goto(`${BASE}/setup?cognome=Fittizio&nome=Esempio&data=07%2F11%2F2026&classe=2A&lang=en&cornice=${encodeURIComponent(token)}`);
  const source = frame.getByRole('textbox', { name: "Testo dell'esercizio originale" });
  await source.waitFor({ timeout: 30000 });
  await source.fill('Today the students read many interesting books.\nMy sister always plays tennis on Saturday morning.');
  await page.waitForTimeout(3500);
  const iframeEl = page.locator('.lf-cornice.lf-lingue-facili iframe');
  const info = async () => ({
    fullscreen: await page.evaluate(() => !!document.fullscreenElement),
    iframeHeight: Math.round(await iframeEl.evaluate((e) => e.getBoundingClientRect().height)),
    inner: await child.evaluate(() => ({ scrollY: Math.round(scrollY), viewport: innerHeight, content: document.documentElement.scrollHeight, cls: document.documentElement.classList.contains('lf-inner-scroll') })),
  });
  const normal = await info();
  assert.ok(normal.iframeHeight >= normal.inner.content - 6 && !normal.inner.cls, `Stato normale inatteso: ${JSON.stringify(normal)}`);
  await page.locator('.lf-cornice.lf-lingue-facili .lf-full').click();
  let full = null;
  for (let i = 0; i < 20; i++) { await sleep(150); full = await info(); if (full.fullscreen) break; }
  assert.equal(full.fullscreen, true, 'Il browser di prova non ha attivato lo schermo intero');
  // Con la cornice attuale (senza messaggio esplicito) lo scorrimento si riattiva dopo la pausa di controllo.
  let scrollable = null;
  for (let i = 0; i < 80; i++) { await sleep(100); scrollable = await info(); if (scrollable.inner.cls) break; }
  assert.equal(scrollable.inner.cls, true, `Nello schermo intero lo scorrimento interno non si è riattivato: ${JSON.stringify(scrollable)}`);
  assert.ok(scrollable.inner.content > scrollable.inner.viewport + 200, `Il test richiede contenuto più alto dell'iframe: ${JSON.stringify(scrollable)}`);
  // Nota: nel post pubblicato l'iframe è dentro un <div> aggiunto da Blogger, quindi
  // `height:100%` non si risolve e in schermo intero l'iframe resta di 150 px (difetto
  // preesistente della cornice, non dell'app). Il gesto parte comunque dentro l'iframe.
  const box = await iframeEl.boundingBox();
  assert.ok(box && box.height > 60, `Iframe non visibile in schermo intero: ${JSON.stringify(box)}`);
  const cdp = await context.newCDPSession(page);
  const x = Math.round(box.x + box.width / 2), y0 = Math.round(box.y + box.height - 15);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - i * 10, id: 1 }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(900);
  const moved = await info();
  assert.ok(moved.inner.scrollY > 40, `Nello schermo intero il contenuto non scorre: ${JSON.stringify(moved)}`);
  // Uscita dallo schermo intero: torna a seguire l'altezza.
  await page.evaluate(() => document.exitFullscreen());
  let back = null;
  for (let i = 0; i < 60; i++) { await sleep(100); back = await info(); if (!back.fullscreen && !back.inner.cls && back.inner.scrollY === 0) break; }
  assert.equal(back.fullscreen, false);
  assert.equal(back.inner.cls, false, `All'uscita lo scorrimento interno deve spegnersi: ${JSON.stringify(back)}`);
  assert.equal(back.inner.scrollY, 0);
  console.log('Schermo intero della cornice: il contenuto scorre dentro l\'iframe e all\'uscita torna a seguire l\'altezza (app simulata).');
  await context.close();
} finally { await browser.close(); }
