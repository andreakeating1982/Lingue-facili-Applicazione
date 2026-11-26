"""Verifiche assert sull'HTML della cornice dedicata Francese Facile (Codice 14).
Ogni trasformazione deve occorrere ESATTAMENTE il numero di volte atteso,
e NON devono esistere residui dell'app precedente (Inglese Facile).
"""
import sys

src = "/home/user/francese-facile/cornice-dinamica/embed-francese-facile-dedicata.html"
out = "/tmp/codice14-francese.html"

with open(src, encoding="utf-8") as f:
    html = f.read()

def conta(needle):
    return html.count(needle)

def assert_eq(needle, expected, label):
    n = html.count(needle)
    assert n == expected, f"FAIL {label}: attese {expected}, trovate {n} occorrenze di {needle!r}"
    print(f"OK  {label}: {n} occorrenza/e")

# --- 1. Commento di intestazione ---
assert_eq("CORNICE DINAMICA — FRANCESE FACILE (embed DEDICATO · v4 impermeabile + anti-loop + anti-tremolio)", 1, "commento intestazione")
assert conta("CORNICE DINAMICA — ") == 1, "commento intestazione duplicato"

# --- 2. Riga Versione DEDICATA + descrizione app ---
assert_eq("⭐ Versione DEDICATA: serve SOLO «Francese Facile».", 1, "riga versione dedicata")
assert_eq("🇫🇷 App: trasforma qualsiasi testo francese (incollato o fotografato)", 1, "descrizione app (riga 1)")
assert_eq("abbinamento francese-italiano — con feedback immediato e PDF.", 1, "descrizione app (riga 2)")

# --- 3. APP_URL ---
assert_eq("var APP_URL = 'https://francese-facile.easy-peasy.site/';", 1, "APP_URL")

# --- 4. Font @font-face ---
assert_eq("https://francese-facile.easy-peasy.site/fonts/OpenDyslexic-Regular-v2.woff2", 1, "font Regular")
assert_eq("https://francese-facile.easy-peasy.site/fonts/OpenDyslexic-Bold-v2.woff2", 1, "font Bold")

# --- 5. Titolo testata e title iframe ---
assert_eq('<p class="lf-titolo">FRANCESE FACILE</p>', 1, "lf-titolo")
assert_eq('title="Francese Facile — app in cornice"', 1, "title iframe")

# --- 6. Commento configurazione ---
assert_eq("⚙️ CONFIGURAZIONE — DEDICATA a Francese Facile", 1, "commento configurazione")

# --- 7. ZERO residui dell'app precedente e del vecchio titolo ---
for residuo in ("english-workout-app", "INGLESE FACILE", "Inglese Facile", "inglese", "english", "English", "🇬🇧", "FRANÇAIS"):
    assert residuo not in html, f"RESIDUO TROVATO: {residuo!r}"
print("OK  zero residui dell'app precedente (inglese) e del vecchio titolo FRANÇAIS")

# --- 8. Conteggio dominio nuovo (come Codice 3: 3 = APP_URL + 2 font) ---
n_dom = html.count("francese-facile.easy-peasy.site")
assert n_dom == 3, f"dominio nuovo: attese 3 occorrenze, trovate {n_dom}"
print(f"OK  dominio francese-facile.easy-peasy.site: {n_dom} occorrenze")

# --- 9. Invarianti strutturali della cornice v4 ---
for invariante in ("labvisivo:height", "'cornice='", "e.source", "lf-iframe", "Schermo intero", "Ricarica"):
    assert invariante in html, f"invariante mancante: {invariante!r}"
print("OK  invarianti v4 (labvisivo:height, token cornice, filtro e.source, pulsanti)")

# --- 10. Prepara il file finale: 499 righe = 499 paragrafi della cella (come Codice 3) ---
with open(out, "w", encoding="utf-8") as f:
    f.write(html.rstrip("\n") + "\n")

lines = open(out, encoding="utf-8").read().splitlines()
print(f"file finale: {out} — {len(lines)} righe (come il Codice 3 con 499 paragrafi)")
assert len(lines) == 499 and lines[-1] == "</script>"
print("TUTTE LE VERIFICHE SUPERATE")
