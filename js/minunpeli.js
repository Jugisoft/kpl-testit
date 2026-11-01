// Minun pelini (1.11.2026): pelaajan jokainen Superpesis-lyönti tilanteittain verrattuna omaan joukkueeseen ja sarjaan.
// Data: YDIN 2027 lyonnit_<kausi>/yhteenveto.json (pelaaja → vaihe r/k → kansio → [lyönti 0–3] → määrät tuloksittain),
// pelaaja tunnistetaan pesistulokset-tunnuksesta. Virallinen tilasto laskee lyöntivuoroja, tämä jokaisen lyönnin.
import { esc } from "./util.js";
import { piirraOttelulyonnit } from "./lyontikartta.js";

const LAHDE = "https://raw.githubusercontent.com/Jugisoft/ydin-2027/main/data/out";
const KAUDET = [2027, 2026];
const MIN_N = 30;          // vähintään näin monta lyöntiä tilanteessa, jotta mukana sarjan järjestyksessä
const KANSIOT = [["kaikki", "Kaikki tilanteet"], ["0", "0-tilanne"], ["1", "1-tilanne"], ["2", "2-tilanne"], ["T", "Takatilanne"]];
const ROOLI = { 0: "kentälle pääsy", 1: "ykköstilanteen purkaja", 2: "kakkostilanteen vaihtaja", T: "takatilanteen kotiuttaja", kaikki: "lyöjä" };
// Tulosryhmät (YDIN TUL-järjestys: kunnari, juoksu, laiton, koppi, palo, haava, eteni, ei_edennyt, muu)
const RYHMAT = [
  ["onnistui", "Onnistui", [0, 1, 6], "#2EE59D"],
  ["ei", "Ei etenemistä", [7, 8], "#5E5850"],
  ["laiton", "Laiton", [2], "#8C877D"],
  ["koppi", "Koppi", [3, 5], "#7DD3FC"],   // koppi + haava (1.11.2026)
  ["palo", "Palo", [4], "#FF3B4E"],
];

const tiedostot = new Map();
async function hae(kausi) {
  if (!tiedostot.has(kausi)) tiedostot.set(kausi, fetch(`${LAHDE}/lyonnit_${kausi}/yhteenveto.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return tiedostot.get(kausi);
}
const summa = (a) => a.reduce((s, x) => s + x, 0);
const ryhma = (rivi, idx) => summa(idx.map((i) => rivi[i] || 0));
const tyhja = () => Array(9).fill(0);
const lisaa = (a, b) => a.map((x, i) => x + (b[i] || 0));
const pros = (x, n) => (n ? (100 * x) / n : null);
const pr = (x) => (x == null ? "–" : `${Math.round(x)} %`);
const onn = (rivi) => ryhma(rivi, RYHMAT[0][2]);

const S = { kausi: null, vaihe: "r", kansio: null, suLy: "", suPal: "" };
const PIENI = 20;   // alle tämän lyöntimäärän luku himmennetään (pieni otos)
let edellinen = null;   // pelaaja, jolle tilanne valittiin
// Suunta (1.11.2026): kenttä 3 × 3 -ruudukoksi. x < 0 = 3-rajan puoli, x > 0 = 2-rajan puoli (kotipesän takaa katsottuna), y = syvyys kotirajasta.
const KANSIO_T = { 0: "0", 1: "1", 2: "2", 4: "2", 3: "T", 5: "T", 6: "T", 7: "T" };
const SARAKKEET = ["3-rajan puoli", "keskelle", "2-rajan puoli"], RIVIT = ["pitkä (yli 50 m)", "keskipitkä (20–50 m)", "lyhyt (alle 20 m)"];
const SUUNTA_S = ["3-rajan puolelle", "keskelle", "2-rajan puolelle"], SUUNTA_R = ["pitkälle", "keskipitkälle", "lyhyeksi"];
const sarake = (x) => (x < -7 ? 0 : x > 7 ? 2 : 1), rivi3 = (y) => (y > 50 ? 0 : y >= 20 ? 1 : 2);
const ONN = new Set([0, 1, 6]);
const lyonnit = new Map();
async function haeLyonnit(kausi, id) {
  const k = `${kausi}:${id}`;
  if (!lyonnit.has(k)) lyonnit.set(k, fetch(`${LAHDE}/lyonnit_${kausi}/p${id}.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return lyonnit.get(k);
}

export async function piirraMinunPeli(el, pelaaja) {
  if (!pelaaja?.pesistulokset_id) { el.innerHTML = ""; return; }
  const kaudet = [];
  for (const k of KAUDET) { const d = await hae(k); if (d?.pelaajat?.[pelaaja.pesistulokset_id]) kaudet.push([k, d]); }
  if (!kaudet.length) { el.innerHTML = ""; return; }
  if (!kaudet.some(([k]) => k === S.kausi)) S.kausi = kaudet[0][0];
  // avautuu pelaajan päätilanteeseen (eniten lyöntejä)
  if (edellinen !== pelaaja.pesistulokset_id || !S.kansio) {
    const o = kaudet[0][1].pelaajat[pelaaja.pesistulokset_id][S.vaihe] || {};
    S.kansio = ["0", "1", "2", "T"].map((k) => [k, summa(o[k]?.[0] || [])]).sort((a, b) => b[1] - a[1])[0][0];
    edellinen = pelaaja.pesistulokset_id;
  }
  const piirra = () => {
    const d = kaudet.find(([k]) => k === S.kausi)[1];
    const oma = d.pelaajat[pelaaja.pesistulokset_id];
    const rivi = (p, k = S.kansio, ly = 0) => p[S.vaihe]?.[k]?.[ly] || tyhja();
    const kaikki = Object.entries(d.pelaajat);
    const joukkue = kaikki.filter(([, p]) => p.j === oma.j);
    const yht = (lista, k, ly) => lista.reduce((a, [, p]) => lisaa(a, rivi(p, k, ly)), tyhja());
    const prow = (p, pa) => p[S.vaihe + "p"]?.[S.kansio]?.[pa] || tyhja();
    const kaikkiP = (lista, pa) => lista.reduce((a, [, p]) => lisaa(a, prow(p, pa)), tyhja());
    const m = rivi(oma), n = summa(m);
    const mJ = yht(joukkue), mS = yht(kaikki);
    // sarjan järjestys tässä tilanteessa (vähintään MIN_N lyöntiä)
    const lista = kaikki.map(([id, p]) => { const r = rivi(p); const nn = summa(r); return { id, nimi: p.n, j: p.j, n: nn, pct: pros(onn(r), nn) }; })
      .filter((x) => x.n >= MIN_N).sort((a, b) => b.pct - a.pct || b.n - a.n);
    const sija = lista.findIndex((x) => x.id === String(pelaaja.pesistulokset_id)) + 1;
    // rooli: osuus omista lyönneistä tilanteittain
    const nKaikki = summa(rivi(oma, "kaikki"));
    const osuudet = KANSIOT.slice(1).map(([k, nimi]) => ({ k, nimi, n: summa(rivi(oma, k)) })).map((x) => ({ ...x, pct: pros(x.n, nKaikki) }));
    const paarooli = [...osuudet].sort((a, b) => b.n - a.n)[0];
    const kansioNimi = KANSIOT.find(([k]) => k === S.kansio)[1];

    el.innerHTML = `
      <div class="oma-osa-paa"><div><h2 id="mp-otsikko">Minun pelini</h2>
        <p class="pieni">Jokainen lyönti, ei vain lyöntivuoro · Superpesis ${S.kausi}${S.vaihe === "r" ? " runkosarja" : ", kaikki ottelut"} · ${esc(oma.j)} · lähde pesistulokset.fi</p></div>
        <div class="chipit pieni-chipit">${kaudet.length > 1 ? kaudet.map(([k]) => `<button type="button" class="chip" data-mp-kausi="${k}" aria-pressed="${k === S.kausi}">${k}</button>`).join("") + '<span class="erotin"></span>' : ""}
          <button type="button" class="chip" data-mp-vaihe="r" aria-pressed="${S.vaihe === "r"}">Runkosarja</button><button type="button" class="chip" data-mp-vaihe="k" aria-pressed="${S.vaihe === "k"}">Kaikki ottelut</button></div>
      </div>
      <div class="mp-tilanteet" role="tablist" aria-label="Tilanne">${KANSIOT.map(([k, nimi]) => { const x = summa(rivi(oma, k)); return `<button role="tab" class="mp-tilanne${x < PIENI ? " pieni-otos" : ""}" data-mp-kansio="${k}" aria-selected="${k === S.kansio}" title="${x < PIENI ? "Pieni otos" : ""}"><span>${nimi}</span><b class="num">${pr(pros(onn(rivi(oma, k)), x))}</b><small>${x} lyöntiä</small></button>`; }).join("")}</div>

      <div class="mp-runko">
        <div class="paneeli mp-paa">
          <p class="mp-kysymys">Miten olen onnistunut ${S.kansio === "kaikki" ? "kaikissa tilanteissa" : `${kansioNimi.toLowerCase().replace("takatilanne", "takatilanteessa").replace(/-tilanne$/, "-tilanteessa")}`}?</p>
          ${n ? `${n < PIENI ? `<p class="mp-varoitus">Pieni otos: vain ${n} lyöntiä tässä tilanteessa.</p>` : ""}
          <div class="mp-iso"><span class="num">${pr(pros(onn(m), n))}</span><span>lyönneistä onnistui<br><small>${onn(m)} / ${n} lyöntiä · onnistui = kärkietenijä eteni, juoksu tai kunnari</small></span></div>
          <div class="mp-vertailu">
            ${vertailuRivi("Minä", pros(onn(m), n), true)}
            ${vertailuRivi(`${esc(oma.j)} yhteensä`, pros(onn(mJ), summa(mJ)))}
            ${vertailuRivi("Sarja yhteensä", pros(onn(mS), summa(mS)))}
          </div>
          <p class="mp-sija">${sija ? `<b>${sija}.</b> / ${lista.length} sarjan ${S.kansio === "kaikki" ? "lyöjistä" : ROOLI[S.kansio] === "kentälle pääsy" ? "pelaajista 0-tilanteessa" : ROOLI[S.kansio].replace(/ja$/, "jista")} <span class="pieni">(vähintään ${MIN_N} lyöntiä)</span>` : `<span class="pieni">Sarjan järjestykseen tarvitaan vähintään ${MIN_N} lyöntiä tässä tilanteessa.</span>`}</p>
          ` : `<p class="tyhja">Ei lyöntejä tässä tilanteessa.</p>`}
        </div>
        <div class="paneeli">
          <h3>Mihin lyönnit päättyivät</h3>
          ${jakauma("Minä", m)}${jakauma(esc(oma.j), mJ)}${jakauma("Sarja", mS)}
          <div class="mp-selite">${RYHMAT.map(([, nimi, , vari]) => `<span><i style="background:${vari}"></i>${nimi}</span>`).join("")}</div>
          <h3>Monesko lyönti</h3>
          ${taulu(["1. lyönti", "2. lyönti", "3. lyönti"], [
            ["Minä", [1, 2, 3].map((ly) => { const r = rivi(oma, S.kansio, ly), nn = summa(r); return [pros(onn(r), nn), nn]; }), true],
            ["Sarja", [1, 2, 3].map((ly) => { const r = yht(kaikki, S.kansio, ly), nn = summa(r); return [pros(onn(r), nn)]; })]])}
          <p class="pieni" style="margin:6px 0 0">Prosentti = onnistuneet lyönnit kyseisellä lyönnillä, pieni luku = lyöntien määrä.</p>
        </div>
      </div>

      <div class="mp-runko">
        <div class="paneeli">
          <h3>Roolini lyöjänä</h3>
          <p class="pieni" style="margin-top:0">${paarooli?.n ? `Lyöt eniten ${paarooli.nimi === "Takatilanne" ? "takatilanteessa" : paarooli.nimi.replace("-tilanne", "-tilanteessa")} (${pr(paarooli.pct)} lyönneistäsi).` : ""}</p>
          <div class="mp-roolit">${osuudet.map((x) => `<div><span>${x.nimi}</span><div class="mp-palkki"><i style="width:${Math.max(1, x.pct || 0)}%"></i></div><b class="num">${pr(x.pct)}</b></div>`).join("")}</div>
        </div>
        <div class="paneeli">
          <h3>${S.kansio === "kaikki" ? "Sarjan parhaat lyöjät" : `Sarjan parhaat: ${kansioNimi}`}</h3>
          <ol class="mp-top">${top(lista, sija, pelaaja.pesistulokset_id)}</ol>
          <p class="pieni" style="margin:6px 0 0">Onnistuneiden lyöntien osuus, vähintään ${MIN_N} lyöntiä. Kärki 8 ja oma sijoitus.</p>
        </div>
      </div>

      <div class="mp-runko">
        <div class="paneeli">
          <h3>Paineen alla</h3>
          <p class="pieni" style="margin-top:0">${kansioNimi} · onnistuneet lyönnit palojen mukaan (palot ennen lyöntiä)</p>
          ${taulu(["0 paloa", "1 palo", "2 paloa"], [
            ["Minä", [0, 1, 2].map((pa) => { const r = prow(oma, pa), nn = summa(r); return [pros(onn(r), nn), nn]; }), true],
            [esc(oma.j), [0, 1, 2].map((pa) => { const r = kaikkiP(joukkue, pa), nn = summa(r); return [pros(onn(r), nn)]; })],
            ["Sarja", [0, 1, 2].map((pa) => { const r = kaikkiP(kaikki, pa), nn = summa(r); return [pros(onn(r), nn)]; })]])}
          ${paineLause(prow(oma, 2), kaikkiP(kaikki, 2))}
        </div>
        <div class="paneeli">
          <div class="rivi vali"><h3 style="margin:0">Lyöntieni suunta</h3></div>
          <div class="chipit pieni-chipit mp-su-suod">
            ${[["", "Kaikki lyönnit"], ["1", "1."], ["2", "2."], ["3", "3. (viimeinen)"]].map(([k, n]) => `<button type="button" class="chip" data-su-ly="${k}" aria-pressed="${S.suLy === k}">${n}</button>`).join("")}
            <span class="erotin"></span>
            ${[["", "Kaikki palot"], ["0", "0 paloa"], ["12", "1–2 paloa"], ["2", "2 paloa"]].map(([k, n]) => `<button type="button" class="chip" data-su-pal="${k}" aria-pressed="${S.suPal === k}">${n}</button>`).join("")}
          </div>
          <div id="mp-suunta"><p class="lataa">Ladataan lyöntejä…</p></div>
        </div>
      </div>

      <h3 style="margin-top:20px">Lyöntini kentällä</h3>
      <div id="mp-kartta"></div>`;
    el.querySelectorAll("[data-mp-kansio]").forEach((b) => (b.onclick = () => { S.kansio = b.dataset.mpKansio; piirra(); }));
    el.querySelectorAll("[data-mp-vaihe]").forEach((b) => (b.onclick = () => { S.vaihe = b.dataset.mpVaihe; piirra(); }));
    el.querySelectorAll("[data-mp-kausi]").forEach((b) => (b.onclick = () => { S.kausi = +b.dataset.mpKausi; piirra(); }));
    el.querySelectorAll("[data-su-ly]").forEach((b) => (b.onclick = () => { S.suLy = b.dataset.suLy; piirra(); }));
    el.querySelectorAll("[data-su-pal]").forEach((b) => (b.onclick = () => { S.suPal = b.dataset.suPal; piirra(); }));
    haeLyonnit(S.kausi, pelaaja.pesistulokset_id).then((dd) => { const kohde = el.querySelector("#mp-suunta"); if (kohde) kohde.innerHTML = suunta(dd, kansioNimi); });
    piirraOttelulyonnit(el.querySelector("#mp-kartta"), { nimi: oma.n, joukkue: oma.j });
  };
  piirra();
}

function vertailuRivi(nimi, pct, oma = false) {
  return `<div class="mp-vrivi${oma ? " oma" : ""}"><span>${nimi}</span><div class="mp-palkki"><i style="width:${Math.max(1, Math.min(100, pct || 0))}%"></i></div><b class="num">${pr(pct)}</b></div>`;
}
function jakauma(nimi, rivi) {
  const n = summa(rivi);
  return `<div class="mp-jakauma"><span>${nimi}</span><div class="mp-pino" role="img" aria-label="${nimi}: ${RYHMAT.map(([, rn, idx]) => `${rn} ${pr(pros(ryhma(rivi, idx), n))}`).join(", ")}">${RYHMAT.map(([k, rn, idx, vari]) => { const p = pros(ryhma(rivi, idx), n) || 0; return p ? `<i style="width:${p}%;background:${vari}" title="${rn} ${Math.round(p)} %">${p >= 9 ? Math.round(p) : ""}</i>` : ""; }).join("")}</div></div>`;
}
function top(lista, sija, omaId) {
  const nayta = lista.slice(0, 8);
  const rivi = (x, i) => `<li class="${x.id === String(omaId) ? "oma" : ""}"><span class="num">${i + 1}.</span><span>${esc(x.nimi)} <small>${esc(x.j || "")}</small></span><b class="num">${Math.round(x.pct)} %</b><small class="num">${x.n}</small></li>`;
  let h = nayta.map(rivi).join("");
  if (sija > 8) h += `<li class="vali" aria-hidden="true">⋯</li>` + rivi(lista[sija - 1], sija - 1);
  return h || `<li class="tyhja">Ei tarpeeksi lyöntejä.</li>`;
}

function paineLause(minä, sarja) {
  const n = summa(minä); if (n < 10) return `<p class="pieni" style="margin:8px 0 0">Kahden palon lyöntejä on vielä alle 10, joten vertailu on suuntaa antava.</p>`;
  const a = pros(onn(minä), n), b = pros(onn(sarja), summa(sarja)), ero = Math.round(a - b);
  return `<p class="mp-lause">Kahden palon paineessa onnistut <b>${pr(a)}</b> lyönneistä, ${ero === 0 ? "saman verran kuin sarja keskimäärin" : `${Math.abs(ero)} %-yksikköä ${ero > 0 ? "paremmin" : "heikommin"} kuin sarja (${pr(b)})`}.</p>`;
}

// Suunta: oman lyöntitiedoston lyönnit valitussa tilanteessa, lyönnissä ja paloissa → 3 × 3 ruudukko
function suunta(d, kansioNimi) {
  if (!d?.l) return `<p class="tyhja">Lyöntejä ei saatu ladattua.</p>`;
  const L = d.l.filter(([x, y, t, palot, lyonti, tulos, vaihe]) =>
    (S.vaihe === "k" || vaihe === 0) && (S.kansio === "kaikki" || KANSIO_T[t] === S.kansio) && (!S.suLy || lyonti === +S.suLy)
    && (!S.suPal || (S.suPal === "12" ? palot >= 1 : palot === +S.suPal)) && tulos !== 2);   // laittomat pois: suunta ilman kenttään osuneita on harhaanjohtava
  if (!L.length) return `<p class="tyhja">Ei lyöntejä näillä valinnoilla.</p>`;
  const solut = Array.from({ length: 9 }, () => ({ n: 0, ok: 0 }));
  L.forEach(([x, y, , , , tulos]) => { const c = solut[rivi3(y) * 3 + sarake(x)]; c.n++; if (ONN.has(tulos)) c.ok++; });
  const max = Math.max(...solut.map((c) => c.n));
  const yleisin = solut.map((c, i) => ({ ...c, i })).sort((a, b) => b.n - a.n)[0];
  const kuvaus = [S.suLy ? `${S.suLy}. lyönnillä` : "", S.suPal ? (S.suPal === "12" ? "1–2 palon kanssa" : `${S.suPal} palon kanssa`.replace("0 palon kanssa", "ilman paloja")) : "", S.kansio === "kaikki" ? "" : kansioNimi.toLowerCase().replace(/-tilanne$/, "-tilanteessa").replace("takatilanne", "takatilanteessa")].filter(Boolean).join(" ");
  return `<p class="mp-lause">${kuvaus ? kuvaus[0].toUpperCase() + kuvaus.slice(1) + " lyöt" : "Lyöt"} useimmiten <b>${SUUNTA_S[yleisin.i % 3]} ${SUUNTA_R[Math.floor(yleisin.i / 3)]}</b> (${pr(pros(yleisin.n, L.length))} lyönneistä). ${L.length} kenttään osunutta lyöntiä, laittomat eivät ole mukana.</p>
    <div class="mp-suunta" role="table" aria-label="Lyöntien suunta">
      <div class="mp-su-ots" role="row"><span></span>${SARAKKEET.map((s) => `<span role="columnheader">${s}</span>`).join("")}</div>
      ${RIVIT.map((r, ri) => `<div class="mp-su-rivi" role="row"><span role="rowheader">${r}</span>${[0, 1, 2].map((ci) => { const c = solut[ri * 3 + ci]; const osuus = pros(c.n, L.length); return `<div role="cell" class="mp-su-solu${c.n === yleisin.n && c.n ? " karki" : ""}" style="--t:${c.n ? 0.12 + (0.6 * c.n) / max : 0}"><b class="num">${c.n ? pr(osuus) : "–"}</b>${c.n ? `<small>${c.n} lyöntiä</small><small>onnistui ${pr(pros(c.ok, c.n))}</small>` : ""}</div>`; }).join("")}</div>`).join("")}
      <div class="mp-su-koti" aria-hidden="true">kotipesä</div>
    </div>`;
}

// Pieni vertailutaulukko ruudukkona: otsikot + rivit [nimi, [[pct, n?], …], korosta]
function taulu(otsikot, rivit) {
  return `<div class="mp-taulu" role="table" style="--sar:${otsikot.length}">
    <div role="row" class="mp-t-rivi mp-t-ots"><span></span>${otsikot.map((o) => `<span role="columnheader">${o}</span>`).join("")}</div>
    ${rivit.map(([nimi, solut, oma]) => `<div role="row" class="mp-t-rivi${oma ? " oma" : ""}"><span role="rowheader">${nimi}</span>${solut.map(([pct, n]) => `<span role="cell"><b class="num">${pr(pct)}</b>${n != null ? `<small>${n} lyöntiä</small>` : ""}</span>`).join("")}</div>`).join("")}
  </div>`;
}
