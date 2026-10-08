// Pelaajakortti: ennätykset, profiili ikätovereihin verrattuna ja kehitys testeittäin.
import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, pvmLyhyt, kausi, paras, parannus, parhaatTulokset, kuva, mediaani, keskiarvo, hajonta, piirra, vari } from "../util.js";

const PROFIILI = ["30m", "10m", "lentava20", "heitto_paikalta", "heitto_vauhti", "lyonti"];
let valittu = "30m";

export async function nayta(main, id) {
  const p = tila.pelaaja[id];
  if (!p) throw new Error("Pelaajaa ei löytynyt.");
  const kaikki = parhaatTulokset(await lataaTulokset());
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

  main.innerHTML = `
    <div class="kortti-paa">${kuva(p, true)}<div>
      <h1>${esc(nimi(p))}</h1>
      <div class="pieni">${p.syntymavuosi ? `Syntynyt ${p.syntymavuosi}` : "Syntymävuosi puuttuu"}${joukkue ? ` · ${esc(joukkue)}` : ""}${p.aktiivinen ? "" : " · ei nykyisessä ryhmässä"}
        ${p.pesistulokset_id ? ` · <a href="https://www.pesistulokset.fi/pelaaja/${p.pesistulokset_id}" target="_blank" rel="noopener">pesistulokset.fi</a>` : ""}</div>
    </div></div>

    <div class="lukemat">${kortit.filter((x) => tila.testi[x.t].ryhma !== "taito" || x.t === "napy_1raja").slice(0, 12).map((x) => `
      <button class="lukema" data-t="${x.t}" style="text-align:left;cursor:pointer;${x.t === valittu ? "border-color:var(--ink)" : ""}">
        <div class="otsikko">${esc(tila.testi[x.t].nimi)}</div>
        <div class="arvo">${muotoile(x.pb, x.t)}<small>${tila.testi[x.t].yksikko} ennätys</small></div>
        <div class="muutos pieni">Viimeisin ${muotoile(x.viim.arvo, x.t)} (${pvmLyhyt(x.viim.pvm)})${x.edel ? `, <span class="${parannus(x.t, x.viim.arvo, x.edel.arvo) > 0 ? "pb" : parannus(x.t, x.viim.arvo, x.edel.arvo) < 0 ? "huono" : ""}">${muotoileMuutos(x.viim.arvo - x.edel.arvo, x.t)}</span>` : ""}</div>
        ${x.ikatov >= 2 ? `<div class="pieni">Parempi kuin ${x.ohi}/${x.ikatov} ikätoverista</div>` : ""}
      </button>`).join("")}</div>

    <h2>Kehitys</h2>
    <div class="chipit" style="margin-bottom:10px">${testit.map((t) => `<button class="chip" data-k="${t}" aria-pressed="${t === valittu}">${esc(tila.testi[t].nimi)}</button>`).join("")}</div>
    <div class="paneeli"><div class="kaavio"><canvas id="kehitys"></canvas></div></div>
    <p class="vihje">Katkoviiva on saman ikäluokan mediaani kullakin testikerralla.</p>

    ${profiili ? `<h2>Profiili talvella ${profiili.kausi}</h2>
    <p class="pieni">T-pisteet verrattuna ${profiili.vertailu}: 50 on keskitaso, 60 selvästi keskitason yläpuolella. Juoksuissa nopeampi aika antaa enemmän pisteitä.</p>
    <div class="rivi" style="align-items:stretch">
      <div class="paneeli" style="flex:1 1 320px"><div class="kaavio"><canvas id="profiili"></canvas></div></div>
      <div class="taulu-wrap" style="flex:1 1 320px"><table><thead><tr><th>Testi</th><th class="n">Kauden paras</th><th class="n">T-pisteet</th></tr></thead>
      <tbody>${profiili.rivit.map((r) => `<tr><td>${esc(tila.testi[r.t].nimi)}</td><td class="n">${muotoile(r.arvo, r.t)}</td><td class="n iso" style="font-size:20px">${Math.round(r.T)}</td></tr>`).join("")}</tbody></table></div>
    </div>` : ""}

    <details style="margin-top:36px"><summary><h2 style="display:inline;margin:0">Kaikki tulokset (${omat.length})</h2></summary>
    <div class="taulu-wrap" style="margin-top:12px"><table><thead><tr><th>Päivä</th><th>Testi</th><th class="n">Paras</th><th class="n">Yrityksiä</th><th class="n">Ka</th></tr></thead>
      <tbody>${[...omat].reverse().map((x) => `<tr><td><a href="#/kerta/${x.kerta}">${pvm(x.pvm)}</a></td><td>${esc(tila.testi[x.testi].nimi)}</td><td class="n">${muotoile(x.arvo, x.testi)}</td><td class="n">${x.n}</td><td class="n">${x.n > 1 ? muotoile(x.ka, x.testi) : ""}</td></tr>`).join("")}</tbody></table></div></details>`;

  const valitse = (t) => { valittu = t; $$("[data-k]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === t)); $$(".lukema[data-t]").forEach((b) => (b.style.borderColor = b.dataset.t === t ? "var(--ink)" : "")); kaavio(); };
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
        { label: nimi(p), data: pvmt.map((d) => a.find((x) => x.pvm === d).arvo), borderColor: vari("--red"), backgroundColor: vari("--red"), borderWidth: 3, pointRadius: 4, tension: .2 },
        { label: `${p.syntymavuosi} syntyneiden mediaani`, data: ikaluokka, borderColor: vari("--ink-3"), borderDash: [6, 4], pointRadius: 0, spanGaps: true, tension: .2 },
      ] },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { y: { reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko } } },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${muotoile(c.parsed.y, t)} ${T.yksikko}` } } } },
    });
  }
  if (valittu) kaavio();

  if (profiili) piirra($("#profiili"), {
    type: "radar",
    data: { labels: profiili.rivit.map((r) => tila.testi[r.t].nimi), datasets: [
      { label: nimi(p), data: profiili.rivit.map((r) => Math.round(r.T)), borderColor: vari("--red"), backgroundColor: vari("--red") + "33", pointRadius: 3 },
      { label: "Keskitaso", data: profiili.rivit.map(() => 50), borderColor: vari("--ink-3"), borderDash: [4, 4], pointRadius: 0, backgroundColor: "transparent" },
    ] },
    options: { maintainAspectRatio: false, scales: { r: { suggestedMin: 20, suggestedMax: 80, ticks: { stepSize: 10, backdropColor: "transparent" } } } },
  });
}

function laskeProfiili(p, kaikki) {
  const omat = kaikki.filter((x) => x.pelaaja === p.id && PROFIILI.includes(x.testi));
  if (!omat.length) return null;
  const ka = kausi(omat.at(-1).pvm);
  const kauden = kaikki.filter((x) => kausi(x.pvm) === ka && PROFIILI.includes(x.testi));
  const kausiParas = (pid, t) => paras(t, kauden.filter((x) => x.pelaaja === pid && x.testi === t).map((x) => x.arvo));
  const ikatoverit = [...new Set(kauden.map((x) => x.pelaaja))].filter((pid) => tila.pelaaja[pid]?.syntymavuosi === p.syntymavuosi);
  const vertailuJoukko = ikatoverit.length >= 5 ? ikatoverit : [...new Set(kauden.map((x) => x.pelaaja))];
  const vertailu = ikatoverit.length >= 5 ? `${p.syntymavuosi} syntyneisiin (${ikatoverit.length} pelaajaa)` : `koko ryhmään (${vertailuJoukko.length} pelaajaa)`;
  const rivit = [];
  for (const t of PROFIILI) {
    const oma = kausiParas(p.id, t);
    if (oma == null) continue;
    const arvot = vertailuJoukko.map((pid) => kausiParas(pid, t)).filter((x) => x != null);
    const sd = hajonta(arvot);
    if (arvot.length < 4 || !sd) continue;
    const z = (oma - keskiarvo(arvot)) / sd * (tila.testi[t].pienempi_parempi ? -1 : 1);
    rivit.push({ t, arvo: oma, T: Math.max(10, Math.min(90, 50 + 10 * z)) });
  }
  return rivit.length >= 3 ? { kausi: ka, rivit, vertailu } : null;
}
