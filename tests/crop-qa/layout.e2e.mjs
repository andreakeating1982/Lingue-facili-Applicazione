import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,390,1440]) for(const scale of [0.8,1,1.6]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({scale})=>{
    localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'}));
  },{scale});
  // Scheda sintetica: nessuna richiesta tocca il database condiviso.
  await context.route('**/api/trpc/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{result:{data:{json:{id:'layout-test',studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'06/11/2026',lang:'en',exercise:{type:'mc',items:[{segments:[{t:'text',v:'She '},{t:'blank'},{t:'text',v:' an apple.'}],options:['eat','eats'],correct:'eats',translationIt:'Lei ___ una mela.'}]}}}}}])}));
  const page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});
  const result=await page.evaluate(async()=>{
   await document.fonts.ready;
   const inputs=[...document.querySelectorAll('.lf-welcome input[aria-label]')].map(el=>{
    const s=getComputedStyle(el),t=el.value?s:getComputedStyle(el,'::placeholder'),r=el.getBoundingClientRect();const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    ctx.font=`${t.fontWeight} ${t.fontSize} ${t.fontFamily}`;
    const text=el.value || el.placeholder;
    return {label:el.getAttribute('aria-label'),text,width:r.width,height:r.height,textWidth:ctx.measureText(text).width,available:r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-4};
   });
   return {scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,inputs};
  });
  assert.ok(result.scroll<=result.client+1,`overflow ${width}/${scale}: ${JSON.stringify(result)}`);
  assert.equal(result.inputs.length,4,`i quattro campi della prima pagina non sono stati rilevati: ${JSON.stringify(result)}`);
  assert.ok(result.inputs.every(i=>i.height>=44 && i.textWidth<=i.available+1),`testo tagliato ${width}/${scale}: ${JSON.stringify(result)}`);
  console.log(`${width}px scala ${scale}: prima pagina, campi e target touch OK`);
  for (const [path, label] of [['/setup?lang=es','preparazione'],['/exercise?id=layout-test','esercizio']]) {
    await page.goto(base+path,{waitUntil:'networkidle'});
    if(label==='esercizio') await page.getByRole('heading',{name:'Scelta multipla'}).waitFor();
    const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return s.display!=='none'&&r.width>0&&(r.right>innerWidth+1||r.left< -1)}).slice(0,8).map(el=>({tag:el.tagName,text:el.textContent.trim().slice(0,50),class:String(el.className).slice(0,100)}))}));
    if(width===320 && scale===1.6) await page.screenshot({path:`/tmp/lingue-new-flow-qa/${label}-320-160.png`,fullPage:true});
    assert.ok(size.scroll<=size.client+1,`${label} overflow ${width}/${scale}: ${JSON.stringify(size)}`);
    if(label==='esercizio') {
      await page.getByRole('button',{name:'Mostra traduzione'}).click();
      await page.getByText('Lei ___ una mela.').waitFor();
      await page.getByRole('button',{name:'eats',exact:true}).click();
      await page.getByRole('button',{name:'FINISCO'}).click();
      await page.getByText(/Risposte giuste al primo colpo/).waitFor();
      const finalSize=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      if(width===320 && scale===1.6) await page.screenshot({path:'/tmp/lingue-new-flow-qa/finale-320-160.png',fullPage:true});
      assert.ok(finalSize.scroll<=finalSize.client+1,`schermata finale overflow ${width}/${scale}: ${JSON.stringify(finalSize)}`);
    }
    console.log(`${width}px scala ${scale}: ${label}, larghezza OK`);
  }
  await context.close();
 }
}finally{await browser.close();}

