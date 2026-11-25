// Talvisuper-välisivu (25.11.2026, Jugin toive): #/talvisuper, valikossa ennen Oma harjoittelu -osiota.
// Talvisuper on oma sarjansa: tilastoidaan samoin kuin Superpesis ja analysoidaan samoilla mittareilla, mutta lukuja
// ei summata Superpesiksen kauteen. Data YDIN 2027:stä (ks. js/talvisuper.js).
import { $, $$, esc } from "../util.js";
import { hae, piirraTalvisuper, talviApu } from "../talvisuper.js";

const { hk, halli, logo, OMA, YDIN } = talviApu;
const KK = ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"];
let st = { lohko: "", vainKpl: false };

function tulosOsat(o) {
  const h = o.tulos.split(" ")[0].toLowerCase(), lisa = /[sk]$/.test(h) ? h.slice(-1) : "";
  const [a, b] = h.replace(/[sk]/g, "").split("-").map(Number);
  return { a, b, lisa, jaksot: ((o.tulos.match(/\((.*)\)/) || [, ""])[1]).replace(/-/g, "–") };
}

function taulukko(D, nimi) {
  const t = (D.taulukot || {})[nimi] || [];
  return `<section class="paneeli ts-kortti"><div class="osio-paa"><h2>${esc(nimi)}</h2><span class="pieni">alkulohko</span></div>
    <table class="ts-taulu"><thead><tr><th></th><th class="l">Joukkue</th><th>O</th><th>V</th><th>H</th><th title="Jaksot voitetut–hävityt">Jaksot</th><th title="Juoksuero jaksoissa">+/−</th></tr></thead><tbody>
    ${t.map((r, i) => `<tr class="${r.jk === OMA ? "oma" : ""}"><td class="num">${i + 1}</td><td class="l"><span class="ts-jk">${logo(D, r.jk)}${esc(r.jk)}</span></td><td class="num">${r.O}</td><td class="num"><b>${r.V}</b></td><td class="num">${r.H}</td><td class="num">${r.JV}–${r.JH}</td><td class="num">${r.J > 0 ? "+" : ""}${r.J}</td></tr>`).join("")}
    </tbody></table><p class="pieni ts-lahde">Järjestys voitot, jaksoero, juoksuero (alustava). Virallinen järjestys pesistulokset.fi:ssä.</p></section>`;
}

function ohjelma(D) {
  const nyt = Date.now();
  const L = D.ottelut.filter((o) => (!st.lohko || o.lohko === st.lohko) && (!st.vainKpl || o.koti === OMA || o.vieras === OMA));
  if (!L.length) return `<p class="pieni">Ei otteluita valinnalla.</p>`;
  let html = "", kk = null, pv = null;
  for (const o of L) {
    const d = new Date(o.pvm), p = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Helsinki" })), t = hk(o.pvm);
    const kkAv = `${p.getFullYear()}-${p.getMonth()}`;
    if (kkAv !== kk) { kk = kkAv; pv = null; html += `<div class="tso-kk">${KK[p.getMonth()]} ${p.getFullYear()}</div>`; }
    if (t.pv !== pv) { pv = t.pv; html += `<div class="tso-pv">${t.pv}</div>`; }
    const kpl = o.koti === OMA || o.vieras === OMA;
    let keski = `<span class="tso-klo num">${t.klo}</span>`, kw = false, vw = false;
    if (o.tulos) {
      const r = tulosOsat(o); kw = r.a > r.b; vw = r.b > r.a;
      keski = `<span class="tso-tulos"><b class="num">${r.a}–${r.b}${r.lisa ? `<small>${r.lisa === "s" ? " SV" : " KK"}</small>` : ""}</b><small class="num">${esc(r.jaksot)}</small></span>`;
    }
    const lohko = /^lohko/i.test(o.lohko) ? o.lohko.replace(/^Lohko /i, "") : o.lohko;
    html += `<a class="tso-rivi${kpl ? " kpl" : ""}${!o.tulos && d < nyt ? " ohi" : ""}" href="https://www.pesistulokset.fi/ottelut/${o.id}" target="_blank" rel="noopener">
      <span class="tso-jk k${o.tulos && !kw ? " h" : ""}"><span>${esc(o.koti)}</span>${logo(D, o.koti)}</span>
      ${keski}
      <span class="tso-jk${o.tulos && !vw ? " h" : ""}">${logo(D, o.vieras)}<span>${esc(o.vieras)}</span></span>
      <span class="tso-halli"><span>${esc(halli(o))}</span><i>${esc(lohko)}</i></span></a>`;
  }
  return html;
}

export async function nayta(main) {
  main.innerHTML = `<p class="pieni">Ladataan Talvisuperia…</p>`;
  const D = await hae();
  if (!D) { main.innerHTML = `<h1>Talvisuper</h1><div class="paneeli"><p>Talvisuperin dataa ei saatu ladattua YDIN 2027:stä. Yritä hetken päästä uudelleen.</p></div>`; return; }
  const lohkot = [...new Set(D.ottelut.map((o) => o.lohko).filter(Boolean))];
  const pelattu = D.ottelut.filter((o) => o.tulos).length;
  const ajat = D.ottelut.map((o) => hk(o.pvm).pv.split(" ")[1]);
  main.innerHTML = `
    <div class="sivu-paa">
      <h1>Talvisuper ${D.kausi}</h1>
      <p class="ingressi">Miesten Talvisuper on oma sarjansa: halliturnaus ennen kautta. Se tilastoidaan samalla tavalla kuin Superpesis ja analysoidaan samoilla mittareilla, mutta lukuja ei lasketa yhteen Superpesiksen kauden kanssa.</p>
    </div>
    <div class="ts-kpi">
      <div><b class="num">${D.ottelut.length}</b><span>ottelua</span></div>
      <div><b class="num">${pelattu}</b><span>pelattu</span></div>
      <div><b class="num">${ajat[0] || "–"}–${ajat.at(-1) || ""}</b><span>ajanjakso</span></div>
      <div><b class="num">${Object.keys(D.taulukot || {}).length}</b><span>alkulohkoa</span></div>
    </div>
    <div class="ts-sivu">
      <section class="paneeli ts-ohjelma">
        <div class="osio-paa"><h2>Otteluohjelma</h2><a href="${YDIN}" target="_blank" rel="noopener">YDIN 2027 ↗</a></div>
        <div class="ts-valinnat">
          ${[["", "Kaikki"], ...lohkot.map((l) => [l, l])].map(([v, n]) => `<button type="button" class="chip" data-lohko="${esc(v)}" aria-pressed="${v === st.lohko}">${esc(n)}</button>`).join("")}
          <label class="chip"><input type="checkbox" id="ts-vain"${st.vainKpl ? " checked" : ""}>Vain KPL</label>
        </div>
        <div id="ts-lista" class="tso-lista"></div>
        <p class="pieni ts-lahde">Ajat Suomen aikaa. Rivi avaa ottelun pesistulokset.fi:ssä. SV = supervuoropari, KK = kotiutuskilpailu.</p>
      </section>
      <div class="ts-sivupalkki">
        <section id="ts-kpl"></section>
        ${Object.keys(D.taulukot || {}).map((l) => taulukko(D, l)).join("")}
        <section class="paneeli ts-kortti"><div class="osio-paa"><h2>Tilastot</h2></div>
          <p class="pieni" style="margin:0">Pelaaja- ja joukkuetilastot (K, L, T, KL%, KL0–KL3) sekä lyöntikartat tulevat tänne samoilla mittareilla kuin Superpesiksessä, kun ottelut alkavat 6.1.2027.</p></section>
      </div>
    </div>`;
  const piirra = () => { $("#ts-lista").innerHTML = ohjelma(D); };
  piirra();
  piirraTalvisuper($("#ts-kpl"), { tiivis: true, linkki: "ydin" });
  $$(".chip[data-lohko]", main).forEach((b) => (b.onclick = () => {
    st.lohko = b.dataset.lohko;
    $$(".chip[data-lohko]", main).forEach((x) => x.setAttribute("aria-pressed", x === b)); piirra();
  }));
  $("#ts-vain").onchange = (e) => { st.vainKpl = e.target.checked; piirra(); };
}
