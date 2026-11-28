// Kokonaisvertailu (28.11.2026, Jugi): pelaajan kaikki testit T-pisteinä valittuun vertailuryhmään.
// Puhdas logiikka, testit tests/kokonais.test.mjs. Syöte: testiParhaat()-rivit {pelaaja, testi, arvo, pvm}.
// T = 50 + 10·z; pienempi parempi -testeissä suunta käännetään, joten isompi T on aina parempi.

export const OMINAISUUDET = ["Pikanopeus", "Nopeuskestävyys", "Ketteryys", "Kestävyys", "Heittovoima", "Lyöntivoima", "Räjähtävä voima", "Maksimivoima", "Lihaskestävyys", "Lyöntitaito"];
export const MIN_N = 3, PIENI_N = 8, TOP_N = 3;

const pvToDate = (s) => new Date(s + "T12:00:00");
export function kuukausiaSitten(pvm, tanaan) { return (pvToDate(tanaan) - pvToDate(pvm)) / (30.44 * 864e5); }

// Pelaajan tulos testeittäin: tapa "viimeisin" (uusin kerta) tai "paras". suodatin(r) rajaa rivit (esim. aikaikkuna tai kausi).
export function pelaajanTulokset(rivit, pid, testit, tapa, suodatin = () => true) {
  const out = new Map();
  for (const r of rivit) {
    if (r.pelaaja !== pid || !testit[r.testi] || testit[r.testi].johdettu || !suodatin(r)) continue;
    const ed = out.get(r.testi), pp = testit[r.testi].pienempi_parempi;
    const parempi = !ed || (tapa === "paras" ? (pp ? r.arvo < ed.arvo : r.arvo > ed.arvo) || (r.arvo === ed.arvo && r.pvm > ed.pvm) : r.pvm > ed.pvm || (r.pvm === ed.pvm && (pp ? r.arvo < ed.arvo : r.arvo > ed.arvo)));
    if (parempi) out.set(r.testi, { arvo: r.arvo, pvm: r.pvm });
  }
  return out;
}

export function normi(arvot) {
  const n = arvot.length;
  if (n < MIN_N) return null;
  const ka = arvot.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(arvot.reduce((s, x) => s + (x - ka) ** 2, 0) / (n - 1));
  return sd > 0 ? { ka, sd, n, pieni: n < PIENI_N } : null;
}

export function tPiste(arvo, nrm, pienempiParempi) {
  if (arvo == null || !nrm) return null;
  const z = (arvo - nrm.ka) / nrm.sd;
  return 50 + 10 * (pienempiParempi ? -z : z);
}

// Ryhmän normit: jokaiselta ryhmän pelaajalta yksi tulos/testi (sama tapa). Lisäksi karkikolmikon keskiarvo (ryhmän paras).
export function ryhmanNormit(rivit, pelaajaIdt, testit, tapa, suodatin) {
  const arvot = new Map();
  for (const pid of pelaajaIdt) for (const [t, v] of pelaajanTulokset(rivit, pid, testit, tapa, suodatin)) (arvot.get(t) || arvot.set(t, []).get(t)).push(v.arvo);
  const out = new Map();
  for (const [t, a] of arvot) {
    const n = normi(a);
    if (!n) continue;
    const jarj = [...a].sort((x, y) => (testit[t].pienempi_parempi ? x - y : y - x)).slice(0, TOP_N);
    out.set(t, { ...n, karki: jarj.reduce((s, x) => s + x, 0) / jarj.length });
  }
  return out;
}

// Profiili: testien T-pisteet, ominaisuuksien keskiarvot ja kokonaisindeksi (ominaisuuksien ka, jokainen ominaisuus painaa saman verran)
export function profiili(tulokset, normit, testit) {
  const rivit = [];
  for (const [t, v] of tulokset) {
    const nrm = normit.get(t);
    rivit.push({ testi: t, arvo: v.arvo, pvm: v.pvm, T: tPiste(v.arvo, nrm, testit[t].pienempi_parempi), normi: nrm || null, ominaisuus: testit[t].alaluokka });
  }
  const om = OMINAISUUDET.map((nimi) => {
    const T = rivit.filter((r) => r.ominaisuus === nimi && r.T != null).map((r) => r.T);
    return { nimi, T: T.length ? T.reduce((a, b) => a + b, 0) / T.length : null, n: T.length };
  });
  const mukana = om.filter((o) => o.T != null);
  return { testit: rivit, ominaisuudet: om, indeksi: mukana.length ? mukana.reduce((a, o) => a + o.T, 0) / mukana.length : null };
}

// Vahvin ja heikoin ominaisuus (vähintään kaksi mukana)
export function aariarvot(prof) {
  const m = prof.ominaisuudet.filter((o) => o.T != null).sort((a, b) => b.T - a.T);
  return m.length >= 2 ? { vahvin: m[0], heikoin: m.at(-1) } : null;
}

export const rajaa = (T) => (T == null ? null : Math.max(20, Math.min(80, T)));
