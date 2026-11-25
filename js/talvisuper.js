// Talvisuper-kortti (25.11.2026): KPL:n Talvisuper-ottelut ja oma lohko. Data YDIN 2027:n julkisesta reposta
// (data/out/talvi_<kausi>.json, ydin/talvi.py, päivittyy iltaajossa). Talvisuper pidetään tarkoituksella erillään
// Superpesiksen tilastoista (Jugi 25.11.2026: halliturnaus, data tulkitaan eri tavalla) – kortti ei vie mitään
// tilastoihin, kuormaan eikä vertailuihin. Uusi kausi: vaihda KAUSI.
import { esc } from "./util.js";

const KAUSI = 2027;
const LAHDE = `https://raw.githubusercontent.com/Jugisoft/ydin-2027/main/data/out/talvi_${KAUSI}.json`;
const YDIN = "https://jugisoft.github.io/ydin-2027/talvi.html";
const OMA = "KPL";
const VP = ["su", "ma", "ti", "ke", "to", "pe", "la"];
let data = null;

async function hae() {
  if (data) return data;
  try { const r = await fetch(LAHDE, { cache: "no-cache" }); data = r.ok ? await r.json() : null; } catch { data = null; }
  return data;
}

const hk = (iso) => {
  const d = new Date(iso), p = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Helsinki" }));
  return { d, pv: `${VP[p.getDay()]} ${p.getDate()}.${p.getMonth() + 1}.`, klo: `${String(p.getHours()).padStart(2, "0")}.${String(p.getMinutes()).padStart(2, "0")}` };
};
const halli = (o) => (o.halli || "").split(",")[0].replace(" Messu- ja Urheilukeskus", " MUK");
const logo = (D, t) => D.logot?.[t] ? `<img src="${esc(D.logot[t])}" alt="" loading="lazy">` : `<span class="ts-ph">${esc(t.slice(0, 3))}</span>`;

/** Piirtää kortin elementtiin el. tiivis = true: vain seuraava ottelu + otteluohjelma (Keskuksen sivupalkki). */
export async function piirraTalvisuper(el, { tiivis = false } = {}) {
  if (!el) return;
  const D = await hae();
  const omat = (D?.ottelut || []).filter((o) => o.koti === OMA || o.vieras === OMA);
  if (!D || !omat.length) { el.remove(); return; }
  const nyt = Date.now();
  const seuraava = omat.find((o) => !o.tulos && new Date(o.pvm) > nyt - 3 * 3600e3);
  const lohko = omat.find((o) => /^lohko/i.test(o.lohko))?.lohko;
  const taulu = (D.taulukot || {})[lohko] || [];
  const pelattu = omat.filter((o) => o.tulos);
  const v = pelattu.filter((o) => { const [a, b] = o.tulos.split(" ")[0].replace(/[sk]/gi, "").split("-").map(Number); return o.koti === OMA ? a > b : b > a; }).length;

  const rivi = (o) => {
    const t = hk(o.pvm), koti = o.koti === OMA, vast = koti ? o.vieras : o.koti;
    let tulos = `<span class="ts-klo num">${t.klo}</span>`;
    if (o.tulos) {
      const h = o.tulos.split(" ")[0].toLowerCase(), lisa = /[sk]$/.test(h) ? h.slice(-1).toUpperCase() : "";
      const [a, b] = h.replace(/[sk]/g, "").split("-").map(Number), om = koti ? a : b, va = koti ? b : a;
      tulos = `<span class="ts-tulos num ${om > va ? "v" : "h"}">${om}–${va}${lisa ? `<small>${lisa === "S" ? "SV" : "KK"}</small>` : ""}</span>`;
    }
    return `<a class="ts-rivi${o === seuraava ? " seur" : ""}${o.tulos ? " pel" : ""}" href="https://www.pesistulokset.fi/ottelut/${o.id}" target="_blank" rel="noopener">
      <span class="ts-pv">${t.pv}</span>
      <span class="ts-vast">${logo(D, vast)}<span><b>${esc(vast)}</b><small>${koti ? "kotona" : "vieraissa"} · ${esc(halli(o))}${/^lohko/i.test(o.lohko) ? "" : ` · ${esc(o.lohko)}`}</small></span></span>
      ${tulos}</a>`;
  };
  const tauluHtml = taulu.length ? `<table class="ts-taulu"><thead><tr><th></th><th class="l">${esc(lohko)}</th><th>O</th><th>V</th><th>H</th><th title="Juoksuero">+/−</th></tr></thead><tbody>
    ${taulu.map((r, i) => `<tr class="${r.jk === OMA ? "oma" : ""}"><td class="num">${i + 1}</td><td class="l"><span class="ts-jk">${logo(D, r.jk)}${esc(r.jk)}</span></td><td class="num">${r.O}</td><td class="num"><b>${r.V}</b></td><td class="num">${r.H}</td><td class="num">${r.J > 0 ? "+" : ""}${r.J}</td></tr>`).join("")}
    </tbody></table>` : "";
  const seurTeksti = seuraava ? (() => { const t = hk(seuraava.pvm); return `Seuraava: <b>${esc(seuraava.koti)} – ${esc(seuraava.vieras)}</b> ${t.pv} klo ${t.klo}, ${esc(halli(seuraava))}`; })()
    : pelattu.length ? `Kaikki ${pelattu.length} ottelua pelattu, ${v} voittoa.` : "";

  el.classList.add("paneeli", "ts-kortti");
  el.innerHTML = `
    <div class="osio-paa"><h2>Talvisuper ${D.kausi}</h2><a href="${YDIN}?j=${OMA}" target="_blank" rel="noopener">Koko ohjelma ↗</a></div>
    <p class="ts-erillinen">Halliturnaus · ${esc(lohko || "")}${pelattu.length ? ` · ${v}–${pelattu.length - v}` : ""} · ei mukana Superpesiksen tilastoissa</p>
    ${seurTeksti ? `<p class="ts-seur">${seurTeksti}</p>` : ""}
    <div class="ts-lista">${omat.map(rivi).join("")}</div>
    ${tiivis ? "" : tauluHtml}
    <p class="pieni ts-lahde">Ajat Suomen aikaa · lähde pesistulokset.fi YDIN 2027:n kautta, päivittyy iltaisin.</p>`;
}
