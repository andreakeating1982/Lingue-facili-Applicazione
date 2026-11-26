#!/usr/bin/env python3
"""Controlla l'intestazione della prima pagina dei PDF generati da test-intestazione-pdf.ts.

Per ogni PDF (3 lingue × 5 tipologie × con/senza risposte):
  1. la prima riga è il titolo dell'app nella lingua giusta;
  2. la seconda riga sono SUBITO i dati dello studente («Cognome: ...»): nessuna riga
     «<tipologia> · <italiano> [- CON LE RISPOSTE]» in mezzo;
  3. con le risposte compare «Risposte giuste al primo tentativo: X su N» con i numeri attesi;
  4. la consegna (istruzione standard) è ancora presente;
  5. in nessuna pagina compaiono «con le risposte», la didascalia sul segno verde o i nomi
     delle tipologie accoppiati all'italiano.
Usa pdftotext (poppler). Codice di uscita 1 se qualcosa non va."""
import json
import re
import subprocess
import sys
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/pdf-intestazione')
manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))

VIETATE = [
    'con le risposte', 'segno verde', 'scritta verde', 'indica la risposta data', 'mostra la soluzione',
]


def testo(pdf: Path, first=None, last=None) -> str:
    cmd = ['pdftotext', '-layout']
    if first:
        cmd += ['-f', str(first), '-l', str(last or first)]
    cmd += [str(pdf), '-']
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def norm(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip().lower()


falliti = []
for m in manifest:
    pdf = OUT / m['file']
    errori = []
    p1 = testo(pdf, 1)
    righe = [r.strip() for r in p1.splitlines() if r.strip()]
    tutto = norm(testo(pdf))
    pagine = len(re.findall(r'\f', testo(pdf))) or 1

    if not righe or righe[0] != m['title']:
        errori.append(f"prima riga {righe[:1]!r}, atteso {m['title']!r}")
    if len(righe) < 2 or not righe[1].startswith('Cognome:'):
        errori.append(f"seconda riga {righe[1:2]!r}: dopo il titolo devono venire i dati dello studente")
    if m['withAnswers']:
        if not any(r.startswith(m['scoreLine']) for r in righe):
            errori.append(f"manca «{m['scoreLine']}»")
    elif any('Risposte giuste al primo tentativo' in r for r in righe):
        errori.append('il PDF senza risposte contiene la riga del punteggio')
    if norm(m['instruction']) not in norm(p1):
        errori.append('manca la consegna standard della tipologia')
    for v in VIETATE:
        if v in tutto:
            errori.append(f'compare «{v}»')
    for combo in (f"{m['typeMetaEn']} · {m['typeMetaIt']}", f"{m['typeMetaEn']} • {m['typeMetaIt']}"):
        if norm(combo) in tutto:
            errori.append(f'compare «{combo}»')
    if norm(m['typeMetaEn']) in norm(' '.join(righe[:4])):
        errori.append(f"compare «{m['typeMetaEn']}» sotto il titolo")

    stato = 'OK  ' if not errori else 'FAIL'
    print(f"{stato} {m['file']:34s} pagine={pagine}" + ('' if not errori else '  <- ' + '; '.join(errori)))
    if errori:
        falliti.append(m['file'])

print('----', len(manifest) - len(falliti), 'superati,', len(falliti), 'falliti su', len(manifest))
sys.exit(1 if falliti else 0)

