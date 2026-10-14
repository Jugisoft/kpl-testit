// Vastustajakortti: tulostettava A4-tiivistelmä vastustajasta ottelupäivää varten.
// Kokoaa yhteen: kokoonpano 2027 ja siirrot, pelaajien tilastot 2026 (taulu tilastot, YDIN 2027 / pesistulokset.fi),
// suunnitellut roolit, kirjatut lyönnit, sisä- ja ulkopelin jaetut tekstit, fläppitaulun kuviot, Jarvisin kooste ja muistiinpanot.
// Valmennus-osion sisältöä ei käytetä (vain luokka = 'vastustaja').
import { sb } from "../db.js";
import { $, $$, esc } from "../util.js";
import { haeSiirtomarkkinat, haePelaajat, haeKoosteet, md, sukunimiJarjestys, kirjoittajanNimi, lataaNimet, VASTUSTAJAT, pvmFi } from "../keskus.js";
import { kenttaSvg, TILANTEET, LYONTITYYPIT, ROOLIT, FIELD, tyyppiTieto } from "../kentta.js";

const KAUSI = 2026;
const OSIOT = [
  ["tilastot", "Joukkueen luvut 2026"],
  ["lyojat", "Kokoonpano ja lyöjät"],
  ["sisapeli", "Sisäpelin yleiskuva"],
  ["ulkopeli", "Ulkopeli tilanteittain"],
  ["kuviot", "Fläppitaulun kuviot"],
  ["kartta", "Lyöntikartta"],
  ["kooste", "Jarvisin kooste"],
  ["muistiinpanot", "Muistiinpanot"],
  ["viivat", "Tyhjä tila omille merkinnöille"],
];
const JARJESTYKSET = [["yht", "YHT"], ["rooli", "Suunniteltu rooli"], ["numero", "Pelinumero"], ["nimi", "Sukunimi"]];
const SARAKKEET = [...TILANTEET, "Jokeri"];
const lyhyt = (t) => ({ "Ajolähtö (1–2–3)": "Ajo", Jokeri: "J" }[t] || t.replace("-tilanne", ""));

const asetukset = (() => {
  const oletus = { osiot: Object.fromEntries(OSIOT.map(([k]) => [k, true])), jarjestys: "yht", piilotetutKuviot: [] };
  try { const s = JSON.parse(localStorage.getItem("kpl-kortti") || "null"); if (s) return { ...oletus, ...s, osiot: { ...oletus.osiot, ...s.osiot } }; } catch { /* ei tallennusta */ }
  return oletus;
})();
const tallennaAsetukset = () => { try { localStorage.setItem("kpl-kortti", JSON.stringify(asetukset)); } catch { /* ei tallennusta */ } };

const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const pros = (x, d = 1) => (x == null || Number.isNaN(x) ? "–" : x.toFixed(d).replace(".", ","));
const osuus = (a, b) => (b ? (100 * a) / b : null);
const Y = (y) => 100 - y;

let D = null; // ladattu data

export async function nayta(main, joukkue) {
  if (!joukkue || !VASTUSTAJAT.includes(joukkue)) return valitse(main, joukkue);
  main.innerHTML = `<p class="lataa">Kootaan vastustajakorttia…</p>`;
  const [sm, pelaajat, tilastot, tekstit, kuviot, huomiot, koosteet, , jo] = await Promise.all([
    haeSiirtomarkkinat().catch(() => null),
    haePelaajat(),
    sb.from("tilastot").select("tyyppi,ref_id,nimi,joukkue,data").eq("kausi", KAUSI).eq("vaihe", "runko"),
    sb.from("vastustaja_tekstit").select("*").eq("joukkue", joukkue),
    sb.from("vastustaja_kuviot").select("*").eq("joukkue", joukkue),
    sb.from("huomiot").select("id,otsikko,teksti,luokka,vastustaja,tyyppi,pelaaja_id,tiedot,ottelu_pvm,kirjoittaja,luotu").eq("luokka", "vastustaja").eq("vastustaja", joukkue).order("luotu", { ascending: false }).limit(2000),
    haeKoosteet().catch(() => []),
    lataaNimet().catch(() => null),
    sb.from("analyysit").select("data").eq("avain", "juoksuodotus_2026").maybeSingle(),
  ]);
  for (const r of [tilastot, tekstit, kuviot, huomiot]) if (r.error) throw r.error;
  D = {
    joukkue, sm, pelaajat,
    tilastot: tilastot.data || [],
    tekstit: new Map((tekstit.data || []).map((t) => [t.avain, t])),
    kuviot: (kuviot.data || []).sort((a, b) => (a.luotu || "").localeCompare(b.luotu || "")),
    huomiot: huomiot.data || [],
    kooste: koosteet.find((k) => k.aihe === `vastustaja:${joukkue}`),
    kynnys: kynnyksetTilanteittain(jo?.data?.data),
  };
  piirra(main);
}

function valitse(main, virhe) {
  main.innerHTML = `<h1>Vastustajakortti</h1>
    <p class="ingressi">Yhden joukkueen tiivistelmä ottelupäivää varten: lyöjät tilastoineen ja rooleineen, ulkopelin kuviot ja valmennuksen havainnot. Tulostuu A4-arkeille.</p>
    ${virhe ? `<p class="pieni">Joukkuetta ${esc(virhe)} ei ole Superpesis 2027 -vastustajissa.</p>` : ""}
    <ul class="kt-valinta">${VASTUSTAJAT.map((j) => `<li><a class="btn" href="#/kortti/${j}">${esc(j)}</a></li>`).join("")}</ul>`;
}

// ---------------- data ----------------

function joukkueData() {
  const { joukkue, sm, pelaajat, tilastot, huomiot } = D;
  const pt = tilastot.filter((t) => t.tyyppi === "pelaaja");
  const indeksi = new Map();
  pt.forEach((t) => { const n = norm(t.nimi); (indeksi.get(n) || indeksi.set(n, []).get(n)).push(t); });
  const tilasto = (nimi) => { const e = indeksi.get(norm(nimi)) || []; return e.sort((a, b) => (b.data.O || 0) - (a.data.O || 0))[0] || null; };
  const siirrot = sm?.siirrot || [];
  const tulleet = new Map(siirrot.filter((s) => s.Mihin === joukkue).map((s) => [norm(s.Pelaaja), s]));
  const lyonnit = huomiot.filter((h) => h.tyyppi === "lyonti");
  // Kokoonpano: Muistion pelaajat + siirtomarkkinoiden sopimuslista (jos joku puuttuu Muistiosta)
  const kok = sm?.kokoonpanot?.[joukkue] || {};
  const omat = [...pelaajat.values()].filter((p) => p.joukkue === joukkue);
  const kokoonpano = omat.filter((p) => p.aktiivinen);
  (kok.sopimus || "").split(";").map((s) => s.trim().replace(/^\*/, "")).filter(Boolean).forEach((s) => {
    const nimi = (s.match(/^(.*?)\s+(?:19|20)\d\d/) || [, s])[1].trim();
    if (nimi && !omat.some((p) => norm(p.nimi) === norm(nimi))) kokoonpano.push({ id: null, nimi, roolit: [], numero: null, vainSopimus: true });
  });
  const rivit = kokoonpano.map((p) => {
    const t = tilasto(p.nimi);
    const hs = p.id ? lyonnit.filter((h) => h.pelaaja_id === p.id) : [];
    return { p, t: t?.data || null, tJoukkue: t?.joukkue || null, tullut: tulleet.get(norm(p.nimi)) || null, lyonnit: hs };
  });
  const jarj = {
    yht: (a, b) => (b.t?.YHT ?? -1) - (a.t?.YHT ?? -1) || sukunimiJarjestys(a.p, b.p),
    rooli: (a, b) => rooliIndeksi(a.p) - rooliIndeksi(b.p) || (b.t?.YHT ?? -1) - (a.t?.YHT ?? -1),
    numero: (a, b) => (a.p.numero ?? 999) - (b.p.numero ?? 999) || sukunimiJarjestys(a.p, b.p),
    nimi: (a, b) => sukunimiJarjestys(a.p, b.p),
  }[asetukset.jarjestys] || ((a, b) => 0);
  rivit.sort(jarj);
  // Lähteneet kokoonpanodatasta ("Nimi > Mihin"), ei valmentajia
  const lahteneet = (kok.lahtijat || "").split(";").map((s) => s.trim()).filter((s) => s && !/^\d?\.?\s*PJ\b/.test(s)).map((s) => {
    const [nimi, mihin] = s.split(" > ").map((x) => x.trim());
    const t = tilasto(nimi);
    return { nimi, mihin: mihin || "", yht: t?.joukkue === joukkue ? t.data.YHT : null };
  }).sort((a, b) => (b.yht ?? -1) - (a.yht ?? -1));
  const jt = tilastot.find((t) => t.tyyppi === "joukkue" && t.joukkue === joukkue)?.data || null;
  const kaikkiJ = tilastot.filter((t) => t.tyyppi === "joukkue").map((t) => t.data);
  return { rivit, lahteneet, jt, kaikkiJ, lyonnit, kok };
}
const rooliIndeksi = (p) => { const i = SARAKKEET.findIndex((t) => (p.roolit || []).includes(t)); return i < 0 ? 99 : i; };

// Kärkilyönnin kynnys (juoksuodotus 2026) kärkietenijän pesän mukaan: painotettu keskiarvo tilanteista ja paloista
export function kynnyksetTilanteittain(jo) {
  if (!jo?.karkilyonti) return null;
  const karki = (t) => (t === "0" ? 0 : Math.max(...t.split("–").map(Number)));
  const sum = [0, 0, 0, 0], n = [0, 0, 0, 0];
  Object.entries(jo.karkilyonti).forEach(([k, v]) => { if (v.kynnys == null) return; const b = karki(k.split("|")[0]), m = v.n_onnistui + v.n_epaonnistui; sum[b] += v.kynnys * m; n[b] += m; });
  return sum.map((x, b) => (n[b] ? x / n[b] : null));
}

// Sarjan KL% tilanteittain (kärkietenijän pesä) (kaikkien joukkueiden vastustajasummista = koko sarjan kärkilyönnit)
function sarjanKL(kaikki) {
  return [0, 1, 2, 3].map((b) => osuus(kaikki.reduce((s, j) => s + (j[`pe_total_b${b}_opponent`] || 0), 0), kaikki.reduce((s, j) => s + (j[`pe_tries_b${b}_opponent`] || 0), 0)));
}

// ---------------- piirto ----------------

function piirra(main) {
  const { joukkue, sm, tekstit, kuviot, huomiot, kooste } = D;
  const J = joukkueData();
  const nimi = sm?.joukkueiden_nimet?.[joukkue] || joukkue;
  const pj = sm?.pelinjohtajat?.find((p) => p.Joukkue === joukkue);
  const vaikutus = sm?.vaikutus?.find((v) => v.Joukkue === joukkue);
  const nyt = new Date();
  const o = asetukset.osiot;
  const naytettavat = kuviot.filter((k) => !asetukset.piilotetutKuviot.includes(k.id));

  main.innerHTML = `
    <div class="kt-ohjaus" aria-label="Kortin asetukset">
      <div class="kt-ohjaus-paa">
        <div>
          <h1>Vastustajakortti</h1>
          <p class="pieni">Valitse, mitä korttiin tulee, ja tulosta. Tulostus- tai PDF-ikkunassa valitse paperiksi A4.</p>
        </div>
        <div class="rivi">
          <label class="kt-joukkue"><span class="sr">Joukkue</span><select id="kt-joukkue">${VASTUSTAJAT.map((j) => `<option${j === joukkue ? " selected" : ""}>${esc(j)}</option>`).join("")}</select></label>
          <a class="btn" href="#/muistio/${esc(joukkue)}/sisapeli">Muokkaa tietoja</a>
          <button class="btn ensisij" id="kt-tulosta" type="button">Tulosta tai tallenna PDF</button>
        </div>
      </div>
      <div class="kt-valinnat">
        <fieldset><legend>Sisältö</legend><div class="chipit pieni-chipit">${OSIOT.map(([k, n]) => `<label class="chip"><input type="checkbox" data-osio="${k}"${o[k] ? " checked" : ""}>${esc(n)}</label>`).join("")}</div></fieldset>
        <fieldset><legend>Lyöjien järjestys</legend><div class="chipit pieni-chipit">${JARJESTYKSET.map(([k, n]) => `<button type="button" class="chip" data-jarj="${k}" aria-pressed="${asetukset.jarjestys === k}">${esc(n)}</button>`).join("")}</div></fieldset>
        ${kuviot.length && o.kuviot ? `<fieldset><legend>Kuviot korttiin</legend><div class="chipit pieni-chipit">${kuviot.map((k) => `<label class="chip"><input type="checkbox" data-kuvio="${k.id}"${asetukset.piilotetutKuviot.includes(k.id) ? "" : " checked"}>${esc(lyhytTilanne(k.tilanne))}: ${esc(k.nimi || "Nimetön")}</label>`).join("")}</div></fieldset>` : ""}
      </div>
    </div>

    <article class="kt-paperi" aria-label="Vastustajakortti ${esc(nimi)}">
      <header class="kt-paa">
        <div class="kt-tunnus" aria-hidden="true">${esc(joukkue)}</div>
        <div class="kt-otsikko">
          <p class="kt-laji">Vastustajakortti, Superpesis 2027</p>
          <h2>${esc(nimi)}</h2>
          <dl class="kt-meta">
            <div><dt>Pelinjohtaja</dt><dd>${esc(pj?.["PJ 2027"] && pj["PJ 2027"] !== "?" ? pj["PJ 2027"] : "ei tiedossa")}</dd></div>
            <div><dt>Kokoonpano</dt><dd>${J.rivit.length} pelaajaa${J.rivit.filter((r) => r.tullut).length ? `, ${J.rivit.filter((r) => r.tullut).length} uutta` : ""}</dd></div>
            ${vaikutus ? `<div><dt>Siirtojen vaikutus</dt><dd>${netto(vaikutus["Netto yhteensä %"])}${vaikutus.Arvio ? `, ${esc(vaikutus.Arvio.toLowerCase())}` : ""}</dd></div>` : ""}
            <div><dt>Koottu</dt><dd>${nyt.toLocaleDateString("fi-FI")}</dd></div>
          </dl>
        </div>
        <img class="kt-logo" src="img/kpl-logo-192.png" alt="KPL" width="44" height="44">
      </header>

      ${o.tilastot ? tilastoLohko(J) : ""}
      ${o.lyojat ? lyojaLohko(J) : ""}
      ${o.sisapeli ? tekstiLohko("Sisäpelin yleiskuva", tekstit.get("sisapeli:yleinen")?.teksti, "Sisäpelin yleiskuvaa ei ole vielä kirjoitettu. Kirjoita se Muistiossa joukkueen Sisäpeli-välilehdellä.") : ""}
      ${o.ulkopeli ? ulkopeliLohko(tekstit, huomiot) : ""}
      ${o.kuviot ? kuvioLohko(naytettavat) : ""}
      ${o.kartta ? karttaLohko(J) : ""}
      ${o.kooste && kooste ? `<section class="kt-lohko kt-kooste"><h3>Jarvisin kooste <span class="kt-lisa">${kooste.huomioita} muistiinpanosta, päivitetty ${new Date(kooste.paivitetty).toLocaleDateString("fi-FI")}</span></h3><div class="md">${md(kooste.sisalto)}</div></section>` : ""}
      ${o.muistiinpanot ? muistiinpanoLohko(huomiot) : ""}
      ${o.viivat ? `<section class="kt-lohko kt-viivat"><h3>Omat merkinnät</h3>${'<div class="kt-viiva"></div>'.repeat(7)}</section>` : ""}

      <footer class="kt-ala">
        <span>KPL Keskus, luottamuksellinen: vain valmennuksen ja joukkueen käyttöön.</span>
        <span>Tilastot: pesistulokset.fi, runkosarja ${KAUSI}. Siirrot: seurojen tiedotteet${sm?.tilannekatsaus_paivitetty ? `, tilanne ${esc(sm.tilannekatsaus_paivitetty)}` : ""}.</span>
      </footer>
    </article>`;

  $("#kt-joukkue", main).onchange = (e) => (location.hash = `#/kortti/${e.target.value}`);
  $("#kt-tulosta", main).onclick = () => {
    const vanha = document.title;
    document.title = `Vastustajakortti ${joukkue} ${nyt.toLocaleDateString("fi-FI")}`;
    addEventListener("afterprint", () => (document.title = vanha), { once: true });
    print();
  };
  $$("[data-osio]", main).forEach((c) => (c.onchange = () => { asetukset.osiot[c.dataset.osio] = c.checked; tallennaAsetukset(); piirra(main); }));
  $$("[data-jarj]", main).forEach((b) => (b.onclick = () => { asetukset.jarjestys = b.dataset.jarj; tallennaAsetukset(); piirra(main); }));
  $$("[data-kuvio]", main).forEach((c) => (c.onchange = () => {
    const id = c.dataset.kuvio, s = new Set(asetukset.piilotetutKuviot);
    if (c.checked) s.delete(id); else s.add(id);
    asetukset.piilotetutKuviot = [...s]; tallennaAsetukset(); piirra(main);
  }));
}

const netto = (x) => (x == null || x === "" ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(0)} %`);
const lyhytTilanne = (t) => (t === "Yleinen" ? "Yleinen" : lyhyt(t));

// Joukkueen luvut: tulosrivi ja kaksi pesäkohtaista palkkikaaviota (oma sisäpeli ja vastustajien sisäpeli tätä joukkuetta vastaan)
function tilastoLohko(J) {
  const { jt, kaikkiJ } = J;
  if (!jt) return `<section class="kt-lohko kt-luvut"><p class="kt-tyhja">${esc(D.joukkue)} pelasi kauden ${KAUSI} Ykköspesiksessä, joten Superpesiksen vertailulukuja ei ole. Pelaajien taustat näkyvät alla.</p></section>`;
  const sarja = sarjanKL(kaikkiJ);
  const sarjaKL = osuus(kaikkiJ.reduce((s, j) => s + (j.pe_total || 0), 0), kaikkiJ.reduce((s, j) => s + (j.pe_tries_total || 0), 0));
  const oma = [0, 1, 2, 3].map((b) => jt[`KL%${b}`]);
  const vast = [0, 1, 2, 3].map((b) => osuus(jt[`pe_total_b${b}_opponent`], jt[`pe_tries_b${b}_opponent`]));
  const sija = (avain, pieni = false) => { const a = kaikkiJ.map((j) => j[avain]).filter((x) => x != null).sort((x, y) => (pieni ? x - y : y - x)); return a.indexOf(jt[avain]) + 1; };
  const vastKL = osuus(jt.pe_total_opponent, jt.pe_tries_total_opponent);
  const vastSija = kaikkiJ.map((j) => osuus(j.pe_total_opponent, j.pe_tries_total_opponent)).sort((a, b) => a - b).indexOf(vastKL) + 1;
  const pesa = ["0-tilanne", "1-tilanne", "2-tilanne", "3-tilanne"];
  const kaavio = (arvot, otsikko, selite, alhaalla) => `
    <figure class="kt-kaavio">
      <figcaption><b>${otsikko}</b><span>${selite}</span></figcaption>
      ${arvot.map((v, b) => {
        const ero = v - sarja[b], hyva = alhaalla ? ero < -1.5 : ero > 1.5, heikko = alhaalla ? ero > 1.5 : ero < -1.5;
        return `<div class="kt-palkki${hyva ? " vahva" : heikko ? " heikko" : ""}" title="KL% ${pesa[b]} ${pros(v)} %, sarja ${pros(sarja[b])} %">
          <span class="kt-pk">${pesa[b]}</span>
          <span class="kt-pa"><span class="kt-pt" style="width:${Math.max(0, Math.min(100, ((v - 30) / 45) * 100))}%"></span><span class="kt-pka" style="left:${((sarja[b] - 30) / 45) * 100}%"></span></span>
          <span class="kt-pv num">${pros(v)}</span><span class="kt-pe num">${ero >= 0 ? "+" : "−"}${pros(Math.abs(ero))}</span></div>`;
      }).join("")}
    </figure>`;
  return `<section class="kt-lohko kt-luvut">
    <div class="kt-avainluvut">
      <div><b class="num">${jt.voitot ?? "–"}</b><span>voittoa ${jt.O} ottelusta</span></div>
      <div><b class="num">${jt.runs}<i>–</i>${jt.runs_opponent}</b><span>juoksut, tehty–päästetty</span></div>
      <div><b class="num">${pros(jt["KL%"])}</b><span>KL %, sarjan ${sija("KL%")}. (ka ${pros(sarjaKL)})</span></div>
      <div><b class="num">${pros(jt["KL%3"])}</b><span>kotiutus-% (3-tilanne), sarjan ${sija("KL%3")}.</span></div>
      <div><b class="num">${pros(vastKL)}</b><span>vastustajien KL %, sarjan ${vastSija}. paras</span></div>
      <div><b class="num">${jt.homeruns}<i>–</i>${jt.homeruns_opponent}</b><span>kunnarit, lyöty–päästetty</span></div>
    </div>
    <div class="kt-kaaviot">
      ${kaavio(oma, "Sisäpeli: onnistuminen tilanteittain", "0-tilanteessa kentälle pääsy, muuten kärkietenijän eteneminen. Viiva = sarjan keskiarvo, oikealla ero siihen.", false)}
      ${kaavio(vast, "Ulkopeli: vastustajien onnistuminen tilanteittain", "Mitä pienempi, sitä paremmin he pysäyttävät", true)}
    </div>
    <p class="kt-huom">Runkosarja ${KAUSI}, ${jt.O} ottelua. Kokoonpano on muuttunut siirroissa, joten joukkueen luvut kuvaavat viime kauden pelitapaa, eivät kauden 2027 tasoa.</p>
  </section>`;
}

function lyojaLohko(J) {
  const { rivit, lahteneet } = J;
  const TY = Object.fromEntries(LYONTITYYPIT.map(([k, n]) => [k, n]));
  const kl = (t, b) => {
    const s = b == null ? t.KL : t[`KL${b}`], y = b == null ? t.KLY : t[`KLY${b}`];
    if (!y) return `<td class="n kt-ei">–</td>`;
    const v = (100 * s) / y, pieni = y < 10;
    const raja = b == null ? null : D.kynnys?.[b];
    const yli = !pieni && raja != null && v >= raja * 100;
    return `<td class="n${pieni ? " kt-pieni-otos" : ""}${yli ? " kt-hyva" : ""}" title="${s}/${y}${pieni ? ", pieni otos" : ""}${raja != null ? `, kynnys ${Math.round(raja * 100)} %` : ""}">${pros(v, 0)}<small>${y}</small></td>`;
  };
  const roolit = (p) => SARAKKEET.filter((t) => (p.roolit || []).includes(t)).map((t) => `<span class="kt-rooli">${esc(lyhyt(t))}</span>`).join("");
  const kirjatut = (hs) => {
    if (!hs.length) return "";
    const lask = {}; hs.forEach((h) => { const k = h.tiedot?.tyyppi; if (k) lask[k] = (lask[k] || 0) + 1; });
    const ylin = Object.entries(lask).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => `${TY[k] || k} ${n}`).join(", ");
    const puoli = hs.filter((h) => h.tiedot?.x != null);
    const vasen = puoli.filter((h) => h.tiedot.x < -5).length, oikea = puoli.filter((h) => h.tiedot.x > 5).length;
    const suunta = puoli.length >= 3 ? [[vasen, "3-raja"], [puoli.length - vasen - oikea, "keski"], [oikea, "2-raja"]].sort((a, b) => b[0] - a[0])[0][1] : "";
    return `<span class="kt-kirj">${hs.length} kirjattua${ylin ? `: ${esc(ylin)}` : ""}${suunta ? `, pääosin ${suunta}` : ""}</span>`;
  };
  const tausta = (r) => {
    if (r.tullut) return `<span class="kt-uusi">Uusi</span>${r.tullut.Mistä && r.tullut.Mistä !== "–" ? ` ${esc(r.tullut.Mistä)}` : ""}`;
    if (r.tJoukkue && r.tJoukkue !== D.joukkue) return `Kausi 2026: ${esc(r.tJoukkue)}`;
    return "";
  };
  return `<section class="kt-lohko kt-lyojat">
    <h3>Kokoonpano 2027 ja lyöjät <span class="kt-lisa">Tilastot runkosarja ${KAUSI}. Tilanteittain: 0 = kentälle pääsy, 1–3 = kärkietenijän pesä; pienellä yritykset. Keltainen alleviivaus = yli kärkilyönnin kynnyksen (juoksuodotus). Harmaa = alle 10 yritystä.</span></h3>
    <table class="kt-taulu">
      <thead><tr class="kt-ryhma"><th colspan="8"></th><th colspan="4" class="kt-ryhma-otsikko">KL % tilanteittain</th></tr><tr>
        <th class="n">#</th><th class="kt-nimi">Pelaaja</th><th>Rooli</th>
        <th class="n" title="Ottelut">O</th><th class="n" title="Kunnarit + lyödyt">K+L</th><th class="n" title="Tuodut">T</th><th class="n" title="Yhteensä">YHT</th>
        <th class="n" title="Kärkilyöntiprosentti">KL %</th><th class="n" title="0-tilanne: lyöjä pääsee kentälle etenijäksi">0</th><th class="n" title="1-tilanne: kärkietenijä ykköseltä eteenpäin">1</th><th class="n" title="2-tilanne: kärkietenijä kakkoselta eteenpäin">2</th><th class="n" title="3-tilanne: kotiutus">3</th>
      </tr></thead>
      <tbody>${rivit.map((r) => `<tr>
        <td class="n kt-nro">${r.p.numero ?? ""}</td>
        <td class="kt-nimi"><b>${esc(r.p.nimi)}</b>${tausta(r) ? `<span class="kt-tausta">${tausta(r)}</span>` : ""}${r.p.kuvaus ? `<span class="kt-kuvaus">${esc(r.p.kuvaus)}</span>` : ""}${kirjatut(r.lyonnit)}</td>
        <td class="kt-roolit">${roolit(r.p)}</td>
        ${r.t ? `<td class="n">${r.t.O}</td><td class="n">${r.t.K}+${r.t.L}</td><td class="n">${r.t.T}</td><td class="n kt-yht">${r.t.YHT}</td>${kl(r.t)}${kl(r.t, 0)}${kl(r.t, 1)}${kl(r.t, 2)}${kl(r.t, 3)}`
          : `<td class="kt-ei" colspan="9">Ei Superpesis-otteluita ${KAUSI}</td>`}
      </tr>`).join("") || `<tr><td colspan="12" class="kt-ei">Kokoonpanoa ei ole vielä tuotu. Lisää pelaajat Muistiossa.</td></tr>`}</tbody>
    </table>
    ${lahteneet.length ? `<p class="kt-lahteneet"><b>Lähteneet (${lahteneet.length}):</b> ${lahteneet.map((l) => `${esc(l.nimi)}${l.yht != null ? ` <span class="num">${l.yht} YHT</span>` : ""}${l.mihin ? ` (${esc(l.mihin)})` : ""}`).join(", ")}</p>` : ""}
  </section>`;
}

function tekstiLohko(otsikko, teksti, tyhja) {
  return `<section class="kt-lohko${teksti ? "" : " kt-tyhja-lohko"}"><h3>${esc(otsikko)}</h3>${teksti ? `<div class="md">${md(teksti)}</div>` : `<p class="kt-tyhja">${esc(tyhja)}</p>`}</section>`;
}

function ulkopeliLohko(tekstit, huomiot) {
  const tilanteet = ["Yleinen", ...TILANTEET];
  const havainnot = (t) => huomiot.filter((h) => h.tyyppi === "muistiinpano" && h.tiedot?.osa === "ulkopeli" && (h.tiedot?.tilanne || "Yleinen") === t);
  const osat = tilanteet.map((t) => {
    const teksti = tekstit.get(`ulkopeli:${t}`)?.teksti;
    const hv = havainnot(t).slice(0, 3);
    if (!teksti && !hv.length) return "";
    return `<div class="kt-ulko"><h4>${esc(t === "Yleinen" ? "Yleisesti" : t)}</h4>${teksti ? `<div class="md">${md(teksti)}</div>` : ""}
      ${hv.length ? `<ul class="kt-havainnot">${hv.map((h) => `<li>${esc(h.otsikko)}${h.teksti && h.teksti !== h.otsikko ? `<span> ${esc(h.teksti.slice(0, 220))}${h.teksti.length > 220 ? "…" : ""}</span>` : ""}</li>`).join("")}</ul>` : ""}</div>`;
  }).filter(Boolean);
  return `<section class="kt-lohko${osat.length ? "" : " kt-tyhja-lohko"}"><h3>Ulkopeli tilanteittain</h3>${osat.length ? `<div class="kt-ulkoruudukko">${osat.join("")}</div>` : `<p class="kt-tyhja">Ulkopelistä ei ole vielä kirjoitettu. Kirjoita tilanteittain Muistiossa joukkueen Ulkopeli-välilehdellä.</p>`}</section>`;
}

// Etenijät tilanteen mukaan (sama logiikka kuin fläppitaulussa)
function etenijat(tilanne) {
  const p = new Set();
  if (/Ajolähtö/.test(tilanne || "")) [1, 2, 3].forEach((n) => p.add(n));
  else { const m = (tilanne || "").match(/^([0-3](?:–[0-3])?)-tilanne/); if (m) m[1].split("–").map(Number).filter(Boolean).forEach((n) => p.add(n)); }
  const siirto = { 1: [-2, 1.5], 2: [1.5, -2.5], 3: [-1.5, -2.5] };
  return [...p].map((n) => { const [x, y] = FIELD.bases[n]; return { n, x: x + siirto[n][0], y: y + siirto[n][1] }; });
}

function kuvioSvg(k, i) {
  const d = k.data || {}, a = d.a || {}, b = d.b || {};
  const perus = k.perus_id ? D.kuviot.find((x) => x.id === k.perus_id) : null;
  const sukunimi = (id) => (D.pelaajat.get(id)?.nimi || "").split(" ").at(-1);
  let h = `<defs><marker id="kt-karki-${i}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="kt-karki"/></marker></defs>`;
  etenijat(k.tilanne).forEach((e) => { h += `<g class="kt-etenija"><circle cx="${e.x}" cy="${Y(e.y)}" r="1.6"/><text x="${e.x}" y="${Y(e.y) + .6}" text-anchor="middle">E${e.n}</text></g>`; });
  ROOLIT.forEach(([r]) => {
    const p = a[r], q = b[r]; if (!p || !q) return;
    const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy);
    if (l > .8) { const s = Math.max(0, l - 2.3) / l; h += `<line class="kt-nuoli" x1="${p.x}" y1="${Y(p.y)}" x2="${p.x + dx * s}" y2="${Y(p.y + dy * s)}" marker-end="url(#kt-karki-${i})"/>`; }
  });
  ROOLIT.forEach(([r]) => {
    const p = a[r]; if (!p) return;
    const pid = d.pelaajat?.[r];
    const vaihto = perus && pid && (perus.data?.pelaajat?.[r] || "") !== pid;
    h += `<g class="kt-pel${vaihto ? " vaihto" : ""}"><circle cx="${p.x}" cy="${Y(p.y)}" r="2.3"/><text x="${p.x}" y="${Y(p.y) + .7}" text-anchor="middle">${r}</text>${pid ? `<text class="kt-pnimi" x="${p.x}" y="${Y(p.y) + 4.6}" text-anchor="middle">${esc(sukunimi(pid))}</text>` : ""}</g>`;
  });
  return kenttaSvg({ id: `kt-kuvio-${i}` }).replace("</svg>", `${h}</svg>`);
}

function kuvioLohko(kuviot) {
  if (!kuviot.length) return `<section class="kt-lohko kt-tyhja-lohko"><h3>Fläppitaulun kuviot</h3><p class="kt-tyhja">Kuvioita ei ole piirretty tai kaikki on rajattu pois. Piirrä ne Ulkopeli-välilehden fläppitaululle.</p></section>`;
  return `<section class="kt-lohko kt-kuviot"><h3>Fläppitaulun kuviot <span class="kt-lisa">Pelaajat asetelmassa, nuoli = liike syötöstä. Keltainen = paikkaa vaihtanut pelaaja peruskuvioon nähden.</span></h3>
    <div class="kt-kuvioruudukko">${kuviot.map((k, i) => `<figure class="kt-kuvio">
      ${kuvioSvg(k, i)}
      <figcaption><b>${esc(lyhytTilanne(k.tilanne))}${k.tilanne !== "Yleinen" ? "-tilanne" : ""}: ${esc(k.nimi || "Nimetön")}</b>${k.milloin ? `<span>Milloin: ${esc(k.milloin)}</span>` : ""}${k.kuvaus ? `<span>${esc(k.kuvaus)}</span>` : ""}</figcaption>
    </figure>`).join("")}</div></section>`;
}

function karttaLohko(J) {
  const ls = J.lyonnit.filter((h) => h.tiedot?.x != null);
  if (!ls.length) return "";
  const nimi = (id) => D.pelaajat.get(id)?.nimi || "";
  const kaytetyt = LYONTITYYPIT.filter(([k]) => ls.some((h) => h.tiedot?.tyyppi === k));
  // Tilanteittain: montako lyöntiä ja yleisin tyyppi
  const TY = Object.fromEntries(LYONTITYYPIT.map(([k, n]) => [k, n]));
  const tilanteittain = TILANTEET.map((t) => {
    const hs = J.lyonnit.filter((h) => h.tiedot?.tilanne === t); if (!hs.length) return "";
    const lask = {}; hs.forEach((h) => { const k = h.tiedot?.tyyppi; if (k) lask[k] = (lask[k] || 0) + 1; });
    const ylin = Object.entries(lask).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${TY[k]} ${n}`).join(", ");
    return `<tr><td>${esc(lyhyt(t))}</td><td class="n">${hs.length}</td><td>${esc(ylin || "–")}</td></tr>`;
  }).join("");
  return `<section class="kt-lohko kt-kartta"><h3>Lyöntikartta <span class="kt-lisa">${ls.length} kirjattua lyöntiä, joilla on paikka kentällä</span></h3>
    <div class="kt-kartta-ruudukko">
      <figure>${kenttaSvg({ id: "kt-kartta", pisteet: ls.map((h) => ({ x: h.tiedot.x, y: h.tiedot.y, vari: tyyppiTieto(h.tiedot.tyyppi)?.[2] || "#555", otsikko: `${nimi(h.pelaaja_id)}: ${h.otsikko}` })) })}
        <figcaption class="kt-selite">${kaytetyt.map(([, n, v]) => `<span><i style="background:${v}"></i>${esc(n)}</span>`).join("")}</figcaption></figure>
      ${tilanteittain ? `<table class="kt-taulu kt-pieni-taulu"><thead><tr><th>Tilanne</th><th class="n">Lyöntejä</th><th>Yleisimmät</th></tr></thead><tbody>${tilanteittain}</tbody></table>` : ""}
    </div>
    ${J.lyonnit.length < 20 ? `<p class="kt-huom">Kirjauksia on vähän, joten jakaumat ovat suuntaa-antavia.</p>` : ""}</section>`;
}

function muistiinpanoLohko(huomiot) {
  const mp = huomiot.filter((h) => h.tyyppi === "muistiinpano" && h.tiedot?.osa !== "ulkopeli").slice(0, 6);
  const om = huomiot.filter((h) => h.tyyppi === "ottelumuistio").sort((a, b) => (b.ottelu_pvm || "").localeCompare(a.ottelu_pvm || "")).slice(0, 4);
  if (!mp.length && !om.length) return "";
  const lyhenna = (s, n) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s || "");
  return `<section class="kt-lohko kt-muistiot"><h3>Muistiinpanot</h3>
    ${om.length ? `<h4>Ottelumuistiot</h4><ul>${om.map((h) => `<li><b>${pvmFi(h.ottelu_pvm)}</b> ${esc(h.otsikko)}</li>`).join("")}</ul>` : ""}
    ${mp.length ? `<h4>Viimeisimmät havainnot</h4><ul>${mp.map((h) => `<li><b>${esc(h.otsikko)}</b>${h.teksti ? ` ${esc(lyhenna(h.teksti, 240))}` : ""} <span class="kt-kirjoittaja">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${new Date(h.luotu).toLocaleDateString("fi-FI")}</span></li>`).join("")}</ul>` : ""}
  </section>`;
}
