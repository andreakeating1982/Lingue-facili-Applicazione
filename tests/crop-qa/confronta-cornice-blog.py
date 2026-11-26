#!/usr/bin/env python3
"""Confronta il blocco della cornice nel post pubblico con il file del progetto (sola lettura).

La vista senza `?m=1` non contiene il blocco della cornice, quella mobile sì: il confronto si
fa sulla vista mobile, con user-agent predefinito e desktop. Ignora solo gli spazi a fine riga."""
import hashlib
import html as htmllib
import re
from pathlib import Path

import requests

# Vista mobile del post (?m=1): è quella servita ai telefoni e quella usata dalle prove.
URL = 'https://blogdelprofessoreandreacentinaro.blogspot.com/2026/09/lingue-straniere.html?m=1'
FILE = Path(__file__).resolve().parents[2] / 'cornice-dinamica' / 'CODICE-3-ANTI-TREMOLIO-ANDROID.html'
UAS = {
    'predefinito': None,
    'desktop': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}


ENT = re.compile(r'&(#\d+|#x[0-9a-fA-F]+|[A-Za-z]+);')


def righe_con_entita_nello_script(t):
    s0 = t.find('<script>')
    return [l for l in t[s0:].split('\n') if ENT.search(l)] if s0 >= 0 else []


def codice_senza_commenti(t):
    """Script senza commenti /* */ e // (approssimato, sufficiente per questo controllo)."""
    s0 = t.find('<script>')
    s = t[s0:] if s0 >= 0 else ''
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'(^|[\s;{}])//[^\n]*', r'\1', s)


def norm(t):
    return '\n'.join(l.rstrip() for l in t.replace('\r\n', '\n').split('\n')).strip()


def blocco(html):
    """Stesso algoritmo delle prove: dal commento di apertura al </script> dopo APP_URL."""
    m = html.find('CORNICE DINAMICA')
    if m < 0:
        return None
    start = html.rfind('<!--====', 0, m)
    app = html.find('var APP_URL', m)
    end = html.find('</script>', app) + len('</script>')
    return html[start:end] if start >= 0 and app > m and end > app else None


def sha(t):
    return hashlib.sha256(norm(t).encode('utf-8')).hexdigest()[:16]


ref = blocco(FILE.read_text(encoding='utf-8'))
assert ref, 'blocco non trovato nel file del progetto'
print(f'progetto: {len(ref)} caratteri, sha256 {sha(ref)}')
for nome, ua in UAS.items():
    r = requests.get(URL, headers={'User-Agent': ua} if ua else {}, timeout=40)
    blk = blocco(r.text)
    if blk is None:
        print(f'[{nome}] http {r.status_code}, {len(r.content)} byte: blocco assente')
        continue
    same = norm(blk) == norm(ref)
    print(f'[{nome}] http {r.status_code}, blocco {len(blk)} caratteri, sha256 {sha(blk)}, identico al progetto: {same}')
    print('  dopo aver decodificato le entità HTML, identico al progetto:', norm(htmllib.unescape(blk)) == norm(ref))
    ent_post, ent_ref = righe_con_entita_nello_script(blk), righe_con_entita_nello_script(ref)
    print(f'  righe con entità HTML dentro <script>: post {len(ent_post)}, progetto {len(ent_ref)}')
    cod_post, cod_ref = codice_senza_commenti(blk), codice_senza_commenti(ref)
    print('  nel CODICE (commenti esclusi): entità HTML nel post =', len(ENT.findall(cod_post)),
          '| caratteri non ASCII nel progetto =', len(re.findall(r'[^\x00-\x7f]', cod_ref)))
    if not same:
        a, b = norm(blk).split('\n'), norm(ref).split('\n')
        diff = [i for i, (x, y) in enumerate(zip(a, b)) if x != y]
        print('  righe diverse:', len(diff), '| righe post/progetto:', len(a), len(b))
        if diff:
            i = diff[0]
            print('  prima differenza, riga', i + 1)
            print('   post    :', a[i][:110])
            print('   progetto:', b[i][:110])

