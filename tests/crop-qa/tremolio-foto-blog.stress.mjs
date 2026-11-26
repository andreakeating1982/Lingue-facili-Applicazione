import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Riproduce nel blog (tema Blogger reale, Android emulato) il flusso che ha
// fatto tremare la seconda pagina: foto → ritaglio → lettura IA → testo caricato.
// TUTTE le API sono intercettate: nessuna scheda, risposta o dato reale viene
// creato o letto. La variante di cornice, se indicata, sostituisce il blocco
// soltanto nella risposta di questo browser isolato; il blog non è modificato.
const BLOG = process.env.LF_BLOG ?? 'https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html';
const BASE = (process.env.CROP_QA_BASE_URL ?? 'https://lingue-facili.easy-peasy.site').replace(/\/$/, '');
const VARIANT = process.env.LF_CORNICE_VARIANT;
const SCENARIO = process.env.LF_SCENARIO ?? 'idle'; // idle | swipe
const CPU = Number(process.env.LF_CPU ?? 4);
const OCR_DELAY = Number(process.env.LF_OCR_DELAY ?? 3500);
const HOLD = Number(process.env.LF_HOLD ?? 14000);
const OUT = process.env.LF_OUT ?? `/tmp/lf-foto-${SCENARIO}.json`;
const WIDTH = Number(process.env.LF_WIDTH ?? 393), HEIGHT = Number(process.env.LF_HEIGHT ?? 852);

const text = [
  'Today the students read many interesting books.',
  'My sister always plays tennis on Saturday morning.',
  'We are going to visit our grandparents next week.',
  'She has never eaten a traditional English breakfast.',
  'The teacher gave us a lot of homework yesterday.',
  'They usually walk to school with their friends.',
  'I would like a cup of tea and a piece of cake.',
].join('\n');
const trpc = (value) => JSON.stringify([{ result: { data: { json: value } } }]);

// Foto sintetica da 12 megapixel (3024×4032) con testo stampato: si genera in una pagina
// vuota del browser di test, senza file esterni. LF_PHOTO può indicare un file proprio.
async function loadPhoto(context) {
  if (process.env.LF_PHOTO) return fs.readFile(process.env.LF_PHOTO);
  const tmp = await context.newPage();
  const base64 = await tmp.evaluate((lines) => {
    const canvas = document.createElement('canvas');
    canvas.width = 3024; canvas.height = 4032;
    const g = canvas.getContext('2d');
    g.fillStyle = '#eee9de'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#222'; g.font = '86px sans-serif';
    lines.forEach((line, i) => g.fillText(line, 160, 400 + i * 190));
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 40, 40); }
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, text.split('\n'));
  await tmp.close();
  return Buffer.from(base64, 'base64');
}

// Su Android Chrome un iframe di un altro sito vive in un processo separato (OOPIF):
// senza questi switch il browser di test lo terrebbe nel processo del blog e non
// riprodurrebbe i ritardi di ridimensionamento tra cornice e app.
const OOPIF = process.env.LF_OOPIF !== '0';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', ...(OOPIF ? ['--site-per-process', '--enable-features=IsolateOrigins,site-per-process'] : [])] });
try {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: WIDTH, height: HEIGHT }, locale: 'it-IT' });
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.includes('/api/trpc/')) return route.abort('blockedbyclient');
    let value = { ok: true };
    if (path.includes('readPhoto')) { await new Promise((r) => setTimeout(r, OCR_DELAY)); value = { text }; }
    if (path.includes('describeAdaptation')) { await new Promise((r) => setTimeout(r, 1500)); value = { description: 'Il testo contiene sette frasi in inglese. Riordina le parole di ogni frase una alla volta.' }; }
    return route.fulfill({ status: 200, contentType: 'application/json', body: trpc(value) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  if (VARIANT) {
    const r = await context.request.get(`${BLOG}?m=1`);
    assert.ok(r.ok(), 'Post non disponibile');
    const html = await r.text(), marker = html.indexOf('CORNICE DINAMICA');
    const start = html.lastIndexOf('<!--====', marker), app = html.indexOf('var APP_URL', marker), end = html.indexOf('</script>', app);
    assert.ok(start >= 0 && app > marker && end > app, 'Cornice non trovata nel post');
    const raw = await fs.readFile(VARIANT, 'utf8');
    const APP_URL_RE = /var APP_URL = 'https?:\/\/[^']+';/;
    assert.ok(APP_URL_RE.test(raw), 'APP_URL non trovato nella variante');
    const modified = raw.replace(APP_URL_RE, `var APP_URL = '${BASE}/';`);
    assert.ok(modified.includes(`var APP_URL = '${BASE}/';`), 'APP_URL non aggiornato');
    const fixture = html.slice(0, start) + modified + html.slice(end + '</script>'.length);
    await page.route('**/2026/09/lingue-straniere.html*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture }));
  }

  await page.addInitScript((origin) => {
    const now = () => Date.now();
    if (window === window.top) {
      window.__t = { geo: [], msgs: [], marks: [] };
      window.__mark = (name) => window.__t.marks.push({ name, t: now(), sy: scrollY });
      let last = '';
      const sample = () => {
        const f = document.querySelector('.lf-cornice.lf-lingue-facili iframe');
        if (f) {
          const r = f.getBoundingClientRect();
          const key = `${r.height}|${Math.round(scrollY * 10)}|${Math.round(r.top * 10)}`;
          if (key !== last) { last = key; window.__t.geo.push({ t: now(), h: Math.round(r.height * 10) / 10, top: Math.round(r.top * 10) / 10, sy: Math.round(scrollY * 10) / 10 }); }
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      addEventListener('message', (e) => {
        const d = e.data;
        if (d && (d.type === 'labvisivo:height' || d.type === 'labvisivo:interaction')) window.__t.msgs.push({ t: now(), type: d.type, h: d.height, a: d.active });
      });
    } else if (location.origin === origin) {
      window.__c = { s: [] };
      let last = '';
      const sample = () => {
        const d = document.documentElement, b = document.body;
        const ta = document.querySelector('textarea');
        const v = [d.scrollHeight, b.scrollHeight, b.offsetHeight, innerHeight, Math.round(scrollY * 10) / 10, ta ? Math.round(ta.getBoundingClientRect().top * 10) / 10 : -1, innerWidth - d.clientWidth].join('|');
        if (v !== last) { last = v; window.__c.s.push({ t: now(), ds: d.scrollHeight, bs: b.scrollHeight, bo: b.offsetHeight, ih: innerHeight, sy: Math.round(scrollY * 10) / 10, ta: ta ? Math.round(ta.getBoundingClientRect().top * 10) / 10 : null, sb: innerWidth - d.clientWidth }); }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }
  }, new URL(BASE).origin);

  await page.goto(BLOG, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const frame = page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
  await frame.getByLabel('Nome', { exact: true }).waitFor({ timeout: 45000 });
  const child = page.frames().find((f) => f.url().startsWith(BASE));
  assert.ok(child, 'iframe Lingue Facili non trovato');

  // Rallenta la CPU del telefono emulato (pagina e iframe).
  const throttled = [];
  for (const target of [page, child]) {
    try { const s = await context.newCDPSession(target); await s.send('Emulation.setCPUThrottlingRate', { rate: CPU }); throttled.push(true); } catch { throttled.push(false); }
  }
  const cdp = await context.newCDPSession(page);
  const mark = (name) => page.evaluate((n) => window.__mark(n), name);
  const iframeBox = async () => page.locator('.lf-cornice.lf-lingue-facili iframe').boundingBox();
  // Eventi touch reali (touchStart/touchMove/touchEnd): il browser li converte in
  // scorrimento come sul telefono, anche sopra un iframe in processo separato.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const drag = async (x, y0, y1, steps, delay) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 + ((y1 - y0) * i) / steps), id: 1 }] });
      await sleep(delay);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  await page.evaluate(() => { const f = document.querySelector('.lf-cornice.lf-lingue-facili iframe'); window.scrollTo({ top: Math.max(0, f.getBoundingClientRect().top + scrollY - 70), behavior: 'instant' }); });
  await page.waitForTimeout(1200);
  await frame.getByLabel('Cognome').fill('Fittizio');
  await frame.getByLabel('Nome', { exact: true }).fill('Esempio');
  await frame.getByLabel('Classe').fill('2A');
  await frame.getByRole('button', { name: "Entra e prepara l'esercizio" }).tap();
  const radio = frame.getByRole('radio', { name: 'INGLESE' });
  await radio.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await radio.tap();
  const source = frame.getByRole('textbox', { name: "Testo dell'esercizio originale" });
  await source.waitFor();
  await page.waitForTimeout(2500);
  await mark('lingua scelta');

  const buffer = await loadPhoto(context);
  await frame.locator('input[type=file][multiple]').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer });
  const crop = frame.locator('.lf-crop-dialog');
  await crop.waitFor({ state: 'visible', timeout: 60000 });
  await crop.locator('img').waitFor({ timeout: 60000 });
  await page.waitForTimeout(1800);
  await mark('ritaglio aperto');
  await crop.getByRole('button', { name: 'Ritaglia', exact: true }).tap();
  await mark('ritaglio confermato');
  // Il dito resta appoggiato e scorre lentamente mentre l'IA legge la foto.
  let slowDrag = Promise.resolve();
  if (SCENARIO === 'swipe') slowDrag = drag(196, 640, 330, 70, 100);
  // Il testo compare dopo la lettura simulata.
  await frame.getByRole('textbox', { name: "Testo dell'esercizio originale" }).evaluate((el) => new Promise((resolve) => {
    if (el.value) return resolve();
    const timer = setInterval(() => { if (el.value) { clearInterval(timer); resolve(); } }, 50);
  }));
  await mark('testo caricato');
  if (SCENARIO === 'swipe') {
    await slowDrag;
    await mark('dito sollevato');
    await sleep(900);
    await drag(196, 700, 250, 10, 14);   // scorrimento rapido verso il basso
    await sleep(1600);
    await drag(196, 300, 650, 10, 14);   // e di nuovo verso l'alto
  }
  await page.waitForTimeout(HOLD);
  await mark('fine');

  const t = await page.evaluate(() => window.__t);
  const c = await child.evaluate(() => window.__c);
  const loaded = t.marks.find((m) => m.name === 'testo caricato').t;
  const after = t.geo.filter((g) => g.t >= loaded - 200);
  const heightsAfter = after.map((g) => g.h);
  const changesAfter = heightsAfter.filter((h, i) => i > 0 && h !== heightsAfter[i - 1]).length;
  const topAfter = after.map((g) => g.top);
  const topJumps = topAfter.filter((v, i) => i > 0 && Math.abs(v - topAfter[i - 1]) > 0.5).length;
  const innerAfter = c.s.filter((s) => s.t >= loaded - 200);
  const taShift = innerAfter.filter((s, i) => i > 0 && s.ta !== null && innerAfter[i - 1].ta !== null && Math.abs(s.ta - innerAfter[i - 1].ta) > 0.5).length;
  const maxInnerScroll = Math.max(0, ...c.s.map((s) => s.sy));
  // Posizione della textarea sullo schermo = top dell'iframe nella pagina + top della textarea
  // dentro l'iframe. Un dito che scorre la sposta in modo continuo; un salto di oltre 120 px
  // tra due campioni è ciò che l'utente percepisce come «tremolio» o contenuto che scappa.
  const events = [
    ...t.geo.map((g) => ({ t: g.t, kind: 'p', v: g.top })),
    ...c.s.filter((s) => s.ta !== null).map((s) => ({ t: s.t, kind: 'c', v: s.ta })),
  ].sort((a, b) => a.t - b.t);
  let pageTop = null, innerTop = null;
  const screenSeries = [];
  for (const e of events) {
    if (e.kind === 'p') pageTop = e.v; else innerTop = e.v;
    if (pageTop !== null && innerTop !== null && e.t >= loaded - 200) screenSeries.push(pageTop + innerTop);
  }
  const screenSteps = screenSeries.map((y, i) => (i ? Math.abs(y - screenSeries[i - 1]) : 0));
  const visibleJumps = screenSteps.filter((d) => d > 120).length;
  const maxVisibleJump = Math.round(Math.max(0, ...screenSteps));
  const summary = {
    scenario: SCENARIO, cpu: CPU, throttled, oopif: OOPIF, blog: BLOG, variant: VARIANT ?? 'cornice pubblicata', base: BASE,
    heightMessagesAfterText: t.msgs.filter((m) => m.t >= loaded && m.type === 'labvisivo:height').map((m) => ({ dt: m.t - loaded, h: m.h })),
    interactionMessages: t.msgs.filter((m) => m.type === 'labvisivo:interaction').map((m) => ({ dt: m.t - loaded, active: m.a })),
    iframeHeightTimelineAfterText: after.map((g) => ({ dt: g.t - loaded, h: g.h, top: g.top, sy: g.sy })).slice(0, 80),
    iframeHeightChangesAfterText: changesAfter, iframeTopJumpsAfterText: topJumps, textareaScreenShiftsInsideFrame: taShift,
    visibleJumpsOver120px: visibleJumps, maxVisibleJumpPx: maxVisibleJump,
    maxInnerScrollY: maxInnerScroll, maxScrollbarWidth: Math.max(0, ...c.s.map((s) => s.sb)), errors,
  };
  await fs.writeFile(OUT, JSON.stringify({ summary, trace: t, inside: c }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.LF_ASSERT === '1') {
    // Nessun contenuto deve scorrere dentro l'iframe né «scappare» sotto il dito.
    assert.equal(summary.maxInnerScrollY, 0, `L'iframe ha scorso al suo interno di ${summary.maxInnerScrollY}px`);
    assert.equal(summary.textareaScreenShiftsInsideFrame, 0, 'Il testo si è spostato dentro l\'iframe');
    assert.equal(summary.visibleJumpsOver120px, 0, `Salto visibile di ${summary.maxVisibleJumpPx}px`);
    assert.deepEqual(errors, []);
  }
  await context.close();
} finally {
  await browser.close();
}

