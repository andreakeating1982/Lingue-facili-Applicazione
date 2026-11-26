import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const row={id:'legacy',lang:'en',studentNome:'Demo',studentCognome:'Test',studentClasse:'',studentData:'',exercise:{type:'mc',items:[{segments:[{t:'text',v:'She '},{t:'blank'},{t:'text',v:' and '},{t:'blank'},{t:'text',v:'.'}],options:['reads','read'],correct:'reads',translationIt:'Lei ___ e ___.'}]}};
const json=x=>JSON.stringify([{result:{data:{json:x}}}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,1440]) {
  const c=await browser.newContext({viewport:{width,height:844}}); let saved=false;
  await c.route('**/api/trpc/**',r=>{
   const u=r.request().url();
   if(u.includes('exercises.get'))return r.fulfill({status:200,contentType:'application/json',body:json(row)});
   if(u.includes('translateOptions'))return r.fulfill({status:200,contentType:'application/json',body:json({translations:['legge','leggono']})});
   if(u.includes('saveAnswers')){saved=true; return r.fulfill({status:200,contentType:'application/json',body:json({success:true})});}
   return r.abort();
  });
  const p=await c.newPage(); await p.goto(`${base}/exercise?id=legacy`,{waitUntil:'networkidle'});
  assert.match(await p.getByRole('note').innerText(),/un solo gruppo di opzioni/);
  await p.getByRole('button',{name:/Mostra traduzione/i}).click();
  await p.getByText('legge', {exact:true}).waitFor();
  assert.match(await p.locator('.lf-translation-panel').innerText(), /Opzioni in italiano:/i);
  await p.getByRole('button',{name:'reads',exact:true}).click();
  await p.getByRole('button',{name:'FINISCO'}).click();
  assert.match(await p.getByText(/Risposte giuste al primo colpo:/).innerText(),/1\s+su\s+1/);
  await p.waitForTimeout(300); assert.ok(saved);
  console.log(`${width}px: scheda storica utilizzabile come prima, con avviso e salvataggio simulato.`); await c.close();
 }
} finally {await browser.close()}

