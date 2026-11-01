// Lyöntipäiväkirja (16.10.2026): pelaajan oma setti. Missiot (esim. 2000 pomppua talvikaudella) ja
// kirjaukset (laji + määrä). Pelaaja näkee ja muokkaa vain omiaan, valmentajat seuraavat kaikkia.
import { sb, tila } from "../db.js";
import { $, $$, esc, pvm, ilmoita, palkki } from "../util.js";
import { lataaNimet, kirjoittajanNimi } from "../keskus.js";

const LAJIT = ["Pieni 1-raja", "Pieni 2-raja", "Keskipieni", "Ohitus", "Rajakova 1-raja", "Rajakova 2-raja", "Kumura", "Saumaveto", "Ilmasauma", "Viistari/pystäri", "Koppi"];
const LISAYS = [10, 25, 50, 100];
const PAIVA = 864e5;

const oma = () => (tila.istunto?.user?.email || "").toLowerCase();
const tanaan = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
const pv = (s) => new Date(s + "T12:00:00Z").getTime();
const lisaaPv = (s, n) => new Date(pv(s) + n * PAIVA).toISOString().slice(0, 10);
const sama = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const luku = (n) => Math.round(n).toLocaleString("fi-FI");
const maanantai = (s) => { const d = new Date(s + "T12:00:00Z"); return lisaaPv(s, -((d.getUTCDay() + 6) % 7)); };
function kaudenLoppu() { const t = tanaan(), y = +t.slice(0, 4), m = +t.slice(5, 7); return m >= 4 ? `${y + 1}-03-31` : `${y}-03-31`; }

let valittuLaji = null;
let maara = 0;

// Mission tila: tehty, odotettu tähän päivään mennessä, tahti
export function laske(m, kirjaukset) {
  const t = tanaan();
  const omat = kirjaukset.filter((k) => k.omistaja === m.omistaja && sama(k.laji, m.laji) && k.pvm >= m.alku && k.pvm <= m.loppu);
  const tehty = omat.reduce((s, k) => s + k.maara, 0);
  const kesto = Math.max(1, (pv(m.loppu) - pv(m.alku)) / PAIVA + 1);
  const kulunut = Math.max(0, Math.min(kesto, (pv(t) - pv(m.alku)) / PAIVA + 1));
  const odotettu = (m.tavoite * kulunut) / kesto;
  const jaljella = Math.max(0, kesto - kulunut);
  const vk4 = omat.filter((k) => k.pvm > lisaaPv(t, -28)).reduce((s, k) => s + k.maara, 0);
  const vkTahti = vk4 / Math.min(4, Math.max(1, kulunut / 7));
  const tarvitaan = jaljella > 0 ? Math.max(0, m.tavoite - tehty) / Math.max(1, jaljella / 7) : 0;
  return { omat, tehty, odotettu, ero: tehty - odotettu, pct: (100 * tehty) / m.tavoite, jaljella, vkTahti, tarvitaan, valmis: tehty >= m.tavoite, paattynyt: t > m.loppu };
}

// Kertymäkaavio: toteutunut porraskäyrä vs. tasainen tavoitetahti
function kertyma(m, s) {
  const W = 560, H = 150, L = 40, R = 10, T = 10, B = 24;
  const x0 = pv(m.alku), x1 = pv(m.loppu) + PAIVA, ymax = Math.max(m.tavoite, s.tehty) * 1.05;
  const X = (d) => L + ((pv(d) - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + (1 - v / ymax) * (H - T - B);
  const paivat = [...new Set(s.omat.map((k) => k.pvm))].sort();
  let kum = 0, polku = `M${X(m.alku).toFixed(1)},${Y(0).toFixed(1)}`;
  for (const d of paivat) { polku += `H${X(d).toFixed(1)}`; kum += s.omat.filter((k) => k.pvm === d).reduce((a, k) => a + k.maara, 0); polku += `V${Y(kum).toFixed(1)}`; }
  const loppuX = X(tanaan() < m.loppu ? tanaan() : m.loppu);
  polku += `H${Math.max(loppuX, X(paivat.at(-1) || m.alku)).toFixed(1)}`;
  const kk = [];
  for (let d = m.alku.slice(0, 8) + "01"; d <= m.loppu; d = lisaaPv(d, 32).slice(0, 8) + "01") if (d >= m.alku) kk.push(d);
  const KK = ["tammi", "helmi", "maalis", "huhti", "touko", "kesä", "heinä", "elo", "syys", "loka", "marras", "joulu"];
  return `<svg class="ly-kertyma" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kertymä: ${luku(s.tehty)} / ${luku(m.tavoite)}, tavoitetahti katkoviivalla">
    <line x1="${L}" x2="${W - R}" y1="${Y(m.tavoite)}" y2="${Y(m.tavoite)}" stroke="var(--line)" stroke-dasharray="2 4"/>
    <text x="${L - 6}" y="${Y(m.tavoite) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${luku(m.tavoite)}</text>
    <text x="${L - 6}" y="${Y(0) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">0</text>
    <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/>
    ${kk.map((d) => `<text x="${X(d)}" y="${H - 6}" font-size="11" fill="var(--ink-3)">${KK[+d.slice(5, 7) - 1]}</text>`).join("")}
    <line x1="${X(m.alku)}" y1="${Y(0)}" x2="${X(lisaaPv(m.loppu, 1))}" y2="${Y(m.tavoite)}" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="5 5"/>
    <path d="${polku}" fill="none" stroke="var(--kpl)" stroke-width="2.5" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(245,168,0,.5))"/>
    ${tanaan() >= m.alku && tanaan() <= m.loppu ? `<line x1="${X(tanaan())}" x2="${X(tanaan())}" y1="${T}" y2="${Y(0)}" stroke="var(--ink-2)" stroke-width="1"/><text x="${X(tanaan()) + 4}" y="${T + 10}" font-size="11" fill="var(--ink-2)">tänään</text>` : ""}
  </svg>`;
}

function missioKortti(m, s, muokattava) {
  const tila2 = s.valmis ? `<span class="ly-tila hyva">Tavoite saavutettu</span>`
    : s.paattynyt ? `<span class="ly-tila heikko">Päättyi ${luku(m.tavoite - s.tehty)} lyöntiä vajaana</span>`
    : s.ero >= 0 ? `<span class="ly-tila hyva">${luku(s.ero)} edellä aikataulusta</span>`
    : `<span class="ly-tila heikko">${luku(-s.ero)} jäljessä aikataulusta</span>`;
  return `<article class="ly-missio paneeli">
    <div class="ly-m-paa">
      <div><h3>${esc(m.nimi || `${luku(m.tavoite)} × ${m.laji}`)}</h3><p class="pieni">${esc(m.laji)} · ${pvm(m.alku)}–${pvm(m.loppu)}</p></div>
      ${muokattava ? `<button class="btn ly-pieni" data-arkistoi="${m.id}" title="Siirrä päättyneisiin">Arkistoi</button>` : ""}
    </div>
    <div class="ly-m-luvut">
      <div><span class="ly-iso num">${luku(s.tehty)}</span><span class="ly-yks">/ ${luku(m.tavoite)}</span></div>
      <div class="ly-pct num">${Math.floor(s.pct)} %</div>
    </div>
    ${palkki(s.pct)}
    <div class="ly-m-ala">${tila2}${!s.valmis && !s.paattynyt ? `<span class="pieni">Tahti 4 vk: <b class="num">${luku(s.vkTahti)}</b>/vk · tarvitaan <b class="num">${luku(s.tarvitaan)}</b>/vk</span>` : ""}</div>
    ${kertyma(m, s)}
  </article>`;
}

function viikkoPylvaat(kirjaukset) {
  const nyt = maanantai(tanaan()), vkt = Array.from({ length: 12 }, (_, i) => lisaaPv(nyt, -7 * (11 - i)));
  const sum = vkt.map((v) => kirjaukset.filter((k) => k.pvm >= v && k.pvm < lisaaPv(v, 7)));
  const max = Math.max(1, ...sum.map((a) => a.reduce((s, k) => s + k.maara, 0)));
  return `<div class="ly-viikot" role="img" aria-label="Lyönnit viikoittain, 12 viikkoa">${sum.map((a, i) => {
    const n = a.reduce((s, k) => s + k.maara, 0);
    const lajeittain = Object.entries(a.reduce((o, k) => ((o[k.laji] = (o[k.laji] || 0) + k.maara), o), {})).map(([l, x]) => `${l} ${x}`).join(", ");
    return `<div class="ly-vk${i === 11 ? " nyt" : ""}" title="Viikko alkaen ${pvm(vkt[i])}: ${n} lyöntiä${lajeittain ? " (" + lajeittain + ")" : ""}">
      <span class="ly-vk-n num">${n || ""}</span><span class="ly-vk-p" style="height:${n ? Math.max(4, (100 * n) / max) : 0}%"></span><span class="ly-vk-l">${+vkt[i].slice(8, 10)}.${+vkt[i].slice(5, 7)}.</span></div>`;
  }).join("")}</div>`;
}

function historia(kirjaukset, muokattava) {
  const viim = [...kirjaukset].sort((a, b) => b.pvm.localeCompare(a.pvm) || b.luotu.localeCompare(a.luotu)).slice(0, 40);
  if (!viim.length) return `<p class="tyhja">Ei vielä kirjauksia.</p>`;
  return `<ul class="ly-hist">${viim.map((k) => `<li><span class="ly-h-pvm">${pvm(k.pvm)}</span><span class="ly-h-laji">${esc(k.laji)}${k.huomio ? `<small>${esc(k.huomio)}</small>` : ""}</span><span class="ly-h-maara num">${luku(k.maara)}</span>${muokattava ? `<button class="ly-poista" data-poista="${k.id}" aria-label="Poista kirjaus ${esc(k.laji)} ${k.maara}">✕</button>` : ""}</li>`).join("")}</ul>`;
}

async function hae(email) {
  let qm = sb.from("lyonti_missiot").select("*").order("alku", { ascending: false });
  let qk = sb.from("lyonti_kirjaukset").select("*").order("pvm", { ascending: false }).limit(5000);
  if (email) { qm = qm.eq("omistaja", email); qk = qk.eq("omistaja", email); }
  const [m, k] = await Promise.all([qm, qk]);
  if (m.error) throw m.error;
  if (k.error) throw k.error;
  return { missiot: m.data, kirjaukset: k.data };
}

const valilehdet = (aktiivinen) => tila.valmennus ? `<div class="ly-tabit" role="tablist">
  <a href="#/lyonnit" role="tab" aria-selected="${aktiivinen === "oma"}">Oma päiväkirja</a>
  <a href="#/lyonnit/seuranta" role="tab" aria-selected="${aktiivinen === "seuranta"}">Seuranta</a></div>` : "";

export async function nayta(main, osa, kenen) {
  await lataaNimet();
  if (osa === "seuranta") return seuranta(main);
  if (osa === "p" && kenen) return paivakirja(main, decodeURIComponent(kenen).toLowerCase(), false);
  return paivakirja(main, oma(), true);
}

async function paivakirja(main, email, muokattava) {
  if (!muokattava && !tila.valmennus) { location.hash = "#/lyonnit"; return; }
  const { missiot, kirjaukset } = await hae(email);
  const aktiiviset = missiot.filter((m) => !m.arkistoitu);
  const arkisto = missiot.filter((m) => m.arkistoitu);
  const kaytetyt = [...new Set([...aktiiviset.map((m) => m.laji), ...kirjaukset.map((k) => k.laji)])];
  const lajit = [...kaytetyt, ...LAJIT.filter((l) => !kaytetyt.some((x) => sama(x, l)))];
  if (!valittuLaji || !lajit.some((l) => sama(l, valittuLaji))) valittuLaji = aktiiviset[0]?.laji || null;
  const t = tanaan(), vk = maanantai(t);
  const tamaVk = kirjaukset.filter((k) => k.pvm >= vk).reduce((s, k) => s + k.maara, 0);
  const kausi = kirjaukset.filter((k) => k.pvm >= (aktiiviset.map((m) => m.alku).sort()[0] || lisaaPv(t, -180))).reduce((s, k) => s + k.maara, 0);
  const nimi = muokattava ? "" : kirjoittajanNimi(email) || email;

  main.innerHTML = `
    ${valilehdet(muokattava ? "oma" : "")}
    <div class="ly-otsikko"><div>
      <h1>${muokattava ? "Lyöntipäiväkirja" : esc(nimi)}</h1>
      <p class="ingressi">${muokattava ? "Oma lyöntisi: kirjaa laji ja määrä, lyöt sitten yhteisissä treeneissä tai omalla ajalla. Missio näyttää, missä mennään." : `Lyöntipäiväkirja · vain luku${tila.valmennus ? ` · <a href="#/lyonnit/seuranta">takaisin seurantaan</a>` : ""}`}</p></div>
      <div class="ly-yht"><div><span class="num">${luku(tamaVk)}</span><small>tällä viikolla</small></div><div><span class="num">${luku(kausi)}</span><small>${aktiiviset.length ? "missioiden aikana" : "puolen vuoden aikana"}</small></div></div>
    </div>

    ${muokattava ? `<form id="ly-kirjaus" class="paneeli ly-kirjaus">
      <h2>Kirjaa lyönnit</h2>
      <div class="ly-lajit" role="group" aria-label="Laji">${lajit.map((l) => `<button type="button" class="chip" data-laji="${esc(l)}" aria-pressed="${!!valittuLaji && sama(l, valittuLaji)}">${esc(l)}</button>`).join("")}
        <input type="text" class="ly-oma-laji" name="omalaji" placeholder="Muu laji…" maxlength="60" aria-label="Muu laji"></div>
      <div class="ly-maara">
        <button type="button" class="btn ly-pm" data-delta="-10" aria-label="Vähennä 10">−</button>
        <input name="maara" type="number" inputmode="numeric" min="1" max="5000" value="${maara || ""}" placeholder="0" aria-label="Määrä" required>
        ${LISAYS.map((n) => `<button type="button" class="btn ly-pm" data-delta="${n}">+${n}</button>`).join("")}
      </div>
      <div class="rivi">
        <label class="ly-kentta">Päivä <input type="date" name="pvm" value="${t}" max="${t}" required></label>
        <label class="ly-kentta ly-kasvaa">Huomio (vapaaehtoinen) <input type="text" name="huomio" maxlength="500" placeholder="esim. syöttökone, 2-raja"></label>
        <button class="btn ensisij ly-tallenna">Tallenna</button>
      </div>
    </form>` : ""}

    <div class="osio-paa"><h2>Missiot</h2>${muokattava ? `<button class="btn" id="ly-uusi-m">+ Uusi missio</button>` : ""}</div>
    ${muokattava ? `<form id="ly-missio" class="paneeli ly-uusi" hidden>
      <div class="rivi">
        <label class="ly-kentta">Laji <input type="text" name="laji" list="ly-lajilista" required maxlength="60" placeholder="esim. Pieni 2-raja"></label>
        <label class="ly-kentta">Tavoite (lyöntiä) <input name="tavoite" type="number" min="1" required placeholder="2000" style="width:130px"></label>
        <label class="ly-kentta">Alkaa <input name="alku" type="date" value="${t}" required></label>
        <label class="ly-kentta">Päättyy <input name="loppu" type="date" value="${kaudenLoppu()}" required></label>
        <label class="ly-kentta ly-kasvaa">Nimi (vapaaehtoinen) <input type="text" name="nimi" maxlength="80" placeholder="esim. Talven 2-rajat"></label>
      </div>
      <datalist id="ly-lajilista">${lajit.map((l) => `<option value="${esc(l)}">`).join("")}</datalist>
      <div class="rivi"><button class="btn ensisij">Luo missio</button><button type="button" class="btn" id="ly-peru-m">Peru</button></div>
      <p class="pieni">Mission edistymiseen lasketaan saman lajin kirjaukset mission aikaväliltä.</p>
    </form>` : ""}
    <details class="ly-selite"><summary>Mitä missiokortti näyttää?</summary>
      <dl>
        <div><dt>Iso luku / tavoite ja %</dt><dd>Tehdyt lyönnit mission lajissa mission aikavälillä ja osuus tavoitteesta.</dd></div>
        <div><dt>Edellä / jäljessä aikataulusta</dt><dd>Tehdyt lyönnit verrattuna tasaiseen tahtiin: tavoite × kuluneet päivät / mission päivät. Esimerkki: 2000 lyönnin missiossa puolivälissä tasainen tahti on 1000.</dd></div>
        <div><dt>Tahti 4 vk</dt><dd>Lajin lyönnit viimeiseltä neljältä viikolta jaettuna neljällä (lyhyemmässä missiossa kuluneilla viikoilla).</dd></div>
        <div><dt>Tarvitaan /vk</dt><dd>Jäljellä oleva määrä jaettuna jäljellä olevilla viikoilla. Kun tahti 4 vk on tätä suurempi, tavoite täyttyy nykymenolla.</dd></div>
        <div><dt>Kertymäkäyrä</dt><dd>Oranssi porrasviiva = kertyneet lyönnit, katkoviiva = tasainen tahti alusta tavoitteeseen, pystyviiva = tänään.</dd></div>
      </dl>
      <p class="pieni">Kaikki Keskuksen laskurit ja lyhenteet: <a href="#/ohje/lyonnit">Ohje</a>.</p>
    </details>
    <div class="ly-missiot">${aktiiviset.map((m) => missioKortti(m, laske(m, kirjaukset), muokattava)).join("") || `<p class="tyhja">${muokattava ? "Ei vielä missiota. Aseta esimerkiksi 2000 lyöntiä pieneen 2-rajaan talvikaudelle." : "Ei aktiivisia missioita."}</p>`}</div>

    <div class="ly-alaosa">
      <section><h2>Lyönnit viikoittain</h2>${viikkoPylvaat(kirjaukset)}</section>
      <section><h2>Viimeisimmät kirjaukset</h2>${historia(kirjaukset, muokattava)}</section>
    </div>
    ${arkisto.length ? `<details class="ly-arkisto"><summary>Päättyneet missiot (${arkisto.length})</summary><div class="ly-missiot">${arkisto.map((m) => missioKortti(m, laske(m, kirjaukset), false)).join("")}</div></details>` : ""}`;

  if (!muokattava) return;
  const f = $("#ly-kirjaus"), mi = f.elements.maara, oml = f.elements.omalaji;
  const valitse = (l) => { valittuLaji = l; $$("[data-laji]", f).forEach((b) => b.setAttribute("aria-pressed", sama(b.dataset.laji, l || "~"))); };
  $$("[data-laji]", f).forEach((b) => (b.onclick = () => { oml.value = ""; valitse(b.dataset.laji); }));
  oml.oninput = () => valitse(oml.value.trim() || null);
  $$("[data-delta]", f).forEach((b) => (b.onclick = () => { mi.value = Math.max(0, (+mi.value || 0) + +b.dataset.delta) || ""; maara = +mi.value || 0; }));
  mi.oninput = () => (maara = +mi.value || 0);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const laji = (oml.value.trim() || valittuLaji || "").trim();
    if (!laji) return ilmoita("Valitse laji.", true);
    if (!(+mi.value > 0)) return ilmoita("Anna määrä.", true);
    const nappi = f.querySelector(".ly-tallenna"); nappi.disabled = true;
    const { error } = await sb.from("lyonti_kirjaukset").insert({ laji, maara: +mi.value, pvm: f.elements.pvm.value, huomio: f.elements.huomio.value.trim() || null });
    nappi.disabled = false;
    if (error) return ilmoita("Tallennus epäonnistui: " + error.message, true);
    ilmoita(`Tallennettu: ${laji} ${mi.value}`);
    maara = 0; valittuLaji = laji;
    paivakirja(main, email, true);
  };
  const mf = $("#ly-missio");
  $("#ly-uusi-m").onclick = () => { mf.hidden = false; mf.elements.laji.value = valittuLaji || ""; mf.elements.laji.focus(); };
  $("#ly-peru-m").onclick = () => (mf.hidden = true);
  mf.onsubmit = async (e) => {
    e.preventDefault();
    const x = mf.elements;
    if (x.loppu.value < x.alku.value) return ilmoita("Päättymispäivä on ennen alkua.", true);
    const { error } = await sb.from("lyonti_missiot").insert({ laji: x.laji.value.trim(), tavoite: +x.tavoite.value, alku: x.alku.value, loppu: x.loppu.value, nimi: x.nimi.value.trim() || null });
    if (error) return ilmoita("Tallennus epäonnistui: " + error.message, true);
    ilmoita("Missio luotu"); valittuLaji = x.laji.value.trim();
    paivakirja(main, email, true);
  };
  $$("[data-arkistoi]").forEach((b) => (b.onclick = async () => {
    if (b.dataset.vahvista !== "1") { b.dataset.vahvista = "1"; b.textContent = "Arkistoidaanko?"; b.classList.add("vaara"); return; }
    const { error } = await sb.from("lyonti_missiot").update({ arkistoitu: true }).eq("id", b.dataset.arkistoi);
    if (error) return ilmoita("Ei onnistunut: " + error.message, true);
    paivakirja(main, email, true);
  }));
  $$("[data-poista]").forEach((b) => (b.onclick = async () => {
    if (b.dataset.vahvista !== "1") { b.dataset.vahvista = "1"; b.textContent = "Poista?"; b.classList.add("vahvista"); return; }
    const { error } = await sb.from("lyonti_kirjaukset").delete().eq("id", b.dataset.poista);
    if (error) return ilmoita("Poisto epäonnistui: " + error.message, true);
    ilmoita("Kirjaus poistettu");
    paivakirja(main, email, true);
  }));
}

async function seuranta(main) {
  if (!tila.valmennus) { location.hash = "#/lyonnit"; return; }
  const { missiot, kirjaukset } = await hae(null);
  const t = tanaan(), raja4 = lisaaPv(t, -28);
  const henkilot = [...new Set([...missiot.filter((m) => !m.arkistoitu).map((m) => m.omistaja), ...kirjaukset.map((k) => k.omistaja)])];
  const rivit = henkilot.map((e) => {
    const omat = kirjaukset.filter((k) => k.omistaja === e);
    const ms = missiot.filter((m) => m.omistaja === e && !m.arkistoitu).map((m) => ({ m, s: laske(m, kirjaukset) }));
    return { e, nimi: kirjoittajanNimi(e) || e.split("@")[0], ms, vk4: omat.filter((k) => k.pvm > raja4).reduce((s, k) => s + k.maara, 0), viim: omat[0]?.pvm };
  }).sort((a, b) => a.nimi.localeCompare(b.nimi, "fi"));
  const jaljessa = rivit.flatMap((r) => r.ms).filter(({ s }) => !s.valmis && !s.paattynyt && s.ero < 0).length;

  main.innerHTML = `${valilehdet("seuranta")}
    <h1>Lyöntipäiväkirjat · seuranta</h1>
    <p class="ingressi">Pelaajien omat missiot ja kirjaukset. Vain valmentajat ja ylläpitäjä näkevät tämän sivun. Pelaajat näkevät vain oman päiväkirjansa.</p>
    <div class="kpi-rivi">
      <div class="kpi"><div class="otsikko">Kirjaajia</div><div class="arvo">${rivit.length}</div></div>
      <div class="kpi"><div class="otsikko">Aktiivisia missioita</div><div class="arvo">${rivit.reduce((s, r) => s + r.ms.length, 0)}</div><div class="ala">${jaljessa ? `${jaljessa} jäljessä aikataulusta` : "kaikki aikataulussa"}</div></div>
      <div class="kpi"><div class="otsikko">Lyönnit, 4 viikkoa</div><div class="arvo">${luku(rivit.reduce((s, r) => s + r.vk4, 0))}</div></div>
    </div>
    ${rivit.length ? `<div class="taulu-wrap"><table class="ly-seuranta"><thead><tr><th>Pelaaja</th><th>Missio</th><th style="min-width:200px">Edistyminen</th><th>Aikataulu</th><th class="n">4 vk</th><th>Viimeisin</th></tr></thead><tbody>
      ${rivit.map((r) => (r.ms.length ? r.ms : [null]).map((x, i) => `<tr>
        ${i === 0 ? `<td rowspan="${Math.max(1, r.ms.length)}"><a href="#/lyonnit/p/${encodeURIComponent(r.e)}">${esc(r.nimi)}</a></td>` : ""}
        <td>${x ? esc(x.m.nimi || `${luku(x.m.tavoite)} × ${x.m.laji}`) + `<div class="pieni">${esc(x.m.laji)} · päättyy ${pvm(x.m.loppu)}</div>` : `<span class="pieni">ei missiota</span>`}</td>
        <td>${x ? `<span class="num">${luku(x.s.tehty)} / ${luku(x.m.tavoite)}</span> <span class="pieni">${Math.floor(x.s.pct)} %</span>${palkki(x.s.pct)}` : ""}</td>
        <td>${x ? (x.s.valmis ? `<span class="ly-tila hyva">valmis</span>` : x.s.ero >= 0 ? `<span class="ly-tila hyva">+${luku(x.s.ero)}</span>` : `<span class="ly-tila heikko">−${luku(-x.s.ero)}</span>`) : ""}</td>
        ${i === 0 ? `<td class="n num" rowspan="${Math.max(1, r.ms.length)}">${luku(r.vk4)}</td><td rowspan="${Math.max(1, r.ms.length)}">${r.viim ? pvm(r.viim) : "–"}</td>` : ""}
      </tr>`).join("")).join("")}</tbody></table></div>
      <p class="vihje">Aikataulu = tehdyt lyönnit verrattuna tasaiseen tahtiin mission alusta tähän päivään. 4 vk = kaikki kirjatut lyönnit neljän viikon ajalta.</p>`
    : `<p class="tyhja">Kukaan ei ole vielä kirjannut lyöntejä.</p>`}`;
}
