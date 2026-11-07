// Kuormitusanalyysin ydin (1.11.2026). Puhdas logiikka ilman selain- tai tietokantariippuvuuksia: sama tiedosto
// käytetään selaimessa (Viikkoni, Viikkokooste) ja Supabase-funktiossa viikkokooste, joka tuo tämän tiedoston GitHubista
// (raw.githubusercontent.com/Jugisoft/kpl-testit/<commit>/js/kuormaydin.js) – muutoksen jälkeen funktio julkaistaan uudelleen.
// Rasitus on ARVIO: kuorma (AU) = arvioitu rasitus 0–10 treenityypistä tai ohjelmasta × minuutit (sRPE-menetelmän
// periaate, Foster ym. 2001). Akuutti:krooninen = viim. 7 pv / edellisten 4 viikon keskiarvo; yli 1,5 on tutkimuksissa
// liitetty kohonneeseen vammariskiin (Hulin ym. 2016; katsaus Arazi ym. 2020, Front Physiol).
// 7.11.2026: pelaaja voi säätää omatoimisen treenin rasituksen kirjauksessa (omat_treenit.rpe), muuten oletus.

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
export const OS_RAJA = 60, OS_SEURAA = 75; // ryhmätreenien osallistuminen 4 vk: alle 60 % = paljon poissa, alle 75 % = seuraa

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
// Ryhmätreenin oletusrasitus = osien treenityyppien rasitus minuuteilla painotettuna (7.11.2026)
export function oletusRpe(e) {
  const o = osat(e).osat, min = o.reduce((s, x) => s + x.min, 0);
  return min ? Math.round(o.reduce((s, x) => s + x.min * T[x.tyyppi].rpe, 0) / min) : 5;
}
export function maaratTeksti(o) {
  const osat_ = Object.entries(o.maarat || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k.toLowerCase()} ${v}`);
  if (o.km) osat_.push(`${desi(+o.km)} km`);
  return osat_.join(" · ");
}

// --- kaikki lähteet yhdeksi listaksi ---
// d = { nh: tapahtumat, poissa: Set(uid), out: Set(uid), rasitus: Map(uid -> rpe), omat: omat_treenit, ohjelmat: {koodi: ohjelma}, lyonnit: [{pvm, maara}], testipaivat: [pvm] }
// 6.11.2026: out = Nimenhuudon OUT-ilmoittautumiset (taulu ilmoittautumiset). OUT tai "Olin poissa" = ei mukana;
// muuten oletus on, että pelaaja oli mukana. rivit.ryhma = ryhmätreenien läsnäolo (viikkokoosteeseen).
export function kokoa(d) {
  const rivit = [];
  const poissa = d.poissa || new Set(), out = d.out || new Set(), ryhma = [];
  const rasitus = d.rasitus || new Map(); // 7.11.2026: pelaajan oma arvio ryhmätreenille (uid -> 1–10)
  for (const e of d.nh || []) {
    if (e.peruttu) continue;
    const syy = poissa.has(e.uid) ? "poissa" : out.has(e.uid) ? "OUT" : null;
    ryhma.push({ pvm: e.pvm, uid: e.uid, mukana: !syy, syy });
    if (syy) continue;
    for (const o of osat(e).osat) rivit.push({ pvm: e.pvm, tyyppi: o.tyyppi, min: o.min, rpe: rasitus.get(e.uid) || T[o.tyyppi].rpe, otsikko: lyhytOtsikko(e.otsikko), lahde: "nh", uid: e.uid });
  }
  for (const o of d.omat || []) {
    const ohj = o.ohjelma && d.ohjelmat?.[o.ohjelma];
    const tyyppi = T[o.tyyppi] ? o.tyyppi : ohj?.tyyppi || "laji";
    rivit.push({ pvm: o.pvm, tyyppi, min: o.kesto_min, rpe: o.rpe || ohj?.rpe || T[tyyppi].rpe, otsikko: ohj?.nimi || o.huomio || `Oma ${T[tyyppi].nimi.toLowerCase()}`,
      lisa: maaratTeksti(o), lahde: "oma", id: o.id, ohjelma: o.ohjelma || null, maarat: o.maarat || null, km: o.km || null });
  }
  for (const l of d.lyonnit || []) rivit.push({ pvm: l.pvm, tyyppi: "laji", min: Math.max(5, Math.round(l.maara * LYONTI_MIN)), rpe: LYONTI_RPE, otsikko: `Lyönnit (${l.maara})`, lahde: "lyonti", maara: l.maara });
  const testiPv = new Set(rivit.filter((r) => r.tyyppi === "testi").map((r) => r.pvm));
  for (const p of d.testipaivat || []) if (!testiPv.has(p)) rivit.push({ pvm: p, tyyppi: "testi", min: 60, rpe: T.testi.rpe, otsikko: "Testipäivä (tulokset)", lahde: "testi" });
  for (const r of rivit) r.au = r.min * r.rpe;
  rivit.ryhma = ryhma;
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
    // ryhmätreenien osallistuminen (6.11.2026): viikko ja 4 viikkoa viitepäivään
    const ry = (p.rivit.ryhma || []).filter(vk);
    const ry4 = (p.rivit.ryhma || []).filter((x) => x.pvm > lisaaPv(viite, -28) && x.pvm <= viite);
    const pros = (a) => (a.length ? Math.round((100 * a.filter((x) => x.mukana).length) / a.length) : null);
    return { ryhmaYht: ry.length, ryhmaMukana: ry.filter((x) => x.mukana).length, ryhmaOut: ry.filter((x) => x.syy === "OUT").length, os: pros(ry),
      ry4Yht: ry4.length, ry4Mukana: ry4.filter((x) => x.mukana).length, ry4Out: ry4.filter((x) => x.syy === "OUT").length, os4: pros(ry4), id: p.id, nimi: p.nimi, min: minuutit(tot), au: summa(tot), omaMin: minuutit(tot, (r) => r.lahde === "oma" || r.lahde === "lyonti"), omaKpl: omat.length,
      tyypit: Object.fromEntries(TYYPIT.map((t) => [t.k, minuutit(tot, (r) => r.tyyppi === t.k)])), acwr: a.acwr, lepoViim7: a.lepoViim7, pisin: a.pisin,
      maarat: Object.fromEntries(Object.entries(syotot).filter(([, v]) => v > 0)), km, lyonnit,
      ohjelmat: [...new Set(omat.map((r) => r.otsikko))] };
  });
  const omaMinuutit = rivit.map((r) => r.omaMin).sort((a, b) => a - b);
  const mediaani = omaMinuutit.length ? omaMinuutit[Math.floor(omaMinuutit.length / 2)] : 0;
  const havainnot = [];
  // putki on poikkeama vain, jos se on selvästi ryhmän tavallista pidempi (koko ryhmä treenaa usein peräkkäisinä päivinä)
  const putket = rivit.map((r) => r.pisin).sort((a, b) => a - b);
  const putkiMed = putket.length ? putket[Math.floor(putket.length / 2)] : 0;
  for (const r of rivit) {
    const syy = [];
    if (r.acwr != null && r.acwr > RAJA_NOUSU) syy.push(`kuorma ${desi(r.acwr)} × oma 4 viikon taso (raja 1,5)`);
    if (r.lepoViim7 === 0) syy.push("ei lepopäivää 7 päivään");
    if (r.pisin >= 4 && r.pisin >= putkiMed + 2) syy.push(`${r.pisin} raskasta päivää peräkkäin (ryhmässä tavallisesti ${putkiMed})`);
    if (syy.length >= 2 || (r.acwr != null && r.acwr > 1.8)) havainnot.push({ taso: "varoitus", pelaaja: r.nimi, teksti: `${r.nimi}: kuormitus on liian kova – ${syy.join(", ")}. Keskustele ja kevennä.` });
    else if (syy.length) havainnot.push({ taso: "huomio", pelaaja: r.nimi, teksti: `${r.nimi}: ${syy.join(", ")}. Seuraa.` });
    if (r.acwr != null && r.acwr < RAJA_KEVYT) havainnot.push({ taso: "info", pelaaja: r.nimi, teksti: `${r.nimi}: viikko selvästi kevyempi kuin oma taso (${Math.round(r.acwr * 100)} %). Sairaus, loukkaantuminen vai tauko?` });
    if (r.ry4Yht >= 4 && r.os4 < OS_RAJA) havainnot.push({ taso: "huomio", pelaaja: r.nimi, koodi: "poissa", teksti: `${r.nimi}: osallistuminen 4 viikossa ${r.os4} % (${r.ry4Mukana}/${r.ry4Yht}${r.ry4Out ? `, OUT ${r.ry4Out}` : ""}), tällä viikolla ${r.ryhmaMukana}/${r.ryhmaYht}. Paljon poissa – selvitä syy.` });
    else if (r.ryhmaYht >= 2 && r.ryhmaMukana * 2 <= r.ryhmaYht) havainnot.push({ taso: "info", pelaaja: r.nimi, koodi: "poissa", teksti: `${r.nimi}: tällä viikolla mukana ${r.ryhmaMukana}/${r.ryhmaYht} ryhmätreenissä${r.ryhmaOut ? ` (OUT ${r.ryhmaOut})` : ""}.` });
    if (mediaani >= 60 && r.omaMin >= 2 * mediaani && r.omaMin >= 180) havainnot.push({ taso: "huomio", pelaaja: r.nimi, teksti: `${r.nimi}: omatoimista harjoittelua ${minStr(r.omaMin)}, yli kaksinkertainen ryhmän mediaaniin (${minStr(mediaani)}).` });
  }
  const eiOmia = rivit.filter((r) => !r.omaKpl && !r.lyonnit).map((r) => r.nimi);
  if (eiOmia.length && eiOmia.length < rivit.length) havainnot.push({ taso: "info", koodi: "eiomia", teksti: `Ei omatoimisia kirjauksia tällä viikolla: ${eiOmia.join(", ")}.` });
  const kirjanneet = rivit.filter((r) => r.omaKpl || r.lyonnit).length;
  const jarj = { varoitus: 0, huomio: 1, info: 2 };
  havainnot.sort((a, b) => jarj[a.taso] - jarj[b.taso]);
  const sum = (k) => rivit.reduce((s, r) => s + r[k], 0);
  const os = sum("ryhmaYht") ? Math.round((100 * sum("ryhmaMukana")) / sum("ryhmaYht")) : null;
  const os4 = sum("ry4Yht") ? Math.round((100 * sum("ry4Mukana")) / sum("ry4Yht")) : null;
  return { viikko, viite, rivit: rivit.sort((a, b) => b.au - a.au), havainnot, mediaaniOma: mediaani, kirjanneet, os, os4 };
}

// Kooste tekstiksi (sähköpostin tekstiversio ja arkisto) – 6.11.2026: linkki ensin, vain poikkeamat ja osallistuminen
export const KOOSTE_URL = "https://jugisoft.github.io/kpl-testit/#/kooste";
// sähköpostissa poissaolot näkyvät osallistumiskaaviossa, joten ne eivät toistu poikkeamalistassa
const poikkeamat = (k) => k.havainnot.filter((h) => h.koodi !== "eiomia" && h.koodi !== "poissa");
const matalat = (k) => k.rivit.filter((r) => (r.ry4Yht >= 2 && r.os4 < OS_SEURAA) || (r.ryhmaYht >= 2 && r.ryhmaMukana * 2 <= r.ryhmaYht)).sort((a, b) => a.os4 - b.os4 || a.os - b.os || a.nimi.localeCompare(b.nimi, "fi"));
const osTxt = (x) => (x == null ? "–" : `${x} %`);
export function koosteTeksti(k, ryhma) {
  const h = poikkeamat(k), m = matalat(k);
  return [
    `KPL Keskus – viikkokooste ${ryhma}, viikko ${pvLyh(k.viikko)}–${pvLyh(k.viite)}`,
    `Koko kooste: ${KOOSTE_URL}`,
    "",
    `Osallistuminen ryhmätreeneihin: tällä viikolla ${osTxt(k.os)} · 4 viikkoa ${osTxt(k.os4)} · paljon poissa (alle ${OS_RAJA} % 4 vk): ${k.rivit.filter((r) => r.ry4Yht >= 4 && r.os4 < OS_RAJA).length} pelaajaa`,
    "",
    "KUORMA JA MUUT POIKKEAMAT",
    ...(h.length ? h.map((x) => `${x.taso === "varoitus" ? "⚠ " : "• "}${x.teksti}`) : ["Ei kuormaan liittyviä poikkeamia."]),
    ...(m.length ? ["", `MATALA OSALLISTUMINEN (4 viikkoa alle ${OS_SEURAA} % tai tällä viikolla puolet tai alle)`, ...m.map((r) => `• ${r.nimi}: ${r.os4} % (${r.ry4Mukana}/${r.ry4Yht}${r.ry4Out ? `, OUT ${r.ry4Out}` : ""}) · tällä viikolla ${r.ryhmaMukana}/${r.ryhmaYht}`)] : []),
    "",
    "Ryhmätreeni lasketaan pois, jos pelaaja on OUT Nimenhuudossa tai merkinnyt Olin poissa. Kuormat, omatoimiset ja kaikki pelaajat koko koosteessa.",
  ].join("\n");
}

// Sähköpostin HTML (6.11.2026): sähköpostiohjelmiin sopiva taulukkoasettelu, kaikki tyylit rivissä.
const hEsc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function koosteHtml(k, ryhma) {
  const h = poikkeamat(k), m = matalat(k), muut = k.rivit.filter((r) => r.ry4Yht >= 2).length - m.length;
  const vari = (p) => (p == null ? "#8a8378" : p < OS_RAJA ? "#d6283b" : p < OS_SEURAA ? "#c27a00" : "#13865d");
  const merkki = { varoitus: ["▲", "#d6283b"], huomio: ["◆", "#c27a00"], info: ["i", "#6f685d"] };
  const ruutu = (otsikko, arvo, alla) => `<td width="33%" style="padding:12px 14px;background:#f6f3ee;border-radius:8px;vertical-align:top">
      <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6f685d">${otsikko}</div>
      <div style="font-size:28px;font-weight:700;line-height:1.2;color:${typeof arvo === "number" ? vari(arvo) : arvo === "0" ? "#13865d" : arvo === "–" ? "#8a8378" : "#d6283b"}">${typeof arvo === "number" ? `${arvo} %` : hEsc(arvo)}</div>
      <div style="font-size:12px;color:#6f685d">${alla}</div></td>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#1d1b18;font-size:15px;line-height:1.5">
<tr><td style="border-top:4px solid #F5A800;padding:14px 0 4px">
  <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#a37000;font-weight:700">KPL Keskus · Viikkokooste</div>
  <div style="font-size:22px;font-weight:700">${hEsc(ryhma)} · viikko ${pvLyh(k.viikko)}–${pvLyh(k.viite)}</div>
</td></tr>
<tr><td style="padding:12px 0 18px"><a href="${KOOSTE_URL}" style="display:inline-block;background:#F5A800;color:#181818;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:8px">Avaa koko kooste →</a></td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
  ${ruutu("Osallistuminen", k.os ?? "–", "tällä viikolla")}
  ${ruutu("Osallistuminen", k.os4 ?? "–", "4 viikkoa")}
  ${ruutu("Paljon poissa", String(k.rivit.filter((r) => r.ry4Yht >= 4 && r.os4 < OS_RAJA).length), `pelaajaa · ${h.filter((x) => x.taso === "varoitus").length ? `${h.filter((x) => x.taso === "varoitus").length} kuormavaroitusta` : "ei kuormavaroituksia"}`)}
</tr></table></td></tr>
<tr><td style="padding:20px 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#6f685d">Kuorma ja muut poikkeamat</td></tr>
<tr><td>${h.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${h.map((x) => `<tr><td width="22" valign="top" style="padding:6px 0;color:${merkki[x.taso][1]};font-weight:700">${merkki[x.taso][0]}</td><td style="padding:6px 0;border-bottom:1px solid #ece7df">${hEsc(x.teksti)}</td></tr>`).join("")}</table>` : `<div style="color:#6f685d">Ei kuormaan liittyviä poikkeamia.</div>`}</td></tr>
${m.length ? `<tr><td style="padding:22px 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#6f685d">Matalin osallistuminen · 4 viikkoa</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${m.map((r) => `<tr>
  <td width="34%" style="padding:5px 8px 5px 0;font-size:14px;white-space:nowrap">${hEsc(r.nimi)}</td>
  <td style="padding:5px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece7df;border-radius:4px"><tr><td width="${Math.max(2, r.os4)}%" style="background:${vari(r.os4)};height:12px;border-radius:4px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table></td>
  <td width="128" align="right" style="padding:5px 0 5px 10px;font-size:13px;white-space:nowrap"><b style="color:${vari(r.os4)}">${r.os4} %</b> <span style="color:#6f685d">${r.ry4Mukana}/${r.ry4Yht}${r.ry4Out ? ` · OUT ${r.ry4Out}` : ""}</span></td>
</tr>`).join("")}</table>
<div style="font-size:12px;color:#6f685d;padding-top:6px">Palkki = osallistuminen 4 viikossa · punainen alle ${OS_RAJA} % (paljon poissa – selvitä syy) · keltainen alle ${OS_SEURAA} %${muut > 0 ? ` · muut ${muut} pelaajaa ${OS_SEURAA} % tai yli` : ""}.</div></td></tr>` : ""}
<tr><td style="padding:22px 0 0;font-size:12px;color:#6f685d;border-top:1px solid #ece7df">Ryhmätreeni lasketaan pois, jos pelaaja on OUT Nimenhuudossa tai merkinnyt Olin poissa; muuten oletus on, että hän oli mukana. Kuormat, omatoimiset treenit ja kaikki pelaajat: <a href="${KOOSTE_URL}" style="color:#a37000">koko kooste</a>.</td></tr>
</table></td></tr></table></body></html>`;
}
