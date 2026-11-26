import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE=(process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const response=x=>JSON.stringify([{result:{data:{json:x}}}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
  let requests=0;
  await context.route('**/api/trpc/**',async route=>{
   if(!route.request().url().includes('exercises.describeAdaptation'))return route.abort('blockedbyclient');
   requests++;
   if(requests===3) return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{message:'errore simulato'}})});
   await new Promise(r=>setTimeout(r,800));
   return route.fulfill({status:200,contentType:'application/json',body:response({description:'Riordina tutte le parole nella frase originale.'})});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
  const source=page.getByRole('textbox',{name:"Testo dell'esercizio originale"});
  await source.fill('1. She eats apples.');
  await page.getByRole('radio',{name:/RIORDINO DI PAROLE/}).check();
  async function inspect(text) {
   const status=page.locator('.lf-description-status').filter({hasText:text});
   await status.waitFor({state:'visible',timeout:12000});
   const css=await status.evaluate(e=>({color:getComputedStyle(e).color,weight:Number(getComputedStyle(e).fontWeight),size:parseFloat(getComputedStyle(e).fontSize),family:getComputedStyle(e).fontFamily}));
   assert.equal(css.color,'rgb(139, 58, 26)',`${text}: colore errato`);assert.ok(css.weight>=700,`${text}: non grassetto`);assert.ok(css.size>=18.6,`${text}: troppo piccolo`);assert.match(css.family,/OpenDyslexic/i);
  }
  await inspect("L'IA sta preparando la spiegazione");
  await inspect('Spiegazione pronta: controllala e correggila se necessario.');
  await page.screenshot({path:`/tmp/lf-status-${width}.png`,fullPage:true});
  await source.fill('2. She reads a book.');
  await page.waitForFunction(()=>document.querySelector('.lf-description-status')?.textContent.includes('preparando'));
  await page.waitForTimeout(1200);
  await page.locator('#teacher-adaptation').fill('Indicazione umana che deve rimanere.');
  await inspect("Hai modificato il testo mentre l'IA lavorava");
  assert.equal(await page.locator('#teacher-adaptation').inputValue(),'Indicazione umana che deve rimanere.');
  await source.fill('3. She writes a letter.');
  await inspect("L'IA non è riuscita a preparare la spiegazione");
  assert.deepEqual(errors,[]);
  console.log(`Stati spiegazione ${width}px: attesa, pronta, revisione ed errore marroni e in grassetto, dati simulati.`);
  await context.close();
 }
} finally {await browser.close();}

