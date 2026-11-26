#!/usr/bin/env python3
"""Verifica i PDF di riordino sintetici, senza aprire il database.

Prima: pnpm exec tsx scripts/test-riordino-uniforme.ts
Poi:   python3 scripts/verifica-riordino-uniforme-pdf.py
Richiede pypdf (solo dipendenza del controllo, non dell'app).
"""
from collections import Counter
from pathlib import Path
import re
from pypdf import PdfReader
from pypdf.generic import ContentStream

BASE = Path('/tmp/lingue-riordino-uniforme-pdf')
PALETTE = {'fill': '#F0E5DF', 'border': '#D4B2A0', 'text': '#5D4037'}
FIXTURES = {
    'en': {'words': ['She', 'often', 'eats', 'apples.'], 'answer': 'She often eats apples.', 'title': 'INGLESE FACILE'},
    'fr': {'words': ['Elle', 'mange', 'souvent', 'des', 'pommes.'], 'answer': 'Elle mange souvent des pommes.', 'title': 'FRANCESE FACILE'},
    'es': {'words': ['Ella', 'siempre', 'come', 'manzanas.'], 'answer': 'Ella siempre come manzanas.', 'title': 'SPAGNOLO FACILE'},
}


def rgb(hex_color):
    return tuple(round(int(hex_color[i:i+2], 16) / 255, 6) for i in (1, 3, 5))


def contrast(hex1, hex2):
    def luminance(value):
        channels = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
        linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels]
        return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]
    hi, lo = sorted((luminance(hex1), luminance(hex2)), reverse=True)
    return (hi + .05) / (lo + .05)


def verify(path, fixture, with_answers, custom=False):
    reader = PdfReader(path)
    assert len(reader.pages) >= 1
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert fixture['title'] in text, f'{path}: titolo errato'
    assert 'Cognome: Sintetico' in text and 'Nome: Test' in text, f'{path}: dati di prova mancanti'
    if custom:
        assert 'Consegna personale: forma la frase corretta.' in text, f'{path}: istruzione personalizzata persa'
    else:
        assert 'Riordina le parole e scrivi la frase corretta.' in text, f'{path}: istruzione predefinita errata'
    assert 'I colori aiutano' not in text, f'{path}: vecchie indicazioni cromatiche'
    for label in ['CHI', 'COSA FA', 'OGNI QUANTO', 'IL RESTO']:
        assert not re.search(rf'(?m)^\s*{re.escape(label)}\s*$', text), f'{path}: vecchia legenda {label}'
    for word in fixture['words']:
        assert word in text, f'{path}: parola mancante: {word}'
    if with_answers:
        assert fixture['answer'] in text, f'{path}: frase svolta assente'
        assert 'Anche corretto:' in text, f'{path}: ordine alternativo assente'
    else:
        assert 'Anche corretto:' not in text, f'{path}: soluzione nel PDF senza risposte'

    counts = Counter()
    for page in reader.pages:
        for args, op in ContentStream(page.get_contents(), reader).operations:
            if op in (b'rg', b'RG') and len(args) == 3:
                counts[(op, tuple(round(float(v), 6) for v in args))] += 1
    expected = len(fixture['words'])
    assert counts[(b'rg', rgb(PALETTE['fill']))] == expected, f'{path}: riempimenti uniformi {counts}'
    assert counts[(b'RG', rgb(PALETTE['border']))] == expected, f'{path}: bordi uniformi {counts}'
    assert counts[(b'rg', rgb(PALETTE['text']))] == expected, f'{path}: parole con colore diverso {counts}'
    for old in ['#E8EAF6', '#E2F3EF', '#FFF3B0']:
        assert counts[(b'rg', rgb(old))] == 0, f'{path}: compare una vecchia tinta per ruolo {old}'
    print(f"{path.name}: {expected} parole con sfondo, bordo e testo identici; consegna e legenda OK")


assert contrast(PALETTE['text'], PALETTE['fill']) >= 4.5, 'contrasto delle tessere inferiore a WCAG AA'
print(f"Contrasto testo/sfondo tessere: {contrast(PALETTE['text'], PALETTE['fill']):.2f}:1")
for lang, fixture in FIXTURES.items():
    for with_answers in (False, True):
        verify(BASE / f"{lang}-{'con' if with_answers else 'senza'}.pdf", fixture, with_answers)
verify(BASE / 'en-personalizzato.pdf', FIXTURES['en'], False, custom=True)
print('Tutti i PDF sintetici sono coerenti; istruzioni personalizzate e alternative conservate.')

