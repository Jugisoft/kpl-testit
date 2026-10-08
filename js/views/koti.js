import { sb, tila } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, pvmLyhyt, kausi, piirra, SARJAVARIT, vari, miniPylvaat, mittari } from "../util.js";

const PAATESTIT = ["30m", "10m", "heitto_paikalta", "heitto_vauhti", "lyonti", "nok_30m", "kuntopallo_taakse_2kg", "napy_1raja"];
let data = [];
let ikadata = [];
let valittu = "30m";

export async function nayta(main) {
  const [{ data: d, error }, { data: ik, error: e2 }] = await Promise.all([sb.rpc("julkinen_yhteenveto"), sb.rpc("julkinen_ikakayra")]);
  if (error || e2) throw error || e2;
  data = d.map((r) => ({ ...r, mediaani: +r.mediaani, keskiarvo: +r.keskiarvo, paras: +r.paras, n: +r.n }));
  ikadata = ik.map((r) => ({ ...r, mediaani: +r.mediaani, q1: +r.q1, q3: +r.q3, paras: +r.paras, n: +r.n }));

  const testit = PAATESTIT.filter((t) => data.some((r) => r.testi === t));
  const hero = heroLuku();

  main.innerHTML = `
    <section class="hero">
      <div>
        <h1>Mitattu kehitys, talvi talvelta</h1>
        <p class="ingressi">KPL:n pelaajat testataan joka talvi samoilla testeillä: kennoilla ajetut 30 metriä, tutkaan heitot ja lyönnit sekä taitotestit. Tällä sivulla näet ryhmän tulokset ikäluokittain ilman nimiä.</p>
        ${tila.valmentaja ? `<p class="rivi"><a class="btn ensisij" href="#/kerrat">Syötä tuloksia</a><a class="btn" href="#/ryhma">Ryhmäanalyysi</a></p>` : `<p class="pieni">Valmentajat näkevät pelaajakohtaiset tulokset <a href="#/kirjaudu">kirjautumalla</a>.</p>`}
      </div>
      ${hero ? `<div>
        <div class="taulukko-kello">${muotoile(hero.nyt, "30m")}<span class="yks">s</span></div>
        <p>30 metrin mediaaniaika ${pvm(hero.nytPvm)}. Talvella ${kausi(hero.ennenPvm)} sama porukka juoksi ${muotoile(hero.ennen, "30m")} sekuntia.</p>
      </div>` : ""}
    </section>
    <div class="kpi-rivi">${kpiRuudut()}</div>

    <h2>Ikäluokat samassa iässä</h2>
    <div class="chipit" role="group" aria-label="Testi">${testit.map((t) => `<button class="chip" data-testi="${t}" aria-pressed="${t === valittu}">${esc(tila.testi[t]?.nimi || t)}</button>`).join("")}</div>
    <p class="pieni" id="selite"></p>
    <div class="paneeli"><div class="kaavio"><canvas id="k-ika" aria-label="Ikäluokkien tulokset iän mukaan"></canvas></div></div>
    <p class="vihje">Viiva kulkee ikäluokan läpi talvi talvelta. Piste on ikäluokan pelaajien kauden parhaiden tulosten mediaani; ikä on se, jonka pelaaja täyttää talven aikana (esim. talvella 2025–26 vuonna 2009 syntynyt on 17). Ontto piste = alle viisi pelaajaa, joten tulos on suuntaa-antava. Pelaajajoukko voi vaihdella talvesta toiseen.</p>
    <div class="taulu-wrap" style="margin-top:12px"><table id="ika-taulu"></table></div>

    <h2>Kehitys testikerroittain</h2>
    <div class="paneeli"><div class="kaavio matala"><canvas id="k-aika" aria-label="Mediaanitulos ikäluokittain ajan funktiona"></canvas></div></div>

    <h2>Testikerrat</h2>
    <div class="taulu-wrap"><table id="taulu"></table></div>
    <p class="vihje">Luvut lasketaan jokaisen pelaajan parhaasta hyväksytystä yrityksestä. Ikäluokka näytetään vain, jos testissä oli vähintään kolme pelaajaa. <a href="tietosuoja.html">Tietosuoja</a></p>`;

  $$(".chip[data-testi]", main).forEach((b) => (b.onclick = () => { valittu = b.dataset.testi; $$(".chip[data-testi]").forEach((x) => x.setAttribute("aria-pressed", x === b)); paivita(); }));
  paivita();
}

function heroLuku() {
  const r = data.filter((x) => x.testi === "30m" && x.tarkenne === "");
  if (!r.length) return null;
  const pvmt = [...new Set(r.map((x) => x.pvm))].sort();
  const painotettu = (p) => { const rr = r.filter((x) => x.pvm === p); const n = rr.reduce((s, x) => s + x.n, 0); return { n, arvo: rr.reduce((s, x) => s + x.mediaani * x.n, 0) / n }; };
  const viimeiset = pvmt.filter((p) => painotettu(p).n >= 8);
  if (viimeiset.length < 2) return null;
  const nytPvm = viimeiset.at(-1), ennenPvm = viimeiset[0];
  return { nyt: painotettu(nytPvm).arvo, nytPvm, ennen: painotettu(ennenPvm).arvo, ennenPvm };
}

function paivita() {
  const t = tila.testi[valittu];
  const r = data.filter((x) => x.testi === valittu && (x.tarkenne === "" || (valittu === "nok_30m")));
  $("#selite").textContent = `${t.nimi}, ${t.yksikko}. ${t.pienempi_parempi ? "Pienempi on parempi." : "Suurempi on parempi."}`;
  const vuodet = [...new Set(r.map((x) => x.syntymavuosi))].sort();
  const pvmt = [...new Set(r.map((x) => x.pvm))].sort();

  piirra($("#k-aika"), {
    type: "line",
    data: { labels: pvmt.map(pvmLyhyt), datasets: vuodet.map((v, i) => ({
      label: `${v} synt.`, spanGaps: true, borderColor: SARJAVARIT[i % 8], backgroundColor: SARJAVARIT[i % 8], tension: .25, pointRadius: 3,
      data: pvmt.map((p) => r.find((x) => x.pvm === p && x.syntymavuosi === v)?.mediaani ?? null),
    })) },
    options: { maintainAspectRatio: false, interaction: { mode: "nearest", intersect: false },
      scales: { y: { reverse: !!t.pienempi_parempi, title: { display: true, text: t.yksikko } } },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${muotoile(c.parsed.y, valittu)} ${t.yksikko}` } } } },
  });

  piirraIka(valittu);

  const rivit = [...r].sort((a, b) => b.pvm.localeCompare(a.pvm) || a.syntymavuosi - b.syntymavuosi);
  $("#taulu").innerHTML = `<thead><tr><th>Päivä</th><th>Ikäluokka</th><th class="n">Pelaajia</th><th class="n">Mediaani</th><th class="n">Keskiarvo</th><th class="n">Paras</th></tr></thead>
    <tbody>${rivit.map((x) => `<tr><td>${pvm(x.pvm)}${x.tarkenne ? ` <span class="merkki harmaa">${esc(x.tarkenne)}</span>` : ""}</td><td>${x.syntymavuosi}</td><td class="n">${x.n}</td><td class="n">${muotoile(x.mediaani, valittu)}</td><td class="n">${muotoile(x.keskiarvo, valittu)}</td><td class="n">${muotoile(x.paras, valittu)}</td></tr>`).join("")}</tbody>`;
}

function piirraIka(t) {
  const T = tila.testi[t];
  const r = ikadata.filter((x) => x.testi === t);
  const vuodet = [...new Set(r.map((x) => x.syntymavuosi))].sort();
  const iat = [...new Set(r.map((x) => x.ika))].sort((a, b) => a - b);
  const loyda = (v, ika) => r.find((x) => x.syntymavuosi === v && x.ika === ika);
  piirra($("#k-ika"), {
    type: "line",
    data: { labels: iat.map((i) => `${i} v`), datasets: vuodet.map((v, i) => {
      const c = SARJAVARIT[i % 8];
      return { label: `${v} syntyneet`, spanGaps: true, borderColor: c, backgroundColor: c, borderWidth: 3, tension: .25,
        pointRadius: iat.map((ika) => (loyda(v, ika) ? 6 : 0)), pointHoverRadius: 8,
        pointBackgroundColor: iat.map((ika) => (loyda(v, ika)?.n < 5 ? vari("--surface") : c)), pointBorderWidth: 2,
        data: iat.map((ika) => loyda(v, ika)?.mediaani ?? null) };
    }) },
    options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      scales: { x: { title: { display: true, text: "ikä talven aikana" }, grid: { display: false } }, y: { reverse: !!T.pienempi_parempi, title: { display: true, text: `${T.yksikko}${T.pienempi_parempi ? " (ylempänä nopeampi)" : ""}` } } },
      plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: {
        title: (c) => `${iat[c[0].dataIndex]}-vuotiaat`,
        label: (c) => { const x = loyda(vuodet[c.datasetIndex], iat[c.dataIndex]); return x ? `${x.syntymavuosi}: ${muotoile(x.mediaani, t)} ${T.yksikko} (talvi ${x.kausi}, ${x.n} pelaajaa, puolet välillä ${muotoile(x.q1, t)}–${muotoile(x.q3, t)})` : ""; } } } } },
  });
  // vertailutaulukko: rivit = ikä, sarakkeet = ikäluokat
  $("#ika-taulu").innerHTML = `<thead><tr><th>Ikä</th>${vuodet.map((v) => `<th class="n">${v} syntyneet</th>`).join("")}${vuodet.length >= 2 ? '<th class="n">Ikäluokkien ero</th>' : ""}</tr></thead>
    <tbody>${iat.map((ika) => {
      const solut = vuodet.map((v) => loyda(v, ika));
      const arvot = solut.filter(Boolean).map((x) => x.mediaani);
      const paras = arvot.length ? (T.pienempi_parempi ? Math.min(...arvot) : Math.max(...arvot)) : null;
      const huonoin = arvot.length ? (T.pienempi_parempi ? Math.max(...arvot) : Math.min(...arvot)) : null;
      return `<tr><td>${ika} v</td>${solut.map((x) => x ? `<td class="n"><span class="${arvot.length > 1 && x.mediaani === paras ? "pb" : ""}" style="font:600 18px var(--num)">${muotoile(x.mediaani, t)}</span> <span class="pieni">${x.kausi} · ${x.n}</span></td>` : '<td class="n tyhja">–</td>').join("")}
        ${vuodet.length >= 2 ? `<td class="n">${arvot.length > 1 ? muotoile(Math.abs(huonoin - paras), t) + " " + T.yksikko : ""}</td>` : ""}</tr>`;
    }).join("")}</tbody>`;
}

// Ryhmän mediaani testikerroittain (ikäluokkien mediaanit painotettuna pelaajamäärällä)
function ryhmanSarja(testi) {
  const r = data.filter((x) => x.testi === testi && x.tarkenne === "");
  const pvmt = [...new Set(r.map((x) => x.pvm))].sort();
  return pvmt.map((p) => { const rr = r.filter((x) => x.pvm === p); const n = rr.reduce((a, x) => a + x.n, 0); return { pvm: p, n, arvo: rr.reduce((a, x) => a + x.mediaani * x.n, 0) / n }; }).filter((x) => x.n >= 5);
}
function kpiRuudut() {
  const ruudut = ["30m", "10m", "lyonti", "heitto_vauhti"].map((t) => {
    const T = tila.testi[t], sarja = ryhmanSarja(t);
    if (sarja.length < 2) return "";
    const viim = sarja.at(-1), eka = sarja[0];
    const ero = viim.arvo - eka.arvo, parempi = T.pienempi_parempi ? ero < 0 : ero > 0;
    return `<div class="kpi"><div class="otsikko">${esc(T.nimi)} · ryhmän mediaani</div>
      <div class="arvo">${muotoile(viim.arvo, t)}<small>${T.yksikko}</small></div>
      <div class="pieni" style="text-align:right"><span class="${parempi ? "pb" : "huono"}" style="font:700 18px var(--num)">${muotoileMuutos(ero, t)}</span><br>vrt. ${kausi(eka.pvm)}</div>
      ${miniPylvaat(sarja.map((x) => x.arvo), T.pienempi_parempi)}
      <div class="ala">${pvm(viim.pvm)} · ${viim.n} pelaajaa</div></div>`;
  }).join("");
  const kerrat = tila.kerrat.length, kaudet = new Set(tila.kerrat.map((k) => kausi(k.pvm))).size;
  return ruudut + `<div class="kpi"><div class="otsikko">Testihistoria</div><div class="arvo">${kerrat}<small>testikertaa</small></div>${mittari(100, kaudet, "talvea", 66)}<div class="ala">${tila.testit.filter((x) => !x.johdettu).length} eri testiä</div></div>`;
}
