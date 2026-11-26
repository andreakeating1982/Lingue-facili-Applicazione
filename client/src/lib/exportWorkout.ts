/**
 * Esportazione PDF dell'esercizio «Francese Facile».
 * - Font OpenDyslexic incorporato (stessi file dell'app).
 * - Colori e icone della versione inclusiva (badge, tessere di riordino
 *   uniformi, evidenziazioni gialle, caselle VERO/FALSO nella lingua scelta,
 *   immagini dell'abbinamento).
 * - Due modalità: senza risposte (da stampare) e con le risposte dello studente
 *   (segni verde/corallo + soluzioni + punteggio).
 */
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  repairGluedSegments,
  type Exercise,
  type ItemAnswer,
  type McItem,
  type StudentData,
} from "@shared/exercise";
import { REORDER_CHIP_PALETTE } from "@shared/exercise";
import { LANGS, langConfig, type LangCode, type LangConfig } from "@shared/languages";

/** Lingua attiva per la costruzione del PDF (impostata da buildWorkoutPdf). */
let ACTIVE_LANG: LangConfig = LANGS.en;

/* ---------------- Colori ---------------- */
const PLUM = "#00695c";
const GOLD = "#c9a227";
const DARK = "#2E2018";
const GRAY = "#8C827A";
const LINEC = "#D6CEC4";
const GREEN = "#00695c";
const GREEN_D = "#004d40";
const CORAL = "#b71c1c";
const CORAL_D = "#a51818";
const BLUE_D = "#283593";
const PURPLE = "#00796b";
const PURPLE_D = "#004d40";
const AMBER_BG = "#fff3b0";
const AMBER_D = "#8a6400";
const SOFT = "#FAF8F5";
const BORDER = "#D6CEC4";
const ZEBRA = "#F7F3EA";
const PILL_BORDER = "#B8846A";

const A4W = 595.28;
const A4H = 841.89;
const M = 54;
/* Il piè di pagina è disegnato a y=24: il contenuto può scendere fino a
   50pt dal fondo. Con questa soglia comune ogni pagina si riempie al
   massimo prima di passare alla successiva (stessa regola già usata dal
   riordino); prima la soglia generale era M+40=94 e spingeva in seconda
   pagina item che in prima c'erano ancora. */
const PAGE_BOTTOM = 50;

/* Base per i font: nel browser è l'origine corrente; in Node (test CLI) è il
   server di sviluppo su localhost:3000. */
const FONT_BASE =
  typeof location !== "undefined" && location.origin
    ? location.origin
    : "http://localhost:3000";

function hex(c: string) {
  const h = c.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
}

/** OpenDyslexic non ha tutti i glifi Unicode: normalizza la punteggiatura e
 *  rimuove emoji/simboli non coperti. */
function sanitize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\u0000-\u024F]/g, "");
}

type Token = {
  v?: string;
  font: PDFFont;
  color: ReturnType<typeof hex>;
  size: number;
  blank?: boolean;
  bold?: boolean;
};

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
};

function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < PAGE_BOTTOM) {
    ctx.page = ctx.pdf.addPage([A4W, A4H]);
    ctx.y = A4H - M;
  }
}

function centerText(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof hex>
): void {
  const t = sanitize(text);
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: (A4W - w) / 2, y, size, font, color });
}

/** Flusso di token con a capo automatico; ritorna la y finale. */
function flow(
  ctx: Ctx,
  tokens: Token[],
  opts: { x0: number; maxX: number; lineH: number }
): void {
  const { x0, maxX, lineH } = opts;
  let x = x0;
  for (const tok of tokens) {
    if (tok.blank) {
      if (x + 40 > maxX) {
        x = x0;
        ctx.y -= lineH;
      }
      ctx.page.drawLine({
        start: { x: x + 2, y: ctx.y + 2 },
        end: { x: x + 34, y: ctx.y + 2 },
        thickness: 1.6,
        color: hex(DARK),
      });
      x += 44;
      continue;
    }
    const words = sanitize(tok.v ?? "").split(/\s+/).filter(Boolean);
    for (const word of words) {
      const w = tok.font.widthOfTextAtSize(word, tok.size);
      const sp = tok.font.widthOfTextAtSize(" ", tok.size);
      if (x + w > maxX && x > x0) {
        x = x0;
        ctx.y -= lineH;
      }
      ctx.page.drawText(word, { x, y: ctx.y, size: tok.size, font: tok.font, color: tok.color });
      x += w + sp;
    }
  }
}

function wrapLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(cand, size) > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = cand;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCheck(page: PDFPage, x: number, y: number, s: number, color: ReturnType<typeof hex>) {
  page.drawLine({ start: { x, y: y - s * 0.15 }, end: { x: x + s * 0.38, y: y - s * 0.5 }, thickness: 2.6, color });
  page.drawLine({ start: { x: x + s * 0.38, y: y - s * 0.5 }, end: { x: x + s, y: y + s * 0.45 }, thickness: 2.6, color });
}

function drawCross(page: PDFPage, x: number, y: number, s: number, color: ReturnType<typeof hex>) {
  page.drawLine({ start: { x, y }, end: { x: x + s, y: y - s }, thickness: 2.6, color });
  page.drawLine({ start: { x, y: y - s }, end: { x: x + s, y }, thickness: 2.6, color });
}

function badge(page: PDFPage, x: number, y: number, label: string, bg: string, white: PDFFont): void {
  page.drawCircle({ x, y, size: 11, color: hex(bg) });
  const w = white.widthOfTextAtSize(label, 10);
  page.drawText(label, { x: x - w / 2, y: y - 3.6, size: 10, font: white, color: rgb(1, 1, 1) });
}

/* ------------------------------------------------------------------ */
/* Immagini                                                            */
/* ------------------------------------------------------------------ */
async function embedAnyImage(pdf: PDFDocument, url: string): Promise<PDFImage | null> {
  if (!url) return null;
  /* Le immagini (media.easy-peasy.ai, Twemoji) non hanno header CORS: il
     fetch diretto del browser fallirebbe e il PDF uscirebbe con i riquadri
     vuoti. Passiamo dal proxy same-origin che scarica l'immagine lato server. */
  try {
    const res = await fetch(`${FONT_BASE}/api/img-proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    try {
      return await pdf.embedPng(bytes);
    } catch {
      return await pdf.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Render per tipologia                                                */
/* ------------------------------------------------------------------ */
/** Soluzione MC: quando l'item ha più risposte corrette, elencale tutte. */
function soluzioneMc(item: McItem): string {
  const alts = (item.alsoCorrect ?? []).filter((a) => a !== item.correct);
  return alts.length > 0 ? `${item.correct} (oppure: ${alts.join(", ")})` : item.correct;
}

/** Vecchio renderer, conservato solo come riferimento per i PDF storici. */
function renderMcLegacy(
  ctx: Ctx,
  items: Extract<Exercise, { type: "mc" }>["items"],
  answers?: ItemAnswer[]
): void {
  const withAnswers = !!answers;
  items.forEach((item, i) => {
    /* OpenDyslexic ha aste e code molto più alte dei font standard: ogni
       item riserva più spazio e le righe successive partono più in basso,
       altrimenti la frase risale dentro le opzioni dell'item precedente. */
    ensure(ctx, item.alsoCorrect?.length ? 185 : 150);
    badge(ctx.page, M + 11, ctx.y - 4, String(i + 1), PLUM, ctx.bold);
    const tokens: Token[] = repairGluedSegments(item.segments).map((seg) => {
      if (seg.t === "text") return { v: seg.v, font: ctx.font, color: hex(DARK), size: 12.5 };
      if (seg.t === "subject")
        return {
          v: seg.v,
          font: ctx.bold,
          color: hex(seg.group === "A" ? BLUE_D : PURPLE_D),
          size: 12.5,
          bold: true,
        };
      return { font: ctx.font, color: hex(DARK), size: 12.5, blank: true };
    });
    flow(ctx, tokens, { x0: M + 30, maxX: A4W - M, lineH: 24 });
    ctx.y -= 20;

    /* Annotazione obbligatoria quando c'è più di una risposta possibile:
       lo studente deve saperlo anche sul cartaceo, prima di cerchiare. */
    if (item.alsoCorrect && item.alsoCorrect.length > 0) {
      ctx.y -= 24;
      ctx.page.drawText(sanitize("⚠ Più di una risposta corretta"), {
        x: M + 30,
        y: ctx.y,
        size: 9.5,
        font: ctx.bold,
        color: hex("#B75D0E"),
      });
      ctx.y -= 10;
    }

    /* opzioni come pillole */
    let x = M + 30;
    for (const opt of item.options) {
      const w = ctx.bold.widthOfTextAtSize(sanitize(opt), 11.5) + 22;
      if (x + w > A4W - M) {
        x = M + 30;
        ctx.y -= 34;
        ensure(ctx, 40);
      }
      ctx.page.drawRectangle({
        x,
        y: ctx.y - 22,
        width: w,
        height: 26,
        borderColor: hex(PILL_BORDER),
        borderWidth: 1.5,
        color: rgb(1, 1, 1),
      });
      ctx.page.drawText(sanitize(opt), {
        x: x + 11,
        y: ctx.y - 14.5,
        size: 11.5,
        font: ctx.bold,
        color: hex(DARK),
      });
      x += w + 8;
    }

    if (withAnswers && answers?.[i]) {
      const a = answers[i];
      ctx.y -= 38;
      if (a.ok) {
        drawCheck(ctx.page, M + 30, ctx.y + 4, 10, hex(GREEN));
        ctx.page.drawText(sanitize(`Risposta: ${a.value}`), {
          x: M + 44,
          y: ctx.y,
          size: 10.5,
          font: ctx.bold,
          color: hex(GREEN_D),
        });
      } else {
        drawCross(ctx.page, M + 30, ctx.y + 4, 10, hex(CORAL));
        ctx.page.drawText(sanitize(`Risposta data: ${a.value}`), {
          x: M + 44,
          y: ctx.y,
          size: 10.5,
          font: ctx.bold,
          color: hex(CORAL_D),
        });
        ctx.y -= 18;
        ctx.page.drawText(sanitize(`Soluzione: ${soluzioneMc(item)}`), {
          x: M + 44,
          y: ctx.y,
          size: 10.5,
          font: ctx.bold,
          color: hex(GREEN_D),
        });
      }
      if (a.attempts > 0) {
        /* la larghezza va calcolata sulla stringa davvero disegnata sulla
           riga corrente, altrimenti la nota grigia si sovrappone al testo */
        const baseText = a.ok ? `Risposta: ${a.value}` : `Soluzione: ${soluzioneMc(item)}`;
        const baseW = ctx.bold.widthOfTextAtSize(sanitize(baseText), 10.5);
        ctx.page.drawText(
          sanitize(`(${a.attempts} ${a.attempts === 1 ? "errore" : "errori"} prima)`),
          {
            x: M + 44 + baseW + 8,
            y: ctx.y,
            size: 8.5,
            font: ctx.italic,
            color: hex(GRAY),
          }
        );
      }
    }
    ctx.y -= withAnswers ? 28 : 40;
  });
}

/* Scelta multipla: opzioni anche lunghe, avvolte senza uscire dalla pagina.
   Il blocco resta unito se possibile; se supera una pagina, i singoli righi
   continuano nella pagina successiva senza sovrapporsi al piè di pagina. */
function renderMc(
  ctx: Ctx,
  items: Extract<Exercise, { type: "mc" }>["items"],
  answers?: ItemAnswer[]
): void {
  const x0 = M + 30;
  const maxX = A4W - M;
  const maxW = maxX - x0;
  const withAnswers = !!answers;
  type Piece = { text?: string; blank?: boolean; font: PDFFont; color: ReturnType<typeof hex>; size: number; width: number };
  type Pill = { lines: string[]; width: number; height: number; x: number };

  /** Anche una singola parola molto lunga deve restare nel foglio. */
  const safeLines = (value: string, font: PDFFont, size: number, width: number): string[] => {
    const words = sanitize(value).split(/\s+/).filter(Boolean);
    const parts: string[] = [];
    for (const word of words) {
      let fragment = "";
      for (const ch of word) {
        if (fragment && font.widthOfTextAtSize(fragment + ch, size) > width) {
          parts.push(fragment);
          fragment = ch;
        } else fragment += ch;
      }
      if (fragment) parts.push(fragment);
    }
    const lines: string[] = [];
    let line = "";
    for (const word of parts) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };

  for (const [index, item] of items.entries()) {
    const questionLines: Piece[][] = [[]];
    let qWidth = 0;
    const addPiece = (piece: Piece) => {
      if (qWidth && qWidth + piece.width > maxW) { questionLines.push([]); qWidth = 0; }
      questionLines[questionLines.length - 1].push(piece);
      qWidth += piece.width;
    };
    for (const segment of repairGluedSegments(item.segments)) {
      if (segment.t === "blank") {
        addPiece({ blank: true, width: 44, font: ctx.font, color: hex(DARK), size: 12.5 });
        continue;
      }
      const font = segment.t === "subject" ? ctx.bold : ctx.font;
      const color = segment.t === "subject" ? hex(segment.group === "A" ? BLUE_D : PURPLE_D) : hex(DARK);
      const space = font.widthOfTextAtSize(" ", 12.5);
      for (const word of sanitize(segment.v).split(/\s+/).filter(Boolean)) {
        for (const fragment of safeLines(word, font, 12.5, maxW - space)) {
          addPiece({ text: fragment, font, color, size: 12.5, width: font.widthOfTextAtSize(fragment, 12.5) + space });
        }
      }
    }

    const groups = (item.steps ?? [{options: item.options, correct: item.correct}]).map(step => {
      const rows: Pill[][] = [[]];
      let rowWidth = 0;
      for (const option of step.options) {
        const lines = safeLines(option, ctx.bold, 11.5, maxW - 22);
        const width = Math.min(maxW, Math.max(...lines.map((line) => ctx.bold.widthOfTextAtSize(line, 11.5))) + 22);
        const height = Math.max(27, lines.length * 16 + 12);
        if (rowWidth && rowWidth + width > maxW) { rows.push([]); rowWidth = 0; }
        rows[rows.length - 1].push({ lines, width, height, x: x0 + rowWidth });
        rowWidth += width + 8;
      }
      return { rows, rowHeights: rows.map((row) => Math.max(...row.map((pill) => pill.height))) };
    });
    const answer = withAnswers ? answers?.[index] : undefined;
    const answerLines = answer ? safeLines(`Risposta: ${answer.value}`, ctx.bold, 10.5, maxW - 18) : [];
    const solutionLines = answer && !answer.ok ? safeLines(`Soluzione: ${soluzioneMc(item)}`, ctx.bold, 10.5, maxW - 18) : [];
    const noteHeight = item.alsoCorrect?.length ? 26 : 0;
    const answerHeight = answer ? (answerLines.length + solutionLines.length) * 19 + (answer.attempts > 0 ? 17 : 0) + 8 : 12;
    const needed = questionLines.length * 24 + noteHeight + groups.reduce((sum, group) => sum + group.rowHeights.reduce((n, height) => n + height + 8, 0) + (item.steps ? 20 : 0), 0) + answerHeight + 15;
    ensure(ctx, Math.min(needed, A4H - M - 100));
    badge(ctx.page, M + 11, ctx.y - 4, String(index + 1), PLUM, ctx.bold);
    for (const [lineIndex, line] of questionLines.entries()) {
      if (lineIndex > 0) ctx.y -= 24;
      ensure(ctx, 36);
      let x = x0;
      for (const part of line) {
        if (part.blank) ctx.page.drawLine({ start: { x: x + 2, y: ctx.y + 2 }, end: { x: x + 34, y: ctx.y + 2 }, thickness: 1.6, color: hex(DARK) });
        else ctx.page.drawText(part.text ?? "", { x, y: ctx.y, size: part.size, font: part.font, color: part.color });
        x += part.width;
      }
    }
    ctx.y -= 22;
    if (item.alsoCorrect?.length) {
      ensure(ctx, 30);
      ctx.page.drawText("Più di una risposta corretta", { x: x0, y: ctx.y, size: 9.5, font: ctx.bold, color: hex(AMBER_D) });
      ctx.y -= 24;
    }
    groups.forEach((group, groupIndex) => {
      if (item.steps) {
        ensure(ctx, 25);
        ctx.page.drawText(`Spazio ${groupIndex + 1}:`, { x: x0, y: ctx.y, size: 10, font: ctx.bold, color: hex(DARK) });
        ctx.y -= 18;
      }
      group.rows.forEach((row, rowIndex) => {
        const height = group.rowHeights[rowIndex];
        ensure(ctx, height + 12);
        for (const pill of row) {
          ctx.page.drawRectangle({ x: pill.x, y: ctx.y - height + 4, width: pill.width, height, borderColor: hex(PILL_BORDER), borderWidth: 1.5, color: rgb(1, 1, 1) });
          pill.lines.forEach((line, li) => ctx.page.drawText(line, { x: pill.x + 11, y: ctx.y - 14 - li * 16, size: 11.5, font: ctx.bold, color: hex(DARK) }));
        }
        ctx.y -= height + 8;
      });
    });
    if (answer) {
      ctx.y -= 4;
      for (const [li, line] of answerLines.entries()) {
        ensure(ctx, 24);
        if (li === 0) {
          if (answer.ok) drawCheck(ctx.page, x0, ctx.y + 4, 10, hex(GREEN));
          else drawCross(ctx.page, x0, ctx.y + 4, 10, hex(CORAL));
        }
        ctx.page.drawText(line, { x: x0 + 14, y: ctx.y, size: 10.5, font: ctx.bold, color: hex(answer.ok ? GREEN_D : CORAL_D) });
        ctx.y -= 19;
      }
      for (const line of solutionLines) {
        ensure(ctx, 24);
        ctx.page.drawText(line, { x: x0 + 14, y: ctx.y, size: 10.5, font: ctx.bold, color: hex(GREEN_D) });
        ctx.y -= 19;
      }
      if (answer.attempts > 0) {
        ensure(ctx, 20);
        ctx.page.drawText(`${answer.attempts} ${answer.attempts === 1 ? "errore prima" : "errori prima"}`, { x: x0 + 14, y: ctx.y, size: 8.5, font: ctx.italic, color: hex(GRAY) });
        ctx.y -= 17;
      }
    }
    ctx.y -= 16;
  }
}

function renderTf(
  ctx: Ctx,
  items: Extract<Exercise, { type: "tf" }>["items"],
  answers?: ItemAnswer[]
): void {
  const withAnswers = !!answers;
  items.forEach((item, i) => {
    ensure(ctx, 130);
    badge(ctx.page, M + 11, ctx.y - 4, String(i + 1), PLUM, ctx.bold);

    /* caselle T e F a destra */
    const cy = ctx.y - 3;
    ctx.page.drawCircle({ x: A4W - M - 50, y: cy, size: 9.5, borderColor: hex(GREEN), borderWidth: 1.7 });
    ctx.page.drawText("T", {
      x: A4W - M - 50 - ctx.bold.widthOfTextAtSize("T", 9.5) / 2,
      y: cy - 3.4,
      size: 9.5,
      font: ctx.bold,
      color: hex(GREEN_D),
    });
    ctx.page.drawCircle({ x: A4W - M - 24, y: cy, size: 9.5, borderColor: hex(CORAL), borderWidth: 1.7 });
    ctx.page.drawText("F", {
      x: A4W - M - 24 - ctx.bold.widthOfTextAtSize("F", 9.5) / 2,
      y: cy - 3.4,
      size: 9.5,
      font: ctx.bold,
      color: hex(CORAL_D),
    });

    /* frase con evidenziazione gialla */
    const size = 12.5;
    const maxW = A4W - M - 78 - (M + 30);
    /* Il riparatore inserisce lo spazio mancante ai confini dell'evidenzia-
       zione (es. «John»+«and»), senza separare la punteggiatura. */
    const fixedSegs = repairGluedSegments([
      { t: "pre", v: sanitize(item.sentence.slice(0, Math.max(0, item.sentence.toLowerCase().indexOf(item.highlight.toLowerCase())))) },
      { t: "mid", v: sanitize(idxOfHighlight(item) >= 0 ? item.sentence.slice(idxOfHighlight(item), idxOfHighlight(item) + item.highlight.length) : "") },
      { t: "post", v: sanitize(idxOfHighlight(item) >= 0 ? item.sentence.slice(idxOfHighlight(item) + item.highlight.length) : item.sentence) },
    ]);
    const pre = fixedSegs[0].v ?? "";
    const mid = fixedSegs[1].v ?? "";
    const post = fixedSegs[2].v ?? "";
    const preW = ctx.font.widthOfTextAtSize(pre, size);
    const midW = ctx.bold.widthOfTextAtSize(mid, size);
    const postW = ctx.font.widthOfTextAtSize(post, size);
    const x0 = M + 30;

    if (preW + midW + postW <= maxW && mid) {
      /* evidenziazione gialla disegnata dietro la parola chiave */
      ctx.page.drawRectangle({
        x: x0 + preW - 2,
        y: ctx.y - 5,
        width: midW + 4,
        height: 19,
        color: hex(AMBER_BG),
      });
      ctx.page.drawText(pre, { x: x0, y: ctx.y, size, font: ctx.font, color: hex(DARK) });
      ctx.page.drawText(mid, { x: x0 + preW, y: ctx.y, size, font: ctx.bold, color: hex(AMBER_D) });
      ctx.page.drawText(post, { x: x0 + preW + midW, y: ctx.y, size, font: ctx.font, color: hex(DARK) });
    } else {
      const tokens: Token[] = [
        { v: pre, font: ctx.font, color: hex(DARK), size },
        { v: mid, font: ctx.bold, color: hex(AMBER_D), size },
        { v: post, font: ctx.font, color: hex(DARK), size },
      ];
      flow(ctx, tokens, { x0, maxX: A4W - M - 72, lineH: 23 });
    }

    if (withAnswers && answers?.[i]) {
      const a = answers[i];
      ctx.y -= 34;
      const solution = item.isTrue ? ACTIVE_LANG.tfTrue : ACTIVE_LANG.tfFalse;
      if (a.ok) {
        drawCheck(ctx.page, M + 30, ctx.y + 4, 10, hex(GREEN));
        ctx.page.drawText(sanitize(`Risposta: ${a.value}`), {
          x: M + 44,
          y: ctx.y,
          size: 10.5,
          font: ctx.bold,
          color: hex(GREEN_D),
        });
      } else {
        drawCross(ctx.page, M + 30, ctx.y + 4, 10, hex(CORAL));
        ctx.page.drawText(sanitize(`Risposta data: ${a.value}`), {
          x: M + 44,
          y: ctx.y,
          size: 10.5,
          font: ctx.bold,
          color: hex(CORAL_D),
        });
        ctx.y -= 18;
        ctx.page.drawText(sanitize(`Soluzione: ${solution}`), {
          x: M + 44,
          y: ctx.y,
          size: 10.5,
          font: ctx.bold,
          color: hex(GREEN_D),
        });
      }
    }
    ctx.y -= withAnswers ? 28 : 30;
  });

  function idxOfHighlight(item: { sentence: string; highlight: string }): number {
    return item.sentence.toLowerCase().indexOf(item.highlight.toLowerCase());
  }
}

async function renderMatch(
  ctx: Ctx,
  pairs: Extract<Exercise, { type: "match" }>["pairs"],
  answers?: ItemAnswer[]
): Promise<void> {
  const withAnswers = !!answers;
  const images = await Promise.all(pairs.map((p) => embedAnyImage(ctx.pdf, p.imageUrl ?? "")));

  /* Misure compatte per stare su UNA sola pagina: griglia immagini + tabella
     (con o senza risposte) entro l'A4, anche per un solo studente. */
  const cols = 2;
  const cellW = (A4W - M * 2 - 14) / 2;
  const imgH = 72;
  const cellH = imgH + 40;
  const rows = Math.ceil(pairs.length / cols);
  const letters = "ABCDEF";

  for (let r = 0; r < rows; r++) {
    ensure(ctx, cellH + 10);
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= pairs.length) break;
      const bx = M + c * (cellW + 14);
      const by = ctx.y - cellH;
      ctx.page.drawRectangle({
        x: bx,
        y: by,
        width: cellW,
        height: cellH,
        borderColor: hex(BORDER),
        borderWidth: 1.4,
        color: hex(SOFT),
      });
      const img = images[idx];
      if (img) {
        const scale = Math.min((cellW - 12) / img.width, imgH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.page.drawImage(img, {
          x: bx + (cellW - w) / 2,
          y: by + 22 + (imgH - h) / 2,
          width: w,
          height: h,
        });
      }
      const isGreen = withAnswers;
      ctx.page.drawCircle({
        x: bx + cellW / 2,
        y: by + 10,
        size: 8.5,
        color: hex(isGreen ? GREEN : GOLD),
      });
      const letter = letters[idx] ?? "?";
      ctx.page.drawText(letter, {
        x: bx + cellW / 2 - ctx.bold.widthOfTextAtSize(letter, 9) / 2,
        y: by + 6.8,
        size: 9,
        font: ctx.bold,
        color: rgb(1, 1, 1),
      });
      if (withAnswers) {
        /* la parola va SOPRA l'immagine, senza sovrapporsi: l'immagine
           occupa da by+22 a by+22+imgH, quindi la scrivo oltre quel limite */
        const word = sanitize(pairs[idx].word);
        const w9 = ctx.bold.widthOfTextAtSize(word, 8.5);
        ctx.page.drawText(word, {
          x: bx + (cellW - Math.min(w9, cellW - 8)) / 2,
          y: by + 22 + imgH + 8,
          size: 8.5,
          font: ctx.bold,
          color: hex(GREEN_D),
        });
      }
    }
    ctx.y -= cellH + 8;
  }

  /* tabella parole */
  const colW = [24, 190, 48, A4W - M * 2 - 24 - 190 - 48];
  const rowH = 17;
  const tableH = rowH * (pairs.length + 1);
  ensure(ctx, tableH + 8);

  let ty = ctx.y - rowH;
  ctx.page.drawRectangle({ x: M, y: ty, width: A4W - M * 2, height: rowH, color: hex(PLUM) });
  const heads = ["n.", "Word", "Letter", "Traduzione italiana"];
  let hx = M;
  heads.forEach((h, i) => {
    ctx.page.drawText(h, { x: hx + 5, y: ty + 5.4, size: 8.5, font: ctx.bold, color: rgb(1, 1, 1) });
    hx += colW[i];
  });

  pairs.forEach((pair, i) => {
    ty -= rowH;
    if (i % 2 === 1) {
      ctx.page.drawRectangle({ x: M, y: ty, width: A4W - M * 2, height: rowH, color: hex(ZEBRA) });
    }
    ctx.page.drawLine({
      start: { x: M, y: ty },
      end: { x: A4W - M, y: ty },
      thickness: 0.8,
      color: hex(BORDER),
    });
    /* n. */
    const nLab = String(i + 1);
    ctx.page.drawText(nLab, {
      x: M + colW[0] / 2 - ctx.font.widthOfTextAtSize(nLab, 9) / 2,
      y: ty + 5.2,
      size: 9,
      font: ctx.font,
      color: hex(DARK),
    });
    /* word */
    ctx.page.drawText(sanitize(pair.word), {
      x: M + colW[0] + 6,
      y: ty + 4.8,
      size: 10,
      font: ctx.bold,
      color: hex(DARK),
    });
    /* lettera */
    const boxX = M + colW[0] + colW[1] + (colW[2] - 11) / 2;
    ctx.page.drawRectangle({
      x: boxX,
      y: ty + 3.5,
      width: 11,
      height: 11,
      borderColor: hex(PURPLE),
      borderWidth: 1.4,
      color: rgb(1, 1, 1),
    });
    if (withAnswers) {
      const letter = letters[i] ?? "?";
      ctx.page.drawText(letter, {
        x: boxX + 5.5 - ctx.bold.widthOfTextAtSize(letter, 7.5) / 2,
        y: ty + 4.6,
        size: 7.5,
        font: ctx.bold,
        color: hex(GREEN_D),
      });
    }
    /* traduzione */
    const txX = M + colW[0] + colW[1] + colW[2] + 6;
    if (withAnswers) {
      ctx.page.drawText(sanitize(pair.it), {
        x: txX,
        y: ty + 5,
        size: 8.5,
        font: ctx.italic,
        color: hex(GREEN_D),
      });
    } else {
      ctx.page.drawLine({
        start: { x: txX, y: ty + 4 },
        end: { x: txX + colW[3] - 16, y: ty + 5 },
        thickness: 0.9,
        color: hex(LINEC),
      });
    }
  });
  ctx.y = ty - 10;
}

/* Hash deterministico (FNV-1a): lo stesso item genera SEMPRE lo stesso
   disordine, quindi il PDF senza risposte e quello con le risposte restano
   identici riga per riga e la scheda si può stampare e correggere. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Mescolamento deterministico (Fisher-Yates con PRNG seedato): le parole del
   riordino nel PDF vanno presentate IN DISORDINE, non nell'ordine giusto. */
function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const rnd = (() => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function renderReorder(
  ctx: Ctx,
  items: Extract<Exercise, { type: "reorder" }>["items"],
  answers?: ItemAnswer[]
): void {
  const withAnswers = !!answers;

  /* Nessuna legenda dei ruoli: le tessere hanno tutte la stessa palette. */
  items.forEach((item, i) => {
    /* Le tessere vanno presentate IN DISORDINE (deterministico per item, così
       il PDF «con risposte» mostra le stesse tessere mescolate e la soluzione
       verde sotto: si può correggere la scheda stampata). Se il disordine
       casuale ricadesse per caso sull'ordine giusto, si ruota di uno. */
    let chips = shuffleDeterministic(item.chips, hashStr(item.answer + "|" + item.chips.map((c) => c.t).join("|")));
    if (
      chips.length > 1 &&
      chips.every((c, k) => c.t === item.chips[k].t)
    ) {
      chips = [...chips.slice(1), chips[0]];
    }
    /* Altezza ESATTA dell'item (tessere anche su più righe + soluzione o riga
       per scrivere): l'item va a pagina nuova SOLO se davvero non ci sta, così
       in prima pagina entrano tutti gli item che ci stanno. Prima il riservo
       fisso di 130p spingeva in seconda pagina item che c'erano ancora.
       L'item non viene MAI spezzato: tessere e soluzione restano insieme. */
    let rows = 1;
    let xx = M + 30;
    for (const chip of chips) {
      const w = ctx.bold.widthOfTextAtSize(sanitize(chip.t), 10.5) + 14;
      if (xx + w > A4W - M) {
        xx = M + 30;
        rows++;
      }
      xx += w + 6;
    }
    /* Stampare ciò che lo studente ha davvero composto, anche quando è
       un ordine alternativo corretto; le schede vecchie restano compatibili. */
    const givenAnswer = answers?.[i]?.value?.trim() || item.answer;
    const nLines =
      withAnswers && answers?.[i]
        ? wrapLines(givenAnswer, ctx.bold, 11, A4W - M - 50).length
        : 0;
    /* ORDINI ALTERNATIVI corretti (alsoCorrect): nel PDF «con risposte»
       vengono stampati sotto la soluzione, così chi corregge la scheda
       sa che anche quell'ordine va accettato. */
    const alternatives = item.alsoCorrect?.length
      ? [item.answer, ...item.alsoCorrect].filter((alt, index, all) =>
          alt.trim().toLowerCase() !== givenAnswer.trim().toLowerCase() && all.indexOf(alt) === index)
      : [];
    const altLines =
      withAnswers && answers?.[i]
        ? alternatives.flatMap((alt) =>
            wrapLines(`Anche corretto: ${alt}`, ctx.italic, 9, A4W - M - 50)
          )
        : [];
    const itemH =
      (withAnswers && answers?.[i] ? 60 : 50) +
      (rows - 1) * 30 +
      Math.max(0, nLines - 1) * 19 +
      altLines.length * 15;
    /* Salto pagina SOLO se l'item davvero non ci sta. Il limite è
       PAGE_BOTTOM (50pt dal fondo; il piè di pagina è a 24pt), la stessa
       soglia di ensure(): la pagina 1 si riempie fino in fondo e non capita
       più una pagina 2 con una sola voce. */
    if (ctx.y - itemH < PAGE_BOTTOM) {
      ctx.page = ctx.pdf.addPage([A4W, A4H]);
      ctx.y = A4H - M;
    }
    badge(ctx.page, M + 11, ctx.y - 4, String(i + 1), PLUM, ctx.bold);
    let x = M + 30;
    const maxX = A4W - M;
    for (const chip of chips) {
      const rc = REORDER_CHIP_PALETTE;
      const label = sanitize(chip.t);
      const w = ctx.bold.widthOfTextAtSize(label, 10.5) + 14;
      if (x + w > maxX) {
        x = M + 30;
        ctx.y -= 30;
      }
      ctx.page.drawRectangle({
        x,
        y: ctx.y - 17,
        width: w,
        height: 23,
        color: hex(rc.bg),
        borderColor: hex(rc.border),
        borderWidth: 1.3,
      });
      ctx.page.drawText(label, { x: x + 7, y: ctx.y - 10.5, size: 10.5, font: ctx.bold, color: hex(rc.text) });
      x += w + 6;
    }
    ctx.y -= 14;

    if (withAnswers && answers?.[i]) {
      const a = answers[i];
      /* La soluzione sta VICINO alla frase scomposta a cui appartiene. */
      ctx.y -= 18;
      if (a.ok) drawCheck(ctx.page, M + 30, ctx.y + 4, 10, hex(GREEN));
      else drawCross(ctx.page, M + 30, ctx.y + 4, 10, hex(CORAL));
      const lines = wrapLines(givenAnswer, ctx.bold, 11, A4W - M - 50);
      lines.forEach((ln, li) => {
        ctx.page.drawText(ln, {
          x: M + 46,
          y: ctx.y - li * 19,
          size: 11,
          font: ctx.bold,
          color: hex(GREEN_D),
        });
      });
      /* Le alternative sotto la soluzione, in corsivo più piccolo. */
      altLines.forEach((ln, li) => {
        ctx.page.drawText(ln, {
          x: M + 46,
          y: ctx.y - (lines.length - 1) * 19 - (li + 1) * 15,
          size: 9,
          font: ctx.italic,
          color: hex(GREEN_D),
        });
      });
      /* Più spazio sotto, per distinguere bene le risposte successive. */
      ctx.y -= (lines.length - 1) * 19 + altLines.length * 15 + 26;
    } else {
      /* riga per scrivere */
      ctx.page.drawLine({
        start: { x: M + 30, y: ctx.y - 10 },
        end: { x: A4W - M, y: ctx.y - 10 },
        thickness: 1,
        color: hex(LINEC),
      });
      ctx.y -= 34;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Abbinamento francese ↔ italiano (quinta tipologia)                   */
/* ------------------------------------------------------------------ */
function renderMatchIt(
  ctx: Ctx,
  pairs: Extract<Exercise, { type: "matchIt" }>["pairs"],
  answers?: ItemAnswer[]
): void {
  const withAnswers = !!answers;
  const letters = "ABCDEF";
  /* Ordine FISSO e deterministico della colonna italiana (rotazione di metà
     lista): il PDF senza risposte e quello con le risposte mostrano ESATTAMENTE
     lo stesso layout, quindi la scheda si può stampare e correggere. */
  const half = Math.floor(pairs.length / 2);
  const slotOf = pairs.map((_, j) => (j + half) % pairs.length);
  const pairAtSlot = pairs.map((_, s) => (s - half + pairs.length) % pairs.length);
  const rowH = 30;
  const colW2 = (A4W - M * 2 - 24) / 2;
  const xEn = M;
  const xIt = M + colW2 + 24;

  /* intestazioni delle due colonne */
  ensure(ctx, rowH * 2 + 24);
  const hy = ctx.y - 16;
  ctx.page.drawRectangle({ x: xEn, y: hy - 4, width: colW2, height: 17, color: hex(PLUM) });
  ctx.page.drawText(ACTIVE_LANG.colTarget, { x: xEn + 8, y: hy + 1.2, size: 9.5, font: ctx.bold, color: rgb(1, 1, 1) });
  ctx.page.drawRectangle({ x: xIt, y: hy - 4, width: colW2, height: 17, color: hex(PLUM) });
  ctx.page.drawText("ITALIANO", { x: xIt + 8, y: hy + 1.2, size: 9.5, font: ctx.bold, color: rgb(1, 1, 1) });
  ctx.y = hy - 12;

  /* una riga per SLOT: a sinistra il francese numero s+1, a destra la
     traduzione con lettera LETTERS[s] */
  for (let s = 0; s < pairs.length; s++) {
    ensure(ctx, rowH + 4);
    const ry = ctx.y - rowH;
    if (s % 2 === 1) {
      ctx.page.drawRectangle({ x: xEn, y: ry, width: colW2, height: rowH - 5, color: hex(ZEBRA) });
      ctx.page.drawRectangle({ x: xIt, y: ry, width: colW2, height: rowH - 5, color: hex(ZEBRA) });
    }
    const cy = ry + (rowH - 5) / 2;

    /* francese: numero + parola/frase + riquadro della lettera */
    ctx.page.drawCircle({ x: xEn + 11, y: cy, size: 9, color: hex(BLUE_D) });
    const nLab = String(s + 1);
    ctx.page.drawText(nLab, {
      x: xEn + 11 - ctx.bold.widthOfTextAtSize(nLab, 9) / 2,
      y: cy - 3.2,
      size: 9,
      font: ctx.bold,
      color: rgb(1, 1, 1),
    });
    ctx.page.drawText(sanitize(pairs[s].en), {
      x: xEn + 26,
      y: cy - 3.8,
      size: 11,
      font: ctx.bold,
      color: hex(DARK),
    });
    const boxX = xEn + colW2 - 24;
    ctx.page.drawRectangle({
      x: boxX,
      y: cy - 6.5,
      width: 13,
      height: 13,
      borderColor: hex(PURPLE),
      borderWidth: 1.4,
      color: rgb(1, 1, 1),
    });
    if (withAnswers) {
      const letter = letters[slotOf[s]] ?? "?";
      ctx.page.drawText(letter, {
        x: boxX + 6.5 - ctx.bold.widthOfTextAtSize(letter, 8) / 2,
        y: cy - 3.4,
        size: 8,
        font: ctx.bold,
        color: hex(GREEN_D),
      });
    }

    /* italiano: lettera + traduzione (ordine mescolato fisso) */
    ctx.page.drawCircle({ x: xIt + 11, y: cy, size: 9, color: hex(GOLD) });
    const itLetter = letters[s] ?? "?";
    ctx.page.drawText(itLetter, {
      x: xIt + 11 - ctx.bold.widthOfTextAtSize(itLetter, 9) / 2,
      y: cy - 3.2,
      size: 9,
      font: ctx.bold,
      color: rgb(1, 1, 1),
    });
    ctx.page.drawText(sanitize(pairs[pairAtSlot[s]].it), {
      x: xIt + 26,
      y: cy - 3.8,
      size: 11,
      font: ctx.font,
      color: hex(DARK),
    });

    ctx.y -= rowH;
  }
}

/* ------------------------------------------------------------------ */
/* Builder principale                                                  */
/* ------------------------------------------------------------------ */
export async function buildWorkoutPdf(opts: {
  exercise: Exercise;
  student: StudentData;
  withAnswers: boolean;
  answers?: ItemAnswer[];
  /** Istruzioni personalizzate (qualsiasi lingua): sostituiscono quelle
      standard nella riga di consegna del PDF. */
  instructions?: string;
  /** Lingua straniera del contenuto. */
  lang: LangCode;
}): Promise<Blob> {
  const { exercise, student, withAnswers, answers, instructions, lang } = opts;
  const L = langConfig(lang);
  ACTIVE_LANG = L;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const [regBytes, boldBytes, italBytes] = await Promise.all([
    fetch(`${FONT_BASE}/fonts/OpenDyslexic-Regular.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${FONT_BASE}/fonts/OpenDyslexic-Bold.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${FONT_BASE}/fonts/OpenDyslexic-Italic.otf`).then((r) => r.arrayBuffer()),
  ]);
  const font = await pdf.embedFont(regBytes);
  const bold = await pdf.embedFont(boldBytes);
  const italic = await pdf.embedFont(italBytes);

  const ctx: Ctx = { pdf, page: pdf.addPage([A4W, A4H]), y: A4H - M, font, bold, italic };
  const total = exercise.type === "match" || exercise.type === "matchIt"
    ? exercise.pairs.length
    : exercise.type === "mc" ? exercise.items.reduce((n, item) => n + (item.steps?.length ?? 1), 0) : exercise.items.length;
  const score = (answers ?? []).reduce((n, a) => n + (a.steps ? a.steps.filter(s => s.ok && s.attempts === 0).length : Number(a.ok && a.attempts === 0)), 0);

  /* intestazione */
  centerText(ctx.page, L.appTitle, ctx.y, 15, bold, hex(PLUM));
  ctx.y -= 18;
  const studentLine = [
    `Cognome: ${student.cognome || "-"}`,
    `Nome: ${student.nome || "-"}`,
    `Classe: ${student.classe || "-"}`,
    `Data: ${student.data || "-"}`,
  ].join(" · ");
  /* I dati lunghi vanno a capo anziché finire oltre i margini del foglio. */
  const studentLines = wrapLines(studentLine, bold, 9.5, A4W - M * 2);
  for (const line of studentLines) {
    centerText(ctx.page, line, ctx.y, 9.5, bold, hex(GRAY));
    ctx.y -= 15;
  }
  if (withAnswers) {
    centerText(
      ctx.page,
      `Risposte giuste al primo tentativo: ${score} su ${total}`,
      ctx.y,
      10,
      bold,
      hex(GREEN_D)
    );
    ctx.y -= 14;
  }
  const barW = 170;
  ctx.page.drawRectangle({
    x: (A4W - barW) / 2,
    y: ctx.y - 2,
    width: barW,
    height: 4,
    color: hex(GOLD),
  });
  ctx.y -= 24;

  /* istruzione (personalizzata dall'insegnante, in qualsiasi lingua, se presente) */
  const instrText = (instructions ?? "").trim() || L.pdfInstructions[exercise.type];
  const instr = wrapLines(instrText, italic, 10.5, A4W - M * 2);
  instr.forEach((ln) => {
    ctx.page.drawText(ln, { x: M, y: ctx.y, size: 10.5, font: italic, color: hex(DARK) });
    ctx.y -= 18;
  });
  ctx.y -= 6;

  /* contenuto per tipologia */
  if (exercise.type === "mc") renderMc(ctx, exercise.items, withAnswers ? answers : undefined);
  if (exercise.type === "tf") renderTf(ctx, exercise.items, withAnswers ? answers : undefined);
  if (exercise.type === "match") await renderMatch(ctx, exercise.pairs, withAnswers ? answers : undefined);
  if (exercise.type === "matchIt") renderMatchIt(ctx, exercise.pairs, withAnswers ? answers : undefined);
  if (exercise.type === "reorder") renderReorder(ctx, exercise.items, withAnswers ? answers : undefined);

  /* piè di pagina con numero pagina */
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `${L.appTitleCase} - pag. ${i + 1} di ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: (A4W - w) / 2, y: 24, size: 8, font, color: hex(GRAY) });
  });

  const saved = await pdf.save();
  return new Blob([Uint8Array.from(saved)], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
