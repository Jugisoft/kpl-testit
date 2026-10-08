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
export const SARJAVARIT = ["#38D6FF", "#FF3B4E", "#2EE59D", "#FFC93C", "#A78BFA", "#2E7BFF", "#F472B6", "#94A3B8"];
let hehkuRekisteroity = false;
export function piirra(canvas, config) {
  if (!window.Chart) { setTimeout(() => piirra(canvas, config), 150); return; }
  kaaviot.get(canvas)?.destroy();
  const Chart = window.Chart;
  Chart.defaults.font.family = "Barlow, system-ui, sans-serif";
  Chart.defaults.color = vari("--ink-3");
  Chart.defaults.borderColor = "rgba(56,214,255,.07)";
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(8,17,31,.95)";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(56,214,255,.35)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  if (!hehkuRekisteroity) {
    // viivoille hento hehku kuten kojelaudoissa
    Chart.register({ id: "hehku",
      beforeDatasetDraw(c, a) { const d = c.data.datasets[a.index]; if (c.config.type !== "line" || d.borderDash) return; c.ctx.save(); c.ctx.shadowColor = d.borderColor; c.ctx.shadowBlur = 10; },
      afterDatasetDraw(c) { if (c.config.type === "line") c.ctx.restore(); } });
    hehkuRekisteroity = true;
  }
  kaaviot.set(canvas, new Chart(canvas, config));
}
// Pystyliukuväri pinta-alalle / pylväille
export function liukuvari(alpha1 = .35, alpha2 = 0, rgb = "56,214,255") {
  return (ctx) => { const { chart } = ctx; const a = chart.chartArea; if (!a) return `rgba(${rgb},${alpha1})`;
    const g = chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, `rgba(${rgb},${alpha1})`); g.addColorStop(1, `rgba(${rgb},${alpha2})`); return g; };
}
// Rengasmittari (0–100) SVG:nä
export function mittari(pct, keski, ala = "", koko = 74) {
  const r = 30, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct ?? 0));
  const vari2 = p >= 67 ? "var(--cyan)" : p >= 34 ? "var(--yellow)" : "var(--red)";
  return `<svg class="mittari" width="${koko}" height="${koko}" viewBox="0 0 80 80" aria-hidden="true">
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/>
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="${vari2}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${(c * p) / 100} ${c}" transform="rotate(-90 40 40)" style="filter:drop-shadow(0 0 4px ${vari2})"/>
    <text x="40" y="${ala ? 41 : 46}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--ink)">${keski}</text>
    ${ala ? `<text x="40" y="56" text-anchor="middle" font-size="10" fill="var(--ink-3)">${ala}</text>` : ""}</svg>`;
}
export const palkki = (pct) => `<div class="palkki" aria-hidden="true"><span style="width:${Math.max(2, Math.min(100, pct ?? 0))}%"></span></div>`;
export function miniPylvaat(arvot, pienempiParempi) {
  const v = arvot.filter((x) => x != null);
  if (v.length < 3) return "";
  const min = Math.min(...v), max = Math.max(...v), vali = max - min || 1;
  return `<div class="mini-pylvaat" aria-hidden="true">${v.slice(-12).map((x, i, a) => {
    const suhde = pienempiParempi ? (max - x) / vali : (x - min) / vali;
    return `<span class="${i === a.length - 1 ? "viim" : ""}" style="height:${15 + 85 * suhde}%"></span>`; }).join("")}</div>`;
}
export function tuhoaKaaviot() { kaaviot.forEach((c) => c.destroy()); kaaviot.clear(); }
