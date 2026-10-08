import { tila, nimikirjaimet, nimi } from "./db.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function muotoile(arvo, testi) {
  if (arvo == null || Number.isNaN(arvo)) return "–";
  const d = tila.testi[testi]?.desimaalit ?? 2;
  return Number(arvo).toFixed(d).replace(".", ",");
}
export function muotoileMuutos(ero, testi) {
  if (ero == null || Number.isNaN(ero) || ero === 0) return "±0";
  return (ero > 0 ? "+" : "−") + muotoile(Math.abs(ero), testi);
}
export const pvm = (s) => { const [y, m, d] = s.split("-"); return `${+d}.${+m}.${y}`; };
export const pvmLyhyt = (s) => { const [y, m, d] = s.split("-"); return `${+d}.${+m}.${y.slice(2)}`; };
export function kausi(s) { const y = +s.slice(0, 4), m = +s.slice(5, 7); return m >= 7 ? `${y}–${String(y + 1).slice(2)}` : `${y - 1}–${String(y).slice(2)}`; }

export function parempi(testi, a, b) { // onko a parempi kuin b
  if (b == null) return true;
  return tila.testi[testi]?.pienempi_parempi ? a < b : a > b;
}
export function paras(testi, arvot) {
  const v = arvot.filter((x) => x != null && !Number.isNaN(x));
  if (!v.length) return null;
  return tila.testi[testi]?.pienempi_parempi ? Math.min(...v) : Math.max(...v);
}
export function parannus(testi, uusi, vanha) { // positiivinen = parempi
  if (uusi == null || vanha == null) return null;
  return tila.testi[testi]?.pienempi_parempi ? vanha - uusi : uusi - vanha;
}
export const mediaani = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const keskiarvo = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const hajonta = (a) => { if (a.length < 2) return null; const k = keskiarvo(a); return Math.sqrt(a.reduce((s, x) => s + (x - k) ** 2, 0) / (a.length - 1)); };

// Parhaat tulokset: avain kerta|pelaaja|testi -> arvo. Vain hyväksytyt ja ilman tarkennetta (piikit erikseen).
export function parhaatTulokset(rivit, { tarkenne = "" } = {}) {
  const ryhmat = new Map();
  const lent = new Map();
  for (const r of rivit) {
    if (!r.hyvaksytty || r.tarkenne !== tarkenne) continue;
    const k = `${r.testikerta_id}|${r.pelaaja_id}|${r.testi}`;
    (ryhmat.get(k) || ryhmat.set(k, []).get(k)).push(r.arvo);
    if (r.testi === "10m" || r.testi === "30m") {
      const kk = `${r.testikerta_id}|${r.pelaaja_id}|${r.yritys}`;
      const o = lent.get(kk) || {}; o[r.testi] = r.arvo; lent.set(kk, o);
    }
  }
  for (const [kk, o] of lent) {
    if (o["10m"] == null || o["30m"] == null) continue;
    const [kerta, pel] = kk.split("|");
    const k = `${kerta}|${pel}|lentava20`;
    (ryhmat.get(k) || ryhmat.set(k, []).get(k)).push(Math.round((o["30m"] - o["10m"]) * 100) / 100);
  }
  const out = [];
  for (const [k, arvot] of ryhmat) {
    const [kerta, pelaaja, testi] = k.split("|");
    const kk = tila.kerta[kerta];
    if (!kk) continue;
    out.push({ kerta, pelaaja, testi, arvo: paras(testi, arvot), ka: keskiarvo(arvot), n: arvot.length, pvm: kk.pvm });
  }
  return out.sort((a, b) => a.pvm.localeCompare(b.pvm));
}

export function kuva(p, iso = false) {
  if (p?.kuva_url) return `<img class="kuva${iso ? " iso" : ""}" src="${esc(p.kuva_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  return `<span class="kuva${iso ? " iso" : ""}" aria-hidden="true">${esc(nimikirjaimet(p))}</span>`;
}
export const pelaajaLinkki = (p) => `<a class="nimi" href="#/pelaaja/${p.id}">${kuva(p)}<span>${esc(nimi(p))}</span></a>`;

let ajastin;
export function ilmoita(teksti, virhe = false) {
  const el = $("#ilmoitus");
  el.textContent = teksti;
  el.className = "ilmoitus nakyy" + (virhe ? " virhe" : "");
  clearTimeout(ajastin);
  ajastin = setTimeout(() => (el.className = "ilmoitus"), virhe ? 6000 : 2500);
}

// Kaaviot (Chart.js)
const kaaviot = new Map();
export function vari(nimi) { return getComputedStyle(document.documentElement).getPropertyValue(nimi).trim(); }
export const SARJAVARIT = ["#2B6CB0", "#D62E2E", "#1F6F5C", "#B97A06", "#7B4BB7", "#0F8A9D", "#A23B72", "#5B6B7F"];
export function piirra(canvas, config) {
  if (!window.Chart) { setTimeout(() => piirra(canvas, config), 150); return; }
  kaaviot.get(canvas)?.destroy();
  const Chart = window.Chart;
  Chart.defaults.font.family = "Barlow, system-ui, sans-serif";
  Chart.defaults.color = vari("--ink-2");
  Chart.defaults.borderColor = vari("--line-2");
  kaaviot.set(canvas, new Chart(canvas, config));
}
export function tuhoaKaaviot() { kaaviot.forEach((c) => c.destroy()); kaaviot.clear(); }
