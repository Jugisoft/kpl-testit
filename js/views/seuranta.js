// Tavoiteseuranta (6.11.2026 Pelaajaseurantana, Jugin toive): valmennukselle yksi sivu ryhmän pelaajien tavoitteista.
// 12.11.2026 (Jugi): omatoimiset treenit siirretty Viikkokoosteeseen (avattavat rivit), sivu nimetty Tavoiteseurannaksi.
// #/seuranta, vain valmennus (myös PSU omille ryhmilleen).
import { sb, tila, nimi, lataaTulokset } from "../db.js";
import { $, esc, testiParhaat, muotoile, palkki, pvm } from "../util.js";
import { tavoiteTila } from "./oma.js";
import { tanaanHki, maanantai, pvLyh } from "../kuormaydin.js";

let joukkue = null;

export async function nayta(main) {
  if (!tila.ohjaaja) { location.replace("#/oma"); return; }
  const ryhmat = tila.joukkueet.filter((j) => tila.pelaajat.some((p) => p.joukkue_id === j.id && p.aktiivinen));
  if (!joukkue || !ryhmat.some((j) => j.id === joukkue)) joukkue = (ryhmat.find((j) => j.alue === "psu") || ryhmat[0])?.id;
  main.innerHTML = `<h1>Tavoiteseuranta</h1><p class="lataa">Ladataan…</p>`;
  if (!joukkue) { main.innerHTML = `<h1>Tavoiteseuranta</h1><p class="tyhja">Ei ryhmiä.</p>`; return; }
  const pelaajat = tila.pelaajat.filter((p) => p.joukkue_id === joukkue && p.aktiivinen).sort((a, b) => nimi(a).localeCompare(nimi(b), "fi"));
  const ids = pelaajat.map((p) => p.id);
  const viikko = maanantai(tanaanHki());

  const [tulokset, tavRes] = await Promise.all([
    lataaTulokset().then(testiParhaat),
    ids.length ? sb.from("tavoitteet").select("*").in("pelaaja_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const tav = tavRes.data || [];
  const uudet = tav.filter((g) => g.luotu.slice(0, 10) >= viikko).length;

  main.innerHTML = `
    <div class="ko-paa">
      <div><p class="oma-yla">Valmennus</p><h1>Tavoiteseuranta</h1>
        <p class="ingressi">Pelaajien itse tai valmentajan asettamat testitavoitteet ja niiden eteneminen. Omatoimiset treenit näkyvät <a href="#/kooste">Viikkokoosteessa</a>.</p></div>
      <div class="rivi">
        ${ryhmat.length > 1 ? `<label class="kentta">Ryhmä<select id="se-ryhma">${ryhmat.map((r) => `<option value="${r.id}"${r.id === joukkue ? " selected" : ""}>${esc(r.nimi)}</option>`).join("")}</select></label>` : ""}
      </div>
    </div>
    <div class="tagit ko-tagit">
      <span>Pelaajia<b>${pelaajat.length}</b></span>
      <span>Tavoitteita<b>${tav.length}${uudet ? ` (${uudet} uutta tällä viikolla)` : ""}</b></span>
      <span>Tavoite asetettu<b>${new Set(tav.map((g) => g.pelaaja_id)).size}/${pelaajat.length} pelaajalla</b></span>
    </div>

    ${tavoiteOsio(tav, tulokset, viikko)}`;

  const sel = $("#se-ryhma", main);
  if (sel) sel.onchange = () => { joukkue = +sel.value; nayta(main); };
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
