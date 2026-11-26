import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Tutte le API sono intercettate: nessun esercizio o risposta reale viene salvato.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const response=x=>JSON.stringify([{result:{data:{json:x}}}]);
const expected={bg:'rgb(242, 231, 222)',border:'rgb(201, 173, 154)',color:'rgb(46, 33, 24)'};
const expectedHighContrast={bg:'rgb(17, 17, 17)',border:'rgb(255, 255, 255)',color:'rgb(255, 255, 255)'};
const fixtures=[
 {lang:'en',check:'CHECK',first:[['She','subject'],['often','adverb'],['eats','verb'],['apples.','other']],answer:'She often eats apples.',alt:'Often she eats apples.',translation:'Lei mangia spesso le mele.',second:[['You','subject'],['read','verb'],['books.','other']],answer2:'You read books.'},
 {lang:'fr',check:'VÉRIFIE',first:[['Elle','subject'],['mange','verb'],['souvent','adverb'],['des','other'],['pommes.','other']],answer:'Elle mange souvent des pommes.',alt:'Souvent elle mange des pommes.',translation:'Lei mangia spesso delle mele.',second:[['Tu','subject'],['lis','verb'],['un','other'],['livre.','other']],answer2:'Tu lis un livre.'},
 {lang:'es',check:'COMPRUEBA',first:[['Ella','subject'],['siempre','adverb'],['come','verb'],['manzanas.','other']],answer:'Ella siempre come manzanas.',alt:'Siempre ella come manzanas.',translation:'Lei mangia sempre mele.',second:[['Tú','subject'],['lees','verb'],['libros.','other']],answer2:'Tú lees libros.'},
];
const toChips=words=>words.map(([t,role])=>({t,role}));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const scenario of [{width:320,scale:1.6},{width:390,scale:1},{width:1440,scale:1}]) for(const f of fixtures){
  const {width,scale}=scenario;
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
  await context.addInitScript(({scale})=>localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'})),{scale});
  let saved=null;
  const exercise={type:'reorder',items:[
   {chips:toChips(f.first),answer:f.answer,alsoCorrect:[f.alt],translationIt:f.translation},
   {chips:toChips(f.second),answer:f.answer2,translationIt:'Traduzione di prova.'},
  ]};
  await context.route('**/api/trpc/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   let body={};try{body=JSON.parse(req.postData()||'{}')}catch{}
   if(path.includes('exercises.get'))return route.fulfill({status:200,contentType:'application/json',body:response({id:'mock-uniforme',studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'07/11/2026',lang:f.lang,exercise})});
   if(path.includes('exercises.saveAnswers')){saved=body?.['0']?.json??body?.json??{};return route.fulfill({status:200,contentType:'application/json',body:response({ok:true})});}
   if(path.includes('exercises.translate'))return route.fulfill({status:200,contentType:'application/json',body:response({translation:f.translation})});
   return route.abort('blockedbyclient');
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(`${BASE}/exercise?id=mock-uniforme`,{waitUntil:'domcontentloaded'});
   const bank=page.locator('[data-drop="reorder-bank"]');
   const area=page.locator('[data-drop="reorder-area"]');
   await bank.waitFor();await page.evaluate(()=>document.fonts.ready);
   async function sameColor(locator, expectedCount, name, palette=expected){
    const values=await locator.evaluateAll(els=>els.map(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,border:s.borderTopColor,color:s.color,touch:s.touchAction}}));
    assert.equal(values.length,expectedCount,`${f.lang}/${width}: ${name} numero tessere`);
    for(const value of values)assert.deepEqual(value,{...palette,touch:'none'},`${f.lang}/${width}: ${name} ${JSON.stringify(value)}`);
   }
   await sameColor(bank.locator('[role=button]'),f.first.length,'banco');
   for(const label of ['CHI','COSA FA','OGNI QUANTO','IL RESTO'])assert.equal(await page.getByText(label,{exact:true}).count(),0,`leggenda ${label} ricomparsa`);
   const dimensions=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
   assert.ok(dimensions.sw<=dimensions.cw+1,`debordo orizzontale: ${JSON.stringify(dimensions)}`);
   assert.equal(await page.getByText(f.translation,{exact:false}).count(),0,'traduzione visibile prima della richiesta');
   await page.getByRole('button',{name:'Mostra traduzione'}).click();
   await page.getByText(f.translation,{exact:false}).waitFor({state:'visible'});

   // Il posizionamento con tastiera conserva sia lo stile sia l'azione touch.
   await bank.getByRole('button',{name:`Parola ${f.first[0][0]}`,exact:true}).focus();
   await page.keyboard.press('Enter');
   await sameColor(area.locator('[data-pos]'),1,'tastiera');
   await sameColor(bank.locator('[role=button]'),f.first.length-1,'banco dopo tastiera');
   await page.getByRole('button',{name:'Svuota',exact:true}).click();
   await sameColor(bank.locator('[role=button]'),f.first.length,'banco dopo svuota');

   // Il contrasto elevato non deve cambiare il colore in base al ruolo.
   const contrast=page.getByRole('button',{name:'Cambia la modalità di lettura'});
   await contrast.click();
   await page.waitForFunction(()=>document.documentElement.classList.contains('lf-hc'));
   await sameColor(bank.locator('[role=button]'),f.first.length,'alto contrasto',expectedHighContrast);
   await contrast.click();
   await page.waitForFunction(()=>!document.documentElement.classList.contains('lf-hc'));

   // Controlla la tessera fantasma mentre si trascina (non solo dopo il rilascio).
   if(width===1440 && f.lang==='en'){
    const word=bank.getByRole('button',{name:'Parola She',exact:true});
    await word.scrollIntoViewIfNeeded();
    const r=await word.boundingBox(),drop=await area.boundingBox();assert.ok(r&&drop,'tessera o bersaglio non visibili');
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
    await page.mouse.move(r.x+r.width/2+12,r.y+r.height/2-15,{steps:3});
    const ghost=page.locator('body > .chip-word[aria-hidden="true"]');
    await ghost.waitFor({state:'visible'});
    const style=await ghost.evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,border:s.borderTopColor,color:s.color}});
    assert.deepEqual(style,expected,'tessera fantasma con colori diversi');
    await page.mouse.move(drop.x+drop.width/2,drop.y+drop.height/2,{steps:10});await page.mouse.up();
    await page.waitForFunction(()=>document.querySelectorAll('[data-drop="reorder-area"] [data-pos]').length===1);
    await sameColor(area.locator('[data-pos]'),1,'parola trascinata');
    await page.getByRole('button',{name:'Svuota',exact:true}).click();
   }

   // Un ordine alternativo registrato resta valido per gli esercizi nuovi.
   const order=width===1440 && f.lang==='en' ? ['often','She','eats','apples.'] : f.first.map(([word])=>word);
   for(const word of order)await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).click();
   await sameColor(area.locator('[data-pos]'),f.first.length,'frase composta');
   const inset=await area.evaluate(el=>{const r=el.getBoundingClientRect(), chips=[...el.querySelectorAll('[data-pos]')].map(c=>c.getBoundingClientRect());return {top:Math.min(...chips.map(c=>c.top))-r.top,bottom:r.bottom-Math.max(...chips.map(c=>c.bottom))};});
   assert.ok(inset.top>=10 && inset.bottom>=10,`${f.lang}/${width}: tessere troppo vicine al bordo ${JSON.stringify(inset)}`);
   if(f.lang==='en')await page.screenshot({path:`/tmp/lingue-riordino-composto-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:f.check,exact:true}).click();
   await sameColor(area.locator('[data-pos]'),f.first.length,'frase verificata');
   await page.getByRole('button',{name:'AVANTI',exact:true}).click();
   await bank.waitFor({state:'visible'});
   await sameColor(bank.locator('[role=button]'),f.second.length,'seconda frase');
   for(const [word] of f.second)await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).click();
   await page.getByRole('button',{name:f.check,exact:true}).click();
   const done=page.getByRole('button',{name:'FINISCO',exact:true});await done.waitFor({state:'visible'});
   const save=page.waitForResponse(r=>r.url().includes('exercises.saveAnswers')&&r.status()===200,{timeout:10000});
   await done.click();await save;
   assert.equal(saved.answers.score,2,`${f.lang}/${width}: punteggio sintetico errato`);
   assert.equal(saved.answers.items[0].value,width===1440&&f.lang==='en'?f.alt:f.answer,'ordine registrato errato');
   assert.equal(saved.answers.items[1].value,f.answer2);
   assert.deepEqual(errors,[],'errori JavaScript');
   console.log(`UNIFORME ${f.lang} ${width}px scala ${scale}: banco, area, tastiera, alto contrasto, due frasi e salvataggio simulato OK${width===1440&&f.lang==='en'?'; drag e ordine alternativo OK':''}.`);
  }finally{await context.close()}
 }
}finally{await browser.close()}

