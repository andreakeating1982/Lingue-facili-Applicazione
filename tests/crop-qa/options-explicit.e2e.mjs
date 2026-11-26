import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Solo dati sintetici e API intercettate: nessuna scheda reale viene creata.
const BASE = (process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const json = value => JSON.stringify([{result:{data:{json:value}}}]);
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const requests=[];
await context.route('**/api/trpc/**', async route => {
  const request=route.request();
  if (!request.url().includes('exercises.describeAdaptation')) return route.abort('blockedbyclient');
  let body={};try {body=JSON.parse(request.postData()||'{}')}catch{}
  const input=body?.['0']?.json ?? body?.json ?? {};
  requests.push(input);
  await new Promise(resolve=>setTimeout(resolve,1200));
  const description=input.mode==='mc'
    ? `Spiegazione di prova: scelta multipla con ${input.optionsCount} opzioni.`
    : 'Spiegazione di prova: riordino delle parole.';
  try { await route.fulfill({status:200,contentType:'application/json',body:json({description})}); } catch {}
});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const explanation=page.locator('#teacher-adaptation');
const create=page.getByRole('button',{name:"CREA L'ESERCIZIO"});
const mc=page.getByRole('radio',{name:/SCELTA MULTIPLA/});
const reorder=page.getByRole('radio',{name:/RIORDINO DI PAROLE/});
const count=n=>page.getByRole('radio',{name:`${n} opzioni`});
const status=page.getByText('Spiegazione pronta: controllala e correggila se necessario.',{exact:true});
const audio=page.getByRole('button',{name:'REGISTRA ISTRUZIONI'});
const hint=page.getByText("La registrazione audio si ferma e viene trascritta dall'IA dopo 30 secondi. Puoi anche caricare un file audio fino a 12 MB. L'applicazione può preparare massimo 10 frasi o domande alla volta",{exact:true});

async function readyFor(n) {
  await page.waitForFunction(n=>document.querySelector('#teacher-adaptation')?.value.includes(`con ${n} opzioni.`),n,{timeout:12000});
  await status.waitFor({state:'visible'});
  assert.equal(requests.at(-1).mode,'mc');
  assert.equal(requests.at(-1).optionsCount,n);
}
async function checkSpacing(width) {
  await page.setViewportSize({width,height:900});
  const top=await status.boundingBox(), buttons=await audio.locator('..').boundingBox(), bottom=await hint.boundingBox();
  assert.ok(top && buttons && bottom,`audio ${width}: elementi non visibili`);
  assert.ok(buttons.y-(top.y+top.height)>=20,`audio ${width}: scritta superiore troppo vicina: ${JSON.stringify({top,buttons})}`);
  assert.ok(bottom.y-(buttons.y+buttons.height)>=16,`audio ${width}: scritta inferiore troppo vicina: ${JSON.stringify({buttons,bottom})}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),`audio ${width}: overflow orizzontale`);
  await page.screenshot({path:`/tmp/lingue-opzioni-audio-${width}.png`,fullPage:true});
  console.log(`SPAZI AUDIO ${width}px: sopra ${Math.round(buttons.y-(top.y+top.height))}px, sotto ${Math.round(bottom.y-(buttons.y+buttons.height))}px.`);
}
try {
  await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
  await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).fill('She studies English every day.');
  await mc.check();
  for(const n of [2,3,4]) assert.equal(await count(n).isChecked(),false,`${n} non deve essere preselezionato`);
  assert.equal(await explanation.count(),0,'la spiegazione non deve essere visibile prima del numero');
  assert.equal(await create.isDisabled(),true,'creazione bloccata finché il numero non è scelto');
  await page.getByText('Scegli 2, 3 o 4 opzioni per preparare la spiegazione.',{exact:true}).waitFor();
  await page.waitForTimeout(1600);
  assert.equal(requests.length,0,'nessuna richiesta IA prima della scelta del numero');
  for(const n of [2,3,4]) {
    const before=requests.length;
    await count(n).check();
    await readyFor(n);
    assert.equal(requests.length,before+1,`una sola richiesta dopo la scelta ${n}`);
    assert.equal(await create.isEnabled(),true);
    console.log(`SCELTA MULTIPLA: spiegazione solo dopo ${n} opzioni selezionate esplicitamente.`);
  }
  for(const w of [320,390,682,1440]) await checkSpacing(w);

  // Una modifica umana mentre la nuova risposta è in arrivo non va persa.
  const pendingRequest=page.waitForRequest(req=>req.url().includes('exercises.describeAdaptation'));
  await count(2).check(); await pendingRequest;
  await explanation.fill('Questa nota personale deve restare.');
  await page.getByText(/Hai modificato il testo mentre l'IA lavorava/).waitFor({timeout:10000});
  assert.equal(await explanation.inputValue(),'Questa nota personale deve restare.');
  await page.getByRole('button',{name:"AGGIUNGI LA PROPOSTA DELL'IA"}).click();
  assert.match(await explanation.inputValue(),/2 opzioni/);
  assert.match(await explanation.inputValue(),/Questa nota personale/);
  console.log('Risposta IA concorrente: istruzioni personali conservate.');

  // Il riordino non richiede numero opzioni; tornando a MC la scelta è azzerata.
  await reorder.check();
  await page.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('riordino delle parole'),null,{timeout:12000});
  assert.equal(requests.at(-1).mode,'reorder');
  await mc.check();
  for(const n of [2,3,4]) assert.equal(await count(n).isChecked(),false);
  assert.equal(await explanation.count(),0,'non mostrare una vecchia spiegazione del riordino');
  const before=requests.length;await page.waitForTimeout(1600);assert.equal(requests.length,before,'nessuna richiesta quando si torna a MC senza numero');
  await count(3).check();await readyFor(3);
  assert.match(await explanation.inputValue(),/Questa nota personale/,'il cambio tipo non deve perdere le note umane');
  console.log('RIORDINO e ritorno a SCELTA MULTIPLA: nuova scelta richiesta, nota personale conservata.');

  // Una vecchia risposta di riordino in ritardo non deve comparire né far
  // partire una chiamata MC prima che venga scelto il numero.
  await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
  await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).fill('She studies English every day.');
  const delayed=page.waitForRequest(req=>req.url().includes('exercises.describeAdaptation'));
  await reorder.check();await delayed;
  await mc.check();
  const beforeOldResponse=requests.length;
  await page.waitForTimeout(1500);
  assert.equal(requests.length,beforeOldResponse,'nessuna richiesta MC finché il numero non è scelto');
  assert.equal(await explanation.count(),0,'la risposta vecchia non deve diventare visibile');
  await count(4).check();await readyFor(4);
  await page.waitForTimeout(300);
  assert.doesNotMatch(await explanation.inputValue(),/riordino delle parole/);
  assert.deepEqual(errors,[]);
  console.log('Risposta precedente in ritardo ignorata prima della scelta del numero.');
  console.log('TEST OPZIONI ESPLICITE E DISTANZA AUDIO SUPERATI.');
} finally {await context.close();await browser.close();}

