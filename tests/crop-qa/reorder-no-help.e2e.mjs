import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Nessun dato reale: esercizio, traduzione e salvataggio sono completamente simulati.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const json=x=>JSON.stringify([{result:{data:{json:x}}}]);
const exercise={type:'reorder',items:[{
 chips:[{t:'She',role:'subject'},{t:'often',role:'adverb'},{t:'eats',role:'verb'},{t:'apples.',role:'other'}],
 answer:'She often eats apples.',translationIt:'Lei mangia spesso le mele.',
}]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,isMobile:width<600,acceptDownloads:true});
  let saved=null;
  await context.route('**/api/trpc/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   let body={};try{body=JSON.parse(req.postData()||'{}')}catch{}
   if(path.includes('exercises.get'))return route.fulfill({status:200,contentType:'application/json',body:json({id:'mock-riordino',studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'07/11/2026',lang:'en',exercise})});
   if(path.includes('exercises.saveAnswers')){saved=body?.['0']?.json??body?.json??{};return route.fulfill({status:200,contentType:'application/json',body:json({ok:true})});}
   if(path.includes('exercises.translate'))return route.fulfill({status:200,contentType:'application/json',body:json({translation:'Lei mangia spesso le mele.'})});
   return route.abort('blockedbyclient');
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/exercise?id=mock-riordino`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-drop="reorder-bank"]').waitFor({state:'visible'});
  for(const text of ['CHI','COSA FA','OGNI QUANTO','IL RESTO']) assert.equal(await page.getByText(text,{exact:true}).count(),0,`${width}: legenda indesiderata ${text}`);
  assert.equal(await page.locator('.legend-dot').count(),0,'la barra colorata è ancora presente');
  assert.equal(await page.getByText('Riordina le parole e verifica la frase.',{exact:true}).count(),1,'istruzioni utili da mantenere');
  const bank=page.locator('[data-drop="reorder-bank"]');
  assert.equal(await bank.locator('[role=button]').count(),4);
  const expected=['rgb(242, 231, 222)','rgb(201, 173, 154)','rgb(46, 33, 24)'];
  const styles=await bank.locator('[role=button]').evaluateAll(chips=>chips.map(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopColor,s.color]}));
  for(const style of styles)assert.deepEqual(style,expected,`${width}: tessere con colori diversi`);
  assert.equal(await bank.locator('.chip-blu,.chip-ver,.chip-gia,.chip-gra').count(),0,'colore legato al ruolo grammaticale');
  assert.equal(await page.getByText(/Lei mangia spesso le mele\./).count(),0);
  await page.getByRole('button',{name:'Mostra traduzione'}).click();
  await page.getByText(/Lei mangia spesso le mele\./).waitFor({state:'visible'});
  await page.screenshot({path:`/tmp/lingue-riordino-uniforme-${width}.png`,fullPage:true});
  for(const word of ['She','often','eats','apples.'])await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).click();
  assert.equal(await page.locator('[data-drop="reorder-area"] [data-pos]').count(),4);
  const placedStyles=await page.locator('[data-drop="reorder-area"] [data-pos]').evaluateAll(chips=>chips.map(el=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderTopColor,s.color,s.touchAction]}));
  for(const style of placedStyles)assert.deepEqual(style,[...expected,'none'],`${width}: tessera piazzata o touch non coerente`);
  await page.getByRole('button',{name:'CHECK',exact:true}).click();
  const finish=page.getByRole('button',{name:'FINISCO',exact:true});await finish.waitFor({state:'visible'});
  const response=page.waitForResponse(r=>r.url().includes('exercises.saveAnswers')&&r.status()===200,{timeout:10000});
  await finish.click();await response;
  assert.ok(saved && saved.answers && saved.answers.score===1,'risposta sintetica non corretta');
  assert.equal(saved.answers.items[0].value,'She often eats apples.');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:"SCARICA L'ESERCIZIO CON RISPOSTE"}).click()]);
  assert.ok(download.suggestedFilename().endsWith('.pdf'));
  assert.deepEqual(errors,[]);
  console.log(`RIORDINO ${width}px: tessere uniformi in banco e risposta; legenda assente, traduzione, verifica, punteggio e PDF funzionano (dati simulati).`);
  await context.close();
 }
}finally{await browser.close()}

