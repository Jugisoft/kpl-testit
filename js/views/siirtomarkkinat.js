// Siirtomarkkinat 2027: Jarvisin kooste (Siirrot, Pelinjohtajat, Kokoonpanot). Etusivuna Siirtopörssi (17.10.2026),
// sama näkymä kuin YDIN 2027:n etusivulla: kasvokuvat ja logot luetaan YDINin julkisesta reposta.
import { $, $$, esc } from "../util.js";
import { haeSiirtomarkkinat, md, aikaSitten } from "../keskus.js";

let valilehti = "porssi";
let auki = null;            // Siirtopörssissä avattu joukkue
const LAHDE = "https://raw.githubusercontent.com/Jugisoft/ydin-2027/main/data/out";
const TEAMS27 = ["ViVe", "SoJy", "KPL", "Manse", "Tahko", "KiPa", "JoMa", "PattU", "KeKi", "IPV", "Ura", "PuMu"];
const NOUSIJAT = new Set(["Ura", "PuMu"]);
let ydin = null;            // { kuvat: nimi -> url, logot: lyh -> url } YDIN 2027:n julkisesta reposta
let joukkue = "KPL";
let siirtoSuodatin = "";

const pct = (x) => (x == null || x === "" ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(0)} %`);
const varmuusLuokka = (v) => (/huhu/i.test(v) ? "huhu" : /yksi lähde/i.test(v) ? "yksi" : /koonti/i.test(v) ? "koonti" : "vahva");
const lahde = (l) => (l?.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.teksti || "lähde")}</a>` : esc(l?.teksti || ""));

export async function nayta(main) {
  const d = await haeSiirtomarkkinat(true);
  if (!d) {
    main.innerHTML = `<h1>Siirtomarkkinat</h1><div class="paneeli tyhja-iso"><p>Siirtomarkkinatietoja ei ole vielä viety portaaliin. Jarvis vie ne iltaisin, kun uusia siirtoja löytyy.</p></div>`;
    return;
  }
  main.innerHTML = `
    <div class="sivu-paa">
      <div>
        <h1>Siirtomarkkinat 2027</h1>
        <p class="ingressi">Miesten Superpesiksen sopimukset, siirrot ja pelinjohtajat. Lähteinä seurojen tiedotteet ja Supervuoron koonti, vaikutusluvut runkosarjasta 2026.</p>
      </div>
      <p class="pieni paivitys">Päivitetty ${esc(d.tilannekatsaus_paivitetty || aikaSitten(d.paivitetty))}</p>
    </div>
    <div class="valilehdet" role="tablist">
      ${[["porssi", "Siirtopörssi"], ["tilanne", "Tilanne"], ["siirrot", `Siirrot <span class="lkm">${d.siirrot.length}</span>`], ["joukkueet", "Kokoonpanot"], ["pj", "Pelinjohtajat"]]
        .map(([k, v]) => `<button role="tab" class="valilehti" data-v="${k}" aria-selected="${valilehti === k}">${v}</button>`).join("")}
    </div>
    <div id="sm"></div>`;
  if (valilehti === "vaikutus") valilehti = "porssi";
  $$(".valilehti", main).forEach((b) => (b.onclick = () => vaihda(b.dataset.v)));
  vaihda = (v) => { valilehti = v; $$(".valilehti", main).forEach((x) => x.setAttribute("aria-selected", x.dataset.v === v)); piirra(d); };
  ydin = ydin || await haeYdin();
  piirra(d);
}

let vaihda = () => {};

async function haeYdin() {
  const hae = async (f) => { try { const r = await fetch(`${LAHDE}/${f}`); return r.ok ? await r.json() : null; } catch { return null; } };
  const [k, p] = await Promise.all([hae("kuvat.json"), hae("pelaajat_2026_runko.json")]);
  const kuvat = {};
  for (const x of p || []) if (k?.pelaajat?.[x.id] && !kuvat[x.nimi]) kuvat[x.nimi] = k.pelaajat[x.id];
  return { kuvat, logot: k?.logot || {} };
}

// ---------- Siirtopörssi (sama näkymä kuin YDIN 2027:n etusivulla) ----------
const tm = (x) => String(x || "").split(/[\s(]/)[0];
const yht = (s) => (s.Data === "SP 2026" ? s.YHT || 0 : 0);
const yksi = (s) => /yksi/i.test(s.Varmuus);
const pvm = (s) => (/koonti/.test(s.Pvm) ? "koonti" : String(s.Pvm).replace(/\.20\d\d$/, ""));
const minne = (s) => (s.Mihin && s.Mihin !== "–" ? s.Mihin : /lopet/i.test(s["Mihin (tieto)"] || "") ? "lopettaa" : "ei jatka");
const ini = (n) => esc(n.split(" ").map((x) => x[0]).slice(0, 2).join(""));
const kasvo = (n) => { const u = ydin?.kuvat[n]; return u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${ini(n)}'))">` : ini(n); };
const logo = (t) => (ydin?.logot[t] ? `<img src="${esc(ydin.logot[t])}" alt="">` : `<span class="sp-ph">${esc(t.slice(0, 3))}</span>`);
const statRivi = (s) => (s.Data === "SP 2026" ? `2026: ${s.YHT} YHT (${s.K}+${s.L}+${s.T}), KL ${s.KL}/${s.KLY}` : s.Data === "YP 2026" ? `Ykköspesis 2026: ${s.YHT} YHT` : "Ei otteluita 2026");

function porssiData(d) {
  return TEAMS27.map((t) => {
    const ins = d.siirrot.filter((s) => tm(s.Mihin) === t), outs = d.siirrot.filter((s) => tm(s.Mistä) === t);
    const yi = ins.reduce((a, s) => a + yht(s), 0), yo = outs.reduce((a, s) => a + yht(s), 0);
    const v = d.vaikutus.find((x) => x.Joukkue === t), jy = NOUSIJAT.has(t) ? null : v?.["Joukkueen YHT 2026"];
    return { t, ins, outs, yi, yo, net: yi - yo, pct: jy ? (100 * (yi - yo)) / jy : null, pj: d.pelinjohtajat.find((p) => p.Joukkue === t) };
  }).sort((a, b) => b.net - a.net || (b.ins.length - b.outs.length) - (a.ins.length - a.outs.length));
}
const kasvot = (rivit, max = 5) => {
  const r = [...rivit].sort((a, b) => yht(b) - yht(a));
  return `<span class="sp-faces">${r.slice(0, max).map((s) => `<span class="${yksi(s) ? "yksi" : ""}" title="${esc(s.Pelaaja)}: ${esc(statRivi(s))}">${kasvo(s.Pelaaja)}</span>`).join("")}${r.length > max ? `<span class="sp-more">+${r.length - max}</span>` : ""}</span>`;
};

function porssi(d, el) {
  const P = porssiData(d), mx = Math.max(...P.flatMap((p) => [p.yi, p.yo]), 1);
  const ylin = P[0], alin = P[P.length - 1], vilkkain = [...P].sort((a, b) => b.ins.length + b.outs.length - (a.ins.length + a.outs.length))[0];
  const tuoreet = d.siirrot.filter((s) => !/koonti/.test(s.Pvm)).slice(0, 10);
  let rivit = "", raja = false;
  for (const p of P) {
    if (!raja && p.net < 0) { raja = true; rivit += `<div class="sp-zero">paperilla heikompi kuin 2026</div>`; }
    const pjNimi = p.pj ? String(p.pj["PJ 2027"] || "").split(" ").slice(-1)[0] : "";
    const pjTxt = !p.pj ? "" : !p.pj["PJ 2027"] || p.pj["PJ 2027"] === "?" ? "PJ auki" : p.pj.Muutos === "Jatkaa" ? `PJ ${esc(pjNimi)}` : `Uusi PJ ${esc(pjNimi)}`;
    const cls = p.net > 0 ? "up" : p.net < 0 ? "dn" : "eq";
    rivit += `<button type="button" class="sp-row${p.t === "KPL" ? " oma" : ""}" data-t="${p.t}" aria-expanded="${auki === p.t}">
      <span class="sp-tn">${logo(p.t)}<span><b>${esc(p.t)}</b><small>${NOUSIJAT.has(p.t) ? "nousija · " : ""}${pjTxt}</small></span></span>
      <span class="sp-sd o">${p.yo ? `<span class="sp-bar" style="width:${(70 * p.yo) / mx}%"></span><span class="num">−${p.yo}</span>` : ""}${kasvot(p.outs)}</span>
      <span class="sp-sd i">${p.yi ? `<span class="sp-bar" style="width:${(70 * p.yi) / mx}%"></span><span class="num">+${p.yi}</span>` : ""}${kasvot(p.ins)}</span>
      <span class="sp-nt ${cls}"><b class="num">${p.net > 0 ? "+" : ""}${p.net}</b><small>${p.pct != null ? `${p.pct > 0 ? "+" : ""}${p.pct.toFixed(0)} % YHT` : "ei vertailua"}</small></span>
    </button>`;
    if (auki === p.t) rivit += detalji(p);
  }
  el.innerHTML = `
    <section class="sp">
      <div class="sp-head">
        <div><h2>Siirtopörssi</h2>
          <p>Palkit näyttävät, kuinka paljon tulleet ja lähteneet pelaajat tekivät tulosta runkosarjassa 2026 (YHT = K+L+T). Klikkaa joukkuetta nähdäksesi pelaajat.</p></div>
        <div class="sp-facts">${[["up", "Vahvistunut eniten", ylin, `${ylin.net > 0 ? "+" : ""}${ylin.net}`, `${ylin.ins.length} tullutta, ${ylin.outs.length} lähtenyttä`],
          ["dn", "Menettänyt eniten", alin, `${alin.net}`, `${alin.outs.length} lähtenyttä, ${alin.ins.length} tullutta`],
          ["", "Vilkkain joukkue", vilkkain, `${vilkkain.ins.length + vilkkain.outs.length}`, "muutosta pelaajistoon"]]
          .map(([c, k, p, v, s]) => `<button type="button" class="sp-fact ${c}" data-t="${p.t}"><span class="k">${k}</span><span class="v">${logo(p.t)}<span>${esc(p.t)}</span><b class="num">${v}</b></span><span class="s">${s}</span></button>`).join("")}</div>
      </div>
      <div class="sp-axis" aria-hidden="true"><span>Lähteneet</span><span>Tulleet</span><span>Netto</span></div>
      <div class="sp-board" role="list">${rivit}</div>
      <p class="sp-note">Ykköspesiksestä tulleilla ei ole Superpesis-tehoja 2026, joten ne näkyvät vain kasvokuvina. Katkoviiva = yksi lähde. Huhut eivät ole mukana.</p>
    </section>
    <section class="sp-lt">
      <h3>Tuoreimmat siirrot</h3>
      <div class="sp-strip">${tuoreet.map((s, i) => { const ok = TEAMS27.includes(tm(s.Mihin)); const u = s.Lähde?.url;
        return `<a class="sp-lc${i === 0 ? " eka" : ""}" ${u ? `href="${esc(u)}" target="_blank" rel="noopener"` : ""}>
          <span class="av">${kasvo(s.Pelaaja)}</span><span class="d">${pvm(s)} · ${yksi(s) ? "yksi lähde" : "vahvistettu"}</span>
          <b>${esc(s.Pelaaja)}</b><span class="mv">${esc(tm(s.Mistä) || s.Mistä)}<i>→</i><span class="${ok ? "to" : "gone"}">${esc(ok ? tm(s.Mihin) : minne(s))}</span></span>
          <span class="st">${esc(statRivi(s))}</span></a>`; }).join("")}</div>
    </section>`;
  requestAnimationFrame(() => el.querySelector(".sp")?.classList.add("valmis"));
  $$(".sp-row, .sp-fact", el).forEach((b) => (b.onclick = () => {
    const t = b.dataset.t, fakta = b.classList.contains("sp-fact");
    auki = auki === t && !fakta ? null : t; porssi(d, el);
    const r = el.querySelector(`.sp-row[data-t="${t}"]`);
    if (r) fakta ? r.scrollIntoView({ block: "center", behavior: "smooth" }) : r.focus({ preventScroll: true });
  }));
  $$("[data-kok]", el).forEach((b) => (b.onclick = () => { joukkue = b.dataset.kok; vaihda("joukkueet"); }));
}

function detalji(p) {
  const rivi = (s) => { const tulo = tm(s.Mihin) === p.t;
    const suunta = tulo ? `${esc(tm(s.Mistä) || s.Mistä)} → ${esc(p.t)}` : `→ ${esc(minne(s))}`;
    return `<div class="pl"><span class="av">${kasvo(s.Pelaaja)}</span><span><b>${esc(s.Pelaaja)}</b><small>${suunta} · ${pvm(s)}${yksi(s) ? " · yksi lähde" : ""}</small></span><span class="y num">${s.Data === "SP 2026" ? s.YHT : "–"}<small>${s.Data === "SP 2026" ? "YHT 2026" : s.Data === "YP 2026" ? "Ykköspesis" : "ei dataa"}</small></span></div>`; };
  const jarj = (r) => [...r].sort((a, b) => yht(b) - yht(a));
  const pj = !p.pj ? "" : p.pj.Muutos === "Jatkaa" ? `Pelinjohtaja <b>${esc(p.pj["PJ 2027"])}</b> jatkaa.` : !p.pj["PJ 2027"] || p.pj["PJ 2027"] === "?" ? `Pelinjohtaja ${esc(p.pj["PJ 2026"])} lähtee, <b>seuraaja auki</b>.` : `Pelinjohtaja vaihtuu: ${esc(p.pj["PJ 2026"])} → <b>${esc(p.pj["PJ 2027"])}</b>.`;
  return `<div class="sp-det" role="region" aria-label="${esc(p.t)}: siirrot">
    <div><h4>Tulleet (${p.ins.length})</h4>${jarj(p.ins).map(rivi).join("") || `<p class="sp-note">Ei vielä uusia pelaajia.</p>`}</div>
    <div><h4>Lähteneet (${p.outs.length})</h4>${jarj(p.outs).map(rivi).join("") || `<p class="sp-note">Ei lähtijöitä.</p>`}</div>
    ${pj ? `<div class="pj">${pj}</div>` : ""}
    <div class="go"><button type="button" class="linkki" data-kok="${p.t}">Kokoonpano 2027 →</button>${p.t !== "KPL" ? `<a href="#/muistio/${p.t}">Vastustajasivu →</a>` : ""}</div></div>`;
}

function piirra(d) {
  const el = $("#sm");
  if (valilehti === "porssi") porssi(d, el);
  else if (valilehti === "tilanne") {
    el.innerHTML = `<div class="kaksi-saraketta">
      <section><h2>Tärkeimmät muutokset</h2><div class="md uutislista">${md(d.tarkeimmat)}</div></section>
      <section><h2>Seurattavat asiat</h2><div class="md uutislista hiljainen">${md(d.seurattavat)}</div></section></div>`;
  } else if (valilehti === "siirrot") {
    const joukkueet = [...new Set(d.siirrot.flatMap((s) => [s.Mistä, s.Mihin]).filter((x) => x && x !== "–"))].sort();
    el.innerHTML = `
      <div class="rivi suodattimet"><select id="sj"><option value="">Kaikki joukkueet</option>${joukkueet.map((j) => `<option>${esc(j)}</option>`).join("")}</select></div>
      <div class="taulu-wrap"><table>
        <thead><tr><th>Pvm</th><th>Pelaaja</th><th>Mistä</th><th>Mihin</th><th class="n">YHT 2026</th><th class="n">KL</th><th>Varmuus</th><th>Lähde</th></tr></thead>
        <tbody id="st"></tbody></table></div>
      <p class="vihje">"Koonti" tarkoittaa, että tieto on Supervuoron sopimuskoonnista, joka linkittää seurojen julkaisuihin; tarkkaa julkaisupäivää ei aina tiedetä.</p>`;
    $("#sj").value = siirtoSuodatin;
    const p = () => {
      $("#st").innerHTML = d.siirrot.filter((s) => !siirtoSuodatin || s.Mistä === siirtoSuodatin || s.Mihin === siirtoSuodatin).map((s) => `
        <tr${s.Mistä === "KPL" || s.Mihin === "KPL" ? ' class="oma"' : ""}><td class="pieni">${esc(String(s.Pvm).replace("koonti ", ""))}</td><td>${esc(s.Pelaaja)}</td><td>${esc(s.Mistä)}</td><td>${esc(s["Mihin (tieto)"] || s.Mihin)}</td>
        <td class="n">${s.Data === "ei dataa" ? "–" : `${s.YHT}<span class="pieni"> ${esc((s.Data || "").slice(0, 2))}</span>`}</td><td class="n">${s.Data === "ei dataa" ? "–" : s.KL}</td>
        <td><span class="varmuus ${varmuusLuokka(s.Varmuus)}">${esc(String(s.Varmuus).split(" – ")[0])}</span></td><td class="pieni">${lahde(s.Lähde)}</td></tr>`).join("");
    };
    $("#sj").onchange = (e) => { siirtoSuodatin = e.target.value; p(); };
    p();
  } else if (valilehti === "joukkueet") {
    const lista = Object.keys(d.kokoonpanot).sort((a, b) => (a === "KPL" ? -1 : b === "KPL" ? 1 : a.localeCompare(b)));
    el.innerHTML = `<div class="chipit" role="group" aria-label="Joukkue">${lista.map((j) => `<button class="chip" data-j="${j}" aria-pressed="${j === joukkue}">${esc(j)}</button>`).join("")}</div><div id="kok"></div>`;
    const p = () => {
      const k = d.kokoonpanot[joukkue] || {};
      const sopimukset = (k.sopimus || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
        const uusi = s.startsWith("*"), t = s.replace(/^\*/, ""), m = t.match(/^(.*?)\s+((?:19|20)\d\d.*)$/);
        return { nimi: m ? m[1] : t, sop: m ? m[2] : "", uusi };
      });
      const lahtijat = (k.lahtijat || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => s.split(" > "));
      const v = d.vaikutus.find((x) => x.Joukkue === joukkue);
      el.querySelector("#kok").innerHTML = `
        <h2>${esc(d.joukkueiden_nimet?.[joukkue] || joukkue)}</h2>
        ${k.pj ? `<p class="ingressi" style="margin-top:0">${esc(k.pj.replace(/\*/g, ""))}</p>` : ""}
        ${v ? `<p class="pieni">Sisään ${v.Tulleet}, ulos ${v.Lähteneet}. Siirtojen netto ${pct(v["Netto yhteensä %"])} (${esc(v.Arvio)}).</p>` : ""}
        <div class="kaksi-saraketta">
          <section><h3>Sopimus kaudelle 2027 (${sopimukset.length})</h3>
            <ul class="kokoonpano">${sopimukset.map((s) => `<li${s.uusi ? ' class="uusi"' : ""}><span>${esc(s.nimi)}</span><span class="pieni">${esc(s.sop)}</span>${s.uusi ? `<span class="merkki">Uusi</span>` : ""}</li>`).join("")}</ul>
            ${k.optio ? `<p class="pieni"><strong>Optio, käyttöä ei ilmoitettu:</strong> ${esc(k.optio)}</p>` : ""}
            ${k.ilman ? `<p class="pieni"><strong>Ilman sopimusta:</strong> ${esc(k.ilman)}</p>` : ""}
          </section>
          <section><h3>Lähteneet (${lahtijat.length})</h3>
            <ul class="kokoonpano">${lahtijat.map(([n, m]) => `<li><span>${esc(n)}</span><span class="pieni">${esc(m || "")}</span></li>`).join("") || `<li class="pieni">Ei lähtijöitä.</li>`}</ul>
          </section>
        </div>`;
    };
    $$(".chip[data-j]", el).forEach((b) => (b.onclick = () => { joukkue = b.dataset.j; $$(".chip[data-j]", el).forEach((x) => x.setAttribute("aria-pressed", x === b)); p(); }));
    p();
  } else {
    el.innerHTML = `<div class="taulu-wrap"><table>
      <thead><tr><th>Joukkue</th><th>PJ 2026</th><th>PJ 2027</th><th>Muutos</th><th>Huomio</th><th>Lähde</th></tr></thead>
      <tbody>${d.pelinjohtajat.map((p) => `<tr${p.Joukkue === "KPL" ? ' class="oma"' : ""}><td>${esc(p.Joukkue)}</td><td>${esc(p["PJ 2026"])}</td><td><strong>${esc(p["PJ 2027"])}</strong></td><td>${esc(p.Muutos)}</td><td class="pieni md-inline">${md(p.Huomio || "")}</td><td class="pieni">${lahde(p.Lähde)}</td></tr>`).join("")}</tbody></table></div>`;
  }
}
