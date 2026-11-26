"""Dump della struttura del DOCX CODICI-EMBED-CORNICI: paragrafi e tabelle in ordine reale."""
import sys
from docx import Document

src = sys.argv[1] if len(sys.argv) > 1 else "/home/user/uploads/2026-09-17T12-37-40-885Z_CODICI-EMBED-CORNICI-v4-aggiornato.docx"
doc = Document(src)

from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

body = doc.element.body
idx_par = 0
idx_tab = 0
print("=== ORDINE REALE DEL CORPO ===")
for child in body.iterchildren():
    if child.tag == qn("w:p"):
        p = Paragraph(child, doc)
        style = p.style.name if p.style is not None else "?"
        txt = p.text.strip()
        if txt:
            print(f"[P{idx_par}] ({style}) {txt[:100]}")
        idx_par += 1
    elif child.tag == qn("w:tbl"):
        t = Table(child, doc)
        rows = len(t.rows)
        cols = len(t.columns)
        # prima cella: primo testo breve
        first = ""
        try:
            cell = t.rows[0].cells[0]
            first = cell.paragraphs[0].text.strip()[:60] if cell.paragraphs else ""
            npar = len(cell.paragraphs)
        except Exception:
            npar = -1
        print(f"[T{idx_tab}] {rows}x{cols} | prima cella: {npar} paragrafi | inizio: {first!r}")
        idx_tab += 1

print()
print("=== TABELLA INDICE T0 ===")
t0 = doc.tables[0]
for r in t0.rows:
    left = r.cells[0].text.strip()
    right = r.cells[1].text.strip()
    print(f"  {left!r} -> {right!r}")

print()
print("=== INDICE: TABELLA PER CODICE (prima riga di ogni tabella 1x1) ===")
for i, t in enumerate(doc.tables):
    if i == 0:
        continue
    try:
        txt = t.rows[0].cells[0].paragraphs[0].text.strip()
        np_ = len(t.rows[0].cells[0].paragraphs)
    except Exception:
        txt, np_ = "ERR", -1
    print(f"  T{i}: {np_} paragrafi | prima riga: {txt[:80]!r}")
