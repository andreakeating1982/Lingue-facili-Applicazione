import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Scheda e salvataggio interamente simulati: nessuna scrittura nel database.
const BASE=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const json=value=>JSON.stringify([{result:{data:{json:value}}}]);
const items=Array.from({length:15},(_,i)=>({segments:[{t:'text',v:`Sentence ${i+1}: She `},{t:'blank'},{t:'text',v:' every day.'}],options:['studies','study'],correct:'studies',translationIt:`Frase ${i+1}: lei ___ ogni giorno.`}));
const row={id:'15-frasi-sintetiche',lang:'en',studentNome:'Esempio',studentCognome:'Prova',studentClasse:'2A',studentData:'13/11/2026',exercise:{type:'mc',items}};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,isMobile:width<600,acceptDownloads:true});
  let saves=0;
  await context.route('**/api/trpc/**',async route=>{
    const url=route.request().url();
    if(url.includes('exercises.get')) return route.fulfill({status:200,contentType:'application/json',body:json(row)});
    if(url.includes('exercises.saveAnswers')) { saves++; return route.fulfill({status:200,contentType:'application/json',body:json({success:true})}); }
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(`${BASE}/exercise?id=15-frasi-sintetiche`,{waitUntil:'networkidle'});
    for(let i=1;i<=15;i++) {
      await page.getByText(`Esercizio ${i} di 15`,{exact:false}).waitFor();
      await page.getByRole('button',{name:'studies',exact:true}).click();
      await page.getByRole('button',{name:i===15?'FINISCO':'AVANTI',exact:true}).click();
    }
    await page.getByText(/Risposte giuste al primo colpo:/).waitFor();
    assert.match(await page.getByText(/Risposte giuste al primo colpo:/).innerText(),/15\s+su\s+15/);
    await page.waitForTimeout(300);
    assert.equal(saves,1);
    if(width===1440){
      const downloading=page.waitForEvent('download');
      await page.getByRole('button',{name:"SCARICA L'ESERCIZIO CON RISPOSTE"}).click();
      const pdf=await downloading;
      await pdf.saveAs('/tmp/lingue-quindici-frasi.pdf');
    }
    assert.deepEqual(errors,[]);
    console.log(`${width}px: svolgimento di 15 frasi e punteggio 15/15, salvataggio simulato OK.`);
  }finally{await context.close();}
 }
}finally{await browser.close();}

