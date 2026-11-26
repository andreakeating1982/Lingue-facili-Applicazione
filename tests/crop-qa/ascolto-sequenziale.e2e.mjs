import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Tutte le richieste sono intercettate, compresi gli esercizi fittizi.
const BASE = process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const cases = [
  {lang:'en', prefix:'She ', suffix:' up every day at seven.', needle:'She', options:['get','gets'], locale:'en-US'},
  {lang:'fr', prefix:'Elle ', suffix:' tous les jours.', needle:'Elle', options:['se lève','se lèvent'], locale:'fr-FR'},
  {lang:'es', prefix:'Todos los días ella ', suffix:' temprano.', needle:'Todos los días', options:['se levanta','me levanto'], locale:'es-ES'},
];
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  for (const c of cases) {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(() => {
      window.__qaSpoken=[]; window.__qaCancelCount=0; window.__qaActive=0; window.__qaMaximum=0; window.__qaDelay=8;
      const voices=['it-IT','en-US','fr-FR','es-ES'].map(lang => ({lang,name:`Google ${lang}`,localService:true}));
      let revision=0;
      const synth={speaking:false,pending:false, getVoices:()=>voices, addEventListener(){}, removeEventListener(){},
        cancel(){revision++;this.speaking=false;this.pending=false;window.__qaActive=0;window.__qaCancelCount++;},
        speak(u){
          const run=revision;this.speaking=true;window.__qaActive++;window.__qaMaximum=Math.max(window.__qaMaximum,window.__qaActive);
          window.__qaSpoken.push({text:u.text,lang:u.lang,voice:u.voice?.name || null});
          setTimeout(()=>{if(run!==revision)return;this.speaking=false;window.__qaActive--;u.onend?.();},window.__qaDelay);
        }
      };
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
      window.SpeechSynthesisUtterance=class { constructor(text){this.text=text;} };
    });
    await context.route('**/api/trpc/**', route => {
      if (!route.request().url().includes('exercises.get')) return route.abort('blockedbyclient');
      const item={segments:[{t:'text',v:c.prefix},{t:'blank'},{t:'text',v:c.suffix}],options:c.options,correct:c.options[0],translationIt:'Traduzione privata di prova.'};
      const row={id:'tts-test',lang:c.lang,studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'06/11/2026',exercise:{type:'mc',items:[item]}};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{result:{data:{json:row}}}])});
    });
    const page=await context.newPage();
    try {
      await page.goto(`${BASE}/exercise?id=tts-test`,{waitUntil:'networkidle'});
      await page.getByRole('heading',{name:'Scelta multipla'}).waitFor();
      const longText=('She studies at school every day '.repeat(14)+'and reads each morning.').trim();
      if(c.lang==='en') await page.evaluate(text=>{const p=document.createElement('p');p.lang='en';p.textContent=text;document.body.append(p);},longText);
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
      await page.getByRole('button',{name:'Ascolto: interrompi la lettura ad alta voce'}).waitFor();
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).waitFor({state:'visible',timeout:12000});
      const spoken=await page.evaluate(()=>window.__qaSpoken);
      const source=spoken.find(u=>u.text.includes(c.needle) && u.lang===c.locale);
      const instruction=spoken.find(u=>u.text.includes('Scegli una risposta corretta'));
      assert.ok(source,`${c.lang}: testo nella lingua corretta mancante ${JSON.stringify(spoken)}`);
      assert.equal(instruction?.lang,'it-IT',JSON.stringify(spoken));
      assert.ok(spoken.some(u=>u.text==='Pulsante.'),'i pulsanti devono essere annunciati');
      assert.ok(!spoken.some(u=>u.text.includes('Traduzione privata')),'traduzione nascosta rivelata');
      assert.equal(await page.evaluate(()=>window.__qaMaximum),1,'la coda deve essere sequenziale');
      for(const lang of ['it-IT',c.locale]) assert.ok(spoken.filter(u=>u.lang===lang).every(u=>u.voice===`Google ${lang}`),'voce instabile');
      assert.ok(spoken.every(u=>u.text.length<=180),'segmento troppo lungo');
      if(c.lang==='en') assert.ok(spoken.filter(u=>u.lang==='en-US').map(u=>u.text).join(' ').includes(longText),'segmento lungo perso');
      await page.getByRole('button',{name:'Mostra traduzione'}).click();
      await page.evaluate(()=>{window.__qaSpoken=[];});
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).waitFor({state:'visible',timeout:12000});
      assert.ok((await page.evaluate(()=>window.__qaSpoken)).some(u=>u.text.includes('Traduzione privata') && u.lang==='it-IT'),'traduzione visibile non letta in italiano');
      await page.evaluate(()=>{window.__qaDelay=1000;});
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
      const stop=page.getByRole('button',{name:'Ascolto: interrompi la lettura ad alta voce'});
      await stop.waitFor();
      const before=await page.evaluate(()=>window.__qaCancelCount);
      await stop.click();
      assert.ok((await page.evaluate(()=>window.__qaCancelCount))>before,'Stop deve annullare la lettura');
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
      await page.getByRole('button',{name:'Nascondi traduzione'}).click();
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).waitFor();
      console.log(`ASCOLTO ${c.lang}: voci stabili, coda singola, pulsanti, traduzione visibile/nascosta e Stop OK (sintetizzatore simulato).`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

