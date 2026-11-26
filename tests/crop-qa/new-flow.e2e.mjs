import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Tutte le API tRPC sono simulate: questa prova non crea o altera dati reali.
const BASE=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const OUT=process.env.FLOW_QA_OUTPUT ?? '/tmp/lingue-new-flow-qa';
await fs.mkdir(OUT,{recursive:true});
const photo=await fs.readFile(new URL('./fixtures/testo.png',import.meta.url));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true});
let descriptions=[],photos=0,audioInputs=[],generated=null,saved=null;
const mc={type:'mc',items:[
  {segments:[{t:'text',v:'She '},{t:'blank'},{t:'text',v:' an apple.'}],options:['eat','eats'],correct:'eats',translationIt:'Lei ___ una mela.'},
  {segments:[{t:'text',v:'They '},{t:'blank'},{t:'text',v:' to school.'}],options:['go','goes'],correct:'go',translationIt:'Loro ___ a scuola.'},
]};
const json=(result)=>JSON.stringify([{result:{data:{json:result}}}]);
await context.route('**/api/trpc/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname; let body={};
  try {body=JSON.parse(req.postData()||'{}');} catch {}
  const input=body?.['0']?.json ?? body?.json ?? {};
  if(path.includes('exercises.describeAdaptation')){
    descriptions.push(input);
    // Ritardo intenzionale per verificare che il testo umano non sia perso.
    await new Promise(resolve=>setTimeout(resolve,700));
    const mode=input.mode==='mc'?`scelta multipla con ${input.optionsCount} opzioni`:'riordino delle parole';
    return route.fulfill({status:200,contentType:'application/json',body:json({description:`L'esercizio chiede di completare le frasi. Adattalo con ${mode}.`})});
  }
  if(path.includes('exercises.readPhoto')){
    photos++;
    return route.fulfill({status:200,contentType:'application/json',body:json({text:photos===1?'1. She ___ an apple.':'2. They ___ to school.'})});
  }
  if(path.includes('exercises.transcribe')){
    audioInputs.push(input);
    return route.fulfill({status:200,contentType:'application/json',body:json({text:'Usa soltanto verbi al presente.'})});
  }
  if(path.includes('exercises.generate')){
    generated=input;
    return route.fulfill({status:200,contentType:'application/json',body:json({id:'mock-scelta',exercise:mc})});
  }
  if(path.includes('exercises.get')){
    return route.fulfill({status:200,contentType:'application/json',body:json({id:'mock-scelta',studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'06/11/2026',lang:'en',exercise:mc})});
  }
  if(path.includes('exercises.saveAnswers')){saved=input;return route.fulfill({status:200,contentType:'application/json',body:json({ok:true})});}
  if(path.includes('exercises.translate'))return route.fulfill({status:200,contentType:'application/json',body:json({translation:'Traduzione di prova.'})});
  return route.abort('blockedbyclient');
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));

async function auditTextAndLayout(label){
  const check=await page.evaluate(async()=>{
    await document.fonts.ready;
    const bad=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode,el=node.parentElement,text=node.textContent?.trim();
      if(!el || !text || el.closest('script,style,svg,[aria-hidden=true],.sr-only'))continue;
      const css=getComputedStyle(el),r=el.getBoundingClientRect();
      if(css.display==='none'||css.visibility==='hidden'||Number(css.opacity)===0||!r.width||!r.height)continue;
      const size=parseFloat(css.fontSize),family=css.fontFamily;
      // La prima pagina e la barra seguono la versione compatta del blog;
      // il minimo dei 14 pt resta valido nel percorso operativo.
      const compact=!!el.closest('[role="toolbar"],.lf-welcome');
      if((!compact && size<18.6)||!family.toLowerCase().includes('opendyslexic'))bad.push({text:text.slice(0,65),size,family});
    }
    const headings=[...document.querySelectorAll('.lf-flow-page h1,.lf-flow-page h2,.lf-flow-page h3,.lf-flow-page h4')].map(el=>({text:el.textContent.trim(),align:getComputedStyle(el).textAlign,transform:getComputedStyle(el).textTransform}));
    return {bad,headings,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth};
  });
  assert.deepEqual(check.bad,[],`${label}: testo più piccolo di 14pt o font diverso: ${JSON.stringify(check.bad)}`);
  assert.ok(check.scroll<=check.client+1,`${label}: scorrimento orizzontale ${JSON.stringify(check)}`);
  assert.ok(check.headings.every(h=>h.align==='center'&&h.transform==='uppercase'),`${label}: titoli ${JSON.stringify(check.headings)}`);
  console.log(`${label}: font >=14pt, OpenDyslexic, titoli e larghezza OK`);
}
try{
  await page.goto(BASE,{waitUntil:'networkidle'});
  await page.screenshot({path:`${OUT}/home-390.png`,fullPage:true});
  assert.equal(await page.getByRole('heading',{name:'LINGUE FACILI'}).count(),1);
  assert.equal(await page.getByRole('radio').count(),0,'la prima pagina non deve mostrare le lingue');
  await auditTextAndLayout('Prima pagina');
  await page.getByLabel('Cognome').fill('Sintetica');
  await page.getByLabel('Nome',{exact:true}).fill('Prova');
  await page.getByLabel('Classe').fill('2A');
  await page.getByRole('button',{name:"Entra e prepara l'esercizio"}).click();
  await page.waitForURL('**/setup?*');
  assert.equal(new URL(page.url()).searchParams.has('lang'),false);
  assert.equal(await page.getByRole('radio',{name:'INGLESE'}).count(),1);
  assert.equal(await page.getByRole('radio',{name:'SPAGNOLO'}).count(),1);
  assert.equal(await page.getByRole('radio',{name:'FRANCESE'}).count(),1);
  for(const [name,flag] of [['INGLESE','ie'],['SPAGNOLO','es'],['FRANCESE','fr']]){
    const label=page.locator('label').filter({has:page.getByRole('radio',{name,exact:true})});
    assert.match(await label.locator('img').getAttribute('src'),new RegExp(`/flags/${flag}\\.svg$`));
  }
  assert.equal(await page.getByRole('button',{name:/Verbi da completare|Parole e traduzioni|Traduci e riordina|Comprensione del testo|Registra e trascrivi/i}).count(),0);
  assert.equal(await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).count(),0,'il testo deve apparire solo dopo la lingua');
  assert.equal(await page.locator('#teacher-adaptation').count(),0,'la spiegazione deve apparire solo dopo il testo');
  assert.equal(await page.getByRole('button',{name:'REGISTRA ISTRUZIONI'}).count(),0);
  assert.equal(await page.getByRole('button',{name:"CREA L'ESERCIZIO"}).count(),0);
  // Il cerchio visivo resta piccolo, ma il radio nativo ha bersaglio 44px
  // e risponde alla tastiera: il CSS non deve sostituirne la semantica.
  for (const radio of await page.getByRole('radio').all()) {
    const box=await radio.boundingBox();assert.ok(box && box.width>=44 && box.height>=44,`radio troppo piccola: ${JSON.stringify(box)}`);
  }
  const englishRadio=page.getByRole('radio',{name:'INGLESE'});
  const uncheckedStyle=await englishRadio.evaluate(e=>getComputedStyle(e).backgroundImage);
  await englishRadio.focus();await page.keyboard.press('Space');
  assert.equal(await englishRadio.isChecked(),true,'selezione con tastiera non funzionante');
  assert.notEqual(await englishRadio.evaluate(e=>getComputedStyle(e).backgroundImage),uncheckedStyle,'stato selezionato non visibile');
  const source=page.getByRole('textbox',{name:"Testo dell'esercizio originale"});
  await source.waitFor();
  assert.equal(await page.getByText('Puoi aggiungere da 1 a 5 foto',{exact:true}).count(),1);
  assert.equal(await page.getByText('0/500 parole',{exact:true}).count(),1);
  assert.equal(await page.locator('#teacher-adaptation').count(),0);
  // Anche una sola lettera rivela il passo successivo: nessun minimo 3.
  await source.fill('a');
  await page.getByRole('heading',{name:'SPIEGA BREVEMENTE L’ESERCIZIO ALL’IA'}).waitFor();
  assert.equal(await page.getByRole('button',{name:"CREA L'ESERCIZIO"}).isDisabled(),true);
  assert.equal(await page.getByText('0/500 parole',{exact:true}).count(),1,'contatore della spiegazione vuota');
  assert.equal(await page.getByRole('button',{name:'REGISTRA ISTRUZIONI'}).count(),1);
  assert.equal(await page.getByLabel('Carica file audio con le istruzioni').count(),1);
  await source.fill('');
  assert.equal(await page.locator('#teacher-adaptation').count(),0);
  assert.equal(await page.getByRole('button',{name:"CREA L'ESERCIZIO"}).count(),0);
  await source.fill('1. She ___ an apple. (eat/eats)\n2. They ___ to school. (go/goes)');
  await page.getByRole('radio',{name:/SCELTA MULTIPLA/}).check();
  await page.getByRole('radio',{name:'2 opzioni'}).check();
  const explanation=page.locator('#teacher-adaptation');
  await page.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('2 opzioni'),null,{timeout:15000});
  assert.equal(descriptions.at(-1).lang,'en');
  assert.equal(descriptions.at(-1).mode,'mc');
  assert.equal(descriptions.at(-1).optionsCount,2);
  assert.match(descriptions.at(-1).text,/She ___ an apple/);
  await page.screenshot({path:`${OUT}/setup-390.png`,fullPage:true});
  await auditTextAndLayout('Seconda pagina');

  // La nuova risposta IA non deve cancellare ciò che viene scritto nel frattempo.
  const before=descriptions.length;
  await page.getByRole('radio',{name:'4 opzioni'}).check();
  for(let attempt=0;attempt<60 && descriptions.length===before;attempt++) await page.waitForTimeout(50);
  assert.ok(descriptions.length>before,'la nuova scelta deve avviare l’IA');
  await explanation.fill('La mia indicazione personale non deve sparire.');
  await page.getByText(/Hai modificato il testo mentre l'IA lavorava/).waitFor({timeout:10000});
  assert.equal(await explanation.inputValue(),'La mia indicazione personale non deve sparire.');
  await page.getByRole('button',{name:"AGGIUNGI LA PROPOSTA DELL'IA"}).click();
  assert.match(await explanation.inputValue(),/4 opzioni/);
  assert.match(await explanation.inputValue(),/La mia indicazione personale/);
  console.log('Spiegazione IA e modifica concorrente conservata OK');

  // Upload di un MP3 sintetico, trascrizione accodata alla spiegazione.
  const fakeMp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(500,11)]);
  await page.getByLabel('Carica file audio con le istruzioni').setInputFiles({name:'istruzioni.mp3',mimeType:'audio/mpeg',buffer:fakeMp3});
  await page.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('Usa soltanto verbi al presente'),null,{timeout:10000});
  assert.equal(audioInputs.length,1);assert.equal(audioInputs[0].source,'upload');assert.equal(audioInputs[0].mime,'audio/mpeg');
  assert.match(await explanation.inputValue(),/La mia indicazione personale/);
  console.log('File MP3 inoltrato e trascrizione inserita senza perdita del testo OK');

  await page.getByRole('button',{name:"CREA L'ESERCIZIO"}).click();
  await page.waitForURL('**/exercise?id=mock-scelta');
  assert.equal(generated.lang,'en');assert.equal(generated.type,'mc');assert.equal(generated.optionsCount,4);
  assert.match(generated.adaptation,/La mia indicazione personale/);assert.match(generated.adaptation,/Usa soltanto verbi/);
  await page.getByRole('heading',{name:'Scelta multipla'}).waitFor();
  assert.equal(await page.getByText('to school.').count(),0,'deve apparire una domanda alla volta');
  await auditTextAndLayout('Terza pagina');
  await page.screenshot({path:`${OUT}/exercise-390.png`,fullPage:true});
  await page.getByRole('button',{name:'Mostra traduzione'}).click();
  assert.equal(await page.getByText('Lei ___ una mela.').isVisible(),true);
  await page.getByRole('button',{name:'eats',exact:true}).click();
  await page.getByRole('button',{name:'AVANTI'}).click();
  assert.equal(await page.getByText('to school.').isVisible(),true);
  assert.equal(await page.getByText('Loro ___ a scuola.').isVisible(),false);
  await page.getByRole('button',{name:'go',exact:true}).click();
  // La schermata finale può comparire prima che l'effetto React invii la
  // richiesta: attendere la risposta simulata, non supporre che sia istantanea.
  const savedResponse=page.waitForResponse(response=>response.url().includes('exercises.saveAnswers') && response.status()===200,{timeout:10000});
  await page.getByRole('button',{name:'FINISCO'}).click();
  await page.getByText(/Risposte giuste al primo colpo/).waitFor();
  await savedResponse;
  assert.ok(saved,'la richiesta di salvataggio simulata deve essere arrivata');
  assert.equal(saved.answers.score,2);
  assert.deepEqual(saved.answers.items.map(a=>a.value),['eats','go']);
  await auditTextAndLayout('Pagina finale');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:"SCARICA L'ESERCIZIO CON RISPOSTE"}).click()]);
  await download.saveAs(`${OUT}/esercizio-sintetico.pdf`);
  console.log('Creazione, traduzione, una frase alla volta, punteggio e PDF OK');

  // Due fotografie: la spiegazione parte solo dopo la lettura di entrambe.
  await page.goto(`${BASE}/setup?lang=es`,{waitUntil:'networkidle'});
  const descBefore=descriptions.length;
  await page.locator('input[type=file][multiple]').setInputFiles([
    {name:'pagina1.png',mimeType:'image/png',buffer:photo},
    {name:'pagina2.png',mimeType:'image/png',buffer:photo},
  ]);
  // Radix mantiene per breve tempo la finestra precedente durante la sua
  // animazione di chiusura. Aspettare quella nuova, aperta e con un'immagine
  // diversa, anziché tentare di cliccare il dialogo già in chiusura.
  const crop=page.locator('[role="dialog"][data-state="open"]');
  let previousImageSrc=null;
  for(let i=0;i<2;i++){
    await crop.waitFor({state:'visible'});
    await page.waitForFunction(previous=>{
      const image=document.querySelector('[role="dialog"][data-state="open"] img');
      return !!image && !!image.currentSrc && image.currentSrc!==previous && image.complete && image.naturalWidth>0;
    },previousImageSrc,{timeout:15000});
    const imageSrc=await crop.locator('img').getAttribute('src');
    assert.ok(imageSrc && imageSrc!==previousImageSrc,`foto ${i+1} non aggiornata`);
    previousImageSrc=imageSrc;
    await crop.getByRole('button',{name:'Ritaglia',exact:true}).click();
    await page.waitForFunction(n=>(document.querySelector('textarea[aria-label="Testo dell\'esercizio originale"]')?.value.match(/___/g)?.length??0)>=n,i+1,{timeout:15000});
  }
  await page.getByRole('radio',{name:/RIORDINO DI PAROLE/}).check();
  await page.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('riordino'),null,{timeout:15000});
  assert.equal(photos,2);
  assert.ok(descriptions.length>descBefore);
  assert.equal(descriptions.at(-1).lang,'es');assert.equal(descriptions.at(-1).mode,'reorder');
  assert.match(descriptions.at(-1).text,/She[\s\S]*They/);
  console.log('Due foto, lettura immediata in ordine e analisi successiva OK');

  await page.setViewportSize({width:320,height:720});
  await page.goto(`${BASE}/setup?lang=fr`,{waitUntil:'networkidle'});
  await auditTextAndLayout('Seconda pagina a 320px');
  await page.screenshot({path:`${OUT}/setup-320.png`,fullPage:true});
  assert.deepEqual(errors,[],`errori JS: ${errors.join('; ')}`);
  console.log('TUTTI I TEST DEL NUOVO PERCORSO PASSATI');
} finally { await context.close();await browser.close(); }

