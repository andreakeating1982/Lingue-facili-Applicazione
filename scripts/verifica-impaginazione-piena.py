#!/usr/bin/env python3
"""Verifica geometrica dei PDF di impaginazione piena (niente database).

Prima: pnpm exec tsx scripts/test-impaginazione-piena.ts
Poi:   python3 scripts/verifica-impaginazione-piena.py
Richiede pypdf (solo dipendenza del controllo, non dell'app).

La geometria è letta dagli operatori RAW dello stream (Tm per il testo,
re per i rettangoli): il visitor di pypdf riporta talvolta tm identità
anche quando il PDF è corretto (verificato con Poppler), quindi non è
affidabile per le coordinate.

Controlli per ogni pagina:
- ogni posizione Tm è o il piè di pagina (y=24) o contenuto a y>=42;
- ogni rettangolo (re) ha il bordo inferiore a y>=42;
- le pagine non finali sono piene: il testo arriva almeno a y<=250.
Caso sintetico: mc-caso-sintetico-con.pdf deve avere ESATTAMENTE 1 pagina e
l'item 6 («Risposta: acompaño») deve stare in pagina 1.
"""
from pathlib import Path
import sys
from pypdf import PdfReader
from pypdf.generic import ContentStream

BASE = Path('/tmp/pdf-impaginazione')
PAGE_BOTTOM = 50
FOOTER_Y = 24

CASES = {
    'mc-caso-sintetico-con.pdf': {'pages': 1, 'must_contain_page1': ['Risposta: acompaño', 'biblioteca']},
    'mc-stress-con.pdf': {'pages': None, 'must_contain_page1': None},
    'mc-stress-senza.pdf': {'pages': None, 'must_contain_page1': None},
    'tf-stress-con.pdf': {'pages': None, 'must_contain_page1': None},
    'reorder-stress-con.pdf': {'pages': None, 'must_contain_page1': None},
}

def visitor_lines(page):
    parts = []
    def visitor(text, cm, tm, font_dict, font_size):
        if text.strip():
            parts.append((text.strip(), round(tm[5], 1)))
    page.extract_text(visitor_text=visitor)
    return parts

def analyze(name, expect, failures):
    path = BASE / name
    if not path.exists():
        failures.append(f'{name}: mancante')
        return
    reader = PdfReader(str(path))
    n = len(reader.pages)
    if expect['pages'] is not None and n != expect['pages']:
        failures.append(f'{name}: {n} pagine, attese {expect["pages"]}')
    print(f'\n== {name}: {n} pagine ==')
    for pno, page in enumerate(reader.pages, 1):
        ops = ContentStream(page.get_contents(), reader).operations
        ys_text, ys_rect = [], []
        for args, op in ops:
            if op == b'Tm' and len(args) >= 6:
                ys_text.append(round(float(args[5]), 1))
            elif op == b're' and len(args) >= 4:
                ys_rect.append(round(float(args[1]), 1))
        content_text = [y for y in ys_text if abs(y - FOOTER_Y) >= 2]
        content_rect = [y for y in ys_rect]
        info = []
        if not content_text:
            failures.append(f'{name} pag.{pno}: nessun testo')
            continue
        min_text = min(content_text)
        if min_text < PAGE_BOTTOM - 8:
            failures.append(f'{name} pag.{pno}: testo a y={min_text} sotto il limite {PAGE_BOTTOM - 8}')
        if content_rect and min(content_rect) < PAGE_BOTTOM - 8:
            failures.append(f'{name} pag.{pno}: rettangolo a y={min(content_rect)} sotto il limite')
        if pno < n and min_text > 250:
            failures.append(f'{name} pag.{pno}: pagina non piena (testo si ferma a y={min_text})')
        print(f'  pag.{pno}: {len(content_text)} righe testo, y min {min_text:.0f}, rettangoli {len(content_rect)}, footer OK')
    if expect['must_contain_page1']:
        text1 = ' '.join(t for t, _ in visitor_lines(reader.pages[0]))
        for needle in expect['must_contain_page1']:
            if needle not in text1:
                failures.append(f'{name}: «{needle}» non in pagina 1')

failures = []
for name, expect in CASES.items():
    analyze(name, expect, failures)

if failures:
    print('\nVERIFICA FALLITA:')
    for f in failures:
        print(' -', f)
    sys.exit(1)
print('\nVERIFICA SUPERATA: geometria dei casi verificati e caso sintetico in 1 pagina.')

