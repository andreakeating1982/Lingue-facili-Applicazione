import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const BASE=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const json=x=>JSON.stringify([{result:{data:{json:x}}}]);
const image=fs.readFileSync(new URL('./fixtures/piccola.png',import.meta.url));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
  const requests=[];
  await context.route('**/api/trpc/**',async route=>{
   const url=route.request().url();requests.push(url);
   if(url.includes('exercises.readPhoto')){await new Promise(r=>setTimeout(r,800));return route.fulfill({status:200,contentType:'application/json',body:json({text:'She reads a book.'})});}
   if(url.includes('exercises.describeAdaptation')){await new Promise(r=>setTimeout(r,1000));return route.fulfill({status:200,contentType:'application/json',body:json({description:'Riordina le parole della frase.'})});}
   if(url.includes('exercises.generate')){await new Promise(r=>setTimeout(r,1200));return route.fulfill({status:200,contentType:'application/json',body:json({id:'synthetic-test'})});}
   return route.abort('blockedbyclient');
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
   const source=page.getByRole('textbox',{name:"Testo dell'esercizio originale"});
   const five=Array.from({length:5},(_,i)=>({name:`foto${i+1}.png`,mimeType:'image/png',buffer:image}));
   await page.locator('input[type=file][multiple]').setInputFiles(five);
   await page.getByText('Foto selezionate: 5/5').waitFor();
   for(let i=0;i<5;i++) {
    const dialog=page.getByRole('dialog');
    await dialog.waitFor({state:'visible',timeout:10000});
    await dialog.getByRole('button',{name:'Ritaglia',exact:true}).click();
    const status=page.locator('.lf-progress-card').filter({hasText:'Sto leggendo il file'});
    await status.waitFor({state:'visible',timeout:10000});
    assert.ok(await status.locator('.lf-progress-track').isVisible());
    assert.notEqual(await status.evaluate(e=>getComputedStyle(e).position),'fixed');
    // Dalla seconda foto la spiegazione e CREA esistono già: l'avanzamento
    // della lettura deve comunque stare vicino al testo, non sotto CREA.
    if(i>0) {
     const beforeAdaptation=await status.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('#adapt-title')) & Node.DOCUMENT_POSITION_FOLLOWING));
     assert.ok(beforeAdaptation,'la lettura del file deve precedere la spiegazione e CREA');
    }
    await page.waitForFunction(n=>(document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.match(/She reads a book/g)||[]).length===n,i+1,{timeout:12000});
   }
   assert.equal(requests.filter(x=>x.includes('readPhoto')).length,5);
   await page.locator('input[type=file][multiple]').setInputFiles({name:'sesta.png',mimeType:'image/png',buffer:image});
   await page.getByText('Puoi aggiungere fino a 5 foto per esercizio.',{exact:false}).waitFor();
   assert.equal(requests.filter(x=>x.includes('readPhoto')).length,5,'sesta foto non deve essere letta');
   // Lascia scomparire il toast temporaneo per una schermata di QA pulita.
   await page.waitForTimeout(5500);
   await page.getByRole('radio',{name:/RIORDINO DI PAROLE/}).check();
   const preparing=page.locator('.lf-progress-card').filter({hasText:"L'IA sta preparando la spiegazione"});
   await preparing.waitFor({state:'visible'});
   assert.ok(await preparing.locator('.lf-progress-track').isVisible());
   const labelBox=await preparing.locator('.lf-description-status').boundingBox();
   const trackBox=await preparing.locator('.lf-progress-track').boundingBox();
   assert.ok(labelBox && trackBox && labelBox.y+labelBox.height<=trackBox.y,`testo sovrapposto alla barra: ${JSON.stringify({labelBox,trackBox})}`);
   assert.notEqual(await preparing.evaluate(e=>getComputedStyle(e).position),'fixed');
   await preparing.scrollIntoViewIfNeeded();
   await page.screenshot({path:`/tmp/lingue-facili-attesa-${width}.png`,fullPage:true});
   await page.getByText('Spiegazione pronta: controllala e correggila se necessario.').waitFor({timeout:12000});
   const message="La registrazione audio si ferma e viene trascritta dall'IA dopo 30 secondi. Puoi anche caricare un file audio fino a 12 MB. L'applicazione può preparare massimo 10 frasi o domande alla volta";
   assert.equal(await page.getByText(message,{exact:true}).count(),1);
   await page.getByRole('button',{name:"CREA L'ESERCIZIO"}).click();
   await page.getByRole('button',{name:/CREO L'ESERCIZIO/}).waitFor();
   assert.equal(await page.locator('.lf-progress-card').count(),0,'nessuna barra sotto crea');
   assert.deepEqual(errors,[]);
   console.log(`${width}px: 5 foto, sesta respinta, due barre interne e nessuna barra sotto CREA, messaggio esatto OK (IA simulata).`);
  }finally{await context.close();}
 }
 // Prova separata: 500 parole ammesse, 501 respinte senza perdere il testo.
 const context=await browser.newContext();await context.route('**/api/trpc/**',r=>r.abort('blockedbyclient'));
 const page=await context.newPage();await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
 const source=page.getByRole('textbox',{name:"Testo dell'esercizio originale"});
 const words=Array.from({length:500},(_,i)=>`parola${i}`).join(' ');await source.fill(words);
 assert.equal(await source.inputValue(),words);await source.fill(`${words} unaltra`);assert.equal(await source.inputValue(),words);
 assert.ok(await page.getByText('500/500 parole').isVisible());
 console.log('Limite testo: 500 parole accettate, 501ª respinta.');await context.close();
}finally{await browser.close();}

