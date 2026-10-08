import { sb, tila } from "../db.js";
import { $, $$, esc, muotoile, pvm, pvmLyhyt, kausi, piirra, SARJAVARIT, vari } from "../util.js";

const PAATESTIT = ["30m", "10m", "heitto_paikalta", "heitto_vauhti", "lyonti", "nok_30m", "kuntopallo_taakse_2kg", "napy_1raja"];
let data = [];
let valittu = "30m";

export async function nayta(main) {
  const { data: d, error } = await sb.rpc("julkinen_yhteenveto");
  if (error) throw error;
  data = d.map((r) => ({ ...r, mediaani: +r.mediaani, keskiarvo: +r.keskiarvo, paras: +r.paras, n: +r.n }));

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

    <h2>Ikäluokkien kehitys</h2>
    <div class="chipit" role="group" aria-label="Testi">${testit.map((t) => `<button class="chip" data-testi="${t}" aria-pressed="${t === valittu}">${esc(tila.testi[t]?.nimi || t)}</button>`).join("")}</div>
    <p class="pieni" id="selite"></p>
    <div class="paneeli"><div class="kaavio"><canvas id="k-aika" aria-label="Mediaanitulos ikäluokittain ajan funktiona"></canvas></div></div>

    <h2>Tulos iän mukaan</h2>
    <p class="pieni">Jokainen piste on yhden ikäluokan mediaani yhdellä testikerralla. Ikä = testivuosi − syntymävuosi.</p>
    <div class="paneeli"><div class="kaavio matala"><canvas id="k-ika" aria-label="Mediaanitulos iän mukaan"></canvas></div></div>

    <h2>Testikerrat</h2>
    <div class="taulu-wrap"><table id="taulu"></table></div>
    <p class="vihje">Luvut lasketaan jokaisen pelaajan parhaasta hyväksytystä yrityksestä. Ikäluokka näytetään vain, jos testissä oli vähintään kolme pelaajaa.</p>`;

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

  piirra($("#k-ika"), {
    type: "scatter",
    data: { datasets: vuodet.map((v, i) => ({
      label: `${v} synt.`, borderColor: SARJAVARIT[i % 8], backgroundColor: SARJAVARIT[i % 8] + "CC", pointRadius: 4,
      data: r.filter((x) => x.syntymavuosi === v).map((x) => ({ x: +x.pvm.slice(0, 4) - v + (+x.pvm.slice(5, 7) - 1) / 12, y: x.mediaani })),
    })) },
    options: { maintainAspectRatio: false,
      scales: { x: { title: { display: true, text: "ikä (v)" }, ticks: { stepSize: 1 } }, y: { reverse: !!t.pienempi_parempi, title: { display: true, text: t.yksikko } } },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}, ${c.parsed.x.toFixed(1)} v: ${muotoile(c.parsed.y, valittu)}` } } } },
  });

  const rivit = [...r].sort((a, b) => b.pvm.localeCompare(a.pvm) || a.syntymavuosi - b.syntymavuosi);
  $("#taulu").innerHTML = `<thead><tr><th>Päivä</th><th>Ikäluokka</th><th class="n">Pelaajia</th><th class="n">Mediaani</th><th class="n">Keskiarvo</th><th class="n">Paras</th></tr></thead>
    <tbody>${rivit.map((x) => `<tr><td>${pvm(x.pvm)}${x.tarkenne ? ` <span class="merkki harmaa">${esc(x.tarkenne)}</span>` : ""}</td><td>${x.syntymavuosi}</td><td class="n">${x.n}</td><td class="n">${muotoile(x.mediaani, valittu)}</td><td class="n">${muotoile(x.keskiarvo, valittu)}</td><td class="n">${muotoile(x.paras, valittu)}</td></tr>`).join("")}</tbody>`;
}
