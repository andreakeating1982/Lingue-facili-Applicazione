import { chromium, devices } from 'playwright';

// Sonda diagnostica: nell'emulazione Android del browser di test, una barra di
// scorrimento personalizzata (::-webkit-scrollbar 5px) occupa spazio nel layout
// dell'iframe? Pagina locale sintetica: nessun blog, nessuna API, nessun dato.
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  const doc = (withCss) => `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1">
    <style>${withCss ? '::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#999;border-radius:3px}' : ''}
    body{margin:0;font:16px sans-serif}p{margin:0 0 8px}</style>
    ${Array.from({ length: 80 }, (_, i) => `<p>Riga ${i + 1} di prova abbastanza lunga da andare a capo in una colonna stretta come questa.</p>`).join('')}`;
  const result = {};
  for (const withCss of [false, true]) {
    await page.setContent(`<iframe id=f style="width:300px;height:400px;border:0" srcdoc='${doc(withCss).replace(/'/g, '&#39;')}'></iframe>`);
    await page.waitForTimeout(300);
    const f = page.frames()[1];
    result[withCss ? 'conBarraPersonalizzata' : 'senzaBarraPersonalizzata'] = await f.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      larghezzaBarra: window.innerWidth - document.documentElement.clientWidth,
    }));
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

