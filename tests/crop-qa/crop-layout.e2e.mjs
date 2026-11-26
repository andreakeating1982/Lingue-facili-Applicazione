import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Immagine sintetica; nessun salvataggio o richiesta al database.
const BASE=(process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/,'');
const fixture=await fs.readFile(new URL('./fixtures/testo.png',import.meta.url));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const width of [320,390,568,600,682,1024,1440]) for(const scale of [0.8,1,1.6]) {
  const height=width===320?568:width===568?320:width===682?590:900;
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
  await context.addInitScript(scale=>localStorage.setItem('lf_access',JSON.stringify({fontScale:scale,lineHeight:1.65,ruler:false,mode:'normale'})),scale);
  await context.route('**/api/trpc/**',route=>route.abort('blockedbyclient'));
  const page=await context.newPage();
  await page.goto(`${BASE}/setup?lang=en`,{waitUntil:'networkidle'});
  await page.locator('input[type=file][multiple]').setInputFiles({name:'sintetica.png',mimeType:'image/png',buffer:fixture});
  const crop=page.locator('.lf-crop-dialog');await crop.waitFor({state:'visible'});await crop.locator('img').waitFor();
  await page.waitForTimeout(300);
  const geometry=await crop.evaluate(root=>{
   const r=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
   const title=root.querySelector('[data-slot=dialog-title]'),header=root.querySelector('[data-slot=dialog-header]');
   const buttons=[...root.querySelectorAll('[data-crop-controls] > button')].map(el=>{
    const box=r(el), css=getComputedStyle(el), walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT), ink=[];
    while(walker.nextNode())if(walker.currentNode.textContent.trim()){const range=document.createRange();range.selectNodeContents(walker.currentNode);for(const b of range.getClientRects())if(b.width&&b.height)ink.push({x:b.x,y:b.y,right:b.right,bottom:b.bottom})}
    const icon=el.querySelector('svg');return {text:el.textContent.trim().replace(/\s+/g,' '),box,font:parseFloat(css.fontSize),color:css.color,bg:css.backgroundColor,ink,icon:icon?r(icon):null};
   });
   const footer=root.querySelector('[data-crop-controls]'),body=root.querySelector('[data-crop-scroll]');
   const image=body.querySelector('img');
   return {dialog:r(root),title:r(title),header:r(header),align:getComputedStyle(title).textAlign,
    titleFont:parseFloat(getComputedStyle(title).fontSize),footer:r(footer),body:r(body),image:r(image),
    footerScroll:{width:footer.scrollWidth,clientWidth:footer.clientWidth},buttons};
  });
  const {dialog,title,header,buttons}=geometry;
  assert.equal(geometry.align,'center',`titolo non centrato ${width}/${scale}`);
  assert.ok(Math.abs((title.x+title.width/2)-(header.x+header.width/2))<1.1,`centro titolo ${width}/${scale}: ${JSON.stringify(geometry)}`);
  assert.deepEqual(buttons.map(b=>b.text),['Ruota sinistra','Ruota destra','Chiudi','Ritaglia']);
  assert.ok(Math.abs(geometry.titleFont-20*scale)<0.05,`titolo non corrisponde al widget ${width}/${scale}`);
  assert.ok(title.y>=geometry.body.y-1 && title.bottom<=geometry.body.bottom+1,`titolo tagliato ${width}/${scale}: ${JSON.stringify(geometry)}`);
  const visibleImage=Math.max(0,Math.min(geometry.body.bottom,geometry.image.bottom)-Math.max(geometry.body.y,geometry.image.y));
  // Anche il widget originale, in orizzontale a 568×320 con font 160%,
  // lascia soltanto una piccola porzione visibile; la foto si scorre dentro.
  const minimumVisible=height<=320 && scale>=1.6 ? 25 : 55;
  assert.ok(visibleImage>=minimumVisible,`foto non visibile ${width}/${scale}: visibili ${visibleImage}px`);
  const overflowing=[];
  for(const button of buttons) {
   const box=button.box;
   assert.ok(box.height>=43.9 && Math.abs(button.font-14*scale)<0.05,`dimensioni diverse dal widget ${width}/${scale}: ${JSON.stringify(button)}`);
   assert.equal(button.bg,'rgb(168, 91, 60)');assert.equal(button.color,'rgb(255, 255, 255)');
   assert.ok(box.y>=dialog.y-1 && box.bottom<=dialog.bottom+1,`comando fuori finestra verticalmente ${width}/${scale}: ${JSON.stringify(button)}`);
   assert.ok(box.x>=dialog.x-1 && box.right<=dialog.right+1,`comando fuori finestra ${width}/${scale}: ${JSON.stringify(button)}`);
   const outside=part=>part && (part.x<box.x-1 || part.right>box.right+1 || part.y<box.y-1 || part.bottom>box.bottom+1);
   if(button.ink.some(outside)||outside(button.icon)) overflowing.push(button.text);
  }
  // Il bug del widget sorgente è corretto su richiesta: nessun debordo a
  // nessuna scala, né collisioni tra icona e testo, senza ridurre il font.
  assert.deepEqual(overflowing,[],`testo/icona oltre il pulsante ${width}/${scale}`);
  for(const button of buttons){
   if(!button.icon) continue;
   for(const text of button.ink){
    const icon=button.icon;
    const overlaps=text.x<icon.right-0.5 && icon.x<text.right-0.5 && text.y<icon.bottom-0.5 && icon.y<text.bottom-0.5;
    assert.equal(overlaps,false,`icona sovrapposta al testo ${width}/${scale}: ${JSON.stringify(button)}`);
   }
  }
  for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){
   const a=buttons[i].box,b=buttons[j].box;
   assert.ok(a.right<=b.x+1 || b.right<=a.x+1 || a.bottom<=b.y+1 || b.bottom<=a.y+1,`pulsanti sovrapposti ${width}/${scale}`);
  }
  const rows=new Set(buttons.map(b=>Math.round(b.box.y))).size;
  if(width>=682 && scale<=1) assert.equal(rows,1,`quattro comandi su una riga ${width}/${scale}`);
  if(width<568 && scale<=1) assert.equal(rows,2,`su telefono due righe ${width}/${scale}`);
  assert.ok(geometry.body.height>=80,`poco spazio per foto ${width}/${scale}: ${JSON.stringify(geometry)}`);
  if(scale===1 && [320,682,1440].includes(width))await crop.screenshot({path:`/tmp/lingue-ritaglio-riferimento-${width}.png`});
  if(scale===1.6 && width===320)await crop.screenshot({path:'/tmp/lingue-ritaglio-320-font160.png'});
  const controls=crop.locator('[data-crop-controls]');
  const items=controls.locator(':scope > button');
  for(let i=0;i<4;i++){
   await items.nth(i).focus();
   assert.ok(await items.nth(i).evaluate(el=>document.activeElement===el),`comando ${i+1} non raggiungibile da tastiera ${width}/${scale}`);
  }
  const photoNote=visibleImage<55?`; porzione iniziale della foto ${visibleImage.toFixed(0)}px come nel widget`:'';
  console.log(`RITAGLIO ${width}×${height}px scala ${scale*100}%: foto visibile, testo ${(14*scale).toFixed(1)}px, nessun debordo o sovrapposizione, focus OK${photoNote}.`);
  await context.close();
 }
} finally {await browser.close();}

