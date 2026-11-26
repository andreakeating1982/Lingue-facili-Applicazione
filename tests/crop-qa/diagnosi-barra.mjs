import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  for (const width of [390,1024,1440]) {
    for (const [name,url] of [['widget','https://espressioni-monomi-polinomi.easy-peasy.site/'],['lingue','http://127.0.0.1:3000/']]) {
      const context = await browser.newContext({viewport:{width,height:844},hasTouch:width<600,isMobile:width<600});
      const page = await context.newPage();
      await page.goto(url,{waitUntil:'networkidle',timeout:60000});
      await page.evaluate(()=>document.fonts.ready);
      const result=await page.evaluate(()=>{
        const t=document.querySelector('[role=toolbar]');
        function measure(el){const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent.trim().replace(/\s+/g,' '),x:r.x,y:r.y,w:r.width,h:r.height,padding:s.padding,gap:s.gap,font:s.fontSize,line:s.lineHeight,color:s.color,bg:s.backgroundColor};}
        return {root:getComputedStyle(document.documentElement).fontSize,toolbar:measure(t),groups:[...t.querySelectorAll('[role=group]')].map(measure),buttons:[...t.querySelectorAll('button')].map(measure)};
      });
      await page.locator('[role=toolbar]').screenshot({path:`/tmp/${name}-toolbar-${width}.png`});
      console.log(name,width,JSON.stringify(result));
      await context.close();
    }
  }
} finally {await browser.close();}

