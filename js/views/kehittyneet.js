// Kehittyneet (28.11.2026, Jugi): valmennukselle testi kerrallaan, pelaajan viimeisin testipäivä vs. edellinen.
// Eniten parantanut ylimpänä. Kerran tulos = kerran paras samalla logiikalla kuin Testit-sivulla (juoksut yhdessä).
// Osoite #/kehittyneet/<ryhmä>/<testi>. Laskenta: js/kehittyneetydin.js.
import { tila, nimi, lataaTulokset, sallitutRyhmat } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvmLyhyt, parhaatTulokset, juoksutYhteen, pelaajaLinkki } from "../util.js";
import { kehittyneet, viimeisinPvm } from "../kehittyneetydin.js";
import { LUOKAT, LUOKKANIMI } from "./testit.js";

const RYHMAT = [["superpesis", "Superpesis"], ["juniorit", "Juniorit"]];
const RAJAUKSET = [["paiva", "Viimeisin testipäivä"], ["jakso", "Tämä testijakso"], ["kaikki", "Kaikki"]];
// testijakso: syksy = elo–joulu, kevät = tammi–heinä (17.11.2026)
const jaksonAlku = (s) => (+s.slice(5, 7) >= 8 ? `${s.slice(0, 4)}-08-01` : `${s.slice(0, 4)}-01-01`);
const jaksoNimi = (s) => `${+s.slice(5, 7) >= 8 ? "syksy" : "kevät"} ${s.slice(0, 4)}`;
const pros = (x) => (x == null ? "" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(1).replace(".", ",")} %`);

let S = { ryhma: "superpesis", testi: null, rajaus: "paiva", ikaluokka: "" };

export async function nayta(main, ryhma, testi) {
  if (!(tila.valmennus || tila.admin || tila.psu)) {
    main.innerHTML = `<div class="paneeli jtt-tyhja"><h2>Kehittyneet</h2><p class="pieni">Näkymä on valmennukselle.</p></div>`;
    return;
  }
  const sallitut = sallitutRyhmat();
  if (RYHMAT.some(([k]) => k === ryhma)) S.ryhma = ryhma;
  if (sallitut && !sallitut.includes(S.ryhma)) S.ryhma = sallitut[0];
  if (testi) S.testi = testi;

  // Data kuten Testit-sivulla: juoksut yhteen, Superpesis/juniorit joukkueen nimestä, tarkenne tyhjä tai yleisin.
  const kaikki = juoksutYhteen(await lataaTulokset());
  const spJ = new Set(tila.joukkueet.filter((j) => /superpesis/i.test(j.nimi)).map((j) => j.id));
  const onSp = (k) => spJ.has(tila.kerta[k]?.joukkue_id);
  const data = {};
  for (const [g] of RYHMAT) {
    const rr = kaikki.filter((r) => r.hyvaksytty && tila.kerta[r.testikerta_id] && (g === "superpesis") === onSp(r.testikerta_id));
    const tark = new Map();
    rr.forEach((r) => { const m = tark.get(r.testi) || new Map(); m.set(r.tarkenne, (m.get(r.tarkenne) || 0) + 1); tark.set(r.testi, m); });
    const valinta = {};
    for (const [t, m] of tark) valinta[t] = m.has("") ? "" : [...m].sort((a, b) => b[1] - a[1])[0][0];
    if (valinta["30m"] === "" && valinta["10m"] === "") valinta.lentava20 = "";
    data[g] = [...new Set(Object.values(valinta))]
      .flatMap((tk) => parhaatTulokset(rr, { tarkenne: tk }).map((x) => ({ ...x, tarkenne: tk })))
      .filter((x) => valinta[x.testi] === x.tarkenne && tila.pelaaja[x.pelaaja] && !tila.pelaaja[x.pelaaja].poistettu);
  }

  main.innerHTML = `
    <div class="jtt-paa"><div><span class="jtt-yla">Testit · Kehittyneet</span><h1>Kehittyneet</h1>
      <p class="ingressi">Pelaajan viimeisin testi verrattuna hänen edelliseen testiinsä samassa testissä. Eniten parantanut ylimpänä.</p></div>
      <div class="rivi"><a class="btn" href="#/testit/${S.ryhma}">Tulokset</a></div></div>
    <div class="jtt-ohjaimet" id="kh-ohjaimet"></div>
    <div id="kh-sisalto"></div>`;

  function piirra() {
    const D = data[S.ryhma];
    // testit, joissa jollain pelaajalla on vähintään kaksi testipäivää
    const paivat = new Map();
    D.forEach((x) => { const k = `${x.testi}|${x.pelaaja}`; (paivat.get(k) || paivat.set(k, new Set()).get(k)).add(x.pvm); });
    const vertailtavat = new Set([...paivat].filter(([, s]) => s.size > 1).map(([k]) => k.split("|")[0]));
    const testit = tila.testit.filter((t) => vertailtavat.has(t.koodi));
    const viim = (t) => viimeisinPvm(D.filter((x) => x.testi === t)) || "";
    if (!testit.some((t) => t.koodi === S.testi)) S.testi = [...testit].sort((a, b) => viim(b.koodi).localeCompare(viim(a.koodi)) || a.jarjestys - b.jarjestys)[0]?.koodi || null;
    history.replaceState(null, "", `#/kehittyneet/${S.ryhma}${S.testi ? "/" + S.testi : ""}`);

    const ryhmaNapit = RYHMAT.filter(([k]) => !sallitut || sallitut.includes(k));
    const optiot = LUOKAT.map(([l]) => [l, testit.filter((t) => t.luokka === l)]).concat([["", testit.filter((t) => !LUOKKANIMI[t.luokka])]])
      .filter(([, a]) => a.length)
      .map(([l, a]) => `<optgroup label="${esc(LUOKKANIMI[l] || "Muut")}">${a.sort((x, y) => x.jarjestys - y.jarjestys).map((t) => `<option value="${esc(t.koodi)}"${t.koodi === S.testi ? " selected" : ""}>${esc(t.nimi)}</option>`).join("")}</optgroup>`).join("");
    const rivit = D.filter((x) => x.testi === S.testi);
    const ikaluokat = S.ryhma === "juniorit" ? [...new Set(rivit.map((x) => tila.pelaaja[x.pelaaja]?.syntymavuosi).filter(Boolean))].sort((a, b) => b - a) : [];
    if (S.ikaluokka && !ikaluokat.includes(+S.ikaluokka)) S.ikaluokka = "";

    $("#kh-ohjaimet").innerHTML = `
      ${ryhmaNapit.length > 1 ? `<div class="jtt-segmentti" role="radiogroup" aria-label="Ryhmä">${ryhmaNapit.map(([k, n]) => `<button role="radio" data-ryhma="${k}" aria-checked="${k === S.ryhma}">${n}</button>`).join("")}</div>` : ""}
      ${testit.length ? `<label class="jtt-valinta"><span>Testi</span><select id="kh-testi">${optiot}</select></label>
      <div class="jtt-segmentti" role="radiogroup" aria-label="Rajaus">${RAJAUKSET.map(([k, n]) => `<button role="radio" data-rajaus="${k}" aria-checked="${k === S.rajaus}">${n}</button>`).join("")}</div>` : ""}
      ${ikaluokat.length > 1 ? `<div class="jtt-chipit" role="radiogroup" aria-label="Ikäluokka"><button class="chip" data-ika="" aria-pressed="${!S.ikaluokka}">Kaikki</button>${ikaluokat.map((v) => `<button class="chip" data-ika="${v}" aria-pressed="${String(v) === String(S.ikaluokka)}">${v}</button>`).join("")}</div>` : ""}`;
    $$("[data-ryhma]").forEach((b) => (b.onclick = () => { S.ryhma = b.dataset.ryhma; S.testi = null; S.ikaluokka = ""; piirra(); }));
    $$("[data-rajaus]").forEach((b) => (b.onclick = () => { S.rajaus = b.dataset.rajaus; piirra(); }));
    $$("[data-ika]").forEach((b) => (b.onclick = () => { S.ikaluokka = b.dataset.ika; piirra(); }));
    if ($("#kh-testi")) $("#kh-testi").onchange = (e) => { S.testi = e.target.value; piirra(); };

    if (!S.testi) { $("#kh-sisalto").innerHTML = `<div class="paneeli jtt-tyhja"><h2>Ei vielä vertailtavaa</h2><p class="pieni">Listaan tarvitaan pelaajia, jotka on testattu samassa testissä vähintään kahtena päivänä.</p></div>`; return; }

    const T = tila.testi[S.testi] || {}, yks = T.yksikko ? ` ${esc(T.yksikko)}` : "";
    const vp = viimeisinPvm(rivit);
    const alkaen = S.rajaus === "paiva" ? vp : S.rajaus === "jakso" ? jaksonAlku(vp) : null;
    const ika = (pid) => !S.ikaluokka || String(tila.pelaaja[pid]?.syntymavuosi) === String(S.ikaluokka);
    const { lista, ilmanVertailua } = kehittyneet(rivit.filter((x) => ika(x.pelaaja)), { pienempiParempi: !!T.pienempi_parempi, alkaen });
    const rajausTeksti = S.rajaus === "paiva" ? `testattu ${pvmLyhyt(vp)}` : S.rajaus === "jakso" ? `testattu ${jaksoNimi(vp)}` : "kaikki pelaajat";
    const parani = lista.filter((x) => x.ero > 0).length, heikkeni = lista.filter((x) => x.ero < 0).length;
    const pelaaja = (pid) => { const p = tila.pelaaja[pid]; return `${pelaajaLinkki(p)}${p.syntymavuosi ? `<span class="pieni"> ${p.syntymavuosi}</span>` : ""}`; };

    $("#kh-sisalto").innerHTML = `<section class="jtt-osio">
      <div class="jtt-osio-paa"><h2>${esc(T.nimi || S.testi)}</h2><span class="pieni">${rajausTeksti} · ${lista.length} pelaajaa · ${parani} parani, ${heikkeni} heikkeni${T.pienempi_parempi ? " · pienempi on parempi" : ""}</span></div>
      ${lista.length ? `<div class="taulu-wrap"><table class="kh-taulu">
        <thead><tr><th>#</th><th>Pelaaja</th><th>Viimeisin</th><th>Edellinen</th><th>Muutos</th><th>%</th></tr></thead>
        <tbody>${lista.map((x, i) => `<tr>
          <td>${i + 1}</td><td>${pelaaja(x.pelaaja)}</td>
          <td><b>${muotoile(x.uusi, S.testi)}</b>${yks}<div class="pieni">${pvmLyhyt(x.uusiPvm)}</div></td>
          <td>${muotoile(x.vanha, S.testi)}${yks}<div class="pieni">${pvmLyhyt(x.vanhaPvm)}${x.vanhaVertailu ? ` <span title="Edellisestä testistä yli 12 kk">⚠ ${x.kk} kk</span>` : ""}</div></td>
          <td class="${x.ero > 0 ? "pb" : x.ero < 0 ? "huono" : ""}">${muotoileMuutos(x.ero, S.testi)}${yks}</td>
          <td class="${x.ero > 0 ? "pb" : x.ero < 0 ? "huono" : ""}">${pros(x.pct)}</td></tr>`).join("")}</tbody></table></div>
        <p class="vihje">Muutos: + = parani (juoksuissa aika pieneni). Saman päivän useista testikerroista lasketaan paras. ⚠ = edellisestä testistä yli 12 kk, joten muutos ei ole suoraan vertailukelpoinen.</p>`
        : `<p class="pieni">Ei vertailtavia pelaajia tällä rajauksella.</p>`}
      ${ilmanVertailua.length ? `<h3>Ei vertailukohtaa (ensimmäinen testi)</h3><p class="pieni">${[...ilmanVertailua].sort((a, b) => nimi(tila.pelaaja[a.pelaaja]).localeCompare(nimi(tila.pelaaja[b.pelaaja]), "fi")).map((x) => `${esc(nimi(tila.pelaaja[x.pelaaja]))} ${muotoile(x.uusi, S.testi)}`).join(" · ")}</p>` : ""}
    </section>`;
  }
  piirra();
}
