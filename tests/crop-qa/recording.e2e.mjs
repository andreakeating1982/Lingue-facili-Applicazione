import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Microfono sintetico di Chromium, API intercettate: nessun dato reale o DB.
const BASE = process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,permissions:['microphone']});
await context.addInitScript(() => {
  const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (getUserMedia) navigator.mediaDevices.getUserMedia = async (constraints) => {
    const stream = await getUserMedia(constraints);
    (window.__qaVoiceStreams ??= []).push(stream);
    return stream;
  };
});
const audioInputs=[];
const reply=(data)=>JSON.stringify([{result:{data:{json:data}}}]);
await context.route('**/api/trpc/**', async route => {
  const request=route.request(), path=new URL(request.url()).pathname;
  let body={}; try {body=JSON.parse(request.postData() || '{}');} catch {}
  const input=body?.['0']?.json ?? body?.json ?? {};
  if(path.includes('exercises.transcribe')) {
    audioInputs.push(input);
    return route.fulfill({status:200,contentType:'application/json',body:reply({text:`Istruzione registrata numero ${audioInputs.length}.`})});
  }
  if(path.includes('exercises.describeAdaptation')) return route.fulfill({status:200,contentType:'application/json',body:reply({description:'Adatta il testo conservando le frasi originali.'})});
  return route.abort('blockedbyclient');
});
const page=await context.newPage();
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
  // La sezione vocale compare dopo la trascrizione dell'esercizio.
  await page.getByRole('textbox',{name:"Testo dell'esercizio originale"}).fill('She studies English every day.');
  const instructions=page.locator('#teacher-adaptation');
  await instructions.fill('Le parole già scritte restano.');
  const start=page.getByRole('button',{name:'REGISTRA ISTRUZIONI'});
  const stop=page.getByRole('button',{name:'FERMA REGISTRAZIONE'});
  const waitTranscription=()=>page.waitForResponse(response=>response.url().includes('exercises.transcribe') && response.status()===200,{timeout:40000});

  // Registrazione reale di un segnale sintetico, interrotta manualmente.
  let response=waitTranscription();
  await start.click(); await stop.waitFor({state:'visible',timeout:10000});
  assert.equal(await stop.getAttribute('aria-pressed'),'true');
  await page.waitForTimeout(1300);
  await stop.click(); await response;
  await page.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('Istruzione registrata numero 1.'),null,{timeout:10000});
  assert.match(await instructions.inputValue(),/Le parole già scritte restano/);
  assert.equal(audioInputs[0].source,'recording');
  assert.match(audioInputs[0].mime,/^audio\//);
  assert.ok(Buffer.from(audioInputs[0].audio,'base64').length>100,'l’audio sintetico deve contenere dati');
  await page.waitForFunction(()=>window.__qaVoiceStreams?.[0]?.getTracks().every(track=>track.readyState==='ended'),null,{timeout:10000});
  console.log('MICROFONO SINTETICO: registrazione, arresto manuale, rilascio microfono e trascrizione accodata OK.');

  // Lasciare realmente trascorrere i 30 secondi: il limite non è simulato.
  await start.waitFor({state:'visible',timeout:10000});
  response=waitTranscription();
  const started=Date.now();
  await start.click(); await stop.waitFor({state:'visible',timeout:10000});
  await response;
  const elapsed=Date.now()-started;
  await page.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('Istruzione registrata numero 2.'),null,{timeout:10000});
  assert.ok(elapsed>=28500 && elapsed<38000,`arresto automatico fuori intervallo: ${elapsed} ms`);
  assert.equal(audioInputs[1].source,'recording');
  assert.ok(Buffer.from(audioInputs[1].audio,'base64').length>100);
  await page.waitForFunction(()=>window.__qaVoiceStreams?.[1]?.getTracks().every(track=>track.readyState==='ended'),null,{timeout:10000});
  assert.deepEqual(errors,[],`errori JavaScript: ${errors.join('; ')}`);
  console.log(`ARRESTO AUTOMATICO: registrazione terminata dopo ${Math.round(elapsed/1000)} s, audio trasmesso e microfono rilasciato.`);
} finally { await context.close(); await browser.close(); }

