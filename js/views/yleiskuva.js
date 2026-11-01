// Joukkueen Yleiskuva (18.10.2026): sama näkymä kuin YDIN 2027:n joukkueet.html. Ensimmäinen välilehti
// Oma pelissä (KPL) ja jokaisella vastustajalla. Tilastodata YDINin julkisesta reposta (joukkueet_keskus.json,
// päivittyy iltaajossa), kokoonpano, pelinjohto ja siirrot Jarvisin siirtomarkkinoista.
import { esc } from "../util.js";
import { haeSiirtomarkkinat } from "../keskus.js";

const LAHDE = "https://raw.githubusercontent.com/Jugisoft/ydin-2027/main/data/out/joukkueet_keskus.json";
const MITALI = { Mestari: "🥇", Hopea: "🥈", Pronssi: "🥉" };
const NOUSIJAT = { Ura: "Kannuksen Ura", PuMu: "Puna-Mustat" };
const fi = (v) => (v == null ? "–" : String(v).replace(".", ","));
const tm = (x) => String(x || "").split(/[\s(]/)[0];
const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
let ydin = null;
let tila = "sisa";

async function haeYdin() {
  if (ydin) return ydin;
  try { const r = await fetch(LAHDE, { cache: "no-cache" }); ydin = r.ok ? await r.json() : null; } catch { ydin = null; }
  return ydin;
}

export async function piirraYleiskuva(el, T, pelaajat) {
  el.innerHTML = `<p class="pieni">Ladataan…</p>`;
  const [D, sm] = await Promise.all([haeYdin(), haeSiirtomarkkinat().catch(() => null)]);
  if (!D) { el.innerHTML = `<div class="paneeli tyhja-iso"><p>Joukkuetilastoja ei saatu ladattua YDIN 2027:stä. Yritä hetken päästä uudelleen.</p></div>`; return; }
  const t = D.taulukko.find((x) => x.lyh === T);
  const hist = Object.keys(D.jhist).map(Number).sort((a, b) => a - b).map((k) => ({ kausi: k, ...(D.jhist[k][T] || {}) })).filter((r) => r.sija != null || r.pudotus);
  const nyt = hist.find((r) => r.kausi === D.kausi) || {};
  const pj = sm?.pelinjohtajat?.find((p) => p.Joukkue === T);
  const kok = sm?.kokoonpanot?.[T];
  const siirrot = sm?.siirrot || [];
  const tulleet = siirrot.filter((s) => tm(s.Mihin) === T), lahteneet = siirrot.filter((s) => tm(s.Mistä) === T);
  const nimi = (t?.nimi || sm?.joukkueiden_nimet?.[T] || NOUSIJAT[T] || T).split(",")[0];
  const logo = D.logot?.[T];
  const lista = (s) => (s || "").split(";").map((x) => x.trim()).filter(Boolean);

  const kpi = nyt.sija
    ? [[`${nyt.sija}.`, "runkosarja 2026"], [nyt.pudotus || "–", "pudotuspelit 2026", !!MITALI[nyt.pudotus]], [nyt.P, "sarjapistettä"], [`${nyt.juoksut - nyt.paastetyt > 0 ? "+" : ""}${nyt.juoksut - nyt.paastetyt}`, "juoksuero"]]
    : [["Nousija", "Ykköspesiksestä"], [lista(kok?.sopimus).length || "–", "sopimuspelaajaa 2027"], [lista(kok?.optio).length || "–", "optiolla"], [tulleet.length, "uutta pelaajaa"]];
  const pjTeksti = !pj ? "" : pj.Muutos === "Jatkaa" ? `Pelinjohtaja ${esc(pj["PJ 2027"])} jatkaa.` : `Pelinjohtaja: ${esc(pj["PJ 2026"])} → ${esc(!pj["PJ 2027"] || pj["PJ 2027"] === "?" ? "avoin" : pj["PJ 2027"])}.`;

  el.innerHTML = `
    <section class="yk-band">
      <div class="yk-nimi">${logo ? `<img src="${esc(logo)}" alt="">` : `<span class="ph">${esc(T)}</span>`}
        <div><div class="yk-ylä">Superpesis 2027${nyt.sija ? "" : " · nousija"}</div><h2>${esc(nimi)}</h2><p>${pjTeksti}</p></div></div>
      <div class="yk-kpit">${kpi.map(([b, s, m]) => `<div class="yk-kpi"><b class="num${m ? " mitali" : ""}${String(b).length > 5 ? " teksti" : ""}">${esc(b)}</b><span>${esc(s)}</span></div>`).join("")}</div>
    </section>
    <div class="yk-sarakkeet">
      <div class="yk-sarake">
        <section class="yk-kortti"><div class="yk-otsa"><h3>Kehitys</h3><span class="pieni">Palkki = runkosarjan pisteet, viiva = sijoitus</span></div>${kehitys(hist.filter((r) => r.sija != null), D.kausi)}</section>
        <section class="yk-kortti"><div class="yk-otsa"><h3>Pelaajat 2026</h3><span class="pieni">Runkosarja, YHT-järjestys</span></div>${pelaajalista(D, T, pelaajat)}</section>
      </div>
      <div class="yk-sarake">
        <section class="yk-kortti"><div class="yk-otsa"><h3>Pesäväleittäin 2026</h3><span class="chipit pieni-chipit" role="group" aria-label="Sisä- vai ulkopeli"><button type="button" class="chip" data-yk="sisa" aria-pressed="${tila === "sisa"}">Sisäpeli</button><button type="button" class="chip" data-yk="ulko" aria-pressed="${tila === "ulko"}">Ulkopeli</button></span></div><div id="yk-kentta"></div></section>
        <section class="yk-kortti" id="yk-laittomat"><div class="yk-otsa"><h3>Laittomat lyönnit ${D.kausi}</h3><span class="chipit pieni-chipit" role="group" aria-label="Vaihe"><button type="button" class="chip" data-lv="r" aria-pressed="${laitonVaihe === "r"}">Runkosarja</button><button type="button" class="chip" data-lv="k" aria-pressed="${laitonVaihe === "k"}">Kaikki ottelut</button></span></div><div id="yk-laittomat-sisalto"><p class="pieni">Ladataan…</p></div></section>
        <section class="yk-kortti"><div class="yk-otsa"><h3>Joukkue vs. sarja 2026</h3><span class="pieni">Sijoitus 12 joukkueen joukossa</span></div>${sijoitukset(D.taulukko, t)}</section>
        <section class="yk-kortti"><div class="yk-otsa"><h3>Kokoonpano 2027</h3><span class="pieni">${kok ? `${lista(kok.sopimus).length} sopimuspelaajaa` : ""}</span></div>${kokoonpano(kok)}</section>
        <section class="yk-kortti"><div class="yk-otsa"><h3>Siirrot</h3></div>
          <div class="yk-io"><div><h4 class="sisaan">Tulleet (${tulleet.length})</h4><ul>${tulleet.map((s) => `<li>${esc(s.Pelaaja)}<small>← ${esc(s.Mistä)} · ${esc(String(s.Pvm).replace(/^koonti .*/, "koonti"))}</small></li>`).join("") || "<li><small>Ei vielä</small></li>"}</ul></div>
          <div><h4 class="ulos">Lähteneet (${lahteneet.length})</h4><ul>${lahteneet.map((s) => `<li>${esc(s.Pelaaja)}<small>→ ${esc(s.Mihin && s.Mihin !== "–" ? s.Mihin : s["Mihin (tieto)"] || "ei jatka")} · ${esc(String(s.Pvm).replace(/^koonti .*/, "koonti"))}</small></li>`).join("") || "<li><small>Ei vielä</small></li>"}</ul></div></div>
          <a class="yk-linkki" href="#/siirtomarkkinat">Siirtopörssi →</a></section>
      </div>
    </div>
    <p class="vihje">Lähteet: pesistulokset.fi YDIN 2027:n kautta (tilastot, kuvat, logot; päivittyy iltaisin) sekä Jarvisin siirtoseuranta (kokoonpano, pelinjohto, siirrot).</p>`;

  const kentta = () => {
    el.querySelectorAll("[data-yk]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.yk === tila));
    el.querySelector("#yk-kentta").innerHTML = pesavalit(D.taulukko, t, T);
  };
  el.querySelectorAll("[data-yk]").forEach((b) => (b.onclick = () => { tila = b.dataset.yk; kentta(); }));
  kentta();
  const laittomat = async () => {
    el.querySelectorAll("[data-lv]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lv === laitonVaihe));
    const kohde = el.querySelector("#yk-laittomat-sisalto"); if (!kohde) return;
    kohde.innerHTML = laitonKortti(await haeYhteenveto(D.kausi), T, D.taulukko);
  };
  el.querySelectorAll("[data-lv]").forEach((b) => (b.onclick = () => { laitonVaihe = b.dataset.lv; laittomat(); }));
  laittomat();
}

// Laittomat lyönnit joukkueittain ja pelaajittain (1.11.2026, Juuso Ilanderin toive). Data: YDIN 2027:n
// lyöntiyhteenveto (pesistulokset.fi:n ottelutapahtumat). Pöytäkirjoissa ei ole tietoa, mitkä laittomat
// olivat merkattuja, joten luvut sisältävät kaikki laittomat.
const LAITON = 2;   // YDIN TUL-järjestys: kunnari, juoksu, laiton, koppi, palo, haava, eteni, ei_edennyt, muu
let laitonVaihe = "r";
const yhteenvedot = new Map();
function haeYhteenveto(kausi) {
  if (!yhteenvedot.has(kausi)) yhteenvedot.set(kausi, fetch(LAHDE.replace("joukkueet_keskus.json", `lyonnit_${kausi}/yhteenveto.json`), { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return yhteenvedot.get(kausi);
}
function laitonKortti(Y, T, taulukko) {
  if (!Y) return `<p class="tyhja">Lyöntidataa ei saatu ladattua.</p>`;
  const sarja = new Set((taulukko || []).map((x) => x.lyh));
  const rivi = (p) => p[laitonVaihe]?.kaikki?.[0] || [];
  const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);
  const pelaajat = Object.values(Y.pelaajat).map((p) => { const r = rivi(p); return { nimi: p.n, j: p.j, n: sum(r), l: r[LAITON] || 0 }; }).filter((p) => p.n > 0);
  const joukkueet = [...new Set(pelaajat.map((p) => p.j))].filter((j) => !sarja.size || sarja.has(j)).map((j) => {
    const a = pelaajat.filter((p) => p.j === j); const n = sum(a.map((p) => p.n)), l = sum(a.map((p) => p.l)); return { j, n, l, pct: n ? (100 * l) / n : 0 }; })
    .sort((a, b) => a.pct - b.pct);
  const oma = joukkueet.find((x) => x.j === T);
  if (!oma) return `<p class="tyhja">Ei Superpesis-lyöntejä kaudelta ${Y.kausi}.</p>`;
  const sija = joukkueet.indexOf(oma) + 1, ka = sum(joukkueet.map((x) => x.l)) / sum(joukkueet.map((x) => x.n)) * 100;
  const maxP = Math.max(...joukkueet.map((x) => x.pct));
  const omat = pelaajat.filter((p) => p.j === T).sort((a, b) => b.l - a.l || b.n - a.n);
  const maxL = Math.max(1, ...omat.map((p) => p.l));
  const pc = (v) => `${fi(v.toFixed(1))} %`;
  return `<div class="yk-lt-kpit">
      <div><b class="num">${oma.l}</b><span>laitonta</span></div>
      <div><b class="num">${pc(oma.pct)}</b><span>lyönneistä (${oma.n})</span></div>
      <div><b class="num">${sija}.</b><span>/ ${joukkueet.length} sarjassa · ka ${pc(ka)}</span></div>
    </div>
    <div class="yk-lt-sarja" role="img" aria-label="Laittomien osuus joukkueittain">${joukkueet.map((x, i) => `<div class="yk-lt-j${x.j === T ? " oma" : ""}"><span class="k">${i + 1}. ${esc(x.j)}</span><span class="tr"><i style="width:${(100 * x.pct) / maxP}%"></i></span><span class="v num">${pc(x.pct)}</span></div>`).join("")}</div>
    <h4 class="yk-lab">Pelaajittain</h4>
    <div class="yk-lt-pelaajat">${omat.map((p) => `<div class="yk-lt-p${p.n < 20 ? " pieni-otos" : ""}"><span class="n">${esc(p.nimi)}<small>${p.n} lyöntiä</small></span><span class="tr"><i style="width:${(100 * p.l) / maxL}%"></i></span><span class="c num">${p.l}</span><span class="c num pct">${p.n ? pc((100 * p.l) / p.n) : "–"}</span></div>`).join("")}</div>
    <p class="vihje">${laitonVaihe === "r" ? "Runkosarja" : "Runkosarja ja pudotuspelit"}, kaikki lyönnit pesistulokset.fi:n ottelutapahtumista. Sarjajärjestys: vähiten laittomia ensin. Pöytäkirjoista ei näe, mitkä laittomat olivat merkattuja, joten luvuissa ovat kaikki laittomat. Himmeä = alle 20 lyöntiä.</p>`;
}

function kehitys(h, kausi) {
  if (!h.length) return `<p class="tyhja">Ei Superpesis-kausia 2023–2026. Kehitys alkaa näkyä kauden 2027 myötä.</p>`;
  const W = 640, H = 230, m = { l: 20, r: 20, t: 34, b: 26 }, n = h.length, bw = Math.min(70, ((W - m.l - m.r) / n) * 0.5);
  const X = (i) => m.l + ((i + 0.5) * (W - m.l - m.r)) / n, maxP = Math.max(...h.map((r) => r.P || 0), 1);
  const Yp = (v) => H - m.b - (v / maxP) * (H - m.t - m.b), Ys = (v) => m.t + ((v - 1) / 12) * (H - m.t - m.b);
  let g = `<line class="pohja" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
  h.forEach((r, i) => {
    g += `<rect class="yk-pa" x="${X(i) - bw / 2}" y="${Yp(r.P)}" width="${bw}" height="${H - m.b - Yp(r.P)}" rx="4"/><text class="arvo" x="${X(i)}" y="${H - m.b - 6}" text-anchor="middle">${r.P} p</text><text x="${X(i)}" y="${H - 6}" text-anchor="middle">${r.kausi}</text>`;
    if (MITALI[r.pudotus] || r.pudotus === "4.") g += `<text class="mitali" x="${X(i)}" y="14" text-anchor="middle">${esc(r.pudotus)}</text>`;
  });
  g += `<path class="viiva" d="M${h.map((r, i) => `${X(i).toFixed(1)} ${Ys(r.sija).toFixed(1)}`).join(" L")}"/>`;
  h.forEach((r, i) => { g += `<circle class="piste" cx="${X(i)}" cy="${Ys(r.sija)}" r="5"/><text class="sija" x="${X(i) + 9}" y="${Ys(r.sija) + 4}">${r.sija}.</text>`; });
  return `<svg class="yk-kaavio" viewBox="0 0 640 230" role="img" aria-label="Joukkueen kehitys kausittain">${g}</svg>
    <div class="taulu-wrap"><table class="yk-taulu"><thead><tr><th class="l">Kausi</th><th>Sija</th><th>P</th><th>V–H</th><th>Juoksut</th><th>Kot.%</th><th>Torj.%</th><th class="l">Pudotuspelit</th></tr></thead>
    <tbody>${[...h].reverse().map((r) => `<tr${r.kausi === kausi ? ' class="nyt"' : ""}><td class="l">${r.kausi}</td><td>${r.sija}.</td><td>${r.P}</td><td>${r.V}–${r.H}</td><td>${r.juoksut}–${r.paastetyt}</td><td>${fi(r.kotiutus)}</td><td>${fi(r.torjunta)}</td><td class="l"><span class="yk-pp${MITALI[r.pudotus] ? " kulta" : ""}">${esc(r.pudotus || "–")}</span></td></tr>`).join("")}</tbody></table></div>`;
}

function pelaajalista(D, T, pelaajat) {
  const P = D.pelaajat.filter((p) => p.jk === T).sort((a, b) => b.YHT - a.YHT);
  if (!P.length) return `<p class="tyhja">Ei Superpesis-pelaajia 2026: joukkue pelasi kauden Ykköspesiksessä.</p>`;
  const keskus = new Map([...(pelaajat?.values() || [])].map((p) => [norm(p.nimi), p]));
  return `<div class="yk-pelaajat">${P.map((p) => {
    const k = D.kuvat?.[String(p.id)], ini = esc(p.nimi.split(" ").map((x) => x[0]).slice(0, 2).join(""));
    const kp = keskus.get(norm(p.nimi)), tag = kp ? "a" : "div";
    return `<${tag} class="yk-p"${kp ? ` href="#/vp/${kp.id}" title="Avaa pelaajasivu (${esc(kp.joukkue)} 2027)"` : ""}>${k ? `<img src="${esc(k)}" alt="" loading="lazy">` : `<span class="av">${ini}</span>`}
      <span class="n">${esc(p.nimi)}<small>${p.O} ottelua${kp && kp.joukkue !== T ? ` · nyt ${esc(kp.joukkue)}` : ""}</small></span>
      <span class="c hs"><small>K+L</small>${p.K}+${p.L}</span><span class="c hs"><small>T</small>${p.T}</span><span class="c"><small>YHT</small>${p.YHT}</span><span class="c"><small>KL%</small>${fi(p["KL%"])}</span></${tag}>`;
  }).join("")}</div>`;
}

function sijoitukset(A, t) {
  if (!t) return `<p class="tyhja">Ei vertailua: joukkue ei pelannut Superpesistä 2026.</p>`;
  const M = [["Kotiutus-%", (x) => x.kotiutus, 1, fi], ["Torjunta-%", (x) => x.torjunta, 1, fi], ["KL%", (x) => x["KL%"], 1, fi],
    ["KL%0", (x) => x.KLpesat?.[0], 1, fi], ["KL%1", (x) => x.KLpesat?.[1], 1, fi], ["KL%2", (x) => x.KLpesat?.[2], 1, fi], ["KL%3", (x) => x.KLpesat?.[3], 1, fi],
    ["Juoksut / ott.", (x) => x.juoksut / x.O, 1, (v) => fi(v.toFixed(1))], ["Päästetyt / ott.", (x) => x.paastetyt / x.O, -1, (v) => fi(v.toFixed(1))]];
  const n = A.length;
  return `<div class="yk-rk">${M.map(([k, f, suunta, muoto]) => {
    const v = f(t); if (v == null) return "";
    const sij = 1 + A.filter((x) => f(x) != null && suunta * (f(x) - v) > 0).length, pos = ((n - sij) / (n - 1)) * 100;
    const vari = `color-mix(in srgb, #2EE59D ${pos}%, #FF3B4E)`;
    return `<div class="yk-rr" title="${k}: ${sij}. / ${n}"><span class="k">${k}</span><span class="tr"><i style="width:${pos}%;background:${vari}"></i><b style="left:${pos}%;background:${vari}">${sij}.</b></span><span class="v num">${muoto(v)}</span></div>`;
  }).join("")}</div><p class="vihje">KL%0 = kärkilyönti kotipesältä (kentälle pääsy), KL%1–3 = kärkietenijä 1., 2. tai 3. pesällä.</p>`;
}

function pesavalit(A, t, T) {
  if (!t?.pesat) return `<p class="tyhja">Ei kenttätilastoja: joukkue ei pelannut Superpesistä 2026.</p>`;
  const sisa = tila === "sisa", nimet = ["kentälle pääsy", "1-tilanne", "2-tilanne", "takatilanne"];
  const arvo = (x, i) => { const p = x.pesat[i]; return sisa ? (p[1] ? (100 * p[0]) / p[1] : null) : (p[3] ? (100 * (p[3] - p[2])) / p[3] : null); };
  const vals = [0, 1, 2, 3].map((i) => arvo(t, i)), paras = Math.max(...vals.filter((v) => v != null));
  const L = [0, 1, 2, 3].map((i) => {
    const v = vals[i], sarja = A.map((x) => arvo(x, i)).filter((x) => x != null), ka = sarja.reduce((a, b) => a + b, 0) / sarja.length;
    const sij = 1 + sarja.filter((x) => x > v).length, e = v - ka;
    return { k: (sisa ? "KL%" : "TORJ%") + i, t: nimet[i], v, hot: v === paras, sub: `${sij}. sarjassa · ${e > 0 ? "+" : ""}${fi(e.toFixed(1))} vs ka`, plus: e >= 0 };
  });
  const P = [{ x: 142, y: 584 }, { x: 228, y: 432 }, { x: 190, y: 352 }, { x: 12, y: 452 }];
  const f = (v) => (v == null ? "–" : `${fi(v.toFixed(1))} %`);
  return `<svg class="yk-kentta" viewBox="-56 268 426 440" role="img" aria-label="${esc(T)} ${sisa ? "sisäpeli" : "ulkopeli"} pesäväleittäin">
    <path class="kenttapinta" d="M25 236 L25 495 L152 655 L198 655 L358 405 L358 236 Z"/>
    <path class="raja" d="M25 236 L25 495 L152 655 M198 655 L358 405 L358 236"/><path class="raja" d="M136 655 L370 655"/>
    <path class="kp" d="M146 655 A44 44 0 0 0 234 655 Z"/><path class="kpk" d="M158 655 A32 32 0 0 0 222 655"/>
    <path class="linja" d="M25 352 L358 352 M100 507 L358 352 M25 400 L190 655"/><path class="paluu" d="M14 360 L12 498 L140 664 L172 676"/>
    <path class="pesa" d="M25 335 A17 17 0 0 1 25 369 Z"/><path class="pesa" d="M358 335 A17 17 0 0 0 358 369 Z"/>
    <circle class="pesa" cx="100" cy="507" r="11"/><circle class="lautanen" cx="190" cy="655" r="7"/>
    ${L.map((b, i) => { const p = P[i]; return `<g class="laatikko${b.hot ? " kuuma" : ""}"><rect x="${p.x - 64}" y="${p.y - 33}" width="128" height="66" rx="10"/>
      <text class="lbl" x="${p.x}" y="${p.y - 15}" text-anchor="middle"><tspan class="k">${b.k}</tspan> ${b.t}</text>
      <text class="pct" x="${p.x}" y="${p.y + 11}" text-anchor="middle">${f(b.v)}</text>
      <text class="cnt ${b.plus ? "plus" : "miinus"}" x="${p.x}" y="${p.y + 26}" text-anchor="middle">${b.sub}</text></g>`; }).join("")}
  </svg>
  <p class="vihje">${sisa
    ? `Sisäpeli: ${esc(T)}:n kärkilyöntiprosentti sen mukaan, miltä pesältä kärkietenijä lähtee (KL%0 kentälle pääsy, KL%1 1-tilanne, KL%2 2-tilanne, KL%3 takatilanne). Alla sija ja ero sarjan keskiarvoon. Kullattu = joukkueen vahvin.`
    : `Ulkopeli: kuinka suuren osan vastustajan kärkilyöntiyrityksistä ${esc(T)} torjui kussakin tilanteessa. Suurempi on parempi. Kullattu = joukkueen vahvin.`}</p>`;
}

function kokoonpano(k) {
  if (!k) return `<p class="tyhja">Kokoonpanotieto puuttuu.</p>`;
  const sop = (k.sopimus || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
    const uusi = s.startsWith("*"), t = s.replace(/^\*/, ""), m = t.match(/^(.*?)\s+((?:19|20)\d\d.*)$/);
    return { n: m ? m[1] : t, v: m ? m[2] : "", uusi };
  }).sort((a, b) => b.uusi - a.uusi || a.n.localeCompare(b.n, "fi"));
  const pillit = (s) => (s || "").split(";").map((x) => x.trim()).filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("");
  return `<div class="yk-lab">Sopimus 2027</div><div class="yk-roster">${sop.map((s) => `<span class="${s.uusi ? "uusi" : ""}">${esc(s.n)}<small>${esc(s.v)}</small></span>`).join("") || "–"}</div>
    ${k.optio ? `<div class="yk-lab">Optio</div><div class="yk-roster">${pillit(k.optio)}</div>` : ""}
    ${k.ilman ? `<div class="yk-lab">Ilman sopimusta</div><div class="yk-roster">${pillit(k.ilman)}</div>` : ""}
    ${k.pj ? `<div class="yk-lab">Pelinjohto</div><p class="yk-pj">${esc(k.pj.replace(/\*/g, ""))}</p>` : ""}`;
}
