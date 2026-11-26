import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Test sintetico, API intercettate: non crea, modifica o salva schede reali.
// 14pt CSS corrispondono a 18,666...px. Il vincolo riguarda il percorso
// didattico. Per scelta esplicita dell'utente, il ritaglio usa invece i font
// originali del Widget metacognitivo: 14px per i pulsanti alla scala 100%.
const BASE = process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const MIN_PX = 56 / 3;
const fixture = await fs.readFile(new URL('./fixtures/piccola.png', import.meta.url));
const testExercise = {id:'font-min-sintetico',studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'06/11/2026',lang:'en',exercise:{type:'mc',items:[{segments:[{t:'text',v:'She '},{t:'blank'},{t:'text',v:' an apple.'}],options:['eat','eats'],correct:'eats',translationIt:'Lei ___ una mela.'}]}};
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});

/** Rileva testo visibile e controlli nella sezione indicata, escludendo il
 * contenuto destinato solamente agli screen reader. */
async function sizes(locator) {
  return locator.evaluate(root => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return !el.closest('.sr-only,[hidden],[aria-hidden="true"]') && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
    };
    return [...root.querySelectorAll('*')].filter(el => {
      if (!visible(el)) return false;
      const hasText = [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'file' && el.type !== 'radio' && el.type !== 'checkbox';
      return hasText || isField;
    }).map(el => ({tag:el.tagName,text:(el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g,' ').slice(0,60),px:parseFloat(getComputedStyle(el).fontSize)}));
  });
}
function assertMin(label, all) {
  assert.ok(all.length > 0, `${label}: nessun testo misurato`);
  const small = all.filter(item => item.px + 0.03 < MIN_PX);
  assert.deepEqual(small, [], `${label}: testo inferiore a 14 punti`);
}

try {
  for (const width of [320,390,1440]) for (const scale of [0.8,0.9,1,1.6]) {
    const context = await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    await context.addInitScript(scale => localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'})),scale);
    await context.route('**/api/trpc/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{result:{data:{json:testExercise}}}])}));
    const page = await context.newPage();
    await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
    await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).fill('She studies English every day.');
    await page.getByRole('heading',{name:'SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA'}).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assertMin(`preparazione ${width}px scala ${scale}`, await sizes(page.locator('.lf-flow-page')));
    await page.locator('input[type=file][multiple]').setInputFiles({name:'prova.png',mimeType:'image/png',buffer:fixture});
    const crop = page.locator('.lf-crop-dialog');
    await crop.waitFor({state:'visible'});
    await crop.locator('img').waitFor({state:'visible'});
    await page.waitForTimeout(300); // attendi il termine dell'animazione Radix
    const controls = await crop.locator('[data-crop-controls] > button').count();
    assert.equal(controls,4);
    const cropControls=await crop.locator('[data-crop-controls] > button').evaluateAll(buttons=>buttons.map(el=>({text:el.textContent.trim(),px:parseFloat(getComputedStyle(el).fontSize),height:el.getBoundingClientRect().height})));
    assert.ok(cropControls.every(el=>Math.abs(el.px-14*scale)<0.05 && el.height>=43.9),`il crop non rispetta font/bersagli del widget: ${JSON.stringify(cropControls)}`);
    const titleSize=await crop.locator('[data-slot="dialog-title"]').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    assert.ok(Math.abs(titleSize-20*scale)<0.05,`titolo crop non conforme al widget: ${titleSize}px`);
    await crop.getByRole('button',{name:'Chiudi',exact:true}).click();
    await page.goto(`${BASE}/exercise?id=font-min-sintetico`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Scelta multipla'}).waitFor();
    assertMin(`esercizio ${width}px scala ${scale}`,await sizes(page.locator('.lf-flow-page')));
    console.log(`FONT: ${width}px scala ${scale*100}% — percorso >=14pt; pulsanti del ritaglio ${(14*scale).toFixed(1)}px come nel widget, con target >=44px.`);
    await context.close();
  }
} finally { await browser.close(); }

