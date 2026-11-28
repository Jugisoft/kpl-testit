// Kehittyneet (28.11.2026): puhtaat apufunktiot – ei DOM:ia eikä tietokantaa, testit tests/kehittyneet.test.mjs.
// Jokaisen pelaajan viimeisin testipäivä vs. edellinen testipäivä samassa testissä. Saman päivän useat
// testikerrat yhdistetään parhaaksi. ero > 0 = parani (pienempi parempi käännetty).

const kuukausia = (a, b) => {
  const [y1, m1, d1] = a.split("-").map(Number), [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30);
};

/** Viimeisin pvm riveistä (ISO), tai null. */
export function viimeisinPvm(rivit) {
  return rivit.reduce((m, x) => (m == null || x.pvm > m ? x.pvm : m), null);
}

/**
 * @param rivit [{ pelaaja, kerta, pvm, arvo }] yhden testin kerran parhaat
 * @param opts { pienempiParempi, alkaen } alkaen = ISO-pvm, vain pelaajat joiden viimeisin testi ≥ alkaen
 * @returns { lista, ilmanVertailua }
 */
export function kehittyneet(rivit, { pienempiParempi, alkaen = null } = {}) {
  const parempi = (a, b) => (pienempiParempi ? a < b : a > b);
  const pelaajat = new Map(); // pelaaja -> Map(pvm -> paras)
  for (const x of rivit) {
    if (x.arvo == null || Number.isNaN(x.arvo)) continue;
    const p = pelaajat.get(x.pelaaja) || pelaajat.set(x.pelaaja, new Map()).get(x.pelaaja);
    const v = p.get(x.pvm);
    if (v == null || parempi(x.arvo, v)) p.set(x.pvm, x.arvo);
  }
  const lista = [], ilmanVertailua = [];
  for (const [pelaaja, paivat] of pelaajat) {
    const pv = [...paivat.keys()].sort();
    const uusiPvm = pv.at(-1), uusi = paivat.get(uusiPvm);
    if (alkaen && uusiPvm < alkaen) continue;
    if (pv.length < 2) { ilmanVertailua.push({ pelaaja, uusi, uusiPvm }); continue; }
    const vanhaPvm = pv.at(-2), vanha = paivat.get(vanhaPvm);
    const ero = pienempiParempi ? vanha - uusi : uusi - vanha;
    const kk = kuukausia(vanhaPvm, uusiPvm);
    lista.push({ pelaaja, uusi, uusiPvm, vanha, vanhaPvm, ero, pct: vanha ? (ero / Math.abs(vanha)) * 100 : null, kk, vanhaVertailu: kk > 12 });
  }
  lista.sort((a, b) => b.ero - a.ero || (b.pct ?? 0) - (a.pct ?? 0));
  return { lista, ilmanVertailua };
}
