import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Blog simulato su localhost + app su 127.0.0.1: sono origini distinte.
// Microfono sintetico, trascrizione simulata e nessun accesso al database.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const BLOG='http://localhost:3000/__qa-microfono-blog';
const dedicated=await fs.readFile(new URL('../../cornice-dinamica/embed-lingue-facili-dedicata.html',import.meta.url),'utf8');
const lite=await fs.readFile(new URL('../../cornice-dinamica/embed-lingue-facili-lite.html',import.meta.url),'utf8');
const iframeAllow=/<iframe\b[^>]*\ballow=["'][^"']*camera\s*;\s*microphone[^"']*["'][^>]*>/i;
assert.match(dedicated,iframeAllow,'la cornice dedicata non concede camera e microfono');
assert.match(lite,iframeAllow,'la cornice lite non concede camera e microfono');
const src=/var APP_URL = 'https?:\/\/[^']+';/;
assert.match(dedicated,src);
const json=data=>JSON.stringify([{result:{data:{json:data}}}]);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-features=LocalNetworkAccessChecks','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try {
 for(const allow of [false,true]) {
  const fragment=dedicated.replace(src,`var APP_URL = '${BASE}/';`).replace(allow?'__NO_CHANGE__':' allow="camera; microphone"','');
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><h1>Post sintetico</h1>${fragment}</body></html>`;
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,permissions:['microphone']});
  await context.addInitScript(()=>{
    const original=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if(original) navigator.mediaDevices.getUserMedia=async constraints=>{const s=await original(constraints);(window.__qaStreams??=[]).push(s);return s};
  });
  const calls=[];
  await context.route('**/api/trpc/**', async route=>{
    const req=route.request();let body={};try {body=JSON.parse(req.postData()||'{}')}catch{}
    const input=body?.['0']?.json ?? body?.json ?? {};
    if(req.url().includes('exercises.transcribe')) {calls.push(input);return route.fulfill({status:200,contentType:'application/json',body:json({text:'Istruzione sintetica riconosciuta.'})})}
    if(req.url().includes('exercises.describeAdaptation')) return route.fulfill({status:200,contentType:'application/json',body:json({description:'Adatta la frase originale.'})});
    return route.abort('blockedbyclient');
  });
  const page=await context.newPage();
  await page.route(BLOG,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(BLOG,{waitUntil:'domcontentloaded'});
  const frameElement=page.locator('iframe[title="Lingue Facili — app in cornice"]');
  await frameElement.waitFor({state:'attached'});
  await page.waitForFunction(()=>document.querySelector('iframe[title="Lingue Facili — app in cornice"]')?.src.includes('cornice='));
  const attr=await frameElement.getAttribute('allow');
  if(allow) assert.equal(attr,'camera; microphone'); else assert.equal(attr,null);
  const frame=page.frames().find(f=>f.url().startsWith(BASE));assert.ok(frame,'iframe app non caricato');
  const token=new URL(frame.url()).searchParams.get('cornice');assert.ok(token);
  await frame.goto(`${BASE}/setup?lang=en&cornice=${encodeURIComponent(token)}`);
  await frame.getByRole('textbox',{name:"Testo dell'esercizio originale"}).fill('She studies English every day.');
  const policy=await frame.evaluate(()=>{
    const p=document.permissionsPolicy ?? document.featurePolicy;
    return p?{microphone:p.allowsFeature('microphone'),camera:p.allowsFeature('camera')}:null;
  });
  assert.ok(policy,'Chromium deve esporre la policy della cornice');
  assert.equal(policy.microphone,allow,`microfono: ${JSON.stringify(policy)}`);
  assert.equal(policy.camera,allow,`camera: ${JSON.stringify(policy)}`);
  const warning=frame.getByText(/Il microfono è bloccato dalla cornice del sito/);
  if(!allow) {
    await warning.waitFor({state:'visible'});
    assert.equal(calls.length,0);
    console.log('BLOG SENZA PERMESSI: microfono e camera bloccati; avviso mostrato.');
  } else {
    assert.equal(await warning.count(),0,'l’avviso non deve comparire con la policy corretta');
    const start=frame.getByRole('button',{name:'REGISTRA ISTRUZIONI'});
    const stop=frame.getByRole('button',{name:'FERMA REGISTRAZIONE'});
    await start.click();await stop.waitFor({state:'visible',timeout:10000});
    await page.waitForTimeout(1200);
    const response=page.waitForResponse(r=>r.url().includes('exercises.transcribe') && r.status()===200,{timeout:10000});
    await stop.click();await response;
    await frame.waitForFunction(()=>document.querySelector('#teacher-adaptation')?.value.includes('Istruzione sintetica riconosciuta.'),null,{timeout:10000});
    assert.equal(calls.length,1);assert.equal(calls[0].source,'recording');
    assert.ok(Buffer.from(calls[0].audio,'base64').length>100,'registrazione sintetica vuota');
    await frame.waitForFunction(()=>window.__qaStreams?.[0]?.getTracks().every(t=>t.readyState==='ended'),null,{timeout:10000});
    console.log('CORNICE AGGIORNATA: policy camera/microfono consentita, registrazione sintetica e trascrizione simulata riuscite.');
  }
  assert.deepEqual(errors,[],`errori JavaScript: ${errors.join('; ')}`);
  await context.close();
 }
} finally {await browser.close();}

