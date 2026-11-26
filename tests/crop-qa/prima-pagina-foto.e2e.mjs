import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,390,773,1030,1440]){
  const c=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});
  await c.addInitScript(()=>{localStorage.clear();localStorage.setItem('lingue-facili-studente',JSON.stringify({cognome:'Prova',nome:'Studente',data:'13/11/2026',classe:'2A'}));});
  await c.route('**/api/trpc/**',r=>r.abort());
  const p=await c.newPage(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base,{waitUntil:'networkidle'}); await p.evaluate(()=>document.fonts.ready);
  const vals=await p.evaluate(()=>{
   const sample=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{font:parseFloat(s.fontSize),width:r.width,height:r.height,color:s.color,bg:s.backgroundColor,radius:s.borderRadius,textTransform:s.textTransform,top:r.top,bottom:r.bottom}};
   return {root:sample(document.documentElement), heading:sample(document.querySelector('h1')), enter:sample(document.querySelector('button[aria-label="Entra e prepara l\'esercizio"]')),field:sample(document.querySelector('input[aria-label=Cognome]')),bar:sample(document.querySelector('[role=toolbar]')),groups:[...document.querySelectorAll('[role=toolbar] [role=group]')].map(sample),barButton:sample(document.querySelector('[aria-label="Cambia la modalità di lettura"]')),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
  });
  assert.ok(Math.abs(vals.root.font-16)<0.1,JSON.stringify(vals));
  assert.ok(Math.abs(vals.heading.font-18)<0.1,JSON.stringify(vals.heading));
  assert.ok(Math.abs(vals.field.font-14)<0.1,JSON.stringify(vals.field));
  assert.ok(Math.abs(vals.enter.font-14)<0.1,JSON.stringify(vals.enter));
  assert.equal(vals.enter.bg,'rgb(139, 58, 26)');assert.equal(vals.enter.radius,'10px');
  assert.equal(vals.barButton.textTransform,'none');assert.equal(vals.groups.length,5);
  assert.ok(vals.overflow<=1,`debordo ${width}: ${vals.overflow}`);
  const card=p.locator('.lf-welcome input').first().locator('../..');
  assert.ok(await card.isVisible());
  await p.screenshot({path:`/tmp/lf-home-riferimento-${width}.png`,fullPage:true});
  const b=p.getByRole('button',{name:'Entra e prepara l\'esercizio'});await b.click();
  await p.waitForURL(/\/setup/);assert.equal(await p.evaluate(()=>document.documentElement.classList.contains('lf-home')),false,'la scala compatta deve essere solo sulla prima pagina');
  assert.ok(await p.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)>=18.6),'le pagine didattiche mantengono 14pt');
  assert.deepEqual(errors,[]);console.log(`${width}px: card, scala, barra, pulsante e passaggio al percorso didattico OK`);await c.close();
 }
}finally{await browser.close();}

