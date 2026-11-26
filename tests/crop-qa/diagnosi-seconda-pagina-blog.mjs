import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Diagnosi del blog pubblico o di una sua copia: il browser è isolato e TUTTE
// le API sono intercettate. Nessuna scheda, risposta o dato reale viene creato.
const BLOG=process.env.LF_DIAG_BLOG ?? 'https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html';
const BASE=(process.env.CROP_QA_BASE_URL??'https://lingue-facili.easy-peasy.site').replace(/\/$/,'');
const output=process.env.LF_DIAG_OUT??'/tmp/lingue-setup-trace.json';
const mock=value=>JSON.stringify([{result:{data:{json:value}}}]);
const words=['Today','the','small','students','read','many','interesting','books.'];
const exercise={type:'reorder',items:[{chips:words.map(t=>({t,role:'other'})),answer:words.join(' '),translationIt:'Oggi gli studenti leggono libri.'},{chips:[{t:'She',role:'other'},{t:'reads.',role:'other'}],answer:'She reads.'}]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS]});
try {
 const context=await browser.newContext({...devices['Pixel 7'],viewport:{width:393,height:852},locale:'it-IT'});
 let apiCount=0;
 await context.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname; apiCount++;
   if(!path.includes('/api/trpc/')) return route.abort('blockedbyclient');
   let value={ok:true};
   if(path.includes('describeAdaptation'))value={description:'L’esercizio contiene frasi. Riordina le parole.'};
   if(path.includes('exercises.generate'))value={id:'synthetic-no-db',exercise};
   if(path.includes('exercises.get'))value={id:'synthetic-no-db',studentNome:'Esempio',studentCognome:'Fittizio',studentClasse:'2A',studentData:'07/11/2026',lang:'en',exercise};
   return route.fulfill({status:200,contentType:'application/json',body:mock(value)});
 });
 const page=await context.newPage(), errors=[];
 const variant=process.env.LF_CORNICE_VARIANT;
 if(variant){
   // Sostituisce la cornice solo nella risposta del browser di test, non nel blog.
   const response=await context.request.get(`${BLOG}?m=1`);
   if(!response.ok())throw new Error(`Post non disponibile: ${response.status()}`);
   const html=await response.text(),marker=html.indexOf('CORNICE DINAMICA');
   const start=html.lastIndexOf('<!--====',marker),app=html.indexOf('var APP_URL',marker),end=html.indexOf('</script>',app);
   if(start<0||app<marker||end<app)throw new Error('Blocco cornice non trovato nel post');
   const raw=await fs.readFile(variant,'utf8');
   const replacement=raw.replace(/var APP_URL = 'https?:\/\/[^']+';/,`var APP_URL = '${BASE}/';`);
   const fixture=html.slice(0,start)+replacement+html.slice(end+'</script>'.length);
   await page.route('**/2026/09/lingue-straniere.html*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
 }
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   const now=()=>Math.round(performance.now());
   if(window===window.top){
     window.__lfTrace={messages:[],frames:[],marks:[]};
     window.__lfMark=name=>window.__lfTrace.marks.push({name,time:now(),scroll:scrollY});
     addEventListener('message',e=>{if(e.data?.type==='labvisivo:height')window.__lfTrace.messages.push({height:e.data.height,origin:e.origin,time:now(),scroll:scrollY});});
     setInterval(()=>{
       const f=document.querySelector('.lf-cornice.lf-lingue-facili iframe');
       if(!f)return;
       const r=f.getBoundingClientRect();
       window.__lfTrace.frames.push({time:now(),height:r.height,top:r.top,scroll:scrollY,width:r.width,pageHeight:document.documentElement.scrollHeight,viewport:innerHeight});
     },50);
   }else{
     window.__lfInside=[];
     setInterval(()=>{const root=document.getElementById('root');if(!root||!document.body)return;window.__lfInside.push({time:now(),innerHeight,bodyScroll:document.body.scrollHeight,bodyOffset:document.body.offsetHeight,rootOffset:root.offsetHeight,docOffset:document.documentElement.offsetHeight,docScroll:document.documentElement.scrollHeight,localScroll:scrollY,focus:document.activeElement?.getAttribute('aria-label')??document.activeElement?.id??document.activeElement?.tagName});},75);
   }
 });
 await page.goto(BLOG,{waitUntil:'domcontentloaded',timeout:45000});
 const frame=page.frameLocator('.lf-cornice.lf-lingue-facili iframe');
 await frame.getByLabel('Cognome').waitFor({timeout:30000});
 const child=page.frames().find(f=>f.url().startsWith(BASE)); if(!child)throw new Error('iframe Lingue Facili non trovato');
 const mark=name=>page.evaluate(name=>window.__lfMark(name),name);
 const settle=async(name,ms=1500)=>{await mark(name);await page.waitForTimeout(ms);};
 await settle('pagina iniziale',2000);
 await frame.getByLabel('Cognome').fill('Fittizio');
 await frame.getByLabel('Nome',{exact:true}).fill('Esempio');
 await frame.getByLabel('Classe').fill('2A');
 await frame.getByRole('button',{name:"Entra e prepara l'esercizio"}).tap();
 await frame.getByRole('radio',{name:'INGLESE'}).waitFor();
 await settle('setup aperto',2500);
 await frame.getByRole('radio',{name:'INGLESE'}).tap();
 const source=frame.getByRole('textbox',{name:"Testo dell'esercizio originale"});
 await source.waitFor();
 await settle('lingua scelta',2300);
 await source.tap();
 await mark('inizio digitazione');
 await page.keyboard.type('Today the students read interesting books.',{delay:55});
 await mark('fine digitazione');
 await settle('testo digitato',3500);
 await frame.getByRole('radio',{name:/RIORDINO DI PAROLE/}).tap();
 await frame.locator('#teacher-adaptation').waitFor();
 await settle('riordino scelto',4000);
 await frame.locator('#teacher-adaptation').tap();
 await page.keyboard.type(' Testo modificato.',{delay:55});
 await settle('spiegazione modificata',2500);
 // Simulazione dei cambi della viewport visibile (comparsa/scomparsa tastiera
 // e barra browser): non è un sostituto della prova su un telefono fisico.
 for(const height of [600,720,560,852]){
   await page.setViewportSize({width:393,height});
   await settle(`viewport ${height}`,1800);
 }
 await frame.getByRole('radio',{name:/SCELTA MULTIPLA/}).tap();
 await frame.getByRole('radio',{name:'3 opzioni'}).tap();
 await settle('scelta multipla',3000);
 await frame.getByRole('radio',{name:/RIORDINO DI PAROLE/}).tap();
 await settle('nuovo riordino',3000);
 // Creazione simulata: la risposta proviene dal mock, NON dal server.
 const create=frame.getByRole('button',{name:"CREA L'ESERCIZIO"});
 await create.waitFor({state:'visible'});await create.tap();
 await frame.getByRole('button',{name:'Parola Today',exact:true}).waitFor({timeout:15000});
 await settle('esercizio aperto',2500);
 for(const word of words.slice(0,6))await frame.getByRole('button',{name:`Parola ${word}`,exact:true}).tap();
 await settle('sei tessere spostate',4000);
 const trace=await page.evaluate(()=>window.__lfTrace);
 const inside=await child.evaluate(()=>window.__lfInside);
 await fs.writeFile(output,JSON.stringify({trace,inside,errors,apiCount,blog:page.url()},null,2));
 const sections=trace.marks.map((m,i)=>{
   const end=trace.marks[i+1]?.time??Infinity;
   const frames=trace.frames.filter(f=>f.time>=m.time&&f.time<end);
   const messages=trace.messages.filter(f=>f.time>=m.time&&f.time<end);
   const values=arr=>[...new Set(arr)];
   return {name:m.name,samples:frames.length,heights:values(frames.map(f=>f.height)),scrolls:values(frames.map(f=>Math.round(f.scroll))).slice(0,20),messages:messages.map(x=>x.height)};
 });
 const start=trace.marks.find(m=>m.name==='inizio digitazione')?.time;
 const end=trace.marks.find(m=>m.name==='fine digitazione')?.time;
 const typing=trace.frames.filter(f=>f.time>=start&&f.time<=end);
 const typingHeights=[...new Set(typing.map(f=>f.height))];
 console.log(JSON.stringify({blog:page.url(),base:BASE,apiCount,errors,typingHeights,sections},null,2));
 if(process.env.LF_ASSERT_STABLE==='1'&&typingHeights.length>1)throw new Error(`Altezza variata durante la digitazione: ${typingHeights}`);
 if(errors.length)process.exitCode=1;
} finally {await browser.close();}

