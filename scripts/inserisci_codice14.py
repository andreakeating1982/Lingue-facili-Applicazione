"""Inserisce nel DOCX CODICI-EMBED-CORNICI un NUOVO blocco «Codice 14»:
- paragrafo titolo (clonato dal Codice 3, Heading 1) con testo «Codice 14 — FRANÇAIS FACILE»
- tabella segnaposto 1×1 (clonata dalla tabella del Codice 13: struttura + pPr coerenti)
- riga nuova nella tabella indice T0: «FRANCESE — Francese Facile» -> «Codice 14»
Il contenuto della tabella segnaposto viene poi riempito da sostituisci_codice.py.
"""
import argparse
from copy import deepcopy

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def corpo_seq(doc):
    """[(tipo, elemento_xml)] di paragrafi e tabelle in ordine reale."""
    seq, pi, ti = [], 0, 0
    for child in doc.element.body.iterchildren():
        tag = child.tag.split("}")[-1]
        if tag == "p":
            seq.append(("p", doc.paragraphs[pi]._p))
            pi += 1
        elif tag == "tbl":
            seq.append(("tbl", doc.tables[ti]._tbl))
            ti += 1
    return seq


def trova_blocco(doc, n):
    """Ritorna (elemento_paragrafo_titolo, elemento_tabella) per «Codice n — …»."""
    seq = corpo_seq(doc)
    for i, (tipo, el) in enumerate(seq):
        if tipo == "p":
            testo = "".join(t.text or "" for t in el.iter(f"{W}t")).strip()
            if testo.startswith(f"Codice {n} — "):
                for tipo2, el2 in seq[i + 1:]:
                    if tipo2 == "tbl":
                        return el, el2
                raise SystemExit(f"Nessuna tabella dopo il titolo del Codice {n}")
    raise SystemExit(f"Titolo «Codice {n} — …» non trovato")


def set_par_text(p_el, text):
    """Imposta il testo di un paragrafo XML mantenendo il primo run (formattazione)."""
    runs = p_el.findall(f"{W}r")
    if runs:
        first = runs[0]
        for t in first.findall(f"{W}t"):
            first.remove(t)
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = text
        first.append(t)
        for r in runs[1:]:
            p_el.remove(r)
    else:
        r = OxmlElement("w:r")
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = text
        r.append(t)
        p_el.append(r)


def set_cell_text(tc_el, text):
    """Imposta il testo della prima cella (w:tc) su un solo paragrafo/run."""
    ps = tc_el.findall(f"{W}p")
    assert ps, "cella senza paragrafi"
    # rimuove i paragrafi extra, tieni il primo
    for p in ps[1:]:
        tc_el.remove(p)
    set_par_text(ps[0], text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    doc = Document(a.src)

    # --- 1. blocco di riferimento: Codice 3 (titolo Heading 1) e Codice 13 (ultima tabella) ---
    p3, _ = trova_blocco(doc, 3)
    _, tbl13 = trova_blocco(doc, 13)

    # --- 2. paragrafo titolo «Codice 14 — FRANÇAIS FACILE» (clona lo stile del Codice 3) ---
    p14 = deepcopy(p3)
    set_par_text(p14, "Codice 14 — FRANÇAIS FACILE")

    # --- 3. tabella segnaposto (clona la struttura dell'ultima tabella) ---
    tbl14 = deepcopy(tbl13)

    # --- 4. inserimento: T13 -> P14 -> T14 ---
    tbl13.addnext(p14)
    p14.addnext(tbl14)

    # --- 5. riga indice nuova in T0 ---
    indice = None
    for tbl in doc.tables:
        if tbl.rows[0].cells[0].text.strip().startswith("Post del blog"):
            indice = tbl
            break
    assert indice is not None, "tabella indice non trovata"
    tr_last = indice.rows[-1]._tr
    tr_new = deepcopy(tr_last)
    tr_last.addnext(tr_new)
    tcs = tr_new.findall(f"{W}tc")
    assert len(tcs) == 2, f"riga indice con {len(tcs)} celle (attese 2)"
    set_cell_text(tcs[0], "FRANCESE — Francese Facile")
    set_cell_text(tcs[1], "Codice 14")

    doc.save(a.out)

    # --- 6. verifica ricaricando ---
    d2 = Document(a.out)
    p14b, t14b = trova_blocco(d2, 14)
    titolo = "".join(t.text or "" for t in p14b.iter(f"{W}t")).strip()
    cell14 = d2.tables[14].rows[0].cells[0]
    print(f"salvato: {a.out}")
    print(f"titolo inserito: {titolo!r}")
    print(f"tabelle totali: {len(d2.tables)} (attese 15: T0 indice + T1..T14)")
    print(f"paragrafi cella T14 (segnaposto): {len(cell14.paragraphs)}")
    for tbl in d2.tables:
        if tbl.rows[0].cells[0].text.strip().startswith("Post del blog"):
            rows = [(r.cells[0].text.strip(), r.cells[1].text.strip()) for r in tbl.rows]
            print(f"indice: {len(rows)} righe; ultima: {rows[-1]!r}")
            assert rows[-1] == ("FRANCESE — Francese Facile", "Codice 14"), "riga indice errata"
            break
    assert titolo == "Codice 14 — FRANÇAIS FACILE"
    print("INSERIMENTO OK")


if __name__ == "__main__":
    main()
