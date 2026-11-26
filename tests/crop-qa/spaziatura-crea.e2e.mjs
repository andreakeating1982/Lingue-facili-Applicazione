import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// API simulate: non crea, salva o modifica esercizi reali.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const json=x=>JSON.stringify([{result:{data:{json:x}}}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const [width,scale] of [[320,1],[390,1],[1440,1],[320,1.6]]) {
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
  await context.route('**/api/trpc/**',route=>{
   if(route.request().url().includes('exercises.describeAdaptation')) return route.fulfill({status:200,contentType:'application/json',body:json({description:'Riordina le parole nella frase originale.'})});
   return route.abort('blockedbyclient');
  });
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
   if(scale===1.6) for(let i=0;i<6;i++) await page.getByRole('button',{name:'Aumenta la dimensione del testo'}).click();
   await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).fill('She reads a book.');
   await page.getByRole('radio',{name:/RIORDINO DI PAROLE/}).check();
   await page.getByText('Spiegazione pronta: controllala e correggila se necessario.').waitFor({timeout:15000});
   const button=page.getByRole('button',{name:"CREA L'ESERCIZIO"});
   await button.waitFor({state:'visible'});
   assert.ok(await button.isEnabled(),'il pulsante deve essere utilizzabile');
   const info=page.getByText("La registrazione audio si ferma",{exact:false});
   const action=page.locator('.lf-create-action');
   const result=await action.evaluate((el)=>{
    const button=el.querySelector('button'), info=el.previousElementSibling.querySelector('p.mt-5:last-of-type');
    const card=el.closest('.card-paper');
    const b=button.getBoundingClientRect(), i=info.getBoundingClientRect(), c=card.getBoundingClientRect(),s=getComputedStyle(el);
    return {top:b.top-i.bottom,bottom:c.bottom-b.bottom,mt:parseFloat(s.marginTop),mb:parseFloat(s.marginBottom),buttonWidth:b.width,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttonX:b.x};
   });
   assert.ok(result.top >= 27,`distanza sopra insufficiente ${JSON.stringify(result)}`);
   assert.ok(result.bottom >= 34,`distanza sotto insufficiente ${JSON.stringify(result)}`);
   assert.ok(result.mt>0 && result.mb>0,'margini entrambi presenti');
   assert.ok(result.buttonX>=0 && result.buttonX+result.buttonWidth<=width+.1,'pulsante oltre lo schermo');
   assert.ok(result.scrollWidth<=width+1,'scroll laterale');
   assert.equal(await info.count(),1);
   await button.scrollIntoViewIfNeeded();
   if(scale===1) {
    // Inquadratura di prova: paragrafo informativo e pulsante reale, con API simulate.
    const infoBox=await info.boundingBox(), buttonBox=await button.boundingBox();
    const top=Math.max(0,infoBox.y-24), bottom=buttonBox.y+buttonBox.height+30;
    await page.screenshot({path:`/tmp/lf-spaziatura-crea-${width}.png`,clip:{x:0,y:top,width,height:bottom-top}});
   }
   await button.focus();
   assert.ok(await button.evaluate(e=>document.activeElement===e),'focus da tastiera');
   assert.deepEqual(errors,[]);
   console.log(`${width}px scala ${scale}: sopra ${result.top.toFixed(1)}px, sotto ${result.bottom.toFixed(1)}px; pulsante visibile e abilitato, dati simulati.`);
  }finally{await context.close();}
 }
}finally{await browser.close();}

