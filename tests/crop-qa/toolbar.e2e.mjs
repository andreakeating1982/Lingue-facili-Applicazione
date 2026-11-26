import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  for(const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'networkidle'});
    const toolbar=page.getByRole('toolbar',{name:/Barra di accessibilità/});
    const smaller=page.getByRole('button',{name:'Riduci la dimensione del testo'});
    const larger=page.getByRole('button',{name:'Aumenta la dimensione del testo'});
    const student=page.getByRole('textbox',{name:'Cognome'});
    const studentSize=()=>student.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    assert.equal(await toolbar.getByRole('group').count(),5);
    const initial=await studentSize();
    if(width<600) {
      // Il bottone visibile è compatto come quello del blog, ma l'area di
      // tocco estesa deve funzionare anche appena fuori dal suo bordo.
      const box=await smaller.boundingBox();
      assert.ok(box && box.y>7);
      await page.touchscreen.tap(box.x+box.width/2,box.y-6);
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('[role=toolbar] span')).some(el=>el.textContent.trim()==='90%'));
    } else await smaller.click();
    await smaller.click();
    assert.equal(await toolbar.getByText('80%',{exact:true}).count(),1);
    assert.ok((await studentSize())<initial,'A− deve ridurre il testo della prima pagina');
    await smaller.click();assert.equal(await toolbar.getByText('80%',{exact:true}).count(),1);
    for(let i=0;i<3;i++) await larger.click();
    assert.equal(await toolbar.getByText('110%',{exact:true}).count(),1);
    // Il CSS viene aggiornato nell'effetto React dopo il rendering del valore.
    await page.waitForFunction(size=>parseFloat(getComputedStyle(document.querySelector('input[aria-label="Cognome"]')).fontSize)>size,initial,{timeout:3000});
    assert.ok((await studentSize())>initial,'A+ deve ingrandire il testo della prima pagina');
    const lines=page.getByRole('button',{name:"Cambia l'interlinea del testo"});
    const before=await lines.innerText();await lines.click();assert.notEqual(await lines.innerText(),before);
    const ruler=page.getByRole('button',{name:'Attiva o disattiva il righello di lettura'});
    await ruler.click();assert.equal(await ruler.getAttribute('aria-pressed'),'true');
    assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('lf-ruler')));
    await ruler.click();assert.equal(await ruler.getAttribute('aria-pressed'),'false');
    const contrast=page.getByRole('button',{name:'Cambia la modalità di lettura'});
    await contrast.click();assert.equal(await contrast.getAttribute('aria-pressed'),'true');
    assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('lf-hc')));
    await contrast.click();assert.equal(await contrast.getAttribute('aria-pressed'),'false');
    assert.equal(await page.getByRole('button',{name:'Ascolto: leggi il testo ad alta voce'}).count(),1);
    const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(sizes.scroll<=sizes.client+1,`barra fuori schermo ${width}: ${JSON.stringify(sizes)}`);
    const labels=await toolbar.locator('button').evaluateAll(buttons=>buttons.map(button=>{
      const range=document.createRange();range.selectNodeContents(button);
      const r=button.getBoundingClientRect(), text=range.getBoundingClientRect();
      return {label:button.textContent.trim(),textWidth:text.width,boxWidth:r.width};
    }));
    assert.ok(labels.every(label=>label.textWidth<=label.boxWidth+1),`testi della barra tagliati: ${JSON.stringify(labels)}`);
    assert.deepEqual(errors,[]);
    console.log(`BARRA ${width}px: 5 moduli, A−/A+ 80–160%, interlinea, righello, contrasto e ascolto disponibili.`);
    await context.close();
  }
} finally { await browser.close(); }

