// Pelaajakortti: ennätykset, profiili ikätovereihin verrattuna ja kehitys testeittäin.
import { tila, nimi, lataaTulokset } from "../db.js";
import { LUOKAT } from "./testit.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, pvmLyhyt, kausi, paras, parannus, parhaatTulokset, juoksutYhteen, testiParhaat, kuva, mediaani, keskiarvo, hajonta, piirra, vari, mittari, miniPylvaat, liukuvari } from "../util.js";

const PROFIILI = ["30m", "10m", "lentava20", "nok_30m", "cooper", "heitto_paikalta", "heitto_vauhti", "lyonti"];
let valittu = "30m";

export async function nayta(main, id) {
  const p = tila.pelaaja[id];
  if (!p) throw new Error("Pelaajaa ei löytynyt.");
  // Nopeuskestävyys: pääluku on 9 juoksun keskiarvo (vain täydet sarjat), paras juoksu talteen
  const kaikki = testiParhaat(await lataaTulokset());
  const omat = kaikki.filter((x) => x.pelaaja === id);
  const testit = [...new Set(omat.map((x) => x.testi))].sort((a, b) => tila.testi[a].jarjestys - tila.testi[b].jarjestys);
  if (!testit.includes(valittu)) valittu = testit[0];
  const joukkue = tila.joukkueet.find((j) => j.id === p.joukkue_id)?.nimi;

  const kortit = testit.map((t) => {
    const a = omat.filter((x) => x.testi === t);
    const viim = a.at(-1), edel = a.at(-2);
    const pb = paras(t, a.map((x) => x.arvo));
    // sijoitus ikätovereihin viimeisimmällä kerralla
    const ikatov = kaikki.filter((x) => x.kerta === viim.kerta && x.testi === t && tila.pelaaja[x.pelaaja]?.syntymavuosi === p.syntymavuosi && x.pelaaja !== id);
    const ohi = ikatov.filter((x) => parannus(t, viim.arvo, x.arvo) > 0).length;
    return { t, viim, edel, pb, ikatov: ikatov.length, ohi };
  });
  const profiili = laskeProfiili(p, kaikki);

  const kerrat = new Set(omat.map((x) => x.kerta)).size;
  // ruuduissa vain testit, joita on tehty viimeisen 18 kk aikana pelaajan viimeisimmästä testistä
  const raja = omat.length ? new Date(new Date(omat.at(-1).pvm) - 550 * 864e5).toISOString().slice(0, 10) : "";
  const tuore = (d) => d >= raja;
  const indeksi = profiili ? Math.round(keskiarvo(profiili.rivit.map((r) => r.T))) : null;
  const pct = (x) => (x.ikatov >= 2 ? Math.round((100 * x.ohi) / x.ikatov) : null);

  main.innerHTML = `
    ${pelaajaValitsin(p, kaikki)}
    <div class="kortti-paa">${kuva(p, true)}<div style="flex:1">
      <h1>${esc(nimi(p))}</h1>
      <div class="tagit">
        ${p.syntymavuosi ? `<span>Syntynyt<b>${p.syntymavuosi}</b></span>` : ""}
        ${joukkue ? `<span>Ryhmä<b>${esc(joukkue)}</b></span>` : ""}
        <span>Testikertoja<b>${kerrat}</b></span>
        ${omat.length ? `<span>Ensimmäinen testi<b>${pvm(omat[0].pvm)}</b></span>` : ""}
        ${p.pesistulokset_id ? `<span><a href="https://www.pesistulokset.fi/pelaaja/${p.pesistulokset_id}" target="_blank" rel="noopener">pesistulokset.fi</a></span>` : ""}
        ${p.aktiivinen ? "" : "<span>Ei nykyisessä ryhmässä</span>"}
        ${tila.ohjaaja || id === tila.omaPelaaja ? `<span><a href="#/oma/${id}">Oma Keskus</a></span>` : ""}
      </div></div>
      ${indeksi != null ? `<div style="text-align:center">${mittari(Math.max(0, Math.min(100, (indeksi - 20) * 100 / 60)), indeksi, "indeksi", 104)}<div class="pieni">Talvi ${profiili.kausi}</div></div>` : ""}
    </div>

    <section class="paneeli pv" id="pv"></section>

    <div class="kpi-rivi" style="margin-top:16px">${kortit.filter((x) => (tila.testi[x.t].ryhma !== "taito" || x.t === "napy_1raja") && tuore(x.viim.pvm)).slice(0, 12).map((x) => {
      const T = tila.testi[x.t], muutos = x.edel ? parannus(x.t, x.viim.arvo, x.edel.arvo) : null;
      return `<button class="kpi lukema" data-t="${x.t}" aria-pressed="${x.t === valittu}" style="text-align:left;border:1px solid var(--line)">
        <div class="otsikko">${x.t === "nok_30m" ? "9×30 m, keskiarvo" : esc(T.nimi)}</div>
        <div><div class="arvo">${muotoile(x.pb, x.t)}<small>${T.yksikko}</small></div><div class="pieni">ennätys</div></div>
        ${pct(x) != null ? mittari(pct(x), pct(x) + "%", "ikäluokka", 66) : ""}
        <div class="ala">Viimeisin ${muotoile(x.viim.arvo, x.t)} <span class="pieni">${pvmLyhyt(x.viim.pvm)}</span>${muutos != null ? ` <span class="${muutos > 0 ? "pb" : muutos < 0 ? "huono" : ""}">${muotoileMuutos(x.viim.arvo - x.edel.arvo, x.t)}</span>` : ""}</div>
        ${miniPylvaat(omat.filter((y) => y.testi === x.t).map((y) => y.arvo), T.pienempi_parempi)}
      </button>`; }).join("")}</div>
    <p class="vihje">Rengas kertoo, monenko prosentin ikätoverien tuloksen pelaaja ylitti viimeisimmällä testikerralla. Pylväät näyttävät kehityksen testikerroittain, viimeisin punaisella.</p>

    <h2>Kehitys</h2>
    <div class="chipit" style="margin-bottom:10px">${testit.map((t) => `<button class="chip" data-k="${t}" aria-pressed="${t === valittu}">${esc(tila.testi[t].nimi)}${t === "nok_30m" ? " (ka)" : ""}</button>`).join("")}</div>
    <div class="paneeli"><div class="kaavio"><canvas id="kehitys"></canvas></div></div>
    <p class="vihje">Katkoviiva on saman ikäluokan mediaani kullakin testikerralla.</p>

    ${profiili ? `<h2>Profiili talvella ${profiili.kausi}</h2>
    <p class="pieni">T-pisteet verrattuna ${profiili.vertailu}: 50 on keskitaso, 60 selvästi keskitason yläpuolella. Juoksuissa (myös 9×30 m keskiarvossa) nopeampi aika ja Cooperissa pidempi matka antaa enemmän pisteitä. Jos testiä ei ole tältä talvelta, mukana on edellisen talven tulos (kausi suluissa).</p>
    <div class="rivi" style="align-items:stretch">
      <div class="paneeli" style="flex:1 1 320px"><div class="kaavio"><canvas id="profiili"></canvas></div></div>
      <div class="taulu-wrap" style="flex:1 1 320px"><table><thead><tr><th>Testi</th><th class="n">Kauden paras</th><th class="n">T-pisteet</th></tr></thead>
      <tbody>${profiili.rivit.map((r) => `<tr><td>${esc(tila.testi[r.t].nimi)}${r.t === "nok_30m" ? " (ka)" : ""}${r.kausi ? ` <span class="pieni" title="Ei tulosta tältä kaudelta: edellisen kauden tulos verrattuna sen kauden ryhmään">(${r.kausi})</span>` : ""}</td><td class="n">${muotoile(r.arvo, r.t)}</td><td class="n iso" style="font-size:20px">${Math.round(r.T)}</td></tr>`).join("")}</tbody></table></div>
    </div>` : ""}

    <details style="margin-top:36px"><summary><h2 style="display:inline;margin:0">Kaikki tulokset (${omat.length})</h2></summary>
    <div class="taulu-wrap" style="margin-top:12px"><table><thead><tr><th>Päivä</th><th>Testi</th><th class="n">Paras</th><th class="n">Yrityksiä</th><th class="n">Ka</th></tr></thead>
      <tbody>${[...omat].reverse().map((x) => `<tr><td><a href="#/kerta/${x.kerta}">${pvm(x.pvm)}</a></td><td>${esc(tila.testi[x.testi].nimi)}</td><td class="n">${muotoile(x.parasJuoksu ?? x.arvo, x.testi)}</td><td class="n">${x.n}</td><td class="n">${x.n > 1 ? muotoile(x.ka, x.testi) : ""}</td></tr>`).join("")}</tbody></table></div></details>`;

  const valitse = (t) => { valittu = t; $$("[data-k]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === t)); $$(".lukema[data-t]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === t)); kaavio(); };
  $$("[data-k]").forEach((b) => (b.onclick = () => valitse(b.dataset.k)));
  $$(".lukema[data-t]").forEach((b) => (b.onclick = () => { valitse(b.dataset.t); $("#kehitys").scrollIntoView({ behavior: "smooth", block: "center" }); }));

  function kaavio() {
    const t = valittu, T = tila.testi[t];
    const a = omat.filter((x) => x.testi === t);
    const pvmt = [...new Set(a.map((x) => x.pvm))];
    const ikaluokka = pvmt.map((d) => { const v = kaikki.filter((x) => x.pvm === d && x.testi === t && tila.pelaaja[x.pelaaja]?.syntymavuosi === p.syntymavuosi).map((x) => x.arvo); return v.length >= 3 ? mediaani(v) : null; });
    piirra($("#kehitys"), {
      type: "line",
      data: { labels: pvmt.map(pvmLyhyt), datasets: [
        { label: nimi(p), data: pvmt.map((d) => a.find((x) => x.pvm === d).arvo), borderColor: vari("--cyan"), pointBackgroundColor: vari("--cyan"), backgroundColor: liukuvari(.28, 0), fill: T.pienempi_parempi ? "start" : "origin", borderWidth: 3, pointRadius: 4, tension: .3 },
        { label: `${p.syntymavuosi} syntyneiden mediaani`, data: ikaluokka, borderColor: vari("--ink-3"), borderDash: [6, 4], pointRadius: 0, spanGaps: true, tension: .2 },
      ] },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { y: { reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko } } },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${muotoile(c.parsed.y, t)} ${T.yksikko}` } } } },
    });
  }
  if (valittu) kaavio();

  piirraVertailu(p, kaikki);
  kytkeValitsin();

  if (profiili) piirra($("#profiili"), {
    type: "radar",
    data: { labels: profiili.rivit.map((r) => (r.t === "nok_30m" ? "9×30 m (ka)" : tila.testi[r.t].nimi) + (r.kausi ? ` (${r.kausi})` : "")), datasets: [
      { label: nimi(p), data: profiili.rivit.map((r) => Math.round(r.T)), borderColor: vari("--cyan"), backgroundColor: "rgba(245,168,0,.18)", pointBackgroundColor: vari("--cyan"), pointRadius: 3 },
      { label: "Keskitaso", data: profiili.rivit.map(() => 50), borderColor: vari("--ink-3"), borderDash: [4, 4], pointRadius: 0, backgroundColor: "transparent" },
    ] },
    options: { maintainAspectRatio: false, scales: { r: { suggestedMin: 20, suggestedMax: 80, grid: { color: "rgba(245,168,0,.12)" }, angleLines: { color: "rgba(245,168,0,.12)" }, pointLabels: { color: vari("--ink-2"), font: { size: 13 } }, ticks: { stepSize: 10, backdropColor: "transparent", color: vari("--ink-3") } } } },
  });
}

function laskeProfiili(p, kaikki) {
  const omat = kaikki.filter((x) => x.pelaaja === p.id && PROFIILI.includes(x.testi));
  if (!omat.length) return null;
  const ka = kausi(omat.at(-1).pvm);
  const edellinen = `${+ka.slice(0, 4) - 1}–${ka.slice(2, 4)}`; // esim. 2025–26 → 2024–25
  // Vertailu tehdään kauden parhaista. Jos testiä ei ole tältä kaudelta (esim. Cooper),
  // käytetään edellisen kauden tulosta ja sen kauden vertailuryhmää (20.10.2026).
  const kaudelta = (k) => {
    const kauden = kaikki.filter((x) => kausi(x.pvm) === k && PROFIILI.includes(x.testi));
    const kausiParas = (pid, t) => paras(t, kauden.filter((x) => x.pelaaja === pid && x.testi === t).map((x) => x.arvo));
    const pelaajat = [...new Set(kauden.map((x) => x.pelaaja))];
    const ikatoverit = pelaajat.filter((pid) => tila.pelaaja[pid]?.syntymavuosi === p.syntymavuosi);
    return { kausiParas, ikatoverit, joukko: ikatoverit.length >= 5 ? ikatoverit : pelaajat };
  };
  const nyt = kaudelta(ka), ed = kaudelta(edellinen);
  const vertailu = nyt.ikatoverit.length >= 5 ? `${p.syntymavuosi} syntyneisiin (${nyt.ikatoverit.length} pelaajaa)` : `koko ryhmään (${nyt.joukko.length} pelaajaa)`;
  const rivit = [];
  for (const t of PROFIILI) {
    for (const [k, K] of [[ka, nyt], [edellinen, ed]]) {
      const oma = K.kausiParas(p.id, t);
      if (oma == null) continue;
      const arvot = K.joukko.map((pid) => K.kausiParas(pid, t)).filter((x) => x != null);
      const sd = hajonta(arvot);
      if (arvot.length < 4 || !sd) continue;
      const z = (oma - keskiarvo(arvot)) / sd * (tila.testi[t].pienempi_parempi ? -1 : 1);
      rivit.push({ t, arvo: oma, T: Math.max(10, Math.min(90, 50 + 10 * z)), kausi: k === ka ? null : k });
      break;
    }
  }
  return rivit.length >= 3 ? { kausi: ka, rivit, vertailu } : null;
}

// ---------- Vertailu (20.10.2026): pelaaja vs. valittu ryhmä, Oma pelin "Joukkue vs. sarja" -mallin mukaan.
// Kunkin testin pelaajan kauden paras (viimeisin kausi, jolla testi on tehty) vs. ryhmän pelaajien kauden parhaat samalta kaudelta.
const VERTAILUT = [["ika", "Oma ikäluokka"], ["juniorit", "Juniorit"], ["miehet", "Miehet"], ["kaikki", "Kaikki testatut"]];
let vertailuValinta = null;
const onSp = (pid) => /superpesis/i.test(tila.joukkueet.find((j) => j.id === tila.pelaaja[pid]?.joukkue_id)?.nimi || "");
const testinNimi = (t) => (t === "nok_30m" ? "9×30 m (ka)" : t === "lentava20" ? "Lentävä 20 m" : tila.testi[t].nimi.replace(/^Edustuksen lyöntitesti: |^Lyöntitesti: /, "LT: ").replace(" juoksu", "").replace(" väliaika", ""));

function vertailuRivit(p, kaikki, ryhma) {
  const kuuluu = (pid) => ryhma === "kaikki" || (ryhma === "miehet" ? onSp(pid) : ryhma === "juniorit" ? !onSp(pid) : !onSp(pid) && tila.pelaaja[pid]?.syntymavuosi === p.syntymavuosi);
  const kausiParhaat = (t, k) => { const m = new Map();
    for (const x of kaikki) { if (x.testi !== t || x.pelaaja === p.id || kausi(x.pvm) !== k || !kuuluu(x.pelaaja)) continue; const o = m.get(x.pelaaja); if (o == null || parannus(t, x.arvo, o) > 0) m.set(x.pelaaja, x.arvo); }
    return [...m.values()]; };
  const testit = [...new Set(kaikki.filter((x) => x.pelaaja === p.id).map((x) => x.testi))];
  return testit.map((t) => {
    const omat = kaikki.filter((x) => x.pelaaja === p.id && x.testi === t);
    const ka = kausi(omat.at(-1).pvm);
    const oma = paras(t, omat.filter((x) => kausi(x.pvm) === ka).map((x) => x.arvo));
    let k = ka, arvot = kausiParhaat(t, ka);
    if (arvot.length < 3 && ryhma === "miehet") { // miehet ovat voineet testata eri kaudella: viimeisin kausi, jolla dataa
      const kk = [...new Set(kaikki.filter((x) => x.testi === t && kuuluu(x.pelaaja)).map((x) => kausi(x.pvm)))].sort().at(-1);
      if (kk && kk !== ka) { k = kk; arvot = kausiParhaat(t, kk); }
    }
    const T = tila.testi[t];
    const viim = omat.at(-1), edel = omat.at(-2);
    const muutos = edel ? { ero: viim.arvo - edel.arvo, parempi: parannus(t, viim.arvo, edel.arvo), pvm: edel.pvm, viimPvm: viim.pvm } : null;
    const rivi = { t, oma, ka, k, luokka: T.luokka, jarj: T.jarjestys ?? 99, muutos };
    if (arvot.length < 3) return { ...rivi, puuttuu: true };
    const parempia = arvot.filter((v) => parannus(t, v, oma) > 0).length;
    const md = mediaani(arvot);
    return { ...rivi, sij: parempia + 1, n: arvot.length + 1, pct: Math.round((100 * (arvot.length - parempia)) / arvot.length), md, ero: oma - md, parempi: parannus(t, oma, md) };
  });
}

function piirraVertailu(p, kaikki) {
  const el = $("#pv"); if (!el) return;
  const sp = onSp(p.id);
  const valinnat = VERTAILUT.filter(([k]) => !(k === "ika" && (sp || !p.syntymavuosi)));
  if (!vertailuValinta || !valinnat.some(([k]) => k === vertailuValinta)) vertailuValinta = sp ? "miehet" : "ika";
  const R = vertailuRivit(p, kaikki, vertailuValinta);
  const ok = R.filter((r) => !r.puuttuu);
  const nimiV = { ika: `ikäluokka ${p.syntymavuosi}`, juniorit: "juniorit", miehet: "Superpesis-miehet", kaikki: "kaikki testatut" }[vertailuValinta];
  const jarj = [...ok].sort((a, b) => b.pct - a.pct);
  // Vahvimmat: pelaajan parhaat sijoitukset (aina näkyvissä); kehitettävät: heikoimmat alle puolivälin, ei samoja
  const vahv = jarj.slice(0, Math.min(3, Math.ceil(jarj.length / 2)));
  const kehit = jarj.filter((r) => r.pct < 50 && !vahv.includes(r)).slice(-3).reverse();
  const uusinKausi = R.map((r) => r.ka).sort().at(-1); // kausi näytetään vain, jos rivi poikkeaa uusimmasta
  const fmt = (t, v) => muotoile(v, t === "lentava20" ? "30m" : t);
  const eroTxt = (r) => { const d = tila.testi[r.t]?.desimaalit ?? 2; const a = Math.abs(r.ero); return a < 10 ** -d / 2 ? "±0" : (r.parempi > 0 ? "+" : "−") + a.toFixed(d).replace(".", ","); };
  const muutosSolu = (r) => {
    if (!r.muutos) return `<span class="m pieni" title="Ensimmäinen testikerta">uusi</span>`;
    const d = tila.testi[r.t]?.desimaalit ?? 2, a = Math.abs(r.muutos.ero), nolla = a < 10 ** -d / 2;
    const luokka = nolla ? "" : r.muutos.parempi > 0 ? "plus" : "miinus";
    const nuoli = nolla ? "•" : r.muutos.parempi > 0 ? "▲" : "▼";
    return `<span class="m num ${luokka}" title="Viimeisin ${pvm(r.muutos.viimPvm)} vs. edellinen ${pvm(r.muutos.pvm)}">${nuoli} ${nolla ? "±0" : (r.muutos.ero > 0 ? "+" : "−") + a.toFixed(d).replace(".", ",")}</span>`;
  };
  const rivi = (r) => {
    if (r.puuttuu) return `<div class="pv-r tyhja-r"><span class="k">${esc(testinNimi(r.t))}</span><span class="pv-ei">ei vertailuryhmän tuloksia${vertailuValinta === "miehet" ? " – miehet eivät ole tehneet testiä" : ""}</span><span class="v num">${fmt(r.t, r.oma)}</span><span></span>${muutosSolu(r)}</div>`;
    const pos = r.n > 1 ? ((r.n - r.sij) / (r.n - 1)) * 100 : 50, vari = `color-mix(in srgb, #2EE59D ${pos}%, #FF3B4E)`;
    return `<div class="pv-r" title="${esc(testinNimi(r.t))}: sija ${r.sij}./${r.n}, parempi kuin ${r.pct} % · ryhmän mediaani ${fmt(r.t, r.md)} ${esc(tila.testi[r.t].yksikko)} · kausi ${r.k}">
      <span class="k">${esc(testinNimi(r.t))}${r.k !== r.ka ? `<small>miehet ${r.k}</small>` : r.ka !== uusinKausi ? `<small>${r.ka}</small>` : ""}</span>
      <span class="tr"><i style="width:${pos}%;background:${vari}"></i><em style="left:50%"></em><b style="left:${pos}%;background:${vari}">${r.sij}.</b></span>
      <span class="v num">${fmt(r.t, r.oma)}<small> ${esc(tila.testi[r.t].yksikko)}</small></span>
      <span class="e num ${r.parempi > 0 ? "plus" : r.parempi < 0 ? "miinus" : ""}">${eroTxt(r)}</span>${muutosSolu(r)}</div>`;
  };
  const puuttuvat = R.filter((r) => r.puuttuu); // kootaan yhdeksi riviksi, ettei näkymä täyty tyhjistä riveistä
  const ryhmat = LUOKAT.map(([k, n]) => [n, ok.filter((r) => r.luokka === k).sort((a, b) => a.jarj - b.jarj)]).filter(([, a]) => a.length);
  const muut = ok.filter((r) => !LUOKAT.some(([k]) => k === r.luokka));
  if (muut.length) ryhmat.push(["Muut", muut]);
  el.innerHTML = `
    <div class="pv-paa"><div><h2>Vertailu</h2><p class="pieni">${esc(nimi(p))} vs. ${esc(nimiV)} · kauden paras tulos verrattuna ryhmän pelaajien kauden parhaisiin</p></div>
      <div class="chipit" role="radiogroup" aria-label="Vertailuryhmä">${valinnat.map(([k, n]) => `<button class="chip" role="radio" data-pv="${k}" aria-pressed="${k === vertailuValinta}" aria-checked="${k === vertailuValinta}">${k === "ika" ? `${n} ${p.syntymavuosi}` : n}</button>`).join("")}</div></div>
    ${ok.length ? `<div class="pv-yht">
      <div class="pv-iso"><span class="pieni">Keskimäärin parempi kuin</span><b class="num" style="color:color-mix(in srgb, #2EE59D ${Math.round(keskiarvo(ok.map((r) => r.pct)))}%, #FF3B4E)">${Math.round(keskiarvo(ok.map((r) => r.pct)))} %</b><span class="pieni">${ok.length} testissä</span></div>
      <div class="pv-lista"><span class="pieni">Vahvimmat</span>${vahv.map((r) => `<span class="pv-merkki ${r.pct >= 50 ? "plus" : ""}">${esc(testinNimi(r.t))} <b>${r.sij}./${r.n}</b></span>`).join("") || `<span class="pieni">–</span>`}</div>
      <div class="pv-lista"><span class="pieni">Kehitettävät</span>${kehit.map((r) => `<span class="pv-merkki miinus">${esc(testinNimi(r.t))} <b>${r.sij}./${r.n}</b></span>`).join("") || `<span class="pieni">–</span>`}</div>
    </div>` : ""}
    <div class="pv-ots"><span></span><span class="pieni">heikompi ← sija → parempi</span><span class="pieni n">Tulos</span><span class="pieni n">vs. md</span><span class="pieni n">Edellisestä</span></div>
    ${ryhmat.map(([n, a]) => { const pct = Math.round(keskiarvo(a.map((r) => r.pct)));
      return `<div class="pv-ryhma"><h3><span class="pv-luokka-pct num" style="background:color-mix(in srgb, #2EE59D ${pct}%, #FF3B4E)" title="${esc(n)}: keskimäärin parempi kuin ${pct} % ryhmästä (${a.length} ${a.length === 1 ? "testi" : "testiä"})">${pct} %</span>${esc(n)}<small>${a.length} ${a.length === 1 ? "testi" : "testiä"}</small></h3>${a.map(rivi).join("")}</div>`; }).join("")}
    ${puuttuvat.length ? `<p class="pieni pv-puuttuu">Ei vertailutuloksia ryhmältä ${esc(nimiV)}${vertailuValinta === "miehet" ? " (miehet eivät ole tehneet näitä testejä)" : ""}: ${puuttuvat.map((r) => esc(testinNimi(r.t))).join(", ")}.</p>` : ""}
    <p class="vihje">Pallo = sija vertailuryhmässä (pelaaja mukaan lukien), vihreä kärjessä, punainen hännillä. Pystyviiva = ryhmän puoliväli. "vs. md" = ero ryhmän mediaaniin: + = parempi kuin ryhmän mediaani (juoksuissa nopeampi). Luokan prosentti = luokan testien keskimääräinen "parempi kuin %". "Edellisestä" = viimeisin tulos verrattuna edelliseen testikertaan (▲ vihreä = parani). Kausi on pelaajan viimeisin kausi, jolla testi on tehty; jos miehillä ei ole tulosta samalta kaudelta, verrataan miesten viimeisimpään kauteen.</p>`;
  $$("[data-pv]", el).forEach((b) => (b.onclick = () => { vertailuValinta = b.dataset.pv; piirraVertailu(p, kaikki); }));
}

// ---------- Pelaajan vaihto (20.10.2026): valikko ryhmittäin + ‹ › selaa saman ryhmän pelaajia
const ryhmaNimi = (q) => (onSp(q.id) ? "Superpesis" : q.syntymavuosi && q.syntymavuosi >= 2007 ? `Juniorit ${q.syntymavuosi}` : "Muut");
function pelaajaValitsin(p, kaikki) {
  const testatut = new Set(kaikki.map((x) => x.pelaaja));
  const lista = tila.pelaajat.filter((q) => testatut.has(q.id) && (q.aktiivinen || q.id === p.id));
  const ryhmat = new Map();
  lista.forEach((q) => { const r = ryhmaNimi(q); (ryhmat.get(r) || ryhmat.set(r, []).get(r)).push(q); });
  const jarj = [...ryhmat.keys()].sort((a, b) => (a === "Superpesis" ? -1 : b === "Superpesis" ? 1 : a === "Muut" ? 1 : b === "Muut" ? -1 : a.localeCompare(b)));
  jarj.forEach((r) => ryhmat.get(r).sort((a, b) => nimi(a).localeCompare(nimi(b), "fi")));
  const oma = ryhmat.get(ryhmaNimi(p)) || [p], i = oma.findIndex((q) => q.id === p.id);
  const ed = oma[(i - 1 + oma.length) % oma.length], seur = oma[(i + 1) % oma.length];
  return `<div class="pk-valitsin">
    <a class="btn pk-nuoli" href="#/pelaaja/${ed.id}" title="Edellinen: ${esc(nimi(ed))}" aria-label="Edellinen pelaaja">‹</a>
    <label class="pk-valinta"><span class="pieni">Pelaaja</span><select id="pk-pelaaja" aria-label="Vaihda pelaajaa">${jarj.map((r) => `<optgroup label="${esc(r)}">${ryhmat.get(r).map((q) => `<option value="${q.id}"${q.id === p.id ? " selected" : ""}>${esc(nimi(q))}</option>`).join("")}</optgroup>`).join("")}</select></label>
    <a class="btn pk-nuoli" href="#/pelaaja/${seur.id}" title="Seuraava: ${esc(nimi(seur))}" aria-label="Seuraava pelaaja">›</a>
    <span class="pieni pk-sijainti">${esc(ryhmaNimi(p))} · ${i + 1} / ${oma.length}</span>
    <a class="btn pk-vertaa" href="#/vertailu/${p.id}">Vertaa toiseen pelaajaan</a>
  </div>`;
}
function kytkeValitsin() {
  const s = $("#pk-pelaaja"); if (!s) return;
  s.onchange = () => (location.hash = `#/pelaaja/${s.value}`);
}
