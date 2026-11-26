import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Tutte le API sono intercettate: esercizio, audio e fotografie sono sintetici;
// nessuna richiesta raggiunge il database o il servizio IA reale.
const BASE = (process.env.CROP_QA_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const reply = value => JSON.stringify([{ result: { data: { json: value } } }]);
const image = await fs.readFile(new URL('./fixtures/piccola.png', import.meta.url));
const row = {
  id: 'qa-impilati', lang: 'en', studentNome: 'Demo', studentCognome: 'Test',
  studentData: '14/11/2026', studentClasse: '2A',
  exercise: { type: 'mc', items: [{
    segments: [{t:'text',v:'She '},{t:'blank'},{t:'text',v:' every day.'}],
    options: ['reads', 'read'], correct: 'reads', translationIt: 'Lei ___ ogni giorno.',
  }] },
};
const scenarios = [[320,0.8,1.65],[320,1,1.65],[320,1.6,1.65],[320,1.6,2.6],[390,1,1.65],[390,1.6,1.65],[773,1,1.65],[1440,1,1.65],[1440,1.6,1.65]];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'] });

async function inspectGroup(group, expected, width, scale, lineHeight) {
  const info = await group.evaluate(el => {
    const box = el.getBoundingClientRect();
    const items = [...el.querySelectorAll(':scope > label, :scope > button')].map(item => {
      const rect = item.getBoundingClientRect();
      const span = item.querySelector(':scope > span');
      const textRect = span?.getBoundingClientRect();
      const range = document.createRange();
      if (span) range.selectNodeContents(span);
      const lines = span ? [...range.getClientRects()].map(r => ({ left:r.left, right:r.right })) : [];
      const css = getComputedStyle(item);
      const textCss = span ? getComputedStyle(span) : css;
      return {
        text: span?.textContent?.trim() ?? '', upper: textCss.textTransform === 'uppercase',
        x: rect.x, y: rect.y, w: rect.width, h: rect.height,
        textCenter: textRect ? textRect.x + textRect.width / 2 : 0,
        textAlign: css.textAlign, direction: css.flexDirection,
        fontSize: parseFloat(textCss.fontSize), lineHeight: parseFloat(textCss.lineHeight),
        iconCount: item.querySelectorAll(':scope > svg').length,
        textOverflows: span ? span.scrollWidth > span.clientWidth + 1 : true,
        scrollWidth: span?.scrollWidth, clientWidth: span?.clientWidth, lines,
        linesFit: lines.every(r => r.left >= rect.left - 1 && r.right <= rect.right + 1),
      };
    });
    return {box:{x:box.x,y:box.y,w:box.width}, items};
  });
  assert.equal(info.items.length, expected.length, `Numero pulsanti ${width}px/${scale}`);
  for (let i=0; i<info.items.length; i++) {
    const item = info.items[i];
    assert.equal(item.text, expected[i], `Testo ${width}px/${scale}`);
    assert.ok(item.upper || item.text === item.text.toLocaleUpperCase('it-IT'), `Maiuscolo ${item.text}`);
    assert.ok(Math.abs(item.w - info.box.w) < 2, `Larghezza ${item.text}: ${JSON.stringify(info)}`);
    assert.ok(Math.abs(item.x + item.w/2 - item.textCenter) < 2, `Testo non centrato: ${JSON.stringify(item)}`);
    assert.equal(item.textAlign, 'center', `Allineamento ${item.text}`);
    assert.equal(item.direction, 'column', `Icona e testo devono restare centrati: ${item.text}`);
    assert.ok(item.lineHeight / item.fontSize >= lineHeight - 0.01, `Interlinea insufficiente: ${JSON.stringify(item)}`);
    assert.equal(item.iconCount, 1, `Icona originale conservata: ${item.text}`);
    assert.ok(item.h >= 44 && item.h < (lineHeight > 2 ? 450 : 250), `Altezza non leggibile ${item.text}: ${item.h}`);
    assert.ok(!item.textOverflows && item.linesFit, `Testo fuori dal pulsante: ${JSON.stringify(item)}`);
    if (i) assert.ok(item.y >= info.items[i-1].y + info.items[i-1].h, `Pulsanti non impilati: ${JSON.stringify(info)}`);
  }
  return info;
}

try {
  for (const [width, scale, lineHeight] of scenarios) {
    const exerciseLang = width === 390 && scale === 1 ? 'es' : width === 773 ? 'fr' : 'en';
    const context = await browser.newContext({
      viewport: {width, height: 900}, hasTouch: width < 600, isMobile: width < 600,
      acceptDownloads: true, permissions: ['microphone'],
    });
    let saveCount = 0, transcribeCount = 0;
    await context.addInitScript(({scale,lineHeight}) => {
      localStorage.setItem('lingue-facili-lang', 'en');
      localStorage.setItem('lf_access', JSON.stringify({fontScale:scale,lineHeight,ruler:false,mode:'normale'}));
      if (navigator.mediaDevices?.getUserMedia) {
        const fake = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async constraints => {
          await new Promise(resolve => setTimeout(resolve, 1200));
          return fake(constraints);
        };
      }
    }, {scale,lineHeight});
    await context.route('**/api/trpc/**', async route => {
      const url = route.request().url();
      if (url.includes('exercises.get')) return route.fulfill({status:200,contentType:'application/json',body:reply({...row,lang:exerciseLang})});
      if (url.includes('exercises.saveAnswers')) { saveCount++; return route.fulfill({status:200,contentType:'application/json',body:reply({success:true})}); }
      if (url.includes('exercises.describeAdaptation')) return route.fulfill({status:200,contentType:'application/json',body:reply({description:'Riordina la frase originale.'})});
      if (url.includes('exercises.transcribe')) {
        transcribeCount++;
        await new Promise(resolve => setTimeout(resolve, 1200));
        return route.fulfill({status:200,contentType:'application/json',body:reply({text:'Istruzione audio di prova.'})});
      }
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/setup?lang=en`, {waitUntil:'networkidle'});
    await page.waitForFunction(({s,lh}) => getComputedStyle(document.documentElement).getPropertyValue('--lf-scale').trim() === String(s) && getComputedStyle(document.documentElement).getPropertyValue('--lf-lh').trim() === String(lh), {s:scale,lh:lineHeight});
    const source = page.getByRole('textbox', {name:"Testo dell'esercizio originale"});
    const photos = page.locator('.lf-equal-actions').first();
    assert.equal(await photos.locator(':scope > label, :scope > button').count(), 2, 'Svuota non compare con testo vuoto');
    await source.fill('She reads a book.');
    assert.equal(await page.locator('.lf-equal-actions').count(), 2, 'Il gruppo audio compare con il testo');
    const audio = page.locator('.lf-equal-actions').last();
    const pInfo = await inspectGroup(photos, ['Scatta una foto','Carica foto o PDF','Svuota'], width, scale, lineHeight);
    const aInfo = await inspectGroup(audio, ['REGISTRA ISTRUZIONI','CARICA FILE AUDIO'], width, scale, lineHeight);
    assert.ok(Math.abs(pInfo.box.w-aInfo.box.w) < 2, `Tutti e cinque i pulsanti devono avere pari larghezza: foto ${pInfo.box.w}, audio ${aInfo.box.w}`);
    const oldWidth = await photos.evaluate(el => {
      const parent = el.parentElement;
      const css = getComputedStyle(parent);
      const available = parent.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lf-scale')) || 1;
      // Anteprima appena precedente: cap 425px, 85% o minimo proporzionale al font.
      return Math.min(available, 425, Math.max(available * 0.85, 150 * scale));
    });
    assert.ok(pInfo.box.w < oldWidth - 1, `I pulsanti devono essere più stretti dell'anteprima precedente: ${pInfo.box.w} vs ${oldWidth}`);
    console.log(`  Misura 5 pulsanti: ${pInfo.box.w.toFixed(1)}px (precedente ${oldWidth.toFixed(1)}px)`);
    assert.equal(await photos.locator('input[capture="environment"]').count(), 1, 'Fotocamera conservata');
    assert.equal(await photos.locator('input[multiple]').count(), 1, 'Caricamento foto/PDF conservato');
    assert.equal(await audio.getByLabel('Carica file audio con le istruzioni').count(), 1, 'Caricamento audio accessibile');
    for (const input of [photos.locator('input[multiple]'), audio.getByLabel('Carica file audio con le istruzioni')]) {
      await input.focus();
      assert.ok(await input.evaluate(el => document.activeElement === el), 'Input file raggiungibile da tastiera');
      assert.notEqual(await input.evaluate(el => getComputedStyle(el.parentElement).outlineStyle), 'none', 'Focus visibile sul pulsante file');
    }
    await source.focus();
    assert.equal(await page.getByRole('button',{name:'REGISTRA ISTRUZIONI'}).getAttribute('aria-pressed'),'false');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, 'Niente scroll orizzontale');

    if (lineHeight === 1.65 && ((width === 320 && scale === 1.6) || (width === 390 && scale === 1) || (width === 1440 && scale === 1))) {
      const tag = `${width}-${String(scale).replace('.','_')}`;
      await photos.screenshot({path:`/tmp/lf-impilati-foto-${tag}.png`});
      await audio.screenshot({path:`/tmp/lf-impilati-audio-${tag}.png`});
    }
    if (width === 320 && scale === 1.6 && lineHeight === 1.65) {
      // Il click su file continua ad aprire il ritaglio originale; poi si annulla.
      await photos.locator('input[multiple]').setInputFiles({name:'foto-sintetica.png',mimeType:'image/png',buffer:image});
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({state:'visible', timeout:15000});
      await dialog.getByRole('button',{name:'Chiudi',exact:true}).click();
      await dialog.waitFor({state:'hidden'});
      // Upload solo di un segnale fittizio: la trascrizione è simulata.
      await audio.getByLabel('Carica file audio con le istruzioni').setInputFiles({name:'audio-prova.wav',mimeType:'audio/wav',buffer:Buffer.from('audio di prova')});
      await page.getByRole('button',{name:'TRASCRIZIONE IA IN CORSO…'}).waitFor();
      await inspectGroup(audio, ['TRASCRIZIONE IA IN CORSO…','CARICA FILE AUDIO'], width, scale, lineHeight);
      await page.getByRole('button',{name:'TRASCRIZIONE IA IN CORSO…'}).scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await page.screenshot({path:'/tmp/lf-ancora-stretti-trascrizione-schermo.png'});
      await page.waitForFunction(() => document.querySelector('#teacher-adaptation')?.value.includes('Istruzione audio di prova.'), null, {timeout:10000});
      assert.equal(transcribeCount, 1);
      // Microfono sintetico, permesso ritardato e trascrizione simulata: le etichette transitorie devono restare leggibili.
      await page.getByRole('button',{name:'REGISTRA ISTRUZIONI'}).click();
      await page.getByRole('button',{name:'ATTENDO IL MICROFONO…'}).waitFor();
      await inspectGroup(audio, ['ATTENDO IL MICROFONO…','CARICA FILE AUDIO'], width, scale, lineHeight);
      const stop = page.getByRole('button',{name:'FERMA REGISTRAZIONE'});
      await stop.waitFor();
      await inspectGroup(audio, ['FERMA REGISTRAZIONE','CARICA FILE AUDIO'], width, scale, lineHeight);
      await stop.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await page.screenshot({path:'/tmp/lf-ancora-stretti-registrazione-schermo.png'});
      await page.waitForTimeout(1300);
      await stop.click();
      await page.getByRole('button',{name:'TRASCRIZIONE IA IN CORSO…'}).waitFor();
      await page.getByRole('button',{name:'REGISTRA ISTRUZIONI'}).waitFor({timeout:10000});
      assert.equal(transcribeCount, 2);
    }
    await page.getByRole('button',{name:'Svuota',exact:true}).click();
    assert.equal(await source.inputValue(), '', 'SVUOTA continua a funzionare');
    assert.equal(await page.locator('.lf-equal-actions').count(), 1, 'Il gruppo audio si nasconde senza testo');

    // Schermata finale con risposta e salvataggio interamente simulati.
    await page.goto(`${BASE}/exercise?id=qa-impilati`, {waitUntil:'networkidle'});
    await page.getByRole('button',{name:'reads',exact:true}).click();
    await page.getByRole('button',{name:'FINISCO',exact:true}).click();
    await page.getByText(/Risposte giuste al primo colpo:/).waitFor();
    const titles = {en:'YOU FINISHED! GREAT JOB!',fr:'TU AS FINI ! EXCELLENT TRAVAIL !',es:'¡HAS TERMINADO! ¡BUEN TRABAJO!'};
    await page.getByRole('heading',{name:titles[exerciseLang],exact:true}).waitFor();
    await page.waitForTimeout(200);
    assert.equal(saveCount, 1, 'Il salvataggio intercettato è stato richiesto');
    const names = ["SCARICA L'ESERCIZIO SENZA RISPOSTE", "SCARICA L'ESERCIZIO CON RISPOSTE"];
    for (const name of names) {
      const button = page.getByRole('button',{name,exact:true});
      assert.equal(await button.locator('svg').count(), 0, 'Nessuna icona nei pulsanti PDF');
      assert.equal(await button.getAttribute('aria-busy'), 'false');
      assert.ok(await button.isEnabled());
      const detail = await button.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const text = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.includes('SCARICA'));
        const range = document.createRange(); if (text) range.selectNodeContents(text);
        return {x:rect.x,w:rect.width, align:getComputedStyle(el).textAlign,
          fontSize:parseFloat(getComputedStyle(el).fontSize), lineHeight:parseFloat(getComputedStyle(el).lineHeight),
          lines:[...range.getClientRects()].filter(r => r.width > 1).map(r => ({left:r.left,right:r.right}))};
      });
      assert.equal(detail.align, 'center');
      assert.ok(detail.lineHeight / detail.fontSize >= lineHeight - 0.01, `Interlinea PDF insufficiente: ${JSON.stringify(detail)}`);
      assert.ok(detail.lines.length > 0 && detail.lines.every(r => r.left >= detail.x-1 && r.right <= detail.x+detail.w+1), `Testo PDF tagliato: ${JSON.stringify(detail)}`);
      assert.ok(detail.lines.every(r => Math.abs((r.left+r.right)/2 - (detail.x+detail.w/2)) < 3), `Testo PDF non centrato: ${JSON.stringify(detail)}`);
    }
    if (lineHeight === 1.65 && ((width === 320 && scale === 1.6) || (width === 390 && scale === 1) || (width === 1440 && scale === 1))) {
      const tag = `${width}-${String(scale).replace('.','_')}`;
      await page.locator('.card-paper').first().screenshot({path:`/tmp/lf-impilati-finale-${tag}.png`});
    }
    if (lineHeight === 1.65 && ((width === 320 && scale === 1.6) || (width === 390 && scale === 1) || width === 773 || (width === 1440 && scale === 1))) {
      for (const [name, suffix] of [[names[0],'senza'],[names[1],'con']]) {
        const waiting = page.waitForEvent('download', {timeout:30000});
        await page.getByRole('button',{name,exact:true}).click();
        const download = await waiting;
        const buffer = await fs.readFile(await download.path());
        assert.equal(buffer.subarray(0,5).toString(), '%PDF-', 'PDF prodotto e scaricato');
        assert.ok(buffer.length > 5000, 'PDF non vuoto');
        await download.saveAs(`/tmp/lf-impilati-${width}-${suffix}.pdf`);
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, 'Niente scroll orizzontale finale');
    assert.deepEqual(errors, [], `Errori JavaScript ${width}px/${scale}`);
    console.log(`${width}px/${Math.round(scale*100)}% interlinea ${lineHeight}, lingua ${exerciseLang}: foto ${pInfo.items.length}, audio ${aInfo.items.length}, impilati e centrati; PDF senza icone e dati simulati OK.`);
    await context.close();
  }
} finally { await browser.close(); }

