// Kuormitusanalyysin ydin (1.11.2026). Puhdas logiikka ilman selain- tai tietokantariippuvuuksia: sama tiedosto
// käytetään selaimessa (Viikkoni, Viikkokooste) ja Supabase-funktiossa viikkokooste (kopio supabase/functions/...).
// Rasitus on ARVIO: kuorma (AU) = arvioitu rasitus 0–10 treenityypistä tai ohjelmasta × minuutit (sRPE-menetelmän
// periaate, Foster ym. 2001). Akuutti:krooninen = viim. 7 pv / edellisten 4 viikon keskiarvo; yli 1,5 on tutkimuksissa
// liitetty kohonneeseen vammariskiin (Hulin ym. 2016; katsaus Arazi ym. 2020, Front Physiol).

export const TYYPIT = [ // pinoamisjärjestys = värijärjestys (validoitu tummalle pinnalle)
  { k: "laji", nimi: "Laji", rpe: 5, vari: "#c98500" },
  { k: "fysiikka", nimi: "Fysiikka", rpe: 6, vari: "#3987e5" },
  { k: "peli", nimi: "Peli", rpe: 7, vari: "#d95926" },
  { k: "aerobinen", nimi: "Aerobinen", rpe: 4, vari: "#199e70" },
  { k: "testi", nimi: "Testi", rpe: 6, vari: "#9085e9" },
  { k: "palauttava", nimi: "Palauttava", rpe: 2, vari: "#d55181" },
];
export const T = Object.fromEntries(TYYPIT.map((t) => [t.k, t]));
export const RASKAS = 450; // AU/päivä, esim. 90 min lajia tai 75 min fysiikkaa
export const LYONTI_MIN = 0.3; // lyöntipäiväkirja: 100 lyöntiä ≈ 30 min lajia
export const LYONTI_RPE = 4;
export const RAJA_NOUSU = 1.5, RAJA_KEVYT = 0.6;

const PAIVA = 864e5;
export const lisaaPv = (s, n) => new Date(new Date(s + "T12:00:00Z").getTime() + n * PAIVA).toISOString().slice(0, 10);
export const tanaanHki = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
export const maanantai = (s) => { const d = new Date(s + "T12:00:00Z"); return lisaaPv(s, -((d.getUTCDay() + 6) % 7)); };
export const VKP = ["ma", "ti", "ke", "to", "pe", "la", "su"];
export const minStr = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
export const pvLyh = (s) => `${+s.slice(8, 10)}.${+s.slice(5, 7)}.`;
export const desi = (x, n = 1) => x.toFixed(n).replace(".", ",");

// --- Nimenhuuto-tapahtumien luokittelu ---
const SANAT = [
  ["testi", /testi|cooper/i],
  ["peli", /ottelu|\bpeli\b|\bpelit\b|\bvs\.?\b|turnau|\bcup\b/i],
  ["palauttava", /palaut|liikkuvuu|huolto|jooga|venyt|kehonhuolto/i],
  ["fysiikka", /\bsali|voima|fysiik|kunto(?!lenk)|nopeu|loikk|plyo|ketteryy|hyppy|jumppa/i],
  ["aerobinen", /lenk|juoks|aerob|kestävyy|pyörä|hiihto|uinti|pk-/i],
];
export function arvaaTyyppi(otsikko) {
  for (const [k, re] of SANAT) if (re.test(otsikko || "")) return k;
  return "laji";
}
export function kestoMin(e) {
  // otsikon kellonaika voittaa kalenterin keston (Nimenhuuto antaa usein oletuksena 2 h), esim. "klo 7.45-9.15"
  const o = (e.otsikko || "").match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (o) { const m = +o[3] * 60 + +o[4] - (+o[1] * 60 + +o[2]); if (m >= 10 && m <= 600) return m; }
  if (e.alku && e.loppu) {
    const [ah, am] = e.alku.split(":").map(Number), [lh, lm] = e.loppu.split(":").map(Number);
    const m = lh * 60 + lm - (ah * 60 + am);
    if (m >= 10 && m <= 600) return m;
  }
  return 90;
}
export function osat(e) { // valmentajan korjaus tai automaattinen arvio
  if (Array.isArray(e.osat) && e.osat.length) return { osat: e.osat.filter((o) => T[o.tyyppi] && o.min > 0), korjattu: true };
  return { osat: [{ tyyppi: arvaaTyyppi(e.otsikko), min: kestoMin(e) }], korjattu: false };
}
export const lyhytOtsikko = (s) => (s || "").replace(/^[^:]{1,12}:\s+/, "");

// Omien kirjausten määrät tekstiksi, esim. "300 tolppasyöttöä · 50 matalaa · 6,5 km"
export function maaratTeksti(o) {
  const osat_ = Object.entries(o.maarat || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k.toLowerCase()} ${v}`);
  if (o.km) osat_.push(`${desi(+o.km)} km`);
  return osat_.join(" · ");
}

// --- kaikki lähteet yhdeksi listaksi ---
// d = { nh: tapahtumat, poissa: Set(uid), omat: omat_treenit, ohjelmat: {koodi: ohjelma}, lyonnit: [{pvm, maara}], testipaivat: [pvm] }
export function kokoa(d) {
  const rivit = [];
  const poissa = d.poissa || new Set();
  for (const e of d.nh || []) {
    if (e.peruttu || poissa.has(e.uid)) continue;
    for (const o of osat(e).osat) rivit.push({ pvm: e.pvm, tyyppi: o.tyyppi, min: o.min, rpe: T[o.tyyppi].rpe, otsikko: lyhytOtsikko(e.otsikko), lahde: "nh", uid: e.uid });
  }
  for (const o of d.omat || []) {
    const ohj = o.ohjelma && d.ohjelmat?.[o.ohjelma];
    const tyyppi = T[o.tyyppi] ? o.tyyppi : ohj?.tyyppi || "laji";
    rivit.push({ pvm: o.pvm, tyyppi, min: o.kesto_min, rpe: ohj?.rpe || T[tyyppi].rpe, otsikko: ohj?.nimi || o.huomio || `Oma ${T[tyyppi].nimi.toLowerCase()}`,
      lisa: maaratTeksti(o), lahde: "oma", id: o.id, ohjelma: o.ohjelma || null, maarat: o.maarat || null, km: o.km || null });
  }
  for (const l of d.lyonnit || []) rivit.push({ pvm: l.pvm, tyyppi: "laji", min: Math.max(5, Math.round(l.maara * LYONTI_MIN)), rpe: LYONTI_RPE, otsikko: `Lyönnit (${l.maara})`, lahde: "lyonti", maara: l.maara });
  const testiPv = new Set(rivit.filter((r) => r.tyyppi === "testi").map((r) => r.pvm));
  for (const p of d.testipaivat || []) if (!testiPv.has(p)) rivit.push({ pvm: p, tyyppi: "testi", min: 60, rpe: T.testi.rpe, otsikko: "Testipäivä (tulokset)", lahde: "testi" });
  for (const r of rivit) r.au = r.min * r.rpe;
  return rivit;
}
export const summa = (rivit, f = () => true) => rivit.filter(f).reduce((s, r) => s + r.au, 0);
const minuutit = (rivit, f = () => true) => rivit.filter(f).reduce((s, r) => s + r.min, 0);

// --- analyysi ---
export function analysoi(rivit, viikko, nyt = tanaanHki()) {
  const loppu = lisaaPv(viikko, 6);
  const paivat = VKP.map((v, i) => {
    const d = lisaaPv(viikko, i), r = rivit.filter((x) => x.pvm === d);
    return { pvm: d, vkp: v, rivit: r, min: minuutit(r), au: summa(r), tuleva: d > nyt, tanaan: d === nyt };
  });
  const tyypit = TYYPIT.map((t) => ({ ...t, min: paivat.reduce((s, p) => s + minuutit(p.rivit, (r) => r.tyyppi === t.k), 0) })).filter((t) => t.min);
  const yht = tyypit.reduce((s, t) => s + t.min, 0);
  const lepo = paivat.filter((p) => !p.min && !p.tuleva).length;
  const lepoSuunn = paivat.filter((p) => !p.min && p.tuleva).length;
  const vkRivit = paivat.flatMap((p) => p.rivit);
  const omaMin = minuutit(vkRivit, (r) => r.lahde === "oma" || r.lahde === "lyonti");

  const trendi = [5, 4, 3, 2, 1, 0].map((n) => {
    const a = lisaaPv(viikko, -7 * n), b = lisaaPv(a, 6), r = rivit.filter((x) => x.pvm >= a && x.pvm <= b);
    return { alku: a, au: summa(r), min: minuutit(r), tyypit: TYYPIT.map((t) => ({ k: t.k, min: minuutit(r, (x) => x.tyyppi === t.k) })) };
  });

  // akuutti:krooninen viitepäivään (tänään tai valitun viikon loppu, kumpi aiempi)
  const viite = loppu < nyt ? loppu : nyt;
  const akuutti = summa(rivit, (r) => r.pvm > lisaaPv(viite, -7) && r.pvm <= viite);
  const krooninen = summa(rivit, (r) => r.pvm > lisaaPv(viite, -35) && r.pvm <= lisaaPv(viite, -7)) / 4;
  const ekaPv = rivit.map((r) => r.pvm).sort()[0];
  const historiaa = !!ekaPv && ekaPv <= lisaaPv(viite, -21);
  const acwr = historiaa && krooninen > 0 ? akuutti / krooninen : null;

  const viim7 = [...Array(7)].map((_, i) => lisaaPv(viite, -i));
  const lepoViim7 = viim7.filter((d) => !rivit.some((r) => r.pvm === d && r.tyyppi !== "palauttava")).length;
  const dataViikolta = rivit.some((r) => r.pvm <= lisaaPv(viite, -6));
  let putki = 0, pisin = 0, putkiLoppu = null;
  for (let i = 13; i >= 0; i--) {
    const d = lisaaPv(viite, -i);
    putki = summa(rivit, (r) => r.pvm === d) >= RASKAS ? putki + 1 : 0;
    if (putki > pisin) { pisin = putki; putkiLoppu = d; }
  }
  const tulevat = rivit.filter((x) => (x.tyyppi === "peli" || x.tyyppi === "testi") && x.pvm > nyt && x.pvm <= lisaaPv(nyt, 2));

  const huomiot = [];
  if (acwr != null && acwr > RAJA_NOUSU) huomiot.push({ taso: "varoitus", koodi: "nousu", teksti: `Viimeisen 7 päivän kuorma on ${desi(acwr)} × edellisten neljän viikon keskitaso. Yli 1,5-kertainen äkillinen nousu on tutkimuksissa liitetty kohonneeseen vammariskiin – puhu valmentajan kanssa, voisiko jotain keventää.` });
  else if (acwr != null && acwr < RAJA_KEVYT) huomiot.push({ taso: "info", koodi: "kevyt", teksti: `Viimeinen viikko on selvästi kevyempi kuin edellisten viikkojen keskitaso (${Math.round(acwr * 100)} %). Jos tauko on tarkoituksellinen, hyvä – palaa tasoon vähitellen.` });
  if (dataViikolta && lepoViim7 === 0) huomiot.push({ taso: "varoitus", koodi: "eilepoa", teksti: "Viimeisen 7 päivän aikana ei ole ollut yhtään lepopäivää (palauttavaa harjoittelua lukuun ottamatta). Mieti, mihin väliin mahtuisi vapaa päivä." });
  if (pisin >= 3) huomiot.push({ taso: "info", koodi: "putki", teksti: `${pisin} raskasta päivää peräkkäin (päättyi ${pvLyh(putkiLoppu)}). Raskaiden päivien väliin kannattaa yleensä sijoittaa kevyempi tai vapaa päivä.` });
  for (const r of tulevat) {
    const ero = Math.round((new Date(r.pvm) - new Date(nyt)) / PAIVA);
    huomiot.push({ taso: "tuleva", koodi: "tuleva", teksti: `${r.tyyppi === "peli" ? "Peli" : "Testit"} ${ero === 1 ? "huomenna" : "ylihuomenna"}: ${r.otsikko}. Edeltävä päivä kannattaa pitää kevyempänä, ja nuku hyvin.` });
  }
  if (acwr == null) huomiot.push({ taso: "info", koodi: "historia", teksti: "Kuormahistoria kertyy: vertailu omaan tasoon näkyy, kun dataa on kertynyt vähintään 3 viikolta." });

  return { paivat, tyypit, yht, lepo, lepoSuunn, omaMin, trendi, acwr, akuutti, krooninen, lepoViim7, pisin, huomiot,
    harj: new Set(vkRivit.map((r) => r.lahde + (r.uid || r.id || r.pvm + r.otsikko))).size };
}

// --- valmentajan viikkokooste: yksi rivi per pelaaja + havainnot ---
// pelaajat = [{ id, nimi, rivit }], viikko = maanantai, nyt = päivä jolloin kooste tehdään
export function kooste(pelaajat, viikko, nyt = tanaanHki()) {
  const loppu = lisaaPv(viikko, 6), viite = loppu < nyt ? loppu : nyt;
  const vk = (r) => r.pvm >= viikko && r.pvm <= viite; // toteutunut osa viikosta
  const rivit = pelaajat.map((p) => {
    const a = analysoi(p.rivit, viikko, nyt);
    const tot = p.rivit.filter(vk);
    const omat = tot.filter((r) => r.lahde === "oma");
    const syotot = {}; let km = 0;
    for (const o of omat) { for (const [k, v] of Object.entries(o.maarat || {})) syotot[k] = (syotot[k] || 0) + (+v || 0); km += +o.km || 0; }
    const lyonnit = tot.filter((r) => r.lahde === "lyonti").reduce((s, r) => s + r.maara, 0);
    return { id: p.id, nimi: p.nimi, min: minuutit(tot), au: summa(tot), omaMin: minuutit(tot, (r) => r.lahde === "oma" || r.lahde === "lyonti"), omaKpl: omat.length,
      tyypit: Object.fromEntries(TYYPIT.map((t) => [t.k, minuutit(tot, (r) => r.tyyppi === t.k)])), acwr: a.acwr, lepoViim7: a.lepoViim7, pisin: a.pisin,
      maarat: Object.fromEntries(Object.entries(syotot).filter(([, v]) => v > 0)), km, lyonnit,
      ohjelmat: [...new Set(omat.map((r) => r.otsikko))] };
  });
  const omaMinuutit = rivit.map((r) => r.omaMin).sort((a, b) => a - b);
  const mediaani = omaMinuutit.length ? omaMinuutit[Math.floor(omaMinuutit.length / 2)] : 0;
  const havainnot = [];
  for (const r of rivit) {
    const syy = [];
    if (r.acwr != null && r.acwr > RAJA_NOUSU) syy.push(`kuorma ${desi(r.acwr)} × oma 4 viikon taso (raja 1,5)`);
    if (r.lepoViim7 === 0) syy.push("ei lepopäivää 7 päivään");
    if (r.pisin >= 4) syy.push(`${r.pisin} raskasta päivää peräkkäin`);
    if (syy.length >= 2 || (r.acwr != null && r.acwr > 1.8)) havainnot.push({ taso: "varoitus", pelaaja: r.nimi, teksti: `${r.nimi}: kuormitus on liian kova – ${syy.join(", ")}. Keskustele ja kevennä.` });
    else if (syy.length) havainnot.push({ taso: "huomio", pelaaja: r.nimi, teksti: `${r.nimi}: ${syy.join(", ")}. Seuraa.` });
    if (r.acwr != null && r.acwr < RAJA_KEVYT) havainnot.push({ taso: "info", pelaaja: r.nimi, teksti: `${r.nimi}: viikko selvästi kevyempi kuin oma taso (${Math.round(r.acwr * 100)} %). Sairaus, loukkaantuminen vai tauko?` });
    if (mediaani >= 60 && r.omaMin >= 2 * mediaani && r.omaMin >= 180) havainnot.push({ taso: "huomio", pelaaja: r.nimi, teksti: `${r.nimi}: omatoimista harjoittelua ${minStr(r.omaMin)}, yli kaksinkertainen ryhmän mediaaniin (${minStr(mediaani)}).` });
  }
  const eiOmia = rivit.filter((r) => !r.omaKpl && !r.lyonnit).map((r) => r.nimi);
  if (eiOmia.length && eiOmia.length < rivit.length) havainnot.push({ taso: "info", teksti: `Ei omatoimisia kirjauksia tällä viikolla: ${eiOmia.join(", ")}.` });
  const kirjanneet = rivit.filter((r) => r.omaKpl || r.lyonnit).length;
  const jarj = { varoitus: 0, huomio: 1, info: 2 };
  havainnot.sort((a, b) => jarj[a.taso] - jarj[b.taso]);
  return { viikko, viite, rivit: rivit.sort((a, b) => b.au - a.au), havainnot, mediaaniOma: mediaani, kirjanneet };
}

// Kooste tekstiksi (sähköposti ja arkisto)
export function koosteTeksti(k, ryhma) {
  const r = k.rivit;
  const rivi = (x) => `• ${x.nimi}: ${minStr(x.min)} (${x.omaMin ? `omatoimisia ${minStr(x.omaMin)}` : "ei omatoimisia"})${x.acwr != null ? ` · kuorma ${desi(x.acwr, 2)} × oma taso` : ""}${Object.keys(x.maarat).length ? ` · ${Object.entries(x.maarat).map(([a, b]) => `${a.toLowerCase()} ${b}`).join(", ")}` : ""}${x.km ? ` · ${desi(x.km)} km` : ""}${x.lyonnit ? ` · ${x.lyonnit} lyöntiä` : ""}`;
  return [
    `KPL Keskus – viikkokooste ${ryhma}, viikko ${pvLyh(k.viikko)}–${pvLyh(k.viite)}`,
    "",
    "HAVAINNOT",
    ...(k.havainnot.length ? k.havainnot.map((h) => `${h.taso === "varoitus" ? "⚠ " : "• "}${h.teksti}`) : ["• Ei erityisiä havaintoja."]),
    "",
    `TREENIMÄÄRÄT (ma–${VKP[(new Date(k.viite + "T12:00:00Z").getUTCDay() + 6) % 7]}), suurimmasta kuormasta alkaen`,
    ...r.map(rivi),
    "",
    `Omatoimisia kirjanneet: ${k.kirjanneet}/${r.length}. Omatoimisen harjoittelun mediaani ${minStr(k.mediaaniOma)}.`,
    "",
    "MIHIN ARVIO PERUSTUU: ryhmän Nimenhuuto-treenit (oletus: pelaaja oli mukana, ellei merkinnyt poissaoloa), pelaajan omat kirjaukset, lyöntipäiväkirja (100 lyöntiä ≈ 30 min) ja testipäivät. Rasitus on arvio treenityypistä tai ohjelmasta × minuutit – ei sykettä eikä pelaajan omaa rasitusarviota. 'Kuorma × oma taso' = viimeiset 7 päivää jaettuna edellisten 4 viikon keskiarvolla; yli 1,5 on tutkimuksissa liitetty kohonneeseen vammariskiin (Hulin ym. 2016). Havainnot ovat keskustelun pohja, eivät diagnoosi.",
    "",
    "Koko kooste: https://jugisoft.github.io/kpl-testit/#/kooste",
  ].join("\n");
}
