// Valmentajien huone (28.11.2026): puhdas logiikka (testattavissa ilman selainta, ks. tests/huone.test.mjs).
// Alueet: psu = poikien/junioreiden valmennus, sp = miesten Superpesis, yhteinen = koko valmennus.
export const ALUEET = { sp: "MSU", psu: "PSU", yhteinen: "Yhteinen" };
export const alueNimi = (a) => ALUEET[a] || a;

// Alueet, joille käyttäjä saa kirjoittaa ja joita hän näkee. Ylläpitäjä näkee kaiken.
export function omatAlueet(jasen) {
  if (!jasen) return [];
  if (jasen.rooli === "admin") return ["sp", "psu", "yhteinen"];
  const a = (jasen.valmennusalue || []).filter((x) => x === "sp" || x === "psu");
  return a.length ? [...a, "yhteinen"] : [];
}

// Mitä käyttäjä näkee: alueen muistiot, omat yksityiset; ylläpitäjä myös muiden yksityiset.
export function nakyyko(m, jasen) {
  if (!jasen) return false;
  if (jasen.rooli === "admin") return true;
  if (!omatAlueet(jasen).includes(m.alue)) return false;
  return !m.yksityinen || m.kirjoittaja === jasen.email;
}

const pv = (d) => new Date(d + "T12:00:00");
// Tehtävän tila: tehty, myöhässä (määräpäivä ohi), tänään, pian (≤ 7 pv), myöhemmin, ei määräpäivää
export function tehtavanTila(t, tanaan) {
  if (t.tehty) return "tehty";
  if (!t.maarapaiva) return "avoin";
  const ero = Math.round((pv(t.maarapaiva) - pv(tanaan)) / 864e5);
  return ero < 0 ? "myohassa" : ero === 0 ? "tanaan" : ero <= 7 ? "pian" : "myohemmin";
}
const JARJ = { myohassa: 0, tanaan: 1, pian: 2, myohemmin: 3, avoin: 4, tehty: 5 };
// Avoimet ensin kiireellisyyden mukaan, sitten määräpäivä, tehdyt viimeisenä (uusin ensin)
export function jarjestaTehtavat(lista, tanaan) {
  return [...lista].sort((a, b) => {
    const ta = tehtavanTila(a, tanaan), tb = tehtavanTila(b, tanaan);
    if (ta !== tb) return JARJ[ta] - JARJ[tb];
    if (ta === "tehty") return (b.tehty_aika || "").localeCompare(a.tehty_aika || "");
    return (a.maarapaiva || "9999").localeCompare(b.maarapaiva || "9999") || (a.luotu || "").localeCompare(b.luotu || "");
  });
}

// Palaverin tehtävärivit tekstistä: "- Tehtävä @Etunimi 5.12." → { teksti, vastuuNimi, maarapaiva }
// (vuosi päätellään: jos päivä on jo mennyt tänä vuonna, seuraava vuosi)
export function lueTehtavarivi(rivi, tanaan) {
  let s = rivi.replace(/^\s*[-*•]\s*(\[\s?\]\s*)?/, "").trim();
  if (!s) return null;
  let maarapaiva = null, vastuuNimi = null;
  const p = s.match(/\s(\d{1,2})\.(\d{1,2})\.(\d{2,4})?\s*$/);
  if (p) {
    const [y0] = tanaan.split("-").map(Number);
    let y = p[3] ? (p[3].length === 2 ? 2000 + +p[3] : +p[3]) : y0;
    const iso = (yy) => `${yy}-${String(p[2]).padStart(2, "0")}-${String(p[1]).padStart(2, "0")}`;
    if (!p[3] && iso(y) < tanaan) y += 1;
    maarapaiva = iso(y);
    s = s.slice(0, p.index).trim();
  }
  const v = s.match(/\s@([\p{L}-]+(?:\s[\p{L}-]+)?)\s*$/u) || s.match(/\s@([\p{L}-]+)/u);
  if (v) { vastuuNimi = v[1]; s = (s.slice(0, v.index) + s.slice(v.index + v[0].length)).trim(); }
  return s ? { teksti: s, vastuuNimi, maarapaiva } : null;
}

// Etsi vastuuhenkilö nimestä (etunimi tai koko nimi, kirjainkoko ei väliä)
export function etsiJasen(nimi, jasenet) {
  if (!nimi) return null;
  const n = nimi.toLocaleLowerCase("fi");
  return jasenet.find((j) => (j.nimi || "").toLocaleLowerCase("fi") === n)
    || jasenet.find((j) => (j.nimi || "").toLocaleLowerCase("fi").split(" ")[0] === n) || null;
}
