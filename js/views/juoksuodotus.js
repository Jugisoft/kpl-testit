// Juoksuodotus pesätilanteittain: matriisi (tila × palot), kärkilyönnin kannattavuus ja lyöjien juoksuarvo.
// Data: taulu analyysit, avain juoksuodotus_2026 (Jarvisin skripti juoksuodotus.py, otteluiden tapahtumat 2026).
import { sb } from "../db.js";
import { $, $$, esc } from "../util.js";

const NIMI = { "0": "0-tilanne", "1": "1-tilanne", "2": "2-tilanne", "3": "3-tilanne", "1–2": "1–2-tilanne", "1–3": "1–3-tilanne", "2–3": "2–3-tilanne", "1–2–3": "Ajolähtö (1–2–3)" };
const PIENI = 60; // tätä pienempi otos merkitään
const s = { joukkue: "", ero: false, lyojaJoukkue: "KPL", minLv: 50, klJoukkue: "KPL" };
let D = null;

const luku = (x, d = 2) => (x == null || Number.isNaN(x) ? "–" : x.toFixed(d).replace(".", ",").replace("-", "−"));
const etumerkki = (x, d = 2) => (x == null ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x).toFixed(d).replace(".", ",")}`);
const pros = (x) => (x == null ? "–" : `${Math.round(x * 100)} %`);

// Pieni pesäkuvio: koti alhaalla, 1. pesä vasemmalla, 2. oikealla, 3. vasemmalla ylhäällä (kuten kentällä)
function pesaIkoni(tila) {
  const on = new Set(tila === "0" ? [] : tila.split("–"));
  const P = { k: [12, 30], 1: [5, 21], 2: [19, 12], 3: [5, 4] };
  const viiva = ["k", "1", "2", "3"].map((k) => P[k].join(",")).join(" ");
  return `<svg class="jo-ikoni" viewBox="0 0 24 34" aria-hidden="true"><polyline points="${viiva}"/>${["1", "2", "3"].map((k) => `<rect x="${P[k][0] - 3}" y="${P[k][1] - 3}" width="6" height="6" transform="rotate(45 ${P[k][0]} ${P[k][1]})" class="${on.has(k) ? "on" : ""}"/>`).join("")}<circle cx="12" cy="30" r="2.2"/></svg>`;
}

export async function nayta(main) {
  const { data, error } = await sb.from("analyysit").select("data,paivitetty").eq("avain", "juoksuodotus_2026").maybeSingle();
  if (error) throw error;
  const [tt, vp] = await Promise.all([
    sb.from("tilastot").select("nimi,joukkue,data").eq("kausi", 2026).eq("vaihe", "runko").eq("tyyppi", "pelaaja"),
    sb.from("vastustajapelaajat").select("nimi,joukkue,aktiivinen").eq("aktiivinen", true),
  ]);
  if (!data) { main.innerHTML = `<h1>Juoksuodotus</h1><div class="paneeli tyhja-iso"><p>Juoksuodotusta ei ole vielä laskettu. Jarvis laskee sen skriptillä juoksuodotus.py.</p></div>`; return; }
  const kokoonpano = new Map();
  (vp.data || []).forEach((p) => (kokoonpano.get(p.joukkue) || kokoonpano.set(p.joukkue, []).get(p.joukkue)).push(p.nimi));
  D = { ...data.data, paivitetty: data.paivitetty, tilastot: tt.data || [], kokoonpano };
  piirra(main);
}

function piirra(main) {
  const joukkueet = Object.keys(D.joukkueet).filter((j) => Object.values(D.joukkueet[j]).some((c) => c[1] > 0)).sort((a, b) => (a === "KPL" ? -1 : b === "KPL" ? 1 : a.localeCompare(b)));
  main.innerHTML = `
    <div class="sivu-paa"><div>
      <p class="pieni"><a href="#/analyysi">Analyysi</a></p>
      <h1>Juoksuodotus</h1>
      <p class="ingressi">Montako juoksua vuoron loppuun mennessä keskimäärin syntyy, kun pesillä on tietty tilanne ja paloja on tietty määrä. Kausi ${D.kausi}, ${D.vuoropareja.toLocaleString("fi-FI")} vuoroa ja ${D.lyontivuoroja.toLocaleString("fi-FI")} lyöntivuoroa.</p>
    </div></div>
    <section id="jo-matriisi"></section>
    <section id="jo-kl"></section>
    <section id="jo-lyojat"></section>
    <section id="jo-joukkueet"></section>
    <details class="jo-menetelma"><summary>Miten luvut on laskettu</summary>
      <ul>
        <li>Lähde: ${esc(D.lahde)}. Juoksut on tarkistettu jaksotuloksia vasten.</li>
        <li>Tilanne luetaan lyöntivuoron alussa: etenijät pesillä ja vuoroparin palot siihen asti. Supervuoroparit ja kotiutuskilpailut eivät ole mukana.</li>
        <li>Jos ottelu ratkesi kesken jakson viimeisen vuoron, sitä vuoroa ei lasketa, koska se jäi kesken.</li>
        <li>Lyöntivuoron arvo = juoksuodotus vuoron jälkeen + vuoron aikana tehdyt juoksut − juoksuodotus ennen. Sarjan keskimääräinen lyöntivuoro on 0. Arvo kirjataan lyöjälle, vaikka siihen vaikuttavat myös etenijät ja ulkopelin virheet.</li>
        <li>Kärkilyönti: onnistunut = lyöntivuoro, jossa vähintään yksi kärkilyönti onnistui; epäonnistunut = kärkilyönti epäonnistui eikä yksikään onnistunut. Tarvittava onnistuminen = epäonnistumisen hinta / (onnistumisen hyöty + epäonnistumisen hinta). 0-tilanteessa kärkilyönti tarkoittaa lyöjän pääsyä kentälle etenijäksi.</li>
      </ul></details>`;
  piirraMatriisi(joukkueet);
  piirraKL();
  piirraLyojat(joukkueet);
  piirraJoukkueet();
}

// ---------- matriisi ----------
function piirraMatriisi(joukkueet) {
  const el = $("#jo-matriisi");
  const J = s.joukkue ? D.joukkueet[s.joukkue] : null;
  const ero = !!(J && s.ero);
  const solu = (t, p) => {
    const [ka, n] = D.sarja[`${t}|${p}`];
    const [jk, jn] = J ? J[`${t}|${p}`] : [null, 0];
    const arvo = ero ? (jk != null ? jk - ka : null) : J ? jk : ka;
    const otos = J ? jn : n;
    let tausta;
    if (arvo == null) tausta = "transparent";
    else if (ero) { const v = Math.max(-1, Math.min(1, arvo / 0.3)); tausta = v >= 0 ? `color-mix(in oklab, var(--jo-plus) ${Math.round(v * 85)}%, var(--surface))` : `color-mix(in oklab, var(--jo-miinus) ${Math.round(-v * 85)}%, var(--surface))`; }
    else { const v = Math.max(0, Math.min(1, arvo / 1.25)); tausta = `color-mix(in oklab, var(--jo-seq) ${Math.round(8 + v * 82)}%, var(--surface))`; }
    const tumma = !ero && arvo != null && arvo / 1.25 > 0.55;
    const otsikko = `${NIMI[t]}, ${p} ${p === 1 ? "palo" : "paloa"}: ${ero ? `${s.joukkue} ${luku(jk)} vs. sarja ${luku(ka)} (${etumerkki(arvo)})` : `${luku(arvo)} juoksua vuoron loppuun`}, otos ${otos} lyöntivuoroa${otos < PIENI ? " (pieni otos)" : ""}`;
    return `<td class="jo-solu${tumma ? " tumma" : ""}${otos < PIENI ? " pieni-otos" : ""}" style="background:${tausta}" title="${esc(otsikko)}" tabindex="0" aria-label="${esc(otsikko)}">
      <span class="jo-arvo num">${ero ? etumerkki(arvo) : luku(arvo)}</span><span class="jo-n">${otos ? `n ${otos}` : ""}</span></td>`;
  };
  const k1 = D.sarja["1|0"][0], k1b = D.sarja["1|1"][0], k3 = D.sarja["3|2"][0];
  el.innerHTML = `
    <div class="jo-ohjaus">
      <label class="kentta">Kenen vuorot <select id="jo-joukkue"><option value="">Koko sarja</option>${joukkueet.map((j) => `<option${j === s.joukkue ? " selected" : ""}>${esc(j)}</option>`).join("")}</select></label>
      ${J ? `<div class="chipit" role="group" aria-label="Näkymä"><button type="button" class="chip" data-ero="0" aria-pressed="${!s.ero}">Joukkueen luvut</button><button type="button" class="chip" data-ero="1" aria-pressed="${s.ero}">Ero sarjaan</button></div>` : ""}
    </div>
    <div class="jo-matriisi-kehys">
      <table class="jo-taulu">
        <caption class="sr">Juoksuodotus pesätilanteittain ja paloittain${J ? `, ${esc(s.joukkue)}` : ""}</caption>
        <thead><tr><th scope="col">Tilanne</th>${[0, 1, 2].map((p) => `<th scope="col">${p} ${p === 1 ? "palo" : "paloa"}</th>`).join("")}</tr></thead>
        <tbody>${D.tilanteet.map((t) => `<tr><th scope="row">${pesaIkoni(t)}<span>${esc(NIMI[t])}</span></th>${[0, 1, 2].map((p) => solu(t, p)).join("")}</tr>`).join("")}</tbody>
      </table>
      <aside class="jo-selite">
        ${ero ? `<p><span class="jo-avain plus"></span>${esc(s.joukkue)} teki enemmän juoksuja kuin sarja</p><p><span class="jo-avain miinus"></span>vähemmän kuin sarja</p><p class="pieni">Väri kyllästyy ±0,30 juoksun kohdalla.</p>`
          : `<div class="jo-asteikko" aria-hidden="true"></div><p class="jo-asteikko-luvut"><span>0</span><span>0,6</span><span>1,2 juoksua</span></p>`}
        <p class="pieni">Himmeä solu: alle ${PIENI} lyöntivuoroa, suuntaa-antava.</p>
        <p class="jo-lukuohje">Esimerkki: 1-tilanteesta ilman paloja syntyy keskimäärin <b>${luku(k1)}</b> juoksua, yhdellä palolla <b>${luku(k1b)}</b>. Yksi palo maksaa siinä tilanteessa ${luku(k1 - k1b)} juoksua. Kolmostilanne kahdella palolla on vielä ${luku(k3)} juoksun arvoinen.</p>
      </aside>
    </div>`;
  $("#jo-joukkue", el).onchange = (e) => { s.joukkue = e.target.value; if (!s.joukkue) s.ero = false; piirraMatriisi(joukkueet); };
  $$("[data-ero]", el).forEach((b) => (b.onclick = () => { s.ero = b.dataset.ero === "1"; piirraMatriisi(joukkueet); }));
}

// ---------- kärkilyönti: mitä onnistuminen tuo, mitä epäonnistuminen maksaa ----------
const karkiPesa = (t) => (t === "0" ? 0 : Math.max(...t.split("–").map(Number)));
const RYHMAT = [
  [0, "0-tilanne: lyöjä pyrkii kentälle etenijäksi"],
  [1, "Kärkietenijä ykkösellä: 1-tilanteen purku"],
  [2, "Kärkietenijä kakkosella: 2-tilanteen purku"],
  [3, "Kärkietenijä kolmosella: kotiutus"],
];
const KL_MIN = 10; // lyöjän yrityksiä vähintään

function kokoonpanonLyojat(joukkue) {
  const pt = new Map();
  D.tilastot.forEach((t) => { const n = norm(t.nimi); if (!pt.has(n) || (t.data.O || 0) > (pt.get(n).data.O || 0)) pt.set(n, t); });
  return [...(D.kokoonpano.get(joukkue) || [])].map((nimi) => ({ nimi, t: pt.get(norm(nimi))?.data || null })).filter((x) => x.t);
}
const norm = (x) => (x || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const klPros = (t, b) => (t[`KLY${b}`] >= KL_MIN ? t[`KL${b}`] / t[`KLY${b}`] : null);

// Painotettu kynnys kärkietenijän pesän mukaan (lyöjätaulukon vertailukohta)
function pesaKynnys(b) {
  let a = 0, n = 0;
  Object.entries(D.karkilyonti).forEach(([k, v]) => { if (karkiPesa(k.split("|")[0]) !== b || v.kynnys == null) return; const m = v.n_onnistui + v.n_epaonnistui; a += v.kynnys * m; n += m; });
  return n ? a / n : null;
}

function piirraKL() {
  const el = $("#jo-kl");
  const joukkueet = [...D.kokoonpano.keys()].sort((a, b) => (a === "KPL" ? -1 : b === "KPL" ? 1 : a.localeCompare(b)));
  const lyojat = kokoonpanonLyojat(s.klJoukkue);
  const esim = D.karkilyonti["1|0"];
  const skaala = (x) => Math.max(0, Math.min(100, ((x - 0.2) / 0.7) * 100)); // 20–90 %
  const rivi = (t, p, k) => {
    const b = karkiPesa(t);
    const pisteet = lyojat.map((l) => ({ nimi: l.nimi, v: klPros(l.t, b), y: l.t[`KLY${b}`] })).filter((x) => x.v != null);
    const yli = pisteet.filter((x) => x.v >= k.kynnys).length;
    const n = k.n_onnistui + k.n_epaonnistui;
    return `<tr>
      <td><span class="jo-tilanne">${pesaIkoni(t)}${esc(NIMI[t])}</span>${n < 120 ? `<span class="pieni-otos-merkki" title="Alle 120 lyöntivuoroa"> *</span>` : ""}</td><td class="n">${p}</td>
      <td class="n jo-plus-teksti">${etumerkki(k.onnistui)}</td><td class="n jo-miinus-teksti">${etumerkki(k.epaonnistui)}</td>
      <td class="n jo-tarvitaan">${pros(k.kynnys)}</td>
      <td><div class="jo-strip" title="Tarvitaan ${pros(k.kynnys)}, sarjassa onnistui ${pros(k.toteutunut)}">
        <span class="jo-strip-yli" style="left:${skaala(k.kynnys)}%"></span>
        <span class="jo-strip-kynnys" style="left:${skaala(k.kynnys)}%"></span>
        <span class="jo-strip-sarja" style="left:${skaala(k.toteutunut)}%" title="Sarja ${pros(k.toteutunut)}"></span>
        ${pisteet.map((x) => `<span class="jo-piste ${x.v >= k.kynnys ? "yli" : "ali"}" style="left:${skaala(x.v)}%" title="${esc(x.nimi)}: ${pros(x.v)} (${x.y} yritystä)"></span>`).join("")}
      </div></td>
      <td class="n jo-yli-lkm">${pisteet.length ? `${yli}/${pisteet.length}` : "–"}</td></tr>`;
  };
  const taulu = RYHMAT.map(([b, otsikko]) => {
    const rr = D.tilanteet.filter((t) => karkiPesa(t) === b).flatMap((t) => [0, 1, 2].map((p) => [t, p, D.karkilyonti[`${t}|${p}`]])).filter((r) => r[2]);
    return rr.length ? `<tr class="jo-ryhma"><th colspan="7">${esc(otsikko)}</th></tr>${rr.map((r) => rivi(...r)).join("")}` : "";
  }).join("");
  const kynnykset = [0, 1, 2, 3].map(pesaKynnys);
  el.innerHTML = `
    <h2>Kärkilyönti: mitä onnistuminen tuo ja mitä epäonnistuminen maksaa</h2>
    <p class="ingressi">Esimerkki: 1-tilanteessa ilman paloja onnistunut purku nostaa juoksuodotusta keskimäärin <b>${luku(esim.onnistui)}</b> juoksua ja epäonnistuminen laskee sitä <b>${luku(-esim.epaonnistui)}</b>. Koska menetys on suurempi kuin hyöty, lyöjän pitää onnistua vähintään <b>${pros(esim.kynnys)}</b> kerroista, jotta yrittäminen on plussalla. Sarja onnistui ${pros(esim.toteutunut)}.</p>
    <div class="jo-ohjaus">
      <label class="kentta">Lyöjät, kokoonpano 2027 <select id="jo-klj">${joukkueet.map((j) => `<option${j === s.klJoukkue ? " selected" : ""}>${esc(j)}</option>`).join("")}</select></label>
      <p class="pieni jo-strip-selite"><span class="jo-piste yli"></span> lyöjä yli tarvittavan <span class="jo-piste ali"></span> alle <span class="jo-strip-kynnys-merkki"></span> tarvitaan <span class="jo-strip-sarja-merkki"></span> sarjan toteutunut</p>
    </div>
    <div class="taulu-wrap"><table class="jo-kl">
      <thead><tr><th>Tilanne</th><th class="n">Palot</th><th class="n jo-mob-pois">Onnistuminen tuo</th><th class="n jo-mob-pois">Epäonnistuminen maksaa</th><th class="n">Tarvitaan</th><th class="jo-palkkisarake">Lyöjien onnistumis-% (20–90 %)</th><th class="n" title="Lyöjiä yli tarvittavan / lyöjiä, joilla vähintään ${KL_MIN} yritystä">Yli</th></tr></thead>
      <tbody>${taulu}</tbody></table></div>
    <p class="vihje">Lyöjän piste = hänen kauden 2026 onnistumis-%:nsa samasta tilanteesta (0-tilanne = kentälle pääsy, muuten kärkietenijän pesä), vähintään ${KL_MIN} yritystä. Juoksuarvot ovat lyöntivuoron keskiarvoja. * = alle 120 lyöntivuoroa, suuntaa-antava.</p>

    <h3>${esc(s.klJoukkue)}: lyöjät tilanteittain</h3>
    <p class="pieni">Vertailukohta on tilanteiden painotettu tarvittava onnistuminen: 0-tilanne ${pros(kynnykset[0])}, 1-tilanne ${pros(kynnykset[1])}, kärkietenijä kakkosella ${pros(kynnykset[2])}, kolmosella ${pros(kynnykset[3])}.</p>
    <div class="taulu-wrap"><table class="jo-lyojamatriisi">
      <thead><tr><th>Pelaaja</th>${["0-tilanne", "1-tilanne", "2-tilanne", "3-tilanne"].map((n) => `<th class="n">${n}</th>`).join("")}</tr></thead>
      <tbody>${lyojat.sort((a, b) => a.nimi.split(" ").at(-1).localeCompare(b.nimi.split(" ").at(-1), "fi")).map((l) => `<tr><td>${esc(l.nimi)}</td>${[0, 1, 2, 3].map((b) => {
        const v = klPros(l.t, b), y = l.t[`KLY${b}`];
        if (v == null) return `<td class="n jo-ei">${y ? `<span title="${y} yritystä">–</span>` : ""}</td>`;
        const ero = v - kynnykset[b];
        return `<td class="n ${ero >= 0 ? "yli" : "ali"}" title="${esc(l.nimi)}: ${pros(v)} (${l.t[`KL${b}`]}/${y}), tarvitaan ${pros(kynnykset[b])}"><b>${pros(v)}</b><small>${ero >= 0 ? "+" : "−"}${Math.abs(Math.round(ero * 100))}</small></td>`;
      }).join("")}</tr>`).join("") || `<tr><td colspan="5" class="tyhja">Kokoonpanon pelaajilla ei ole Superpesis-tilastoja 2026.</td></tr>`}</tbody></table></div>
    <p class="vihje">Pieni luku = ero tarvittavaan prosenttiyksikköinä. Tyhjä = alle ${KL_MIN} yritystä.</p>`;
  $("#jo-klj", el).onchange = (e) => { s.klJoukkue = e.target.value; piirraKL(); };
}

// ---------- lyöjät ----------
function piirraLyojat(joukkueet) {
  const el = $("#jo-lyojat");
  const kaikki = D.pelaajat.filter((p) => p.lv >= s.minLv && (!s.lyojaJoukkue || p.joukkue === s.lyojaJoukkue));
  const lista = s.lyojaJoukkue ? kaikki : [...kaikki.slice(0, 12), ...kaikki.slice(-5)];
  const max = Math.max(...D.pelaajat.map((p) => Math.abs(p.arvo)), 1);
  el.innerHTML = `
    <h2>Lyöjien juoksuarvo</h2>
    <p class="ingressi">Kuinka monta juoksua lyöjän lyöntivuorot tuottivat yli tai alle sarjan keskitason koko kaudella. Luku kertoo lisäarvon määrän, sadan lyöntivuoron luku tehokkuuden.</p>
    <div class="jo-ohjaus">
      <label class="kentta">Joukkue <select id="jo-lj"><option value="">Koko sarja (kärki ja häntä)</option>${joukkueet.map((j) => `<option${j === s.lyojaJoukkue ? " selected" : ""}>${esc(j)}</option>`).join("")}</select></label>
      <label class="kentta">Vähintään lyöntivuoroja <select id="jo-min">${[1, 50, 100, 150].map((n) => `<option${n === s.minLv ? " selected" : ""}>${n}</option>`).join("")}</select></label>
    </div>
    <div class="taulu-wrap"><table class="jo-lyojat">
      <thead><tr><th>Pelaaja</th><th class="jo-mob-pois">Joukkue 2026</th><th class="n jo-mob-pois">Lyöntivuoroja</th><th class="jo-palkkisarake">Juoksuarvo</th><th class="n">/ 100 LV</th></tr></thead>
      <tbody>${lista.map((p, i) => `${!s.lyojaJoukkue && i === 12 ? `<tr class="jo-vali"><td colspan="5">…</td></tr>` : ""}<tr${p.joukkue === "KPL" && s.lyojaJoukkue !== "KPL" ? ' class="oma"' : ""}>
        <td>${esc(p.nimi)}</td><td class="jo-mob-pois">${esc(p.joukkue || "")}</td><td class="n jo-mob-pois">${p.lv}</td>
        <td><div class="jo-hajonta" title="${esc(p.nimi)}: ${etumerkki(p.arvo, 1)} juoksua">
          <span class="rata"><span class="${p.arvo >= 0 ? "plus" : "miinus"}" style="${p.arvo >= 0 ? `left:50%;width:${(p.arvo / max) * 50}%` : `right:50%;width:${(-p.arvo / max) * 50}%`}"></span></span>
          <b class="num">${etumerkki(p.arvo, 1)}</b></div></td>
        <td class="n">${etumerkki(p.per100, 1)}</td></tr>`).join("") || `<tr><td colspan="5" class="tyhja">Ei lyöjiä tällä rajauksella.</td></tr>`}</tbody></table></div>
    <p class="vihje">Juoksuarvo kirjataan lyöjälle koko lyöntivuorolta, joten etenijöiden ratkaisut ja ulkopelin virheet näkyvät siinä myös. Ykköspesiksestä tulleilla ei ole lukuja.</p>`;
  $("#jo-lj", el).onchange = (e) => { s.lyojaJoukkue = e.target.value; piirraLyojat(joukkueet); };
  $("#jo-min", el).onchange = (e) => { s.minLv = +e.target.value; piirraLyojat(joukkueet); };
}

// ---------- joukkueet ----------
function piirraJoukkueet() {
  const rivit = Object.entries(D.joukkuearvot).map(([j, x]) => ({ j, ...x })).sort((a, b) => b.arvo - a.arvo);
  const max = Math.max(...rivit.map((r) => Math.abs(r.arvo)), 1);
  $("#jo-joukkueet").innerHTML = `
    <h2>Joukkueiden sisäpeli juoksuarvona</h2>
    <p class="ingressi">Kaikkien lyöntivuorojen juoksuarvo yhteensä: paljonko joukkueen sisäpeli tuotti juoksuja yli tai alle sarjan keskitason. Pudotuspelit ja karsinnat ovat mukana, joten otteluiden määrä vaihtelee.</p>
    <div class="jo-joukkuepalkit">${rivit.map((r) => `<div class="jo-jr${r.j === "KPL" ? " oma" : ""}"><span class="jo-jn">${esc(r.j)}</span>
      <div class="jo-hajonta" title="${esc(r.j)}: ${etumerkki(r.arvo, 1)} juoksua ${r.lv} lyöntivuorosta"><span class="rata"><span class="${r.arvo >= 0 ? "plus" : "miinus"}" style="${r.arvo >= 0 ? `left:50%;width:${(r.arvo / max) * 50}%` : `right:50%;width:${(-r.arvo / max) * 50}%`}"></span></span>
      <b class="num">${etumerkki(r.arvo, 1)}</b></div><span class="pieni">${r.lv} lyöntivuoroa</span></div>`).join("")}</div>`;
}
