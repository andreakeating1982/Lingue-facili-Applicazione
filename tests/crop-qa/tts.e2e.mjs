import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Voci simulate e API intercettate: nessuna registrazione o scrittura nel DB.
const BASE=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const cases=[
  {lang:'en',prefix:'She ',suffix:' up every day at seven.',needle:'She up every day',correct:'gets',options:['get','gets'],voice:'en-US'},
  {lang:'fr',prefix:'Elle ',suffix:' tous les jours.',needle:'Elle tous les jours',correct:'se lève',options:['se lève','se lèvent'],voice:'fr-FR'},
  {lang:'es',prefix:'Todos los días ella ',suffix:' temprano.',needle:'Todos los días ella temprano',correct:'se levanta',options:['se levanta','me levanto'],voice:'es-ES'},
];
try {
  for(const c of cases){
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addInitScript(()=>{
      window.__qaSpoken=[]; window.__qaCancelCount=0;
      const synth={
        speaking:false,pending:false,
        getVoices:()=>[],addEventListener(){},removeEventListener(){},
        cancel(){this.speaking=false;this.pending=false;window.__qaCancelCount++;},
        // Non emettiamo onstart/onend: verifichiamo anche il fallback della UI.
        speak(utterance){this.speaking=true;window.__qaSpoken.push({text:utterance.text,lang:utterance.lang});}
      };
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
      window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
      window.__qaFinishSpeech=()=>{synth.speaking=false;synth.pending=false;};
    });
    await context.route('**/api/trpc/**',route=>{
      const row={id:'tts-test',lang:c.lang,studentNome:'Prova',studentCognome:'Sintetica',studentClasse:'2A',studentData:'06/11/2026',exercise:{type:'mc',items:[{segments:[{t:'text',v:c.prefix},{t:'blank'},{t:'text',v:c.suffix}],options:c.options,correct:c.correct,translationIt:'Traduzione di prova.'}]}};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{result:{data:{json:row}}}])});
    });
    const page=await context.newPage();
    try {
      await page.goto(`${BASE}/exercise?id=tts-test`,{waitUntil:'networkidle'});
      await page.getByRole('heading',{name:'Scelta multipla'}).waitFor();
      // Una frase lunga deve essere spezzata senza perdere testo né superare
      // il limite del sintetizzatore (la frase resta interamente in inglese).
      const longText='She studies at school every day '.repeat(14)+'and reads each morning.';
      if(c.lang==='en') await page.evaluate(text=>{const p=document.createElement('p');p.textContent=text;document.body.append(p);},longText);
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
      const stop=page.getByRole('button',{name:'Ascolto: interrompi la lettura ad alta voce'});
      await stop.waitFor({state:'visible',timeout:3000});
      assert.equal(await stop.getAttribute('aria-pressed'),'true');
      const spoken=await page.evaluate(()=>window.__qaSpoken);
      if(c.lang==='en') {
        assert.ok(spoken.every(u=>u.text.length<=220),`frase troppo lunga: ${JSON.stringify(spoken)}`);
        assert.ok(spoken.map(u=>u.text).join(' ').includes(longText),`testo lungo alterato: ${JSON.stringify(spoken)}`);
      }
      const source=spoken.find(u=>u.text.includes(c.needle));
      const instruction=spoken.find(u=>u.text.includes('Scegli una risposta corretta'));
      assert.ok(source,`frase ${c.lang} non letta: ${JSON.stringify(spoken)}`);
      assert.equal(source.lang,c.voice,`voce errata per ${c.lang}: ${JSON.stringify(source)}`);
      assert.ok(instruction,`istruzione italiana non letta: ${JSON.stringify(spoken)}`);
      assert.equal(instruction.lang,'it-IT',`l'istruzione italiana non deve condividere la voce della frase: ${JSON.stringify(instruction)}`);
      assert.ok(!source.text.includes('Scegli una risposta corretta'),`frasi in lingue diverse fuse: ${JSON.stringify(source)}`);
      // Anche senza evento onend, la sonda deve riportare il pulsante a Leggi.
      await page.evaluate(()=>window.__qaFinishSpeech());
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).waitFor({state:'visible',timeout:3000});
      await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).click();
      const before=await page.evaluate(()=>window.__qaCancelCount);
      await page.getByRole('button',{name:'Ascolto: interrompi la lettura ad alta voce'}).click();
      assert.ok((await page.evaluate(()=>window.__qaCancelCount))>before,'Stop deve interrompere la lettura');
      console.log(`ASCOLTO ${c.lang}: istruzione italiana e frase ${c.voice} distinte; Leggi/Stop e fine senza onend OK.`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

