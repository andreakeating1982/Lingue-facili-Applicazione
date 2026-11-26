import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Il demo monta il componente vero con dati locali e non deve usare alcuna API.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
  const page=await context.newPage();let calls=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/**',route=>{calls++;return route.abort('blockedbyclient');});
  await page.goto(`${BASE}/anteprima-riordino`,{waitUntil:'networkidle'});
  await page.getByText(/Esempio di anteprima/).waitFor();
  const bank=page.locator('[data-drop="reorder-bank"]');
  await bank.waitFor();
  const styles=await bank.locator('[role=button]').evaluateAll(els=>els.map(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopColor,s.color]}));
  assert.equal(styles.length,4);assert.ok(styles.every(s=>JSON.stringify(s)===JSON.stringify(styles[0])),`colori diversi ${width}`);
  if(width===390 || width===1440)await page.screenshot({path:`/tmp/lingue-anteprima-interattiva-${width}.png`,fullPage:true});
  for(const word of ['She','often','eats','apples.'])await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).click();
  await page.getByRole('button',{name:/CHECK|VÉRIFIE|COMPRUEBA/}).click();
  await page.getByRole('button',{name:"RIPROVA L'ESEMPIO",exact:true}).click();
  assert.equal(await bank.locator('[role=button]').count(),4,'riavvio demo fallito');
  assert.equal(calls,0,'il demo ha tentato una chiamata API');assert.deepEqual(errors,[]);
  console.log(`DEMO ${width}px: componente reale, 4 parole uniformi e prova ripetibile senza API.`);
  await context.close();
 }
} finally { await browser.close(); }

