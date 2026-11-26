import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Verifica la pagina temporanea consegnabile: il parent e l'app sono su due
// origini HTTPS distinte e le API passano al SOLO server di simulazione 3011.
const BLOG=process.env.LF_DEMO_BLOG??'https://3010-irez2b7mzfn5d088ttmhq.sandbox.easy-peasy.ai';
const APP=process.env.LF_DEMO_APP??'https://3011-irez2b7mzfn5d088ttmhq.sandbox.easy-peasy.ai';
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS]});
try{
 const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:393,height:852},locale:'it-IT'});
 const page=await context.newPage(),errors=[],api=[],responseHeaders=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',req=>{if(req.url().includes('/api/'))api.push(req.url());});
 page.on('response',res=>{if(res.url().includes('/api/trpc/'))responseHeaders.push({url:res.url(),demo:res.headers()['x-demo-only']});});
 await page.goto(BLOG,{waitUntil:'domcontentloaded',timeout:45000});
 assert.ok(await page.getByText('PROVA TECNICA — NON È IL BLOG PUBBLICATO').isVisible());
 assert.ok(await page.getByText(/Modalità simulata/).isVisible());
 const frame=page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
 await frame.getByLabel('Cognome').waitFor({timeout:30000});
 const child=page.frames().find(f=>f.url().startsWith(APP));assert.ok(child,'Origine simulata non caricata');
 assert.notEqual(new URL(child.url()).origin,new URL(page.url()).origin);
 await page.screenshot({path:'/tmp/lf-anteprima-blog-mobile.png',fullPage:true});
 await frame.getByLabel('Cognome').fill('Fittizio');
 await frame.getByLabel('Nome',{exact:true}).fill('Esempio');
 await frame.getByLabel('Classe').fill('2A');
 await frame.getByRole('button',{name:"Entra e prepara l'esercizio"}).tap();
 await frame.getByRole('radio',{name:'INGLESE'}).tap();
 const source=frame.getByRole('textbox',{name:"Testo dell'esercizio originale"});
 await source.fill('She reads interesting books.');
 await frame.getByRole('radio',{name:/RIORDINO DI PAROLE/}).tap();
 const instructions=frame.locator('#teacher-adaptation');
 await page.waitForFunction(()=>document.querySelector('.lf-cornice iframe')?.getBoundingClientRect().height>1000,null,{timeout:10000});
 await instructions.waitFor();
 for(let i=0;i<70 && !(await instructions.inputValue()).includes('ESEMPIO SIMULATO');i++)await page.waitForTimeout(200);
 assert.ok((await instructions.inputValue()).includes('ESEMPIO SIMULATO'),'Spiegazione simulata non disponibile');
 await frame.getByRole('button',{name:"CREA L'ESERCIZIO"}).tap();
 const bank=frame.locator('[data-drop="reorder-bank"]'),area=frame.locator('[data-drop="reorder-area"]');
 await bank.waitFor({timeout:15000});
 for(const word of ['She','often','reads','interesting','books.'])await bank.getByRole('button',{name:`Parola ${word}`,exact:true}).tap();
 assert.equal(await area.locator('[data-pos]').count(),5);
 await frame.getByRole('button',{name:'CHECK',exact:true}).tap();
 // L'esempio simulato ha un solo item: dopo CHECK l'app mostra FINISCO,
 // non AVANTI (riservato agli esercizi con altre frasi).
 await frame.getByRole('button',{name:'FINISCO',exact:true}).tap();
 await frame.getByRole('button',{name:"SCARICA L'ESERCIZIO SENZA RISPOSTE"}).waitFor({timeout:10000});
 assert.ok(api.length>=3,'Le API simulate non sono state esercitate');
 assert.ok(api.every(url=>url.startsWith(APP+'/api/')),`Richiesta API fuori dal simulatore: ${JSON.stringify(api)}`);
 assert.ok(responseHeaders.length>=3 && responseHeaders.every(r=>r.demo==='simulazione-senza-database'),`Mancano risposte simulate: ${JSON.stringify(responseHeaders)}`);
 assert.deepEqual(errors,[]);
 console.log('ANTEPRIMA SIMULATA: seconda pagina, generazione di esempio, riordino e risultato funzionano; ogni API è isolata e simulata.');
 await page.goto(`${BLOG}/?modo=riordino`,{waitUntil:'domcontentloaded'});
 const demo=page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
 const demoBank=demo.locator('[data-drop="reorder-bank"]');
 await demoBank.waitFor({timeout:30000});
 await demoBank.getByRole('button',{name:'Parola She',exact:true}).tap();
 assert.equal(await demo.locator('[data-pos]').count(),1);
 await page.screenshot({path:'/tmp/lf-anteprima-riordino-mobile.png',fullPage:true});
 console.log('ANTEPRIMA RIORDINO: esempio diretto senza API disponibile nella cornice separata.');
 await context.close();
}finally{await browser.close();}

