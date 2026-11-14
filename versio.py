#!/usr/bin/env python3
"""KPL Keskus: versiotunnisteen nosto yhdellä komennolla (14.11.2026).

Selain pitää sivun tiedostoja välimuistissa (GitHub Pages max-age 10 min). Siksi jokaisessa
index.html:n, import mapin, app.js:n ja Pelikirja-linkkien osoitteessa on ?v=<versio>. Jos yksikin
jää vanhaksi, puhelin voi sekoittaa vanhaa ja uutta koodia ja jäädä "Ladataan…"-tilaan.

Käyttö (repon juuressa ennen committia):
    python3 versio.py            nostaa version: PPKKVV-N (sama päivä → N+1, uusi päivä → 1)
    python3 versio.py --tarkista tarkistaa, että kaikissa tiedostoissa on sama versio (exit 1, jos ei)
"""
import datetime
import pathlib
import re
import sys

JUURI = pathlib.Path(__file__).resolve().parent
KUVIO = re.compile(r"\?v=(\d{8}-\d+)")


def tiedostot():
    for p in [JUURI / "index.html", JUURI / "pelikirja.html", JUURI / "app.js", *sorted((JUURI / "js").rglob("*.js"))]:
        if p.exists():
            yield p


def versiot():
    loydetyt = {}
    for p in tiedostot():
        for v in KUVIO.findall(p.read_text(encoding="utf-8")):
            loydetyt.setdefault(v, []).append(p.relative_to(JUURI).as_posix())
    return loydetyt


def main():
    loydetyt = versiot()
    if not loydetyt:
        sys.exit("Versiotunnisteita ei löytynyt.")
    if "--tarkista" in sys.argv:
        if len(loydetyt) == 1:
            v, paikat = next(iter(loydetyt.items()))
            print(f"OK: versio {v} kaikissa ({len(paikat)} kohtaa)")
            return
        for v, paikat in sorted(loydetyt.items()):
            print(f"{v}: {len(paikat)} kohtaa, esim. {', '.join(sorted(set(paikat))[:4])}")
        sys.exit("VIRHE: tiedostoissa on eri versioita – aja python3 versio.py")

    nyt = max(loydetyt)  # uusin käytössä oleva
    tanaan = datetime.date.today().strftime("%Y%m%d")
    pv, n = nyt.split("-")
    uusi = f"{tanaan}-{int(n) + 1}" if pv == tanaan else f"{tanaan}-1"
    muutetut = 0
    for p in tiedostot():
        s = p.read_text(encoding="utf-8")
        t = KUVIO.sub(f"?v={uusi}", s)
        if t != s:
            p.write_text(t, encoding="utf-8")
            muutetut += len(KUVIO.findall(s))
    # Päivitä version.json kotinäytön cache-tarkistusta varten
    (JUURI / "version.json").write_text(f'{{"v":"{uusi}"}}', encoding="utf-8")
    print(f"Versio {nyt} → {uusi} ({muutetut} kohtaa)")


if __name__ == "__main__":
    main()
