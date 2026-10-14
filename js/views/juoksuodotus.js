// Juoksuodotus pesätilanteittain: matriisi (tila × palot), kärkilyönnin kannattavuus ja lyöjien juoksuarvo.
// Data: taulu analyysit, avain juoksuodotus_2026 (Jarvisin skripti juoksuodotus.py, otteluiden tapahtumat 2026).
import { sb } from "../db.js";
import { $, $$, esc } from "../util.js";

const NIMI = { "0": "0-tilanne", "1": "1-tilanne", "2": "2-tilanne", "3": "3-tilanne", "1–2": "1–2-tilanne", "1–3": "1–3-tilanne", "2–3": "2–3-tilanne", "1–2–3": "Ajolähtö (1–2–3)" };
const PIENI = 60; // tätä pienempi otos merkitään
const s = { joukkue: "", ero: false, lyojaJoukkue: "KPL", minLv: 50 };
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
  if (!data) { main.innerHTML = `<h1>Juoksuodotus</h1><div class="paneeli tyhja-iso"><p>Juoksuodotusta ei ole vielä laskettu. Jarvis laskee sen skriptillä juoksuodotus.py.</p></div>`; return; }
  D = { ...data.data, paivitetty: data.paivitetty };
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
        <li>Kärkilyönnin kynnys: onnistumisprosentti, jolla kärkilyöntiä yrittänyt lyöntivuoro on keskimäärin yhtä arvokas kuin tavallinen lyöntivuoro samasta tilanteesta. Epäonnistunut tarkoittaa vuoroa, jossa kärkilyönti epäonnistui eikä yksikään onnistunut.</li>
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

// ---------- kärkilyönnin kannattavuus ----------
function piirraKL() {
  const rivit = D.tilanteet.flatMap((t) => [0, 1, 2].map((p) => ({ t, p, k: D.karkilyonti[`${t}|${p}`] }))).filter((r) => r.k);
  $("#jo-kl").innerHTML = `
    <h2>Milloin kärkilyönti kannattaa</h2>
    <p class="ingressi">Kynnys kertoo, kuinka usein kärkilyönnin pitää onnistua, jotta sitä yrittävä lyöntivuoro on keskimäärin yhtä arvokas kuin tavallinen lyöntivuoro samasta tilanteesta. Kun sarjan toteutunut onnistuminen on kynnyksen yläpuolella, yrittäminen on kannattanut.</p>
    <div class="taulu-wrap"><table class="jo-kl">
      <thead><tr><th>Tilanne</th><th class="n">Palot</th><th class="n jo-mob-pois" title="Juoksuarvo, kun kärkilyönti onnistui">Onnistui</th><th class="n jo-mob-pois" title="Juoksuarvo, kun kärkilyönti epäonnistui">Epäonnistui</th><th class="jo-palkkisarake">Onnistuminen ja kynnys</th><th class="n" title="Toteutunut onnistuminen miinus kynnys">Ero</th></tr></thead>
      <tbody>${rivit.map(({ t, p, k }) => {
        const m = k.toteutunut - k.kynnys, n = k.n_onnistui + k.n_epaonnistui;
        return `<tr>
          <td><span class="jo-tilanne">${pesaIkoni(t)}${esc(NIMI[t])}</span></td><td class="n">${p}</td>
          <td class="n jo-plus-teksti jo-mob-pois">${etumerkki(k.onnistui)}</td><td class="n jo-miinus-teksti jo-mob-pois">${etumerkki(k.epaonnistui)}</td>
          <td><div class="jo-kynnys" title="Kynnys ${pros(k.kynnys)}, toteutunut ${pros(k.toteutunut)} (${n} lyöntivuoroa)">
            <span class="jo-kp" style="width:${Math.round(k.toteutunut * 100)}%"></span><span class="jo-km" style="left:${Math.round(k.kynnys * 100)}%"><i>${pros(k.kynnys)}</i></span>
            <b class="num">${pros(k.toteutunut)}</b></div></td>
          <td class="n ${m >= 0.05 ? "jo-plus-teksti" : m <= -0.05 ? "jo-miinus-teksti" : ""}">${m >= 0 ? "+" : "−"}${Math.abs(Math.round(m * 100))} %-yks.${n < 120 ? `<span class="pieni-otos-merkki" title="Alle 120 lyöntivuoroa"> *</span>` : ""}</td></tr>`;
      }).join("")}</tbody></table></div>
    <p class="vihje">Palkki = sarjan toteutunut onnistumisprosentti, pystyviiva = kynnys. Onnistui ja Epäonnistui ovat lyöntivuoron keskimääräiset juoksuarvot. * = alle 120 lyöntivuoroa, suuntaa-antava. Taulukossa ovat tilanteet, joissa kumpaakin lopputulosta on vähintään 20.</p>`;
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
