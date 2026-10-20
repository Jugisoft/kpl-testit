// Juoksutestit (20.10.2026): 30 m (10 m lähtö, lentävä 20 m), nopeuskestävyys 9×30 m ja Cooper.
// Ryhmänäkymä #/juoksu/<testi>/<ryhmä> ja pelaajan juoksuprofiili #/juoksu/pelaaja/<id>.
// Vertailut: oma kehitys, oma ryhmä (juniorit / Superpesis), ikäluokka (juniorit) ja kaikki testatut.
// Vertailuvaraston pohja: pelaajan kauden paras tulos (kausi heinäkuu–kesäkuu) samoilla kengillä.
import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, pvm, pvmLyhyt, kausi, mediaani, keskiarvo, piirra, vari, kuva } from "../util.js";

const KIERROS = 261; // Cooperin kierros metreinä
const M = {
  t30: { nimi: "30 m", pitka: "30 m aika", yks: "s", pp: true, d: 2 },
  t10: { nimi: "10 m", pitka: "10 m lähtö", yks: "s", pp: true, d: 2 },
  l20: { nimi: "Lentävä 20 m", pitka: "Lentävä 20 m", yks: "s", pp: true, d: 2 },
  ka: { nimi: "Keskiarvo", pitka: "Keskiarvo 9 × 30 m", yks: "s", pp: true, d: 2 },
  paras: { nimi: "Paras juoksu", pitka: "Paras 30 m juoksu", yks: "s", pp: true, d: 2 },
  sdec: { nimi: "Pudotus", pitka: "Nopeuden pudotus", yks: "%", pp: true, d: 1 },
  m: { nimi: "Matka", pitka: "Cooper, matka", yks: "m", pp: false, d: 0 },
};
const TESTIT = [
  { k: "30m", nimi: "30 m pikajuoksu", ala: "10 m lähtö · lentävä 20 m · 30 m", paa: "t30", mitat: ["t30", "t10", "l20"], kengat: true,
    kuvaus: "Kennomittaus paikaltaan. Paras yritys. Lentävä 20 m = 30 m − 10 m samasta juoksusta; huippunopeus = 20 m ÷ lentävä aika." },
  { k: "nok", nimi: "Nopeuskestävyys", ala: "9 × 30 m · 3 sarjaa", paa: "ka", mitat: ["ka", "paras", "sdec"], kengat: true,
    kuvaus: "3 sarjaa × 3 × 30 m täysillä. Palautus 30 s juoksujen välillä ja 2 min sarjojen välillä. Pudotus % = kuinka paljon keskiarvo on hitaampi kuin paras juoksu." },
  { k: "cooper", nimi: "Cooper", ala: "12 min juoksu", paa: "m", mitat: ["m"], kengat: false,
    kuvaus: `12 minuutin juoksu. Kierros ${KIERROS} m. Hapenottokyvyn arvio = (matka − 504,9) ÷ 44,73 ml/kg/min.` },
];
const TESTI = Object.fromEntries(TESTIT.map((t) => [t.k, t]));
const RYHMAT = [["juniorit", "Juniorit"], ["superpesis", "Superpesis"], ["kaikki", "Kaikki testatut"]];
const KENKA = { "": "Tossut", piikit: "Piikit" };
const LAJIVARIT = ["#7DD3FC", "#2EE59D", "#A78BFA", "#F472B6", "#FFC93C", "#94A3B8", "#FB923C", "#5EEAD4"];

let S = { testi: "30m", ryhma: "juniorit", kengat: {}, valinta: {}, ikaluokka: "", korostus: new Set() };
let D = null;
let piirtajat = []; // uudelleenpiirto ikkunan koon muuttuessa
let kokoAjastin = null;
const koonMuutos = () => { clearTimeout(kokoAjastin); kokoAjastin = setTimeout(() => piirtajat.forEach((f) => f()), 150); };

export function poistu() { window.removeEventListener("resize", koonMuutos); piirtajat = []; }

// ---------- apurit
const f = (v, d = 2) => (v == null || Number.isNaN(v) ? "–" : Number(v).toFixed(d).replace(".", ",").replace("-", "−"));
const fm = (m, v) => f(v, M[m].d);
const muutosTxt = (m, ero) => (ero == null ? "" : Math.abs(ero) < 1e-9 ? "±0" : (ero > 0 ? "+" : "−") + f(Math.abs(ero), M[m].d));
const parannus = (m, uusi, vanha) => (uusi == null || vanha == null ? null : M[m].pp ? vanha - uusi : uusi - vanha);
const parasArvo = (m, a) => { const v = a.filter((x) => x != null); return v.length ? (M[m].pp ? Math.min(...v) : Math.max(...v)) : null; };
const kevat = (ka) => +ka.slice(0, 4) + 1;
const synt = (pid) => tila.pelaaja[pid]?.syntymavuosi || null;
const ika = (pid, ka) => (synt(pid) ? kevat(ka) - synt(pid) : null);
const lyhytNimi = (p) => `${p.etunimi} ${(p.sukunimi || "")[0] || ""}.`.trim();
const kvart = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const huippu = (l20) => (l20 ? (20 / l20) * 3.6 : null);
const kierrokset = (m) => `${Math.floor(m / KIERROS)} kierr. + ${Math.round(m - Math.floor(m / KIERROS) * KIERROS)} m`;
const vo2 = (m) => (m - 504.9) / 44.73;
const yAks = (m, extra = {}) => ({ reverse: M[m].pp, ticks: { callback: (v) => f(v, M[m].d === 0 ? 0 : M[m].d) }, ...extra });
const kaistaNimi = (v) => (v && v >= 2007 ? String(v) : "Muut");

function ryhmaOf(pid) { return D.sp.has(tila.pelaaja[pid]?.joukkue_id) ? "superpesis" : "juniorit"; }
const kuuluu = (pid, ryhma) => ryhma === "kaikki" || ryhmaOf(pid) === ryhma;

// ---------- data: suoritukset (testikerta × pelaaja × kengät)
function valmistele(rivit) {
  const sp = new Set(tila.joukkueet.filter((j) => /superpesis/i.test(j.nimi)).map((j) => j.id));
  const by = new Map();
  for (const r of rivit) {
    if (!r.hyvaksytty) continue;
    const fam = r.testi === "10m" || r.testi === "30m" ? "30m" : r.testi === "nok_30m" ? "nok" : r.testi === "cooper" ? "cooper" : null;
    if (!fam) continue;
    const k = tila.kerta[r.testikerta_id];
    if (!k || !tila.pelaaja[r.pelaaja_id]) continue;
    const tark = fam === "cooper" ? "" : r.tarkenne || "";
    const key = `${fam}|${r.testikerta_id}|${r.pelaaja_id}|${tark}`;
    let o = by.get(key);
    if (!o) by.set(key, (o = { fam, kerta: r.testikerta_id, pvm: k.pvm, pelaaja: r.pelaaja_id, tark, a: {}, b: {} }));
    if (r.testi === "10m") o.a[r.yritys] = r.arvo; else o.b[r.yritys] = r.arvo;
  }
  const out = { "30m": [], nok: [], cooper: [] };
  for (const o of by.values()) {
    const s = { kerta: o.kerta, pvm: o.pvm, pelaaja: o.pelaaja, tark: o.tark, kausi: kausi(o.pvm) };
    if (o.fam === "30m") {
      const v30 = Object.values(o.b), v10 = Object.values(o.a);
      s.t30 = v30.length ? Math.min(...v30) : null;
      s.t10 = v10.length ? Math.min(...v10) : null;
      const l = Object.keys(o.b).filter((y) => o.a[y] != null).map((y) => Math.round((o.b[y] - o.a[y]) * 100) / 100).filter((x) => x > 1.5 && x < 4.5);
      s.l20 = l.length ? Math.min(...l) : null;
      s.yrit = Math.max(v30.length, v10.length);
      if (s.t30 == null && s.t10 == null) continue;
    } else if (o.fam === "nok") {
      const ajat = Array.from({ length: 9 }, (_, i) => o.b[i + 1] ?? null);
      const v = ajat.filter((x) => x != null);
      if (!v.length) continue;
      s.ajat = ajat; s.n = v.length; s.paras = Math.min(...v);
      s.ka = v.length >= 9 ? keskiarvo(v) : null; // keskiarvo vain täydestä sarjasta
      s.kaOsa = keskiarvo(v);
      s.sdec = v.length >= 9 ? (keskiarvo(v) / s.paras - 1) * 100 : null;
      s.sarjat = [0, 1, 2].map((i) => keskiarvo(ajat.slice(i * 3, i * 3 + 3).filter((x) => x != null)));
    } else {
      s.m = Math.max(...Object.values(o.b));
    }
    out[o.fam].push(s);
  }
  Object.values(out).forEach((a) => a.sort((x, y) => x.pvm.localeCompare(y.pvm)));
  return { ...out, sp };
}

// pelaajan kauden paras tulos (mittari m) -> Map pelaaja -> suoritus
function kausiParhaat(fam, m, ka, tark, ryhma = "kaikki") {
  const out = new Map();
  for (const s of D[fam]) {
    if (s.kausi !== ka || s[m] == null || (tark != null && s.tark !== tark) || !kuuluu(s.pelaaja, ryhma)) continue;
    const o = out.get(s.pelaaja);
    if (!o || parannus(m, s[m], o[m]) > 0) out.set(s.pelaaja, s);
  }
  return out;
}
function sijoitus(m, arvo, arvot) {
  if (arvo == null || !arvot.length) return null;
  const pp = M[m].pp, e = 1e-9;
  const parempia = arvot.filter((x) => (pp ? x < arvo - e : x > arvo + e)).length;
  const huonompia = arvot.filter((x) => (pp ? x > arvo + e : x < arvo - e)).length;
  return { sija: parempia + 1, n: arvot.length, pct: arvot.length > 1 ? Math.round((huonompia / (arvot.length - 1)) * 100) : 100 };
}
// edellinen tulos ja ennätys ennen annettua suoritusta
function historia(fam, s, m) {
  const aiemmat = D[fam].filter((x) => x.pelaaja === s.pelaaja && x.tark === s.tark && x.pvm < s.pvm && x[m] != null);
  return { ed: aiemmat.at(-1) || null, pb: parasArvo(m, aiemmat.map((x) => x[m])) };
}
const pctLuokka = (p) => (p == null ? "" : p >= 67 ? "hyva" : p >= 34 ? "keski" : "heikko");

// ---------- näkymä
export async function nayta(main, a, b) {
  window.removeEventListener("resize", koonMuutos);
  window.addEventListener("resize", koonMuutos);
  piirtajat = [];
  const kaikki = await lataaTulokset();
  D = valmistele(kaikki);
  if (a === "pelaaja") return naytaPelaaja(main, b);
  if (TESTI[a]) S.testi = a;
  if (RYHMAT.some(([k]) => k === b)) S.ryhma = b;
  naytaRyhma(main);
}

function osoite() { history.replaceState(null, "", `#/juoksu/${S.testi}/${S.ryhma}`); }

function naytaRyhma(main) {
  main.innerHTML = `
    <div class="jtt-paa">
      <div><span class="jtt-yla">Testit · nopeus ja kestävyys</span><h1>Juoksutestit</h1>
        <p class="ingressi">Kehitys, ikäluokat ja vertailu miehiin samassa paikassa. Valitse testi ja ryhmä; klikkaa pelaajan sijaa korostaaksesi hänet kaavioissa.</p></div>
      <div class="rivi"><a class="btn" href="#/juoksu/pelaaja">Pelaajan juoksuprofiili</a><a class="btn ensisij" href="#/kerrat">Syötä tuloksia</a></div>
    </div>
    <div class="jtt-testit" role="tablist" aria-label="Testi" id="jtt-testit"></div>
    <div class="jtt-ohjaimet" id="jtt-ohjaimet"></div>
    <div id="jtt-runko"></div>`;
  piirraTestikortit();
  piirraOhjaimet();
}

function piirraTestikortit() {
  const ryhma = S.ryhma;
  $("#jtt-testit").innerHTML = TESTIT.map((T) => {
    const rr = D[T.k].filter((s) => kuuluu(s.pelaaja, ryhma) && s[T.paa] != null);
    const tark = T.kengat ? oletusKenka(T.k) : "";
    const kaudet = [...new Set(rr.filter((s) => s.tark === tark).map((s) => s.kausi))].sort();
    const sarja = kaudet.map((ka) => mediaani([...kausiParhaat(T.k, T.paa, ka, tark, ryhma).values()].map((s) => s[T.paa])));
    const viim = kaudet.at(-1);
    const n = viim ? kausiParhaat(T.k, T.paa, viim, tark, ryhma).size : 0;
    return `<button class="jtt-testikortti" role="tab" data-testi="${T.k}" aria-selected="${T.k === S.testi}">
      <span class="jtt-tk-nimi">${esc(T.nimi)}</span><span class="jtt-tk-ala">${esc(T.ala)}</span>
      ${viim ? `<span class="jtt-tk-arvo">${fm(T.paa, sarja.at(-1))}<small>${M[T.paa].yks}</small></span>
        <span class="jtt-tk-ala">mediaani · kausi ${viim} · ${n} pelaajaa${T.kengat && tark ? " · piikit" : ""}</span>${kipina(sarja, M[T.paa].pp)}`
        : `<span class="jtt-tk-tyhja">Ei vielä tuloksia${ryhma === "superpesis" ? " Superpesis-ryhmältä" : ""}</span>`}
    </button>`;
  }).join("");
  $$("[data-testi]").forEach((b) => (b.onclick = () => { S.testi = b.dataset.testi; S.korostus.clear(); piirraTestikortit(); piirraOhjaimet(); }));
}

// pieni kehityskäyrä (kausimediaanit), ylös = parempi
function kipina(arvot, pp) {
  const v = arvot.filter((x) => x != null);
  if (v.length < 2) return "";
  const min = Math.min(...v), max = Math.max(...v), w = 120, h = 30, vali = max - min || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 6) + 3, pp ? 3 + ((x - min) / vali) * (h - 6) : h - 3 - ((x - min) / vali) * (h - 6)]);
  return `<svg class="jtt-kipina" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 3.5 : 2}" fill="${i === pts.length - 1 ? "var(--cyan)" : "var(--ink-3)"}"/>`).join("")}</svg>`;
}

function oletusKenka(fam) {
  if (S.kengat[fam] != null) return S.kengat[fam];
  const rr = D[fam].filter((s) => kuuluu(s.pelaaja, S.ryhma));
  return rr.at(-1)?.tark ?? "";
}

function vaihtoehdot(fam, tark) {
  const rr = D[fam].filter((s) => kuuluu(s.pelaaja, S.ryhma) && s.tark === tark && s[TESTI[fam].paa] != null);
  const kerrat = [...new Set(rr.map((s) => s.kerta))].map((id) => tila.kerta[id]).sort((a, b) => b.pvm.localeCompare(a.pvm));
  const kaudet = [...new Set(rr.map((s) => s.kausi))].sort().reverse();
  return { kerrat, kaudet };
}

function piirraOhjaimet() {
  osoite();
  const T = TESTI[S.testi], fam = T.k;
  const kengat = T.kengat ? [...new Set(D[fam].filter((s) => kuuluu(s.pelaaja, S.ryhma)).map((s) => s.tark))].sort() : [];
  let tark = T.kengat ? oletusKenka(fam) : "";
  if (T.kengat && kengat.length && !kengat.includes(tark)) tark = kengat.at(-1);
  const { kerrat, kaudet } = vaihtoehdot(fam, tark);
  let val = S.valinta[fam + S.ryhma + tark];
  const ok = (v) => v && ((v.startsWith("k:") && kerrat.some((k) => "k:" + k.id === v)) || (v.startsWith("s:") && kaudet.includes(v.slice(2))));
  if (!ok(val)) val = S.ryhma === "kaikki" ? (kaudet[0] ? "s:" + kaudet[0] : null) : kerrat[0] ? "k:" + kerrat[0].id : null;
  const nykyKausi = val?.startsWith("k:") ? kausi(tila.kerta[val.slice(2)].pvm) : val?.slice(2);
  const ikaluokat = S.ryhma === "superpesis" ? [] : [...new Set(D[fam].filter((s) => s.kausi === nykyKausi && s.tark === tark && ryhmaOf(s.pelaaja) === "juniorit").map((s) => kaistaNimi(synt(s.pelaaja))))].sort();
  if (S.ikaluokka && !ikaluokat.includes(S.ikaluokka)) S.ikaluokka = "";

  $("#jtt-ohjaimet").innerHTML = `
    <div class="jtt-segmentti" role="radiogroup" aria-label="Ryhmä">${RYHMAT.map(([k, n]) => `<button role="radio" data-ryhma="${k}" aria-checked="${k === S.ryhma}">${n}</button>`).join("")}</div>
    ${val ? `<label class="jtt-valinta"><span>Tarkastelu</span><select id="jtt-val">
      ${kerrat.length ? `<optgroup label="Testikerta">${kerrat.map((k) => `<option value="k:${k.id}"${"k:" + k.id === val ? " selected" : ""}>${pvm(k.pvm)} · ${esc(k.nimi || "")}</option>`).join("")}</optgroup>` : ""}
      <optgroup label="Kauden paras">${kaudet.map((ka) => `<option value="s:${ka}"${"s:" + ka === val ? " selected" : ""}>Kausi ${ka}, paras tulos</option>`).join("")}</optgroup>
    </select></label>` : ""}
    ${kengat.length > 1 ? `<div class="jtt-chipit" role="radiogroup" aria-label="Kengät">${kengat.map((k) => `<button class="chip" role="radio" data-kenka="${k}" aria-checked="${k === tark}" aria-pressed="${k === tark}">${KENKA[k] ?? k}</button>`).join("")}</div>` : kengat.length === 1 && T.kengat ? `<span class="merkki harmaa">${KENKA[kengat[0]] ?? kengat[0]}</span>` : ""}
    ${ikaluokat.length > 1 ? `<div class="jtt-chipit" role="radiogroup" aria-label="Ikäluokka"><button class="chip" data-ika="" aria-pressed="${!S.ikaluokka}">Kaikki</button>${ikaluokat.map((v) => `<button class="chip" data-ika="${v}" aria-pressed="${v === S.ikaluokka}">${v === "Muut" ? "Muut" : v}</button>`).join("")}</div>` : ""}`;

  $$("[data-ryhma]").forEach((b) => (b.onclick = () => { S.ryhma = b.dataset.ryhma; S.korostus.clear(); piirraTestikortit(); piirraOhjaimet(); }));
  $("#jtt-val") && ($("#jtt-val").onchange = (e) => { S.valinta[fam + S.ryhma + tark] = e.target.value; piirraOhjaimet(); });
  $$("[data-kenka]").forEach((b) => (b.onclick = () => { S.kengat[fam] = b.dataset.kenka; piirraTestikortit(); piirraOhjaimet(); }));
  $$("[data-ika]").forEach((b) => (b.onclick = () => { S.ikaluokka = b.dataset.ika; piirraOhjaimet(); }));
  piirraRunko(fam, tark, val, nykyKausi);
}

function tyhjaTila(fam) {
  const sp = S.ryhma === "superpesis";
  return `<div class="paneeli jtt-tyhja"><h2>${sp ? "Superpesis-ryhmän juoksutestit puuttuvat vielä" : "Ei tuloksia"}</h2>
    <p class="pieni">${sp ? `Kun miesten ${{ "30m": "30 m juoksut", nok: "nopeuskestävyystestit", cooper: "Cooper-tulokset" }[fam]} on syötetty testikerralle, tulokset, kehitys ja vertailu junioreihin näkyvät tässä automaattisesti.` : "Valitulla ryhmällä ei ole tämän testin tuloksia."}</p>
    <div class="rivi"><a class="btn ensisij" href="#/kerrat">Luo testikerta</a>${sp ? `<button class="btn" data-ryhma2="kaikki">Näytä kaikki testatut</button>` : ""}</div></div>`;
}

// ---------- runko: KPI, tulostaulu, kaikki samalla janalla, testikohtainen analyysi, kehitys
function piirraRunko(fam, tark, val, nykyKausi) {
  const el = $("#jtt-runko");
  piirtajat = [];
  const T = TESTI[fam], m = T.paa;
  if (!val) { el.innerHTML = tyhjaTila(fam); $("[data-ryhma2]")?.addEventListener("click", () => { S.ryhma = "kaikki"; piirraTestikortit(); piirraOhjaimet(); }); return; }
  const onKerta = val.startsWith("k:");
  let lista = onKerta ? D[fam].filter((s) => s.kerta === val.slice(2) && s.tark === tark && kuuluu(s.pelaaja, S.ryhma))
    : [...kausiParhaat(fam, m, nykyKausi, tark, S.ryhma).values()];
  if (onKerta) lista = lista.filter((s) => s[m] != null || fam === "nok");
  if (S.ikaluokka) lista = lista.filter((s) => ryhmaOf(s.pelaaja) === "juniorit" && kaistaNimi(synt(s.pelaaja)) === S.ikaluokka);

  // vertailuvarastot: kauden parhaat
  const kpJun = kausiParhaat(fam, m, nykyKausi, tark, "juniorit");
  const kpKaikki = kausiParhaat(fam, m, nykyKausi, tark, "kaikki");
  const ikaArvot = (v) => [...kpJun.values()].filter((s) => kaistaNimi(synt(s.pelaaja)) === kaistaNimi(v)).map((s) => s[m]);

  const rivit = lista.map((s) => {
    const h = historia(fam, s, m);
    const v = s[m];
    const sy = synt(s.pelaaja), jun = ryhmaOf(s.pelaaja) === "juniorit";
    const kpArvo = kpKaikki.get(s.pelaaja)?.[m] ?? v;
    return { s, v, ed: h.ed, pb: h.pb, uusiPb: v != null && h.pb != null && parannus(m, v, h.pb) > 0, ero: h.ed && v != null ? v - h.ed[m] : null,
      ikaS: jun && sy ? sijoitus(m, kpArvo, ikaArvot(sy)) : null, kaikkiS: sijoitus(m, kpArvo, [...kpKaikki.values()].map((x) => x[m])) };
  }).sort((a, b) => (a.v == null) - (b.v == null) || (M[m].pp ? a.v - b.v : b.v - a.v));
  const arvot = rivit.map((r) => r.v).filter((x) => x != null);
  rivit.forEach((r) => (r.sija = r.v == null ? null : sijoitus(m, r.v, arvot)));

  if (!rivit.length) { el.innerHTML = tyhjaTila(fam); return; }
  const md = mediaani(arvot);
  const paras = rivit.find((r) => r.v != null);
  const vrt = rivit.filter((r) => r.ero != null);
  const parani = vrt.filter((r) => parannus(m, r.v, r.ed[m]) > 0).length;
  const mdMuutos = mediaani(vrt.map((r) => parannus(m, r.v, r.ed[m])));
  const otsikko = onKerta ? `${pvm(tila.kerta[val.slice(2)].pvm)} · ${esc(tila.kerta[val.slice(2)].nimi || "")}` : `Kausi ${nykyKausi} · pelaajan paras tulos`;

  el.innerHTML = `
    <p class="jtt-kuvaus">${esc(T.kuvaus)}</p>
    <div class="jtt-kpit">
      <div class="jtt-kpi"><span class="jtt-kpi-ots">Mediaani · ${esc(M[m].pitka)}</span><span class="jtt-kpi-arvo">${fm(m, md)}<small>${M[m].yks}</small></span><span class="jtt-kpi-ala">${rivit.length} pelaajaa${tark ? " · piikit" : ""}</span></div>
      <div class="jtt-kpi"><span class="jtt-kpi-ots">Paras</span><span class="jtt-kpi-arvo">${fm(m, paras.v)}<small>${M[m].yks}</small></span><span class="jtt-kpi-ala">${esc(nimi(tila.pelaaja[paras.s.pelaaja]))}</span></div>
      ${fam === "30m" ? `<div class="jtt-kpi"><span class="jtt-kpi-ots">Kovin huippunopeus</span><span class="jtt-kpi-arvo">${f(Math.max(0, ...rivit.map((r) => huippu(r.s.l20) || 0)), 1)}<small>km/h</small></span><span class="jtt-kpi-ala">lentävästä 20 metristä</span></div>` : ""}
      ${fam === "nok" ? `<div class="jtt-kpi"><span class="jtt-kpi-ots">Pudotuksen mediaani</span><span class="jtt-kpi-arvo">${f(mediaani(rivit.map((r) => r.s.sdec).filter((x) => x != null)), 1)}<small>%</small></span><span class="jtt-kpi-ala">keskiarvo vs. paras juoksu</span></div>` : ""}
      ${fam === "cooper" ? `<div class="jtt-kpi"><span class="jtt-kpi-ots">Hapenotto, arvio</span><span class="jtt-kpi-arvo">${f(vo2(md), 1)}<small>ml/kg/min</small></span><span class="jtt-kpi-ala">mediaanimatkasta</span></div>` : ""}
      <div class="jtt-kpi"><span class="jtt-kpi-ots">Kehitys edellisestä</span><span class="jtt-kpi-arvo">${vrt.length ? `${parani}<small>/ ${vrt.length}</small>` : "–"}</span><span class="jtt-kpi-ala">${vrt.length ? `paransi · mediaani ${muutosTxt(m, M[m].pp ? -mdMuutos : mdMuutos)} ${M[m].yks}` : "ei aiempia tuloksia"}</span></div>
    </div>

    <section class="jtt-osio"><div class="jtt-osio-paa"><h2>Tulostaulu</h2><span class="pieni">${otsikko}</span></div>
      <div class="jtt-selite"><span><i class="jtt-pallo"></i>tulos</span><span><i class="jtt-pallo haamu"></i>edellinen tulos</span><span><i class="jtt-mdviiva"></i>mediaani</span><span>oikealla = parempi</span>${fam === "nok" ? `<span><i class="jtt-lampo-selite"></i>juoksut 1–9: väri kertoo hidastumisen omasta parhaasta</span>` : ""}</div>
      <div class="jtt-taulu jtt-taulu-${fam}" id="jtt-taulu" role="table" aria-label="Tulostaulu"></div></section>

    <section class="jtt-osio"><div class="jtt-osio-paa"><h2>Kaikki samalla janalla</h2><span class="pieni">Kausi ${nykyKausi} · jokaisen pelaajan kauden paras${tark ? " (piikit)" : ""}</span></div>
      <p class="pieni">Ikäluokat ja Superpesis-pelaajat rinnakkain. Pystyviiva on kaistan mediaani, katkoviiva kaikkien mediaani. Korostetut pelaajat näkyvät nimellä.</p>
      <div class="paneeli jtt-svg" id="jtt-jana"></div></section>

    ${fam === "30m" ? `<section class="jtt-osio"><div class="jtt-osio-paa"><h2>Lähtö vai huippunopeus?</h2><span class="pieni">${otsikko}</span></div>
      <p class="pieni">Vaaka-akseli 10 m lähtö, pystyakseli lentävä 20 m. Viivat ovat näytettävien pelaajien mediaanit: oikea yläkulma on vahva molemmissa.</p>
      <div class="paneeli jtt-svg" id="jtt-hajonta"></div></section>` : ""}
    ${fam === "nok" ? `<section class="jtt-osio"><div class="jtt-osio-paa"><h2>Juoksuprofiili 1–9</h2><span class="pieni">${otsikko}</span></div>
      <p class="pieni">Mediaani ja keskimmäinen puolikas juoksuittain. Korosta pelaajia tulostaulusta nähdäksesi heidän käyränsä.</p>
      <div class="paneeli"><div class="kaavio"><canvas id="jtt-profiili"></canvas></div></div></section>` : ""}

    <section class="jtt-osio"><div class="jtt-osio-paa"><h2>Kehitys kausittain</h2><span class="pieni">${esc(M[m].pitka)} · mediaani kauden parhaista<span id="jtt-kehitys-kengat"></span></span></div>
      <p class="pieni">Juniorien ikäluokat ja Superpesis-ryhmä. ${M[m].pp ? "Ylempänä on parempi." : ""} Mukana kaudet, joilla ryhmässä vähintään kolme pelaajaa.</p>
      <div class="paneeli"><div class="kaavio"><canvas id="jtt-kehitys"></canvas></div></div></section>`;

  const piirraKaikki = () => {
    piirraTaulu(fam, m, rivit, md);
    piirraJana(fam, m, nykyKausi, tark);
    if (fam === "30m") piirraHajonta(rivit);
    if (fam === "nok") piirraProfiili(rivit);
  };
  piirraKaikki();
  piirraKehitys(fam, m, tark);
  piirtajat.push(() => { piirraJana(fam, m, nykyKausi, tark); if (fam === "30m") piirraHajonta(rivit); });
  el._korostus = piirraKaikki;
}

function vaihdaKorostus(pid) {
  S.korostus.has(pid) ? S.korostus.delete(pid) : S.korostus.add(pid);
  $("#jtt-runko")._korostus?.();
}

// ---------- tulostaulu
function piirraTaulu(fam, m, rivit, md) {
  const kaikkiArvot = rivit.flatMap((r) => [r.v, r.ed?.[m]]).filter((x) => x != null);
  let lo = Math.min(...kaikkiArvot), hi = Math.max(...kaikkiArvot);
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.02 || 1; lo -= pad; hi += pad;
  const pos = (v) => (M[m].pp ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo)) * 100;
  const sarakkeet = { "30m": ["10 m", "Lentävä 20", "Huippu"], nok: ["Juoksut 1–9", "Paras", "Pudotus"], cooper: ["Kierrokset", "VO₂ arvio"] }[fam];
  $("#jtt-taulu").innerHTML = `
    <div class="jtt-r jtt-ots" role="row"><span role="columnheader">#</span><span role="columnheader">Pelaaja</span><span role="columnheader" class="jtt-rata-ots">${esc(M[m].pitka)}</span><span role="columnheader" class="n">Tulos</span><span role="columnheader" class="n">Muutos</span>
      ${sarakkeet.map((s) => `<span role="columnheader" class="n jtt-lisa">${s}</span>`).join("")}<span role="columnheader" class="n jtt-lisa2">Ikäluokassa</span></div>
    ${rivit.map((r) => {
      const p = tila.pelaaja[r.s.pelaaja], kor = S.korostus.has(p.id), sy = synt(p.id);
      const plus = r.ero != null && parannus(m, r.v, r.ed[m]) > 0, miinus = r.ero != null && parannus(m, r.v, r.ed[m]) < 0;
      const lisat = fam === "30m" ? [`${fm("t10", r.s.t10)}`, `${fm("l20", r.s.l20)}`, r.s.l20 ? `${f(huippu(r.s.l20), 1)}<small> km/h</small>` : "–"]
        : fam === "nok" ? [lampo(r.s), fm("paras", r.s.paras), r.s.sdec != null ? `${f(r.s.sdec, 1)}<small> %</small>` : `<span class="pieni" title="Kaikkia yhdeksää juoksua ei ole kirjattu">${r.s.n}/9</span>`]
        : [r.v != null ? kierrokset(r.v) : "–", r.v != null ? f(vo2(r.v), 1) : "–"];
      return `<div class="jtt-r${kor ? " korostettu" : ""}" role="row" data-p="${p.id}">
        <span role="cell"><button class="jtt-sija" data-kor="${p.id}" aria-pressed="${kor}" title="Korosta kaavioissa">${r.sija?.sija ?? "–"}</button></span>
        <span role="cell" class="jtt-nimi"><a href="#/juoksu/pelaaja/${p.id}">${kuva(p)}<span><b>${esc(nimi(p))}</b><small>${ryhmaOf(p.id) === "superpesis" ? "Superpesis" : sy ? `${sy} · ${ika(p.id, r.s.kausi)} v` : "juniori"}</small></span></a></span>
        <span role="cell" class="jtt-rata" aria-hidden="true"><i class="jtt-md" style="left:${pos(md)}%"></i>
          ${r.ed && r.v != null ? `<i class="jtt-yhd ${plus ? "plus" : miinus ? "miinus" : ""}" style="left:${Math.min(pos(r.ed[m]), pos(r.v))}%;width:${Math.abs(pos(r.v) - pos(r.ed[m]))}%"></i><i class="jtt-pallo haamu" style="left:${pos(r.ed[m])}%" title="Edellinen ${fm(m, r.ed[m])} (${pvmLyhyt(r.ed.pvm)})"></i>` : ""}
          ${r.v != null ? `<i class="jtt-pallo${r.uusiPb ? " pb" : ""}" style="left:${pos(r.v)}%"></i>` : ""}</span>
        <span role="cell" class="n jtt-tulos">${fm(m, r.v)}${r.uusiPb ? `<em class="jtt-pb" title="Uusi ennätys">PB</em>` : ""}</span>
        <span role="cell" class="n jtt-muutos ${plus ? "plus" : miinus ? "miinus" : ""}" title="${r.ed ? `Edellinen ${fm(m, r.ed[m])} ${M[m].yks}, ${pvm(r.ed.pvm)}` : "Ei edellistä tulosta"}">${r.ed ? `${plus ? "▲" : miinus ? "▼" : "•"} ${muutosTxt(m, r.ero)}` : "<span class='pieni'>uusi</span>"}</span>
        ${lisat.map((x) => `<span role="cell" class="n jtt-lisa">${x}</span>`).join("")}
        <span role="cell" class="n jtt-lisa2">${r.ikaS ? `<span class="jtt-ikas ${pctLuokka(r.ikaS.pct)}" title="Kauden parhaiden perusteella ikäluokassa ${sy}">${r.ikaS.sija}./${r.ikaS.n}</span>` : "<span class='pieni'>–</span>"}</span>
      </div>`; }).join("")}`;
  $$("[data-kor]", $("#jtt-taulu")).forEach((b) => (b.onclick = () => vaihdaKorostus(b.dataset.kor)));
}

// 9 juoksun lämpökartta: väri = hidastuminen omasta parhaasta juoksusta
function lampo(s) {
  return `<span class="jtt-lampo" aria-label="Juoksut: ${s.ajat.map((x) => (x == null ? "–" : f(x))).join(", ")}">${s.ajat.map((x, i) => {
    if (x == null) return `<i class="tyhja${i % 3 === 0 && i ? " vali" : ""}"></i>`;
    const h = Math.min(1, (x / s.paras - 1) / 0.08);
    return `<i class="${i % 3 === 0 && i ? "vali" : ""}" style="background:${lampoVari(h)}" title="${i + 1}. juoksu ${f(x)} s (+${f((x / s.paras - 1) * 100, 1)} %)"></i>`; }).join("")}</span>`;
}
function lampoVari(h) { // 0 = oma paras (vihreä) → 0,5 kulta → 1 punainen (+8 %)
  const c = h < 0.5 ? [[46, 229, 157], [245, 168, 0], h / 0.5] : [[245, 168, 0], [255, 59, 78], (h - 0.5) / 0.5];
  const [a, b, t] = c; return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
}

// ---------- kaikki samalla janalla (SVG, mitoitetaan säiliön leveyden mukaan)
function piirraJana(fam, m, ka, tark) {
  const el = $("#jtt-jana"); if (!el) return;
  const kp = [...kausiParhaat(fam, m, ka, tark, "kaikki").values()];
  if (!kp.length) { el.innerHTML = `<p class="pieni">Ei tuloksia.</p>`; return; }
  const kaistat = new Map();
  for (const s of kp) { const nm = ryhmaOf(s.pelaaja) === "superpesis" ? "Superpesis" : kaistaNimi(synt(s.pelaaja)); (kaistat.get(nm) || kaistat.set(nm, []).get(nm)).push(s); }
  const jarj = [...kaistat.keys()].sort((a, b) => (a === "Superpesis" ? -1 : b === "Superpesis" ? 1 : a === "Muut" ? -1 : b === "Muut" ? 1 : a.localeCompare(b)));
  const W = Math.max(320, el.clientWidth - 36), vasen = W < 560 ? 74 : 120, oikea = 16, kaista = 50, yla = 14, H = yla + jarj.length * kaista + 40;
  const v = kp.map((s) => s[m]); let lo = Math.min(...v), hi = Math.max(...v); const pad = (hi - lo) * 0.05 || 1; lo -= pad; hi += pad;
  const x = (val) => vasen + (M[m].pp ? (hi - val) / (hi - lo) : (val - lo) / (hi - lo)) * (W - vasen - oikea);
  const kaikkiMd = mediaani(v);
  const ticks = asteikko(lo, hi, W < 560 ? 4 : 7);
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kauden parhaat tulokset kaistoittain">`;
  ticks.forEach((t) => { svg += `<line x1="${x(t)}" x2="${x(t)}" y1="${yla - 4}" y2="${H - 32}" stroke="var(--line-2)"/><text x="${x(t)}" y="${H - 14}" text-anchor="middle" class="jtt-ax">${fm(m, t)}</text>`; });
  svg += `<text x="${W - oikea}" y="${H - 1}" text-anchor="end" class="jtt-ax">parempi →</text>`;
  jarj.forEach((nm, i) => {
    const y0 = yla + i * kaista, yc = y0 + kaista / 2, ss = kaistat.get(nm).sort((a, b) => x(a[m]) - x(b[m]));
    const sp = nm === "Superpesis", vari2 = sp ? "#F5A800" : LAJIVARIT[i % LAJIVARIT.length];
    const korostettuKaista = (S.ryhma === "superpesis" && sp) || (S.ryhma === "juniorit" && !sp) || S.ryhma === "kaikki";
    svg += `<rect x="${vasen}" y="${y0 + 4}" width="${W - vasen - oikea}" height="${kaista - 8}" rx="6" fill="${sp ? "rgba(245,168,0,.07)" : "rgba(255,255,255,.025)"}"/>`;
    svg += `<text x="${vasen - 10}" y="${yc - 2}" text-anchor="end" class="jtt-kaista${sp ? " sp" : ""}">${nm === "Muut" ? "Muut" : sp ? "Superpesis" : nm}</text><text x="${vasen - 10}" y="${yc + 13}" text-anchor="end" class="jtt-ax">${sp || nm === "Muut" ? "" : `${kevat(ka) - +nm} v · `}${ss.length} pel.</text>`;
    const q1 = kvart(ss.map((s) => s[m]), 0.25), q3 = kvart(ss.map((s) => s[m]), 0.75), mdk = mediaani(ss.map((s) => s[m]));
    if (ss.length >= 3) svg += `<line x1="${x(q1)}" x2="${x(q3)}" y1="${yc}" y2="${yc}" stroke="${vari2}" stroke-opacity=".35" stroke-width="10" stroke-linecap="round"/>`;
    // pisteet: väistö pystysuunnassa
    const paikat = [];
    ss.forEach((s) => { const px = x(s[m]); let dy = 0; for (let k = 0; k < 6; k++) { dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 7; if (!paikat.some(([ax, ay]) => Math.abs(ax - px) < 9 && Math.abs(ay - dy) < 7)) break; } paikat.push([px, dy]);
      const kor = S.korostus.has(s.pelaaja), p = tila.pelaaja[s.pelaaja];
      svg += `<circle cx="${px}" cy="${yc + dy}" r="${kor ? 7 : 5}" fill="${vari2}" fill-opacity="${korostettuKaista ? (kor ? 1 : 0.85) : 0.35}" stroke="${kor ? "#fff" : "rgba(0,0,0,.5)"}" stroke-width="${kor ? 2 : 1}" class="jtt-piste" data-kor="${s.pelaaja}"><title>${esc(nimi(p))}: ${fm(m, s[m])} ${M[m].yks} (${pvm(s.pvm)})</title></circle>`;
      if (kor) svg += `<text x="${px}" y="${yc + dy - 11}" text-anchor="middle" class="jtt-tunniste">${esc(lyhytNimi(p))}</text>`; });
    svg += `<line x1="${x(mdk)}" x2="${x(mdk)}" y1="${y0 + 8}" y2="${y0 + kaista - 8}" stroke="var(--ink)" stroke-width="2"><title>Mediaani ${fm(m, mdk)}</title></line>`;
  });
  svg += `<line x1="${x(kaikkiMd)}" x2="${x(kaikkiMd)}" y1="${yla}" y2="${H - 32}" stroke="var(--ink-2)" stroke-dasharray="4 4"/><text x="${x(kaikkiMd)}" y="${yla - 2}" text-anchor="middle" class="jtt-ax">kaikki ${fm(m, kaikkiMd)}</text>`;
  el.innerHTML = svg + "</svg>";
  $$("circle[data-kor]", el).forEach((c) => (c.onclick = () => vaihdaKorostus(c.dataset.kor)));
}

function asteikko(lo, hi, n) {
  const raaka = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raaka)), askel = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raaka) || raaka;
  const out = []; for (let t = Math.ceil(lo / askel) * askel; t <= hi + 1e-9; t += askel) out.push(Math.round(t * 1e6) / 1e6); return out;
}

// ---------- 30 m: lähtö vs. huippunopeus
function piirraHajonta(rivit) {
  const el = $("#jtt-hajonta"); if (!el) return;
  const pp = rivit.filter((r) => r.s.t10 != null && r.s.l20 != null);
  if (pp.length < 3) { el.innerHTML = `<p class="pieni">Väliaikoja (10 m) tarvitaan vähintään kolmelta pelaajalta.</p>`; return; }
  const W = Math.max(320, el.clientWidth - 36), H = W < 560 ? 340 : 420, va = 52, oi = 18, yl = 18, al = 44;
  const xs = pp.map((r) => r.s.t10), ys = pp.map((r) => r.s.l20);
  const [x0, x1] = [Math.min(...xs) - 0.03, Math.max(...xs) + 0.03], [y0, y1] = [Math.min(...ys) - 0.03, Math.max(...ys) + 0.03];
  const X = (v) => va + ((x1 - v) / (x1 - x0)) * (W - va - oi), Y = (v) => yl + ((v - y0) / (y1 - y0)) * (H - yl - al);
  const mx = mediaani(xs), my = mediaani(ys);
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="10 m lähtö ja lentävä 20 m">`;
  svg += `<rect x="${X(mx)}" y="${yl}" width="${W - oi - X(mx)}" height="${Y(my) - yl}" fill="rgba(46,229,157,.06)"/>`;
  asteikko(x0, x1, W < 560 ? 4 : 6).forEach((t) => (svg += `<line x1="${X(t)}" x2="${X(t)}" y1="${yl}" y2="${H - al}" stroke="var(--line-2)"/><text x="${X(t)}" y="${H - al + 16}" text-anchor="middle" class="jtt-ax">${f(t)}</text>`));
  asteikko(y0, y1, 5).forEach((t) => (svg += `<line x1="${va}" x2="${W - oi}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line-2)"/><text x="${va - 8}" y="${Y(t) + 4}" text-anchor="end" class="jtt-ax">${f(t)}</text>`));
  svg += `<line x1="${X(mx)}" x2="${X(mx)}" y1="${yl}" y2="${H - al}" stroke="var(--ink-3)" stroke-dasharray="5 4"/><line x1="${va}" x2="${W - oi}" y1="${Y(my)}" y2="${Y(my)}" stroke="var(--ink-3)" stroke-dasharray="5 4"/>`;
  const kulma = (tx, ty, a, t) => `<text x="${tx}" y="${ty}" text-anchor="${a}" class="jtt-kulma">${t}</text>`;
  svg += kulma(W - oi - 6, yl + 16, "end", "Vahva molemmissa") + kulma(va + 6, yl + 16, "start", "Huippunopeus vahvuus") + kulma(W - oi - 6, H - al - 8, "end", "Lähtö vahvuus") + kulma(va + 6, H - al - 8, "start", "Kehitettävää");
  svg += `<text x="${(W + va) / 2}" y="${H - 6}" text-anchor="middle" class="jtt-ax">10 m lähtö, s (nopeampi →)</text><text x="14" y="${(H - al) / 2}" text-anchor="middle" class="jtt-ax" transform="rotate(-90 14 ${(H - al) / 2})">lentävä 20 m, s (nopeampi ↑)</text>`;
  const laatikot = [];
  const jarj = [...pp].sort((a, b) => S.korostus.has(a.s.pelaaja) - S.korostus.has(b.s.pelaaja));
  jarj.forEach((r) => {
    const p = tila.pelaaja[r.s.pelaaja], kor = S.korostus.has(p.id), cx = X(r.s.t10), cy = Y(r.s.l20), sp = ryhmaOf(p.id) === "superpesis";
    svg += `<circle cx="${cx}" cy="${cy}" r="${kor ? 7.5 : 5.5}" fill="${sp ? "#F5A800" : "#7DD3FC"}" fill-opacity="${kor ? 1 : 0.8}" stroke="${kor ? "#fff" : "rgba(0,0,0,.5)"}" stroke-width="${kor ? 2 : 1}" data-kor="${p.id}" class="jtt-piste"><title>${esc(nimi(p))}: 10 m ${f(r.s.t10)} s, lentävä 20 m ${f(r.s.l20)} s (${f(huippu(r.s.l20), 1)} km/h)</title></circle>`;
  });
  // nimet: korostetut ensin, sitten muut jos mahtuvat
  [...pp].sort((a, b) => S.korostus.has(b.s.pelaaja) - S.korostus.has(a.s.pelaaja)).forEach((r) => {
    const p = tila.pelaaja[r.s.pelaaja], kor = S.korostus.has(p.id), t = lyhytNimi(p), w = t.length * 6.2, cx = X(r.s.t10), cy = Y(r.s.l20);
    const box = [cx + 8, cy - 7, w, 13];
    if (!kor && (W < 560 || laatikot.some((b) => box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1]))) return;
    laatikot.push(box);
    svg += `<text x="${cx + 8}" y="${cy + 4}" class="${kor ? "jtt-tunniste" : "jtt-pisteteksti"}">${esc(t)}</text>`;
  });
  el.innerHTML = svg + "</svg>";
  $$("circle[data-kor]", el).forEach((c) => (c.onclick = () => vaihdaKorostus(c.dataset.kor)));
}

// ---------- 9×30 m juoksuprofiili
const sarjaTaustat = { id: "sarjat", beforeDatasetsDraw(c) { const { ctx, chartArea: a, scales: { x } } = c; if (!a) return; ctx.save(); ctx.fillStyle = "rgba(255,255,255,.03)";
  [[0, 2], [6, 8]].forEach(([i, j]) => { const l = x.getPixelForValue(i) - (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2, r = x.getPixelForValue(j) + (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2; ctx.fillRect(l, a.top, r - l, a.bottom - a.top); });
  ctx.fillStyle = vari("--ink-3"); ctx.font = "600 12px Barlow, sans-serif"; ctx.textAlign = "center";
  [1, 4, 7].forEach((i, k) => ctx.fillText(`${k + 1}. sarja`, x.getPixelForValue(i), a.top + 14)); ctx.restore(); } };
function piirraProfiili(rivit) {
  const c = $("#jtt-profiili"); if (!c) return;
  const ss = rivit.map((r) => r.s).filter((s) => s.ajat);
  const per = Array.from({ length: 9 }, (_, i) => ss.map((s) => s.ajat[i]).filter((x) => x != null));
  const varit = ["#F5A800", "#2EE59D", "#FF3B4E", "#7DD3FC", "#A78BFA", "#F472B6"];
  const kor = ss.filter((s) => S.korostus.has(s.pelaaja));
  piirra(c, { type: "line", plugins: [sarjaTaustat],
    data: { labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], datasets: [
      { label: "75 %", data: per.map((a) => kvart(a, 0.75)), borderColor: "transparent", pointRadius: 0, fill: false },
      { label: "Keskimmäinen puolikas", data: per.map((a) => kvart(a, 0.25)), borderColor: "transparent", backgroundColor: "rgba(245,168,0,.14)", pointRadius: 0, fill: "-1" },
      { label: "Mediaani", data: per.map((a) => mediaani(a)), borderColor: vari("--ink"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0 },
      ...kor.map((s, i) => ({ label: nimi(tila.pelaaja[s.pelaaja]), data: s.ajat, borderColor: varit[i % varit.length], backgroundColor: varit[i % varit.length], borderWidth: 3, pointRadius: 4, spanGaps: true })),
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      scales: { y: { reverse: true, ticks: { callback: (v) => f(v) }, title: { display: true, text: "s (ylempänä nopeampi)" } }, x: { title: { display: true, text: "juoksu" }, grid: { display: false } } },
      plugins: { legend: { labels: { filter: (l) => l.text !== "75 %", usePointStyle: true, boxWidth: 8 } }, tooltip: { filter: (t) => t.dataset.label !== "75 %", callbacks: { label: (t) => `${t.dataset.label}: ${f(t.parsed.y)} s` } } } } });
}

// ---------- kehitys kausittain: ikäluokat + Superpesis
function piirraKehitys(fam, m, tark) {
  const c = $("#jtt-kehitys"); if (!c) return;
  if (TESTI[fam].kengat) { const kk = (t) => new Set(D[fam].filter((s) => s.tark === t && s[m] != null).map((s) => s.kausi)).size;
    const paras = [...new Set(D[fam].map((s) => s.tark))].sort((a, b) => kk(b) - kk(a))[0];
    if (paras != null && kk(paras) > kk(tark)) tark = paras;
    const el = $("#jtt-kehitys-kengat"); if (el) el.textContent = TESTI[fam].kengat ? ` · ${KENKA[tark] ?? tark}` : ""; }
  const kaudet = [...new Set(D[fam].filter((s) => s.tark === tark && s[m] != null).map((s) => s.kausi))].sort();
  if (kaudet.length < 2) { c.closest(".paneeli").innerHTML = `<p class="pieni" style="margin:0">Kehityskäyrä piirtyy, kun tuloksia on vähintään kahdelta kaudelta${TESTI[fam].kengat ? " samoilla kengillä" : ""}. Nyt kausi ${kaudet[0] || "–"}.</p>`; return; }
  const ryhmat = new Map();
  for (const ka of kaudet) for (const s of kausiParhaat(fam, m, ka, tark, "kaikki").values()) {
    const g = ryhmaOf(s.pelaaja) === "superpesis" ? "Superpesis" : synt(s.pelaaja) && synt(s.pelaaja) >= 2007 ? `${synt(s.pelaaja)} syntyneet` : null;
    if (!g) continue;
    const o = ryhmat.get(g) || ryhmat.set(g, {}).get(g); (o[ka] = o[ka] || []).push(s[m]);
  }
  const nimet = [...ryhmat.keys()].sort((a, b) => (a === "Superpesis" ? 1 : b === "Superpesis" ? -1 : a.localeCompare(b)));
  const ds = nimet.map((g, i) => { const sp = g === "Superpesis", col = sp ? "#F5A800" : LAJIVARIT[i % LAJIVARIT.length];
    const data = kaudet.map((ka) => { const a = ryhmat.get(g)[ka]; return a && a.length >= 3 ? mediaani(a) : null; });
    return { label: g, data, borderColor: col, backgroundColor: col, borderWidth: sp ? 4 : 2.5, borderDash: sp ? [] : undefined, pointRadius: 5, spanGaps: true, tension: 0.25, _n: kaudet.map((ka) => ryhmat.get(g)[ka]?.length || 0) }; })
    .filter((d) => d.data.some((x) => x != null));
  const kor = [...S.korostus].map((pid, i) => ({ label: nimi(tila.pelaaja[pid]), data: kaudet.map((ka) => kausiParhaat(fam, m, ka, tark, "kaikki").get(pid)?.[m] ?? null), borderColor: "#fff", backgroundColor: "#fff", borderWidth: 1.5, borderDash: [2, 3], pointRadius: 3, spanGaps: true, _n: [] }));
  piirra(c, { type: "line", data: { labels: kaudet, datasets: [...ds, ...kor] },
    options: { maintainAspectRatio: false, interaction: { mode: "nearest", intersect: false },
      scales: { y: yAks(m, { title: { display: true, text: M[m].yks } }), x: { grid: { display: false } } },
      plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: (t) => `${t.dataset.label}: ${fm(m, t.parsed.y)} ${M[m].yks}${t.dataset._n?.[t.dataIndex] ? ` (${t.dataset._n[t.dataIndex]} pelaajaa)` : ""}` } } } } });
}

// ================= PELAAJAN JUOKSUPROFIILI =================
function naytaPelaaja(main, pid) {
  const testatut = new Set([...D["30m"], ...D.nok, ...D.cooper].map((s) => s.pelaaja));
  const pelaajat = [...testatut].map((id) => tila.pelaaja[id]).filter(Boolean);
  if (!pid || !tila.pelaaja[pid]) pid = S.pelaaja && testatut.has(S.pelaaja) ? S.pelaaja : null;
  S.pelaaja = pid;
  const ryhmiteltu = [["Superpesis", pelaajat.filter((p) => ryhmaOf(p.id) === "superpesis")],
    ...[...new Set(pelaajat.filter((p) => ryhmaOf(p.id) === "juniorit").map((p) => p.syntymavuosi || 0))].sort((a, b) => b - a)
      .map((v) => [v ? `Juniorit ${v}` : "Juniorit", pelaajat.filter((p) => ryhmaOf(p.id) === "juniorit" && (p.syntymavuosi || 0) === v)])]
    .filter(([, a]) => a.length).map(([n, a]) => [n, a.sort((x, y) => (y.aktiivinen - x.aktiivinen) || nimi(x).localeCompare(nimi(y), "fi"))]);
  const p = pid ? tila.pelaaja[pid] : null;
  main.innerHTML = `
    <div class="jtt-paa">
      <div><a class="jtt-yla" href="#/juoksu/${S.testi}/${S.ryhma}">← Juoksutestit</a><h1>${p ? esc(nimi(p)) : "Pelaajan juoksuprofiili"}</h1>
        <p class="ingressi">${p ? "Oma kehitys ja sijoitus ikäluokassa, omassa ryhmässä ja kaikkien testattujen joukossa." : "Valitse pelaaja nähdäksesi kehityksen ja vertailut."}</p></div>
      <label class="jtt-valinta"><span>Pelaaja</span><select id="jtt-pelaaja"><option value="">Valitse…</option>${ryhmiteltu.map(([n, a]) => `<optgroup label="${esc(n)}">${a.map((x) => `<option value="${x.id}"${x.id === pid ? " selected" : ""}>${esc(nimi(x))}${x.aktiivinen ? "" : " (entinen)"}</option>`).join("")}</optgroup>`).join("")}</select></label>
    </div>
    <div id="jtt-p-runko"></div>`;
  $("#jtt-pelaaja").onchange = (e) => (location.hash = `#/juoksu/pelaaja/${e.target.value}`);
  if (!p) { $("#jtt-p-runko").innerHTML = `<div class="paneeli jtt-tyhja"><p class="pieni">Profiilissa on mukana ${pelaajat.length} pelaajaa, joilla on juoksutestituloksia.</p></div>`; return; }
  history.replaceState(null, "", `#/juoksu/pelaaja/${pid}`);

  const jun = ryhmaOf(pid) === "juniorit", sy = synt(pid);
  const osiot = TESTIT.map((T) => ({ T, ss: D[T.k].filter((s) => s.pelaaja === pid && s[T.paa] != null) })).filter((o) => o.ss.length);
  // vahvuusprofiili: viimeisimmän kauden paras jokaisessa mittarissa, sijoitus omassa ryhmässä
  const profiili = osiot.flatMap(({ T, ss }) => {
    const tark = ss.at(-1).tark, ka = ss.at(-1).kausi;
    return T.mitat.map((m) => {
      const kp = kausiParhaat(T.k, m, ka, tark, ryhmaOf(pid)), oma = kp.get(pid);
      if (!oma) return null;
      const s = sijoitus(m, oma[m], [...kp.values()].map((x) => x[m]));
      return { T, m, ka, s, arvo: oma[m] };
    }).filter(Boolean);
  });

  $("#jtt-p-runko").innerHTML = `
    <div class="jtt-pkortti paneeli">
      <div class="jtt-pk-kuva">${kuva(p, true)}</div>
      <div class="jtt-pk-tiedot"><span class="jtt-yla">${jun ? (sy ? `Juniorit · ikäluokka ${sy}` : "Juniorit") : "Miehet · Superpesis"}</span><b>${esc(nimi(p))}</b>
        <span class="pieni">${sy ? `syntynyt ${sy}` : ""}${p.aktiivinen ? "" : " · entinen pelaaja"} · <a href="#/pelaaja/${p.id}">pelaajakortti</a></span></div>
      <div class="jtt-vahvuudet"><span class="jtt-kpi-ots">Juoksuprofiili · sijoitus ${jun ? "junioreissa" : "Superpesis-ryhmässä"}, kauden paras</span>
        ${profiili.map((x) => `<div class="jtt-vahvuus"><span>${esc(x.m === "t30" || x.m === "t10" || x.m === "l20" ? M[x.m].pitka : x.T.k === "nok" ? `9×30: ${M[x.m].nimi.toLowerCase()}` : "Cooper")}</span>
          <span class="jtt-vpalkki"><i class="${pctLuokka(x.s.pct)}" style="width:${Math.max(4, x.s.pct)}%"></i></span><b class="num">${x.s.sija}./${x.s.n}</b></div>`).join("") || `<p class="pieni">Ei tuloksia.</p>`}
        <span class="pieni">Palkki: kuinka monta prosenttia ryhmästä on jäänyt taakse.</span></div>
    </div>
    ${osiot.map(({ T, ss }) => pelaajaOsio(T, ss, pid)).join("")}`;
  osiot.forEach(({ T, ss }) => piirraPelaajaKaavio(T, ss, pid));
}

function vertailuNauha(nimiTxt, m, arvo, arvot) {
  const s = sijoitus(m, arvo, arvot);
  if (!s || arvot.length < 2) return "";
  let lo = Math.min(...arvot), hi = Math.max(...arvot); const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad;
  const pos = (v) => (M[m].pp ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo)) * 100;
  return `<div class="jtt-nauha"><div class="jtt-nauha-ots"><span>${esc(nimiTxt)}</span><b class="num">${s.sija}./${s.n}</b></div>
    <div class="jtt-nauha-rata">${arvot.map((v) => `<i style="left:${pos(v)}%"></i>`).join("")}<i class="md" style="left:${pos(mediaani(arvot))}%"></i><b class="${pctLuokka(s.pct)}" style="left:${pos(arvo)}%"></b></div>
    <div class="jtt-nauha-ala pieni">parempi kuin ${s.pct} % · mediaani ${fm(m, mediaani(arvot))} ${M[m].yks}</div></div>`;
}

function pelaajaOsio(T, ss, pid) {
  const m = T.paa, viim = ss.at(-1), tark = viim.tark, ka = viim.kausi, sy = synt(pid), jun = ryhmaOf(pid) === "juniorit";
  const samat = ss.filter((s) => s.tark === tark);
  const h = historia(T.k, viim, m);
  const ero = h.ed ? viim[m] - h.ed[m] : null, plus = parannus(m, viim[m], h.ed?.[m]) > 0, miinus = parannus(m, viim[m], h.ed?.[m]) < 0;
  const pb = parasArvo(m, samat.map((s) => s[m]));
  const omaKp = kausiParhaat(T.k, m, ka, tark, "kaikki").get(pid)?.[m];
  const kpJun = [...kausiParhaat(T.k, m, ka, tark, "juniorit").values()];
  const ryhmaArvot = [...kausiParhaat(T.k, m, ka, tark, ryhmaOf(pid)).values()].map((s) => s[m]);
  const kaikkiArvot = [...kausiParhaat(T.k, m, ka, tark, "kaikki").values()].map((s) => s[m]);
  const ikaArvot = kpJun.filter((s) => sy && synt(s.pelaaja) === sy).map((s) => s[m]);
  const spArvot = [...kausiParhaat(T.k, m, ka, tark, "superpesis").values()].map((s) => s[m]);
  const lisa = T.k === "30m" ? [["10 m lähtö", "t10"], ["Lentävä 20 m", "l20"]].map(([n, mm]) => { const hh = historia("30m", viim, mm), e = hh.ed && viim[mm] != null ? parannus(mm, viim[mm], hh.ed[mm]) : null;
      return `<div class="jtt-mini"><span>${n}</span><b class="num">${fm(mm, viim[mm])}<small> s</small></b><em class="${e > 0 ? "plus" : e < 0 ? "miinus" : ""}">${e != null ? muutosTxt(mm, viim[mm] - hh.ed[mm]) : ""}</em></div>`; }).join("")
      + `<div class="jtt-mini"><span>Huippunopeus</span><b class="num">${f(huippu(viim.l20), 1)}<small> km/h</small></b><em>${viim.l20 ? f(20 / viim.l20, 2) + " m/s" : ""}</em></div>`
    : T.k === "nok" ? `<div class="jtt-mini"><span>Paras juoksu</span><b class="num">${fm("paras", viim.paras)}<small> s</small></b><em></em></div>
      <div class="jtt-mini"><span>Pudotus</span><b class="num">${f(viim.sdec, 1)}<small> %</small></b><em>${viim.sarjat.map((x) => f(x)).join(" · ")}</em></div>
      <div class="jtt-mini jtt-mini-leveä"><span>Juoksut 1–9</span>${lampo(viim)}</div>`
    : `<div class="jtt-mini"><span>Kierrokset</span><b class="num">${Math.floor(viim.m / KIERROS)}<small> + ${Math.round(viim.m % KIERROS)} m</small></b><em></em></div>
      <div class="jtt-mini"><span>Hapenotto, arvio</span><b class="num">${f(vo2(viim.m), 1)}<small> ml/kg/min</small></b><em></em></div>`;
  return `<section class="jtt-osio paneeli jtt-posio">
    <div class="jtt-osio-paa"><h2>${esc(T.nimi)}</h2><span class="pieni">viimeisin ${pvm(viim.pvm)}${T.kengat ? ` · ${KENKA[tark] ?? tark}` : ""} · ${ss.length} ${ss.length === 1 ? "testi" : "testiä"}</span></div>
    <div class="jtt-pgrid">
      <div class="jtt-isot">
        <span class="jtt-kpi-ots">${esc(M[m].pitka)}</span>
        <span class="jtt-iso">${fm(m, viim[m])}<small>${M[m].yks}</small></span>
        <span class="jtt-muutos ${plus ? "plus" : miinus ? "miinus" : ""}">${h.ed ? `${plus ? "▲" : miinus ? "▼" : "•"} ${muutosTxt(m, ero)} ${M[m].yks} edellisestä (${pvmLyhyt(h.ed.pvm)})` : "ensimmäinen testi"}</span>
        <span class="pieni">Ennätys <b class="num">${fm(m, pb)} ${M[m].yks}</b>${pb === viim[m] && samat.length > 1 ? ` <em class="jtt-pb">PB</em>` : ""}</span>
        <div class="jtt-minit">${lisa}</div>
      </div>
      <div class="jtt-vertailut"><span class="jtt-kpi-ots">Kausi ${ka} · kauden paras ${fm(m, omaKp)} ${M[m].yks}</span>
        ${jun && sy ? vertailuNauha(`Ikäluokka ${sy} (${kevat(ka) - sy} v)`, m, omaKp, ikaArvot) : ""}
        ${vertailuNauha(jun ? "Kaikki juniorit" : "Superpesis-ryhmä", m, omaKp, ryhmaArvot)}
        ${jun && spArvot.length >= 2 ? vertailuNauha("Superpesis-pelaajat", m, omaKp, [...spArvot, omaKp]) : ""}
        ${kaikkiArvot.length > ryhmaArvot.length ? vertailuNauha("Kaikki testatut", m, omaKp, kaikkiArvot) : ""}
        ${jun && !spArvot.length ? `<p class="pieni">Superpesis-ryhmän tuloksia ei vielä ole tältä kaudelta, joten vertailu miehiin puuttuu.</p>` : ""}
      </div>
      <div class="jtt-pkaavio"><div class="kaavio matala"><canvas id="jtt-pk-${T.k}"></canvas></div></div>
    </div></section>`;
}

function piirraPelaajaKaavio(T, ss, pid) {
  const c = $(`#jtt-pk-${T.k}`); if (!c) return;
  const m = T.paa, tark = ss.at(-1).tark, sy = synt(pid), jun = ryhmaOf(pid) === "juniorit";
  const kerrat = [...new Map(ss.map((s) => [s.pvm + s.kerta, s])).values()].sort((a, b) => a.pvm.localeCompare(b.pvm));
  const pvmt = [...new Set(kerrat.map((s) => s.pvm))];
  const ikaMd = (ka) => { const a = [...kausiParhaat(T.k, m, ka, tark, "juniorit").values()].filter((s) => synt(s.pelaaja) === sy).map((s) => s[m]); return a.length >= 3 ? mediaani(a) : null; };
  const ryhmaMd = (ka) => { const a = [...kausiParhaat(T.k, m, ka, tark, ryhmaOf(pid)).values()].map((s) => s[m]); return a.length >= 3 ? mediaani(a) : null; };
  const kengat = [...new Set(ss.map((s) => s.tark))];
  const ds = kengat.map((k) => { const oma = k === tark, col = oma ? "#F5A800" : "#C98A00";
    return { label: T.kengat && kengat.length > 1 ? `${nimi(tila.pelaaja[pid])} · ${KENKA[k] ?? k}` : nimi(tila.pelaaja[pid]), data: pvmt.map((d) => parasArvo(m, ss.filter((s) => s.pvm === d && s.tark === k).map((s) => s[m]))),
      borderColor: col, backgroundColor: col, borderWidth: oma ? 3 : 2, borderDash: oma ? undefined : [4, 3], pointRadius: oma ? 5 : 3, spanGaps: true, tension: 0.2 }; });
  const kaudet = pvmt.map((d) => kausi(d));
  const vl = (d, i) => (ss.some((s) => s.pvm === d && s.tark === tark) ? i : null);
  if (jun && sy) ds.push({ label: `Ikäluokan ${sy} mediaani${kengat.length > 1 ? ` (${(KENKA[tark] ?? tark).toLowerCase()})` : ""}`, data: pvmt.map((d, i) => (vl(d, i) != null ? ikaMd(kaudet[i]) : null)), borderColor: "#7DD3FC", borderDash: [6, 4], borderWidth: 2, pointRadius: 0, spanGaps: true });
  ds.push({ label: jun ? "Juniorien mediaani" : "Ryhmän mediaani", data: pvmt.map((d, i) => (vl(d, i) != null ? ryhmaMd(kaudet[i]) : null)), borderColor: vari("--ink-3"), borderDash: [2, 3], borderWidth: 2, pointRadius: 0, spanGaps: true });
  piirra(c, { type: "line", data: { labels: pvmt.map(pvmLyhyt), datasets: ds },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      scales: { y: yAks(m, { title: { display: true, text: M[m].yks } }), x: { grid: { display: false } } },
      plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } }, tooltip: { callbacks: { label: (t) => `${t.dataset.label}: ${fm(m, t.parsed.y)} ${M[m].yks}` } } } } });
}
