import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SITE_ISOLATION_ARGS } from './site-isolation.mjs';

// Prova la copia pubblicata oppure, solo se selezionata esplicitamente,
// una variante locale. L'app è simulata; nessun blog o database è modificato.
const source = process.env.LF_CORNICE_VARIANT ?? new URL('../../cornice-dinamica/CODICE-3-ANTI-TREMOLIO-ANDROID.html', import.meta.url);
const raw = await fs.readFile(source, 'utf8');
const appPattern = /var APP_URL = 'https?:\/\/[^']+';/;
assert.match(raw, appPattern);
assert.match(raw, /allow="camera; microphone"/);
const host = 'http://localhost:3000';
const fragment = raw.replace(appPattern, `var APP_URL = '${host}/__cornice_blog_app';`);
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">${fragment}</body></html>`;
const fake = `<!doctype html><meta charset="utf-8"><h1>App simulata</h1><script>
window.currentHeight=600;
const token=new URL(location.href).searchParams.get('cornice');
function send(){parent.postMessage({type:'labvisivo:height',height:window.currentHeight,cornice:token},'*');}
window.addEventListener('message',e=>{if(e.data?.type==='labvisivo:ping')send();});
window.addEventListener('load',()=>setTimeout(send,50));
</script>`;
const browser = await chromium.launch({headless:true,args:['--no-sandbox',...SITE_ISOLATION_ARGS,'--disable-features=LocalNetworkAccessChecks']});
try {
  for (const width of [320,390,1440]) {
    const ctx=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await ctx.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.pathname==='/__cornice_blog_host') return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
      if(u.pathname==='/__cornice_blog_app') return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fake});
      return route.abort('blockedbyclient');
    });
    await page.goto(`${host}/__cornice_blog_host`,{waitUntil:'domcontentloaded'});
    const frame=page.locator('.lf-cornice.lf-lingue-facili');
    const iframe=frame.locator('iframe');
    await page.waitForFunction(()=>document.querySelector('.lf-cornice iframe')?.src.includes('cornice='));
    await page.waitForFunction(()=>document.querySelector('.lf-cornice iframe')?.style.height==='600px',null,{timeout:8000});
    assert.equal(await iframe.getAttribute('allow'),'camera; microphone');
    const token=new URL(await iframe.getAttribute('src')).searchParams.get('cornice'); assert.ok(token);
    const full=frame.getByRole('button',{name:'Apri a schermo intero'});
    const reload=frame.getByRole('button',{name:"Ricarica l'app"});
    for(const button of [full,reload]){
      assert.equal(await button.isVisible(),true);
      const measures=await button.evaluate(el=>{
        const b=el.getBoundingClientRect(), s=el.querySelector('svg').getBoundingClientRect(), label=el.querySelector('.lf-lbl');
        const root=el.closest('.lf-cornice').getBoundingClientRect();
        return {left:b.left,right:b.right,rootLeft:root.left,rootRight:root.right,width:s.width,height:s.height,label:getComputedStyle(label).display,pathCount:el.querySelectorAll('svg > path').length};
      });
      assert.ok(measures.left>=measures.rootLeft-1 && measures.right<=measures.rootRight+1,JSON.stringify(measures));
      assert.ok(Math.abs(measures.width-16)<0.2 && Math.abs(measures.height-16)<0.2,JSON.stringify(measures));
      assert.notEqual(measures.label,'none'); assert.equal(measures.pathCount,1);
    }
    // Messaggi di altre finestre/token non devono alterare l'altezza.
    await page.evaluate(()=>window.postMessage({type:'labvisivo:height',height:1350},'*'));
    await page.waitForTimeout(300); assert.equal(await iframe.evaluate(e=>e.style.height),'600px');
    const child=page.frames().find(f=>f.url().includes('__cornice_blog_app')); assert.ok(child);
    await child.evaluate(()=>parent.postMessage({type:'labvisivo:height',height:1350,cornice:'token-errato'},'*'));
    await page.waitForTimeout(300); assert.equal(await iframe.evaluate(e=>e.style.height),'600px');
    // Salto confermato: il nuovo ping deve far rinviare 2000px all'app simulata.
    await child.evaluate(()=>{window.currentHeight=2000; parent.postMessage({type:'labvisivo:height',height:2000,cornice:new URL(location.href).searchParams.get('cornice')},'*');});
    await page.waitForFunction(()=>document.querySelector('.lf-cornice iframe')?.style.height==='2000px',null,{timeout:5000});
    await page.evaluate(()=>window.__sentinella='blog-intatto');
    const nav=page.waitForEvent('framenavigated',{predicate:f=>f.parentFrame()===page.mainFrame() && f.url().includes('__cornice_blog_app'),timeout:8000});
    await reload.click(); await nav;
    await page.waitForFunction(()=>document.querySelector('.lf-cornice iframe')?.style.height==='600px',null,{timeout:8000});
    assert.equal(await page.evaluate(()=>window.__sentinella),'blog-intatto');
    assert.equal(new URL(await iframe.getAttribute('src')).searchParams.get('cornice'),token);
    assert.deepEqual(errors,[]);
    console.log(`Cornice aggiornata ${width}px: pulsanti, permessi, token, altezza, conferma salto e ricarica OK (app simulata).`);
    await ctx.close();
  }
} finally {await browser.close();}

