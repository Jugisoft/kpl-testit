// Kuka tarvitsee huomiota (28.11.2026, Jugi): pelaajakohtaiset signaalit liikennevaloina ja sanallinen analyysi.
// Puhdas logiikka, testit tests/huomio.test.mjs. Kieli myönteinen ja ei-diagnostinen (ei vammariskiväitteitä).
// Tila: "pun" = huomio nyt, "kelt" = seuraa, "vihr" = kunnossa, "odottaa" = ei vielä mitattavissa, "ei" = ei dataa.

export const PISTEET = { pun: 3, kelt: 1, vihr: 0, odottaa: 0, ei: 0 };
const pv = (s) => new Date(s + "T12:00:00");
const paivia = (a, b) => Math.round((pv(b) - pv(a)) / 864e5);
const d1 = (x) => x.toFixed(1).replace(".", ",");

// Ryhmätreenien läsnäolo 4 viikkoa (juniorit; miehillä ei IN/OUT-merkintöjä)
export function laasnaolo(os4, yht) {
  if (yht == null || yht < 4 || os4 == null) return { tila: "ei", teksti: "ei tarpeeksi ryhmätreenejä" };
  return { tila: os4 >= 75 ? "vihr" : os4 >= 60 ? "kelt" : "pun", teksti: `${os4} % (4 vk)`, arvo: os4 };
}

// MSU: oman Treenikeskus-suunnitelman toteutuminen 4 viikkoa (suunnitellut päivät, joilta löytyy tehty treeni)
export function suunnitelma(suunniteltu, tehty) {
  if (!suunniteltu || suunniteltu < 3) return { tila: "ei", teksti: "ei omaa suunnitelmaa" };
  const pct = Math.round((100 * tehty) / suunniteltu);
  return { tila: pct >= 80 ? "vihr" : pct >= 60 ? "kelt" : "pun", teksti: `${pct} % (${tehty}/${suunniteltu})`, arvo: pct };
}

export function kuorma(acwr, lepoViim7) {
  if (acwr == null) return { tila: "ei", teksti: "historia kertyy" };
  const t = acwr > 1.8 || (acwr > 1.5 && lepoViim7 === 0) ? "pun" : acwr > 1.5 || acwr < 0.6 ? "kelt" : "vihr";
  const selite = acwr > 1.5 ? "nousi nopeasti" : acwr < 0.6 ? "selvästi kevyempi" : "omalla tasolla";
  return { tila: t, teksti: `${d1(acwr)} × oma taso · ${selite}${lepoViim7 === 0 ? " · ei lepopäivää" : ""}`, arvo: acwr };
}

export function kirjaukset(viimeisin, tanaan) {
  if (!viimeisin) return { tila: "pun", teksti: "ei kirjauksia 12 viikkoon" };
  const n = paivia(viimeisin, tanaan);
  return { tila: n <= 7 ? "vihr" : n <= 14 ? "kelt" : "pun", teksti: n === 0 ? "tänään" : n === 1 ? "eilen" : `${n} pv sitten`, arvo: n };
}

// Tavoitteet: g = { luotu, takaraja, saavutettu, pct, tuloksiaJalkeen }
export function tavoitteet(lista, tanaan) {
  if (!lista.length) return { tila: "ei", teksti: "ei tavoitteita" };
  const arviot = lista.map((g) => {
    if (g.saavutettu) return "vihr";
    if (g.takaraja && g.takaraja < tanaan) return "pun";
    if (!g.tuloksiaJalkeen) return "odottaa";
    if (!g.takaraja) return g.pct > 0 ? "vihr" : "kelt";
    const aika = Math.max(0, Math.min(1, paivia(g.luotu.slice(0, 10), tanaan) / Math.max(1, paivia(g.luotu.slice(0, 10), g.takaraja))));
    return g.pct >= aika * 100 - 15 ? "vihr" : "kelt";
  });
  const saav = lista.filter((g) => g.saavutettu).length, mit = arviot.filter((a) => a !== "odottaa");
  if (!mit.length) return { tila: "odottaa", teksti: `${lista.length} tavoitetta · mitataan seuraavissa testeissä` };
  const t = mit.includes("pun") ? "pun" : mit.includes("kelt") ? "kelt" : "vihr";
  const jalj = arviot.filter((a) => a === "pun" || a === "kelt").length;
  return { tila: t, teksti: `${saav}/${lista.length} saavutettu${jalj ? ` · ${jalj} jäljessä` : ""}${arviot.includes("odottaa") ? ` · ${arviot.filter((a) => a === "odottaa").length} odottaa testiä` : ""}` };
}

// Lyöntimissio: s = laske()-tulos (tehty, odotettu, valmis, paattynyt)
export function missio(lista) {
  const akt = lista.filter((s) => !s.paattynyt || s.valmis);
  if (!akt.length) return { tila: "ei", teksti: "ei aktiivista missiota" };
  const arvio = (s) => (s.valmis || s.tehty >= 0.9 * s.odotettu ? "vihr" : s.tehty >= 0.6 * s.odotettu ? "kelt" : "pun");
  const a = akt.map(arvio), t = a.includes("pun") ? "pun" : a.includes("kelt") ? "kelt" : "vihr";
  const pct = Math.round(akt.reduce((x, s) => x + Math.min(1.5, s.odotettu ? s.tehty / s.odotettu : 1), 0) / akt.length * 100);
  return { tila: t, teksti: `${pct} % aikataulusta${akt.length > 1 ? ` (${akt.length} missiota)` : ""}` };
}

// Testikehitys: muutokset = [{ testi, nimi, z }] (z = parannus keskihajonnoissa, + parempi). Todellinen muutos ≥ 0,2 SD.
export const SWC = 0.2;
export function testikehitys(muutokset) {
  if (!muutokset.length) return { tila: "ei", teksti: "ei verrattavia testejä", parani: [], heikkeni: [] };
  const parani = muutokset.filter((m) => m.z >= SWC), heikkeni = muutokset.filter((m) => m.z <= -SWC);
  const t = heikkeni.length >= 3 && heikkeni.length >= 2 * parani.length ? "pun" : heikkeni.length > parani.length ? "kelt" : "vihr";
  return { tila: t, teksti: `↑ ${parani.length} · ↓ ${heikkeni.length} · ≈ ${muutokset.length - parani.length - heikkeni.length}`, parani, heikkeni };
}

export const pisteet = (signaalit) => Object.values(signaalit).reduce((s, x) => s + (PISTEET[x?.tila] || 0), 0);
// Huomio nyt: vähintään kaksi punaista signaalia tai punainen kuorma (yksittäinen punainen = seuraa)
export const tarvitseeHuomiota = (signaalit) => Object.values(signaalit).filter((x) => x?.tila === "pun").length >= 2 || signaalit.kuorma?.tila === "pun";

// ---------- Sanallinen analyysi ----------
// Testiluokat ominaisuusryhmiksi (testit.luokka): nopeus, fysiikka, voima (heitto- ja lyöntivoima), lajitaito
export const RYHMAT = { nopeus: "Nopeus", fysiikka: "Fysiikka", voima: "Heitto- ja lyöntivoima", lajitaito: "Lajitaito" };
const VINKIT = {
  nopeus: "lyhyet maksimaaliset pikajuoksut ja lähdöt täydellä palautuksella, ketteryys- ja suunnanmuutosharjoitteet",
  fysiikka: "perusvoima (esim. kyykky, maastaveto, leuat), hyppelyt ja aerobinen peruskunto",
  voima: "räjähtävät heitto- ja rotaatioliikkeet (kuntopallo), heittomäärät ja kovat lyönnit",
  lajitaito: "lyöntitaidon toistot: näpyt, rajalyönnit ja kovat lyönnit sekä lyöntipäiväkirjan missiot",
};
const taso = (T) => (T >= 58 ? "selvästi ryhmän yläpäätä" : T >= 53 ? "ryhmän keskitason yläpuolella" : T >= 47 ? "ryhmän keskitasoa" : T >= 42 ? "hieman ryhmän keskitason alapuolella" : "selvästi ryhmän keskitason alapuolella");

// testit = profiilin rivit [{ testi, T }], luokat = { testikoodi: luokka }, nimet = { testikoodi: nimi }
export function ryhmaT(testit, luokat) {
  const out = {};
  for (const [k] of Object.entries(RYHMAT)) {
    const T = testit.filter((x) => luokat[x.testi] === k && x.T != null).map((x) => x.T);
    if (T.length) out[k] = { T: T.reduce((a, b) => a + b, 0) / T.length, n: T.length };
  }
  return out;
}

export function sanallinen({ etunimi, indeksi, testit, luokat, nimet, ryhmaNimi, signaalit = {}, kehitys = null }) {
  const lauseet = [];
  const R = ryhmaT(testit, luokat);
  const lista = Object.entries(R).sort((a, b) => b[1].T - a[1].T);
  if (indeksi == null || !lista.length) lauseet.push("Testituloksia ei ole vielä tarpeeksi ominaisuusprofiiliin.");
  else {
    lauseet.push(`Kokonaisuutena ${etunimi} on testeissä ${taso(indeksi)} (indeksi ${Math.round(indeksi)}, ryhmä ${ryhmaNimi} = 50).`);
    if (lista.length >= 2) {
      const [vk, v] = lista[0], [hk, h] = lista.at(-1);
      if (v.T - h.T >= 8) {
        lauseet.push(`Profiili on epätasainen: vahvuus on ${RYHMAT[vk].toLowerCase()} (${Math.round(v.T)}), mutta ${RYHMAT[hk].toLowerCase()} jää selvästi jälkeen (${Math.round(h.T)}).`);
        lauseet.push(`Harjoittelun painopisteeksi kannattaa nostaa ${RYHMAT[hk].toLowerCase()}: ${VINKIT[hk]}. Vahvuuden (${RYHMAT[vk].toLowerCase()}) ylläpitoon riittää normaali harjoittelu.`);
      } else lauseet.push(`Profiili on tasainen: ominaisuusryhmien ero on pieni (${lista.map(([k, x]) => `${RYHMAT[k].toLowerCase()} ${Math.round(x.T)}`).join(", ")}).`);
    }
    const heikot = testit.filter((x) => x.T != null && x.T < 42).sort((a, b) => a.T - b.T).slice(0, 3);
    const vahvat = testit.filter((x) => x.T != null && x.T >= 60).sort((a, b) => b.T - a.T).slice(0, 3);
    if (vahvat.length) lauseet.push(`Erityisen vahvoja testejä: ${vahvat.map((x) => `${nimet[x.testi] || x.testi} (${Math.round(x.T)})`).join(", ")}.`);
    if (heikot.length) lauseet.push(`Selvimmät kehityskohteet yksittäisistä testeistä: ${heikot.map((x) => `${nimet[x.testi] || x.testi} (${Math.round(x.T)})`).join(", ")}.`);
  }
  if (kehitys && (kehitys.parani.length || kehitys.heikkeni.length)) {
    const n = (l) => l.map((m) => m.nimi).slice(0, 3).join(", ");
    lauseet.push(`Edellisiin testeihin verrattuna ${kehitys.parani.length ? `parantunut: ${n(kehitys.parani)}` : "ei selviä parannuksia"}${kehitys.heikkeni.length ? `; heikentynyt: ${n(kehitys.heikkeni)}` : ""}.`);
  }
  const s = signaalit;
  if (s.kuorma?.tila === "pun" || s.kuorma?.tila === "kelt") lauseet.push(s.kuorma.arvo > 1.5 ? "Kuorma on noussut viime viikolla nopeasti omaan tavalliseen tasoon nähden – kannattaa jutella palautumisesta ja tulevan viikon määristä." : "Viimeinen viikko on ollut selvästi tavallista kevyempi – sairaus, tauko vai motivaatio?");
  if (s.kirjaukset?.tila === "pun") lauseet.push("Omia kirjauksia ei ole tullut pitkään aikaan; muistutus kirjaamisesta tai kysymys tilanteesta on paikallaan.");
  if (s.laasnaolo?.tila === "pun") lauseet.push("Ryhmätreenien läsnäolo on ollut matala viimeisen kuukauden aikana.");
  if (s.suunnitelma?.tila === "pun") lauseet.push("Oman treenisuunnitelman toteutuminen on jäänyt vajaaksi – onko suunnitelma realistinen?");
  if (s.missio?.tila === "pun") lauseet.push("Lyöntimissio on jäljessä aikataulusta.");
  if (s.tavoitteet?.tila === "pun") lauseet.push("Osa tavoitteista on jäänyt saavuttamatta takarajaan mennessä – päivitetäänkö tavoite?");
  return lauseet;
}
