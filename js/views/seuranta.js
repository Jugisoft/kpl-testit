// Pelaajaseuranta (6.11.2026, Jugin toive): valmennukselle yksi sivu, jossa ryhmän pelaajien asettamat tavoitteet
// ja itse kirjaamat omatoimiset treenit (Treenipäiväkirja). #/seuranta, vain valmennus (myös PSU omille ryhmilleen).
import { sb, tila, nimi, lataaTulokset } from "../db.js";
import { $, esc, testiParhaat, muotoile, palkki, pvm } from "../util.js";
import { tavoiteTila } from "./oma.js";
import { haeOhjelmat } from "../kuorma.js";
import { T, lisaaPv, tanaanHki, maanantai, minStr, pvLyh, maaratTeksti } from "../kuormaydin.js";

let joukkue = null;
let jakso = 28;

export async function nayta(main) {
  if (!tila.ohjaaja) { location.replace("#/oma"); return; }
  const ryhmat = tila.joukkueet.filter((j) => tila.pelaajat.some((p) => p.joukkue_id === j.id && p.aktiivinen));
  if (!joukkue || !ryhmat.some((j) => j.id === joukkue)) joukkue = (ryhmat.find((j) => j.alue === "psu") || ryhmat[0])?.id;
  main.innerHTML = `<h1>Pelaajaseuranta</h1><p class="lataa">Ladataan…</p>`;
  if (!joukkue) { main.innerHTML = `<h1>Pelaajaseuranta</h1><p class="tyhja">Ei ryhmiä.</p>`; return; }
  const pelaajat = tila.pelaajat.filter((p) => p.joukkue_id === joukkue && p.aktiivinen).sort((a, b) => nimi(a).localeCompare(nimi(b), "fi"));
  const ids = pelaajat.map((p) => p.id);
  const tanaan = tanaanHki(), alku = lisaaPv(tanaan, -(jakso - 1)), viikko = maanantai(tanaan);

  const [tulokset, tavRes, omatRes, ohjelmat] = await Promise.all([
    lataaTulokset().then(testiParhaat),
    ids.length ? sb.from("tavoitteet").select("*").in("pelaaja_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("omat_treenit").select("*").in("pelaaja_id", ids).gte("pvm", alku).lte("pvm", tanaan).order("pvm", { ascending: false }) : Promise.resolve({ data: [] }),
    haeOhjelmat(),
  ]);
  const tav = tavRes.data || [], omat = omatRes.data || [];
  const uudet = tav.filter((g) => g.luotu.slice(0, 10) >= viikko).length;
  const perPelaaja = pelaajat.map((p) => { const r = omat.filter((o) => o.pelaaja_id === p.id); return { p, r, min: r.reduce((s, o) => s + (o.kesto_min || 0), 0) }; });
  const kirjanneet = perPelaaja.filter((x) => x.r.length);
  const eiKirjauksia = perPelaaja.filter((x) => !x.r.length);

  main.innerHTML = `
    <div class="ko-paa">
      <div><p class="oma-yla">Valmennus</p><h1>Pelaajaseuranta</h1>
        <p class="ingressi">Pelaajien itse asettamat tavoitteet ja Treenipäiväkirjaan kirjatut omatoimiset treenit yhdellä sivulla.</p></div>
      <div class="rivi">
        ${ryhmat.length > 1 ? `<label class="kentta">Ryhmä<select id="se-ryhma">${ryhmat.map((r) => `<option value="${r.id}"${r.id === joukkue ? " selected" : ""}>${esc(r.nimi)}</option>`).join("")}</select></label>` : ""}
        <label class="kentta">Omatoimiset<select id="se-jakso">${[[7, "7 päivää"], [28, "4 viikkoa"], [90, "3 kuukautta"]].map(([v, t]) => `<option value="${v}"${v === jakso ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      </div>
    </div>
    <div class="tagit ko-tagit">
      <span>Pelaajia<b>${pelaajat.length}</b></span>
      <span>Tavoitteita<b>${tav.length}${uudet ? ` (${uudet} uutta tällä viikolla)` : ""}</b></span>
      <span>Tavoite asetettu<b>${new Set(tav.map((g) => g.pelaaja_id)).size}/${pelaajat.length} pelaajalla</b></span>
      <span>Omatoimisia ${pvLyh(alku)}–${pvLyh(tanaan)}<b>${omat.length} treeniä · ${minStr(omat.reduce((s, o) => s + (o.kesto_min || 0), 0))}</b></span>
      <span>Kirjanneet<b>${kirjanneet.length}/${pelaajat.length}</b></span>
    </div>

    ${tavoiteOsio(tav, tulokset, viikko)}

    <section class="paneeli">
      <h2 class="ko-h2">Omatoimiset treenit · ${jakso === 7 ? "7 päivää" : jakso === 28 ? "4 viikkoa" : "3 kuukautta"}</h2>
      <p class="pieni">Pelaajan itse Treenipäiväkirjaan kirjaamat treenit, eniten minuutteja ensin. Avaa pelaajan rivi nähdäksesi yksittäiset kirjaukset.</p>
      ${kirjanneet.length ? `<div class="se-omat">${kirjanneet.sort((a, b) => b.min - a.min).map(({ p, r, min }) => {
        const ohj = {};
        for (const o of r) { const k = ohjelmat[o.ohjelma]?.nimi.replace(/\s*\(.*\)$/, "") || T[o.tyyppi]?.nimi || "Muu"; ohj[k] = (ohj[k] || 0) + 1; }
        return `<details class="se-pelaaja"><summary>
          <a href="#/oma/${p.id}">${esc(nimi(p))}</a>
          <span class="num">${r.length} treeniä · ${minStr(min)}</span>
          <span class="se-ohj">${Object.entries(ohj).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="oma-tag">${esc(k)}${n > 1 ? ` ×${n}` : ""}</span>`).join("")}</span>
          <span class="pieni">viimeksi ${pvLyh(r[0].pvm)}</span></summary>
          <ul class="se-lista">${r.map((o) => { const oh = ohjelmat[o.ohjelma]; const ty = T[o.tyyppi] || T[oh?.tyyppi] || T.laji; const lisa = maaratTeksti(o); return `<li>
            <span class="num">${pvLyh(o.pvm)}</span>
            <span><i style="background:${ty.vari}"></i>${esc(oh?.nimi || o.huomio || `Oma ${ty.nimi.toLowerCase()}`)}${lisa ? ` <small>${esc(lisa)}</small>` : ""}${o.rpe ? ` <small>· rasitus ${o.rpe}/10</small>` : ""}${oh && o.huomio ? ` <small>· ${esc(o.huomio)}</small>` : ""}</span>
            <span class="num">${minStr(o.kesto_min || 0)}</span></li>`; }).join("")}</ul>
        </details>`; }).join("")}</div>` : `<p class="tyhja">Ei omatoimisia kirjauksia tältä ajalta.</p>`}
      ${eiKirjauksia.length && kirjanneet.length ? `<p class="pieni se-ei">Ei kirjauksia: ${eiKirjauksia.map(({ p }) => `<a href="#/oma/${p.id}">${esc(nimi(p))}</a>`).join(", ")}</p>` : ""}
    </section>`;

  const sel = $("#se-ryhma", main);
  if (sel) sel.onchange = () => { joukkue = +sel.value; nayta(main); };
  $("#se-jakso", main).onchange = (e) => { jakso = +e.target.value; nayta(main); };
}

// Pelaajien tavoitteet (6.11.2026): kaikki ryhmän tavoitteet yhdessä taulukossa, tämän viikon uudet ensin.
function tavoiteOsio(rivit, tulokset, viikko) {
  const lista = rivit.filter((g) => tila.testi[g.testi] && tila.pelaaja[g.pelaaja_id]).map((g) => {
    const omat = tulokset.filter((x) => x.pelaaja === g.pelaaja_id && x.testi === g.testi);
    return { g, uusi: g.luotu.slice(0, 10) >= viikko, ...tavoiteTila(g, omat) };
  }).sort((a, b) => (b.uusi - a.uusi) || (a.saavutettu - b.saavutettu) || nimi(tila.pelaaja[a.g.pelaaja_id]).localeCompare(nimi(tila.pelaaja[b.g.pelaaja_id]), "fi"));
  return `<section class="paneeli">
    <h2 class="ko-h2">Pelaajien tavoitteet</h2>
    <p class="pieni">Pelaajan itse tai valmentajan asettamat testitavoitteet. Lähtötaso = paras tulos ennen tavoitteen asettamista, nyt = paras sen jälkeen. Nimestä pääset pelaajan Keskukseen.</p>
    ${lista.length ? `<div class="ko-tav" role="table" aria-label="Pelaajien tavoitteet">
      <div class="ko-tav-rivi ko-tav-otsikot" role="row"><span role="columnheader">Pelaaja</span><span role="columnheader">Testi</span><span role="columnheader">Tavoite</span><span role="columnheader">Lähtö → nyt</span><span role="columnheader">Eteneminen</span><span role="columnheader">Mennessä</span></div>
      ${lista.map(({ g, uusi, lahto, nyt, saavutettu, pct }) => { const T = tila.testi[g.testi]; return `<div class="ko-tav-rivi${saavutettu ? " saavutettu" : ""}" role="row">
        <span role="cell"><a href="#/oma/${g.pelaaja_id}">${esc(nimi(tila.pelaaja[g.pelaaja_id]))}</a>${uusi ? ' <span class="ko-uusi">uusi</span>' : ""}</span>
        <span role="cell">${esc(T.nimi)}</span>
        <span role="cell" class="num">${saavutettu ? "✓ " : ""}${muotoile(g.arvo, g.testi)} <small>${esc(T.yksikko)}</small></span>
        <span role="cell" class="num">${lahto != null ? `${muotoile(lahto, g.testi)} → ${muotoile(nyt, g.testi)}` : "ei tuloksia"}</span>
        <span role="cell">${palkki(pct)}</span>
        <span role="cell" class="pieni">${g.takaraja ? pvm(g.takaraja) : "–"}<br>asetettu ${pvLyh(g.luotu.slice(0, 10))}</span>
      </div>`; }).join("")}
    </div>` : `<p class="tyhja">Ryhmän pelaajilla ei ole vielä tavoitteita. Pelaaja asettaa tavoitteen omassa Keskuksessaan (Tavoitteet → + Uusi tavoite).</p>`}
  </section>`;
}
