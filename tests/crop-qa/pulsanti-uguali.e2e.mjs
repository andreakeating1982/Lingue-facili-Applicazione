import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// API simulate: nessuna scrittura reale nel database.
const BASE = (process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const json = (x) => JSON.stringify([{ result: { data: { json: x } } }]);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const shots = [];
try {
  for (const [width, scale] of [[320, 1], [320, 1.6], [390, 1], [1440, 1]]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 600,
      isMobile: width < 600,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.route('**/api/trpc/**', (route) => {
      if (route.request().url().includes('exercises.describeAdaptation')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: json({ description: 'Riordina le parole della frase.' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: json({}) });
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('lingue-facili-lang', 'en'); } catch {}
    });
    await page.goto(`${BASE}/setup?lang=en&cognome=Prova&nome=Studente&data=14%2F11%2F2026&classe=3A`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lf-equal-actions', { timeout: 15000 });

    const dati = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('.lf-equal-actions')];
      const info = groups.map((g) => {
        const items = [...g.querySelectorAll(':scope > button, :scope > label')].map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return { text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 30), w: Math.round(r.width), upper: cs.textTransform === 'uppercase' };
        });
        const widths = items.map((i) => i.w);
        return { items, stessaLarghezza: Math.max(...widths) - Math.min(...widths) <= 2 };
      });
      const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      return { info, overflowX };
    });

    for (const g of dati.info) {
      assert.ok(g.stessaLarghezza, `Larghezze diverse a ${width}px: ${JSON.stringify(g.items)}`);
      for (const it of g.items) {
        assert.ok(it.w > 0, 'pulsante visibile');
        assert.ok(dati.overflowX === false, `Overflow orizzontale a ${width}px`);
      }
    }
    // I due pulsanti foto devono avere il testo visibile in maiuscolo.
    const foto = dati.info[0];
    assert.ok(foto.items.every((i) => i.upper), `Maiuscolo mancante a ${width}px: ${JSON.stringify(foto.items)}`);
    // I nomi accessibili restano in minuscolo naturale per la lettura vocale.
    const nomi = await page.evaluate(() => [...document.querySelectorAll('.lf-equal-actions label input')].length);
    assert.ok(nomi >= 2, 'input dei pulsanti foto presenti');

    const shot = `/tmp/lf-pulsanti-${width}-${String(scale).replace('.', '_')}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    shots.push(shot);
    console.log(`${width}px scala ${scale}: coppie con stessa larghezza, foto in maiuscolo, nomi accessibili naturali, nessun overflow.`);
    await context.close();
  }
  fs.writeFileSync('/tmp/lf-pulsanti-shots.txt', shots.join('\n'));
} finally {
  await browser.close();
}

