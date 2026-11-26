import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';

// API simulate e foto sintetica: nessuna richiesta arriva al database o all'IA.
const BASE = (process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const reply = value => JSON.stringify([{result:{data:{json:value}}}]);
const picture = await fs.readFile(new URL('./fixtures/piccola.png',import.meta.url));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases = [
 {width:320,height:760,scale:1,lh:1.65,lang:'en',mode:'mc',over:true},
 {width:320,height:760,scale:1.6,lh:2.6,lang:'en',mode:'reorder',over:true},
 {width:390,height:844,scale:1,lh:1.65,lang:'es',mode:'mc',over:true,photo:true},
 {width:390,height:844,scale:1,lh:1.65,lang:'fr',mode:'reorder',over:true},
 {width:390,height:844,scale:1,lh:1.65,lang:'fr',mode:'mc',over:true,contrast:true},
 {width:1440,height:900,scale:1,lh:1.65,lang:'en',mode:'mc',over:true},
 {width:390,height:844,scale:1,lh:1.65,lang:'en',mode:'mc',over:false},
 {width:390,height:844,scale:1,lh:1.65,lang:'es',mode:'reorder',over:false},
 {width:390,height:844,scale:1,lh:1.65,lang:'fr',mode:'mc',over:true,iframe:true},
 {width:320,height:760,scale:1.6,lh:2.6,lang:'en',mode:'mc',over:true,iframe:true},
];

function exFor(mode){
 return mode==='mc'
   ? {type:'mc',items:Array.from({length:10},(_,i)=>({segments:[{t:'text',v:`Frase ${i+1}: She `},{t:'blank'},{t:'text',v:' today.'}],options:['works','work'],correct:'works',translationIt:`Frase ${i+1}: lei ___ oggi.`}))}
   : {type:'reorder',items:Array.from({length:10},(_,i)=>({chips:[{t:`Name${i+1}`,role:'subject'},{t:'works.',role:'verb'}],answer:`Name${i+1} works.`,translationIt:`Nome ${i+1} lavora.`}))};
}

let parentServer;
try {
 for(const test of cases){
  const {width,height,scale,lh,lang,mode,over,photo,iframe,contrast}=test;
  const source=Array.from({length:over?12:10},(_,i)=>`${i+1}. Name${i+1} ___ today.`).join('\n');
  const exercise=exFor(mode); let generated=null, readCount=0;
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<600,isMobile:width<600});
  await context.addInitScript(({scale,lh,contrast})=>{
   localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:lh,ruler:false,mode:contrast?'contrasto':'normale'}));
  },{scale,lh,contrast});
  await context.route('**/api/trpc/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   let body={};try{body=JSON.parse(req.postData()||'{}');}catch{}
   const input=body?.['0']?.json??body?.json??{};
   if(path.includes('exercises.describeAdaptation')) return route.fulfill({status:200,contentType:'application/json',body:reply({description:'Adatta le frasi originali in ordine.'})});
   if(path.includes('exercises.readPhoto')){readCount++;return route.fulfill({status:200,contentType:'application/json',body:reply({text:source})});}
   if(path.includes('exercises.generate')){generated=input;return route.fulfill({status:200,contentType:'application/json',body:reply({id:'test-prime-dieci',exercise,wasTruncated:over})});}
   if(path.includes('exercises.get')) return route.fulfill({status:200,contentType:'application/json',body:reply({id:'test-prime-dieci',lang,studentNome:'',studentCognome:'',studentClasse:'',studentData:'',exercise})});
   return route.abort('blockedbyclient');
  });
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let frame=page;
  if(iframe){
   parentServer=http.createServer((_req,res)=>{
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div style="height:650px">INIZIO BLOG</div><iframe title="Lingue Facili" src="${BASE}/setup?lang=${lang}" style="width:100%;height:${scale>1?6000:3100}px;border:0" allow="camera; microphone"></iframe><div style="height:1000px">FINE BLOG</div></body></html>`);
   });
   await new Promise(resolve=>parentServer.listen(0,'127.0.0.1',resolve));
   const port=parentServer.address().port;
   await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
   const element=await page.locator('iframe').elementHandle(); frame=await element.contentFrame();
   assert.ok(frame,'iframe non raggiungibile');
  }else await page.goto(`${BASE}/setup?lang=${lang}`,{waitUntil:'networkidle'});
  const textbox=frame.getByRole('textbox',{name:"Testo dell'esercizio originale"});
  await textbox.waitFor({state:'visible'});
  if(photo){
   await frame.locator('input[type=file][multiple]').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:picture});
   const crop=frame.getByRole('dialog');await crop.waitFor({state:'visible'});
   await frame.waitForFunction(()=>{const img=document.querySelector('[role=dialog] img');return !!img && img.naturalWidth>0;});
   await crop.getByRole('button',{name:'Ritaglia',exact:true}).click();
   await frame.waitForFunction(()=>document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.includes('Name12'),null,{timeout:20000});
   assert.equal(readCount,1);
  } else await textbox.fill(source);
  await frame.getByRole('radio',{name:mode==='mc'?/SCELTA MULTIPLA/:/RIORDINO DI PAROLE/}).check();
  if(mode==='mc') await frame.getByRole('radio',{name:'2 opzioni'}).check();
  await frame.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('Adatta le frasi'),null,{timeout:15000});
  const create=frame.getByRole('button',{name:"CREA L'ESERCIZIO"});
  await create.waitFor({state:'visible'});
  const generatedResponse=page.waitForResponse(response=>response.url().includes('exercises.generate') && response.status()===200,{timeout:15000});
  await create.click();
  await generatedResponse;
  assert.ok(generated,'la richiesta di generazione simulata non è arrivata');
  assert.equal(generated.text,source,'il testo originale deve arrivare integro');
  assert.equal(generated.lang,lang);assert.equal(generated.type,mode);
  const modal=frame.getByRole('alertdialog');
  if(over){
   await modal.waitFor({state:'visible',timeout:15000});
   // Attendere la fine dell'animazione Radix prima di valutare i colori e lo screenshot.
   await page.waitForTimeout(450);
   const visual=await modal.evaluate(el=>({opacity:getComputedStyle(el).opacity,bg:getComputedStyle(el).backgroundColor}));
   assert.equal(visual.opacity,'1',`il dialogo deve essere opaco: ${JSON.stringify(visual)}`);
   assert.equal(visual.bg,contrast?'rgb(17, 17, 17)':'rgb(250, 248, 245)',`lo sfondo deve coprire i contenuti sottostanti: ${JSON.stringify(visual)}`);
   if(contrast){
    assert.equal(await frame.evaluate(()=>document.documentElement.classList.contains('lf-hc')),true,'la modalità alto contrasto deve restare attiva');
    await page.screenshot({path:'/tmp/lf-prime-dieci-alto-contrasto-390.png'});
   }
   assert.ok(await modal.getByRole('heading',{name:'AVVISO'}).isVisible());
   const description=modal.getByText(/Sono state adattate solo le prime 10/);
   assert.ok(await description.isVisible());
   assert.match(await description.innerText(),/successive non sono incluse nella scheda/);
   assert.ok(await modal.getAttribute('aria-describedby'));
   assert.ok(await modal.getAttribute('aria-labelledby'));
   const style=await description.evaluate(el=>({family:getComputedStyle(el).fontFamily,font:parseFloat(getComputedStyle(el).fontSize),line:parseFloat(getComputedStyle(el).lineHeight)}));
   assert.match(style.family,/OpenDyslexic/i);assert.ok(style.font>=18.6);assert.ok(style.line/style.font>=lh-0.02,`interlinea popup ${JSON.stringify(style)}`);
   const dimensions=await modal.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,scroll:el.scrollWidth,client:el.clientWidth}));
   assert.ok(dimensions.scroll<=dimensions.client+1,`avviso con scroll orizzontale: ${JSON.stringify(dimensions)}`);
   const go=modal.getByRole('button',{name:'CONTINUA',exact:true});
   const dialogBox=await modal.boundingBox(), goBox=await go.boundingBox();
   assert.ok(dialogBox && goBox && goBox.y >= dialogBox.y && goBox.y+goBox.height <= dialogBox.y+dialogBox.height+1,'CONTINUA deve rimanere visibile anche con testo ingrandito');
   if(width===320 && scale===1.6){
    const head=modal.getByRole('region',{name:"Testo completo dell'avviso"});
    const initial=await head.evaluate(el=>({need:el.scrollHeight>el.clientHeight,top:el.scrollTop,height:el.scrollHeight,client:el.clientHeight}));
    assert.ok(initial.need,`il testo ingrandito deve poter scorrere: ${JSON.stringify(initial)}`);
    await head.focus();
    assert.equal(await head.evaluate(el=>document.activeElement===el),true,'il testo scorrevole deve ricevere focus da tastiera');
    await page.keyboard.press('End');
    await page.waitForTimeout(350);
    const scrollInfo=await head.evaluate(el=>({top:el.scrollTop,height:el.scrollHeight,client:el.clientHeight}));
    assert.ok(scrollInfo.top>0,`il testo lungo deve scorrere con la tastiera: ${JSON.stringify(scrollInfo)}`);
    await page.screenshot({path:'/tmp/lf-prime-dieci-modal-320-1_6-bottom.png'});
    await head.evaluate(el=>el.scrollTop=0);
   }
   if(iframe){
    const box=await modal.boundingBox();
    const child=await modal.evaluate(el=>({styleTop:el.style.top,cssTop:getComputedStyle(el).top,innerHeight:innerHeight,scrollY:scrollY,rect:el.getBoundingClientRect().toJSON(),docHeight:document.documentElement.scrollHeight,bodyPosition:getComputedStyle(document.body).position}));
    const parent=await page.evaluate(()=>({scrollY,iframe:document.querySelector('iframe')?.getBoundingClientRect().toJSON()}));
    await page.screenshot({path:`/tmp/lf-prime-dieci-iframe-${width}-${String(scale).replace('.','_')}.png`});
    assert.ok(box && box.y>=-2 && box.y+box.height<=height+2,`il popup deve comparire nello schermo visibile del blog: ${JSON.stringify({box,child,parent})}`);
   }else if((width===320 && scale===1.6)||width===1440||photo){
    await page.screenshot({path:`/tmp/lf-prime-dieci-modal-${width}-${String(scale).replace('.','_')}.png`});
   }
   await go.focus();assert.equal(await go.evaluate(el=>document.activeElement===el),true,'CONTINUA deve essere raggiungibile da tastiera');
   await frame.keyboard?.press?.('Enter');
   // Frame non espone keyboard: inviare l'evento nel contesto della pagina.
   if(await modal.isVisible()) await page.keyboard.press('Enter');
   await frame.waitForURL('**/exercise?id=test-prime-dieci');
  } else {
   await frame.waitForURL('**/exercise?id=test-prime-dieci');
   assert.equal(await modal.count(),0,'nessun avviso se non è stato escluso niente');
  }
  await frame.getByRole('heading',{name:mode==='mc'?'Scelta multipla':'Riordina le parole'}).waitFor({timeout:10000});
  assert.equal(await frame.getByText(/Name11|Frase 11/).count(),0,'gli item dopo il decimo non devono apparire');
  assert.deepEqual(errors,[]);
  console.log(`${width}px/${scale}, ${lang}/${mode}, ${photo?'foto sintetica, ':''}${iframe?'cornice cross-origin, ':''}${contrast?'alto contrasto, ':''}${over?'avviso e CONTINUA':'nessun avviso'}: OK`);
  await context.close();
  if(parentServer){await new Promise(resolve=>parentServer.close(resolve));parentServer=undefined;}
 }
}finally{
 if(parentServer) await new Promise(resolve=>parentServer.close(resolve));
 await browser.close();
}
