import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Dati e fotografie sintetici; nessuna richiesta viene inviata al database.
const BASE=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const image=await fs.readFile(new URL('./fixtures/piccola.png',import.meta.url));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const json=(value)=>JSON.stringify([{result:{data:{json:value}}}]);
let photos=0;
await context.route('**/api/trpc/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.includes('exercises.readPhoto')) {
    photos++;
    return route.fulfill({status:200,contentType:'application/json',body:json({text:`Foto${photos} testo riconosciuto.`})});
  }
  if(path.includes('exercises.describeAdaptation')) return route.fulfill({status:200,contentType:'application/json',body:json({description:'Adatta la frase originale con parole da riordinare.'})});
  return route.abort('blockedbyclient');
});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const file=(n)=>({name:`foto${n}.png`,mimeType:'image/png',buffer:image});
const source=page.getByRole('textbox',{name:"Testo dell'esercizio originale"});
const explanation=page.locator('#teacher-adaptation');
const create=page.getByRole('button',{name:"CREA L'ESERCIZIO"});
const dialog=page.getByRole('dialog');
const words=(n)=>Array.from({length:n},(_,i)=>`parola${i+1}`).join(' ');
try {
  await page.goto(`${BASE}/setup`,{waitUntil:'networkidle'});
  assert.equal(await source.count(),0,'la lingua viene scelta prima della trascrizione');
  assert.equal(await explanation.count(),0);
  assert.equal(await create.count(),0);
  await page.getByRole('radio',{name:'INGLESE'}).check();
  assert.equal(await source.count(),1);
  assert.equal(await explanation.count(),0);
  assert.equal(await create.count(),0);
  assert.equal(await page.locator('#exercise-word-count').innerText(),'0/500 parole');
  assert.equal(await page.getByText('Puoi aggiungere da 1 a 5 foto',{exact:true}).count(),1);
  await source.fill('a');
  await page.getByRole('heading',{name:'SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA'}).waitFor();
  assert.equal(await create.count(),1);
  assert.equal(await create.isDisabled(),true,'il tipo deve essere ancora selezionato');
  await page.getByRole('radio',{name:/RIORDINO DI PAROLE/}).check();
  await page.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('Adatta la frase'),null,{timeout:12000});
  await create.waitFor({state:'visible'});
  assert.equal(await create.isEnabled(),true,'una lettera è accettata: nessun minimo di tre caratteri');
  await source.fill('   ');
  assert.equal(await explanation.count(),0);
  assert.equal(await create.count(),0);
  console.log('PASSI PROGRESSIVI: lingua → testo → spiegazione → creazione, anche con un carattere; testo vuoto non genera.');

  // In una pagina nuova senza tipo scelto non intervengono proposte IA tardive.
  await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
  await source.fill(words(500));
  assert.equal(await page.locator('#exercise-word-count').innerText(),'500/500 parole');
  await source.fill(words(501));
  assert.equal(await source.inputValue(),words(500),'la 501ª parola non deve entrare');
  await explanation.fill(words(500));
  assert.equal(await page.locator('#teacher-word-count').innerText(),'500/500 parole');
  await explanation.fill(words(501));
  assert.equal(await explanation.inputValue(),words(500),'la 501ª parola non deve entrare nella spiegazione');
  for(const removed of ["Inserisci il testo e scegli lingua e tipo di esercizio","Foto e audio sono elaborati dall'IA: evita dati personali e controlla sempre il risultato","Una frase alla volta, con traduzione disponibile su richiesta","Puoi aggiungere più foto, una dopo l'altra: ritagliale e controlla il testo letto dall'IA","Minimo 3 / massimo 6000 caratteri"]) {
    assert.equal(await page.getByText(removed,{exact:false}).count(),0,`testo non rimosso: ${removed}`);
  }
  console.log('CONTATORI: massimo 500 parole applicato a entrambi i campi; scritte rimosse.');

  await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
  const files=page.locator('input[type=file][multiple]');
  await files.setInputFiles([1,2,3,4,5,6].map(file));
  await dialog.waitFor({state:'visible',timeout:15000});
  assert.equal(await page.getByText('Foto selezionate: 5/5',{exact:true}).count(),1,'cinque posti prenotati');
  for(let n=1;n<=5;n++){
    await dialog.waitFor({state:'visible',timeout:15000});
    await dialog.locator('img').waitFor({state:'visible'});
    await dialog.getByRole('button',{name:'Ritaglia',exact:true}).click();
    await page.waitForFunction(n=>document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.includes(`Foto${n} testo`),n,{timeout:20000});
  }
  await dialog.waitFor({state:'hidden',timeout:12000});
  assert.equal(photos,5,'la sesta foto selezionata insieme alle altre è scartata');
  assert.match(await source.inputValue(),/Foto1[\s\S]*Foto2[\s\S]*Foto3[\s\S]*Foto4[\s\S]*Foto5/);
  await files.setInputFiles(file(6));
  await page.waitForTimeout(1000);
  assert.equal(await dialog.isVisible(),false,'il limite vale anche per aggiunte successive');
  assert.equal(photos,5);
  await page.getByRole('button',{name:'Svuota'}).click();
  assert.equal(await source.inputValue(),'');
  await files.setInputFiles(file(7));
  await dialog.waitFor({state:'visible',timeout:15000});
  await dialog.getByRole('button',{name:'Chiudi',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  assert.equal(await page.getByText(/Foto selezionate:/).count(),0,'una foto annullata libera il posto');
  await files.setInputFiles(file(8));
  await dialog.waitFor({state:'visible',timeout:15000});
  await dialog.getByRole('button',{name:'Ritaglia',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.includes('Foto6 testo'),null,{timeout:20000});
  assert.equal(photos,6);
  assert.deepEqual(errors,[]);
  console.log('FOTO: massimo 5, selezione multipla e aggiunte successive; ordine, svuotamento e annullamento verificati.');
} finally { await context.close(); await browser.close(); }

