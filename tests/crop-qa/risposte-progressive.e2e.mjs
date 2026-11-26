import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000';
const json=x=>JSON.stringify([{result:{data:{json:x}}}]);
const steps=[{options:['reads','read'],optionsTranslationIt:['legge','leggono'],correct:'reads'},{options:['writes','write'],optionsTranslationIt:['scrive','scrivono'],correct:'writes'},{options:['sleeps','sleep'],optionsTranslationIt:['dorme','dormono'],correct:'sleeps'}];
const row={id:'progressiva',lang:'en',studentNome:'Demo',studentCognome:'Test',studentClasse:'2A',studentData:'13/11/2026',exercise:{type:'mc',items:[{segments:[{t:'text',v:'She '},{t:'blank'},{t:'text',v:', '},{t:'blank'},{t:'text',v:' and '},{t:'blank'},{t:'text',v:' at home.'}],options:steps[0].options,optionsTranslationIt:steps[0].optionsTranslationIt,correct:steps[0].correct,steps,translationIt:'Lei ___, ___ e ___ a casa.'},{segments:[{t:'text',v:'He '},{t:'blank'},{t:'text',v:'.'}],options:['walks','walk'],optionsTranslationIt:['cammina','camminano'],correct:'walks',translationIt:'Lui ___.'}]}};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for (const width of [320,390,1440]) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,acceptDownloads:true});
  let saved=null;
  await context.route('**/api/trpc/**',async r=>{
   const u=r.request().url();
   if(u.includes('exercises.get')) return r.fulfill({status:200,contentType:'application/json',body:json(row)});
   if(u.includes('saveAnswers')) { saved=r.request().postData(); return r.fulfill({status:200,contentType:'application/json',body:json({success:true})}); }
   return r.abort();
  });
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const btn=name=>page.getByRole('button',{name,exact:true});
  await page.goto(`${BASE}/exercise?id=progressiva`,{waitUntil:'networkidle'});
  const assertButtonStyle=async()=>{
   // Una verifica dello stile di riposo non deve misurare l'hover del mouse
   // rimasto sul pulsante dopo il clic in desktop.
   await page.mouse.move(0,0);
   const styles=await page.locator('button:visible').evaluateAll(els=>els.filter(el=>!el.closest('.lf-standard-toolbar, .lf-crop-dialog')).map(el=>({label:el.textContent.trim(),kind:el.classList.contains('lf-choice-option')?'choice':el.classList.contains('lf-new-exercise')?'new':'action',bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,radius:getComputedStyle(el).borderRadius,decoration:getComputedStyle(el).textDecorationLine})));
   for(const s of styles){
    if(s.kind==='choice') {assert.equal(s.bg,'rgb(242, 231, 222)',`sfondo scelta ${s.label}`);assert.equal(s.color,'rgb(46, 33, 24)',`testo scelta ${s.label}`);assert.equal(s.radius,'12px');}
    else if(s.kind==='new') {assert.equal(s.bg,'rgba(0, 0, 0, 0)',`sfondo ${s.label}`);assert.equal(s.color,'rgb(139, 58, 26)',`testo ${s.label}`);assert.match(s.decoration,/underline/);}
    else {assert.equal(s.bg,'rgb(139, 58, 26)',`sfondo ${s.label}`);assert.equal(s.color,'rgb(255, 255, 255)',`testo ${s.label}`);assert.equal(s.radius,'12px',`angoli ${s.label}`)}
   }
  };
  await assertButtonStyle();
  if(width===320||width===1440)await page.screenshot({path:`/tmp/lingue-progressiva-${width}.png`,fullPage:true});
  assert.equal(await btn('reads').count(),1); for(const s of ['writes','write','sleeps','sleep']) assert.equal(await btn(s).count(),0,`scelta futura ${s} visibile`);
  await btn('Mostra traduzione').click(); const trText=await page.locator('[lang=it]').last().innerText(); assert.match(trText,/___.*___.*___/); assert.match(trText,/legge/); assert.match(trText,/leggono/); assert.doesNotMatch(trText,/scrive|dorme/);
  await btn('read').click(); assert.equal(await btn('writes').count(),0,'non svelare dopo errore');
  await btn('reads').click(); assert.equal(await btn('writes').count(),0,'non svelare prima di prossima domanda');
  assert.equal(await page.getByLabel('risposta 1: reads').count(),1); assert.equal(await page.getByLabel('spazio 2 da completare').count(),1);
  await btn('PROSSIMA DOMANDA').click(); assert.equal(await btn('writes').count(),1); assert.equal(await btn('sleeps').count(),0);
  await btn('writes').click(); assert.equal(await btn('sleeps').count(),0); await btn('PROSSIMA DOMANDA').click(); await btn('sleeps').click();
  assert.equal(await btn('AVANTI').count(),1); await btn('AVANTI').click(); await btn('walks').click(); await btn('FINISCO').click();
  await page.getByText(/Risposte giuste al primo colpo:/).waitFor(); await assertButtonStyle(); assert.match(await page.getByText(/Risposte giuste al primo colpo:/).innerText(),/3\s+su\s+4/);
  await page.waitForTimeout(300); assert.ok(saved && saved.includes('reads') && saved.includes('writes') && saved.includes('sleeps'));
  if(width===1440) {for(const [name,file] of [["SCARICA L'ESERCIZIO SENZA RISPOSTE",'/tmp/lf-progressiva-senza.pdf'],["SCARICA L'ESERCIZIO CON RISPOSTE",'/tmp/lf-progressiva-con.pdf']]) {const wait=page.waitForEvent('download'); await btn(name).click(); const dl=await wait; await dl.saveAs(file);}}
  assert.deepEqual(errors,[]); console.log(`${width}px: passi separati, errori, punteggio 3/4 e salvataggio simulato OK`); await context.close();
 }
} finally {await browser.close();}

