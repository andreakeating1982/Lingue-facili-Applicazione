import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Test autonomo del protocollo: app interamente finta, origini distinte,
// nessun database né modifica al blog pubblicato.
const ROOT=(process.env.CROP_QA_BASE_URL??'http://127.0.0.1:3000').replace(/\/$/,'');
const BLOG='http://localhost:3000/__qa_cornice_interazione';
const MOCK=`${ROOT}/__qa_app_interazione`;
const raw=await fs.readFile(new URL('../../cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html',import.meta.url),'utf8');
const fragment=raw.replace(/var APP_URL = 'https?:\/\/[^']+';/,`var APP_URL = '${MOCK}';`);
assert.notEqual(fragment,raw);
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}.above{height:200px}.below{height:2200px}</style><div class="above">Blog simulato</div>${fragment}<div class="below">Fine del post</div>`;
const childHtml=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body>App simulata<script>
const token=new URLSearchParams(location.search).get('cornice');window.h=600;
window.sendH=(value)=>{window.h=value;parent.postMessage({type:'labvisivo:height',height:value,cornice:token},'*')};
window.activity=(active,t=token)=>parent.postMessage({type:'labvisivo:interaction',active,cornice:t},'*');
addEventListener('message',e=>{if(e.data?.type==='labvisivo:ping')window.sendH(window.h)});
setTimeout(()=>window.sendH(600),50);
</script></body>`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS,'--disable-features=LocalNetworkAccessChecks']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/api/**',r=>r.abort('blockedbyclient'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(BLOG,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
 await page.route(`${MOCK}**`,r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:childHtml}));
 await page.goto(BLOG,{waitUntil:'domcontentloaded'});
 const iframe=page.locator('.lf-cornice.lf-lingue-facili iframe');
 await page.waitForFunction(()=>document.querySelector('.lf-iframe')?.src.includes('cornice='));
 const child=page.frames().find(f=>f.url().startsWith(MOCK));assert.ok(child);
 const height=()=>iframe.evaluate(e=>e.getBoundingClientRect().height);
 const waitHeight=async expected=>{for(let i=0;i<80;i++){if(Math.abs(await height()-expected)<2)return;await page.waitForTimeout(100);}throw new Error(`Attesa altezza ${expected}, trovata ${await height()}`);};
 await waitHeight(600);
 // Un resize è già nel timer del parent prima dell'inizio del gesto.
 await child.evaluate(()=>window.sendH(780));
 await page.waitForTimeout(80);
 await child.evaluate(()=>window.activity(true));
 await page.waitForTimeout(450);
 assert.equal(await height(),600,'Un resize pendente è stato applicato durante il gesto');
 await child.evaluate(()=>window.sendH(820));await page.waitForTimeout(350);
 assert.equal(await height(),600,'Misura applicata mentre il gesto è attivo');
 await child.evaluate(()=>window.activity(false));await waitHeight(820);
 // Token sbagliato e finestra diversa non possono bloccare questa cornice.
 await child.evaluate(()=>window.activity(true,'token-sbagliato'));
 await page.evaluate(()=>window.postMessage({type:'labvisivo:interaction',active:true,cornice:'estraneo'},'*'));
 await child.evaluate(()=>window.sendH(950));await waitHeight(950);
 // Se l'app sparisce dopo un inizio non rinnovato, il watchdog riprende e
  // richiede una nuova misura: il blocco non deve essere permanente.
 await child.evaluate(()=>window.activity(true));
 await child.evaluate(()=>window.sendH(1020));
 await page.waitForTimeout(400);
 assert.equal(await height(),950);
 await waitHeight(1020);
 // Un resize in coda non deve essere applicato durante lo scroll del blog.
 await child.evaluate(()=>window.sendH(1100));
 await page.waitForTimeout(80);
 const scrollStart=Date.now();
 for(let i=0;i<20;i++){await page.evaluate(y=>window.scrollTo(0,y),100+i*20);await page.waitForTimeout(30);}
 assert.equal(await height(),1020,'La cornice si è ridimensionata durante lo scroll');
 await waitHeight(1100);
 assert.ok(Date.now()-scrollStart>=500);
 assert.deepEqual(errors,[]);
 console.log('CORNICE: resize pendente annullato durante gesto e scroll, ripresa con misura fresca, token isolato e watchdog OK; nessuna API.');
 await context.close();
}finally{await browser.close();}

