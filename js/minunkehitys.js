// Minun kehitykseni (14.11.2026): junioripelaajan kehityskaari testitulosten perusteella.
// Näyttää testikohtaiset kehityskaaviot, vertailun joukkueen keskiarvoon, tavoitteet ja
// vahvuudet/kehityskohteet. Data: tulokset- ja tavoitteet-taulut (Supabase).
import { sb, tila, nimi, lataaTulokset } from "./db.js";
import { $, $$, esc, muotoile, pvm, pvmLyhyt, paras, parannus, parhaatTulokset, juoksutYhteen, mediaani, keskiarvo, piirra, liukuvari, mittari, palkki } from "./util.js";
import { tavoiteTila } from "./views/oma.js";

const LUOKAT = [
  ["voima", "Lyönti- ja heittovoima", "heitto_paikalta,heitto_vauhti,lyonti"],
  ["nopeus", "Nopeus ja ketteryys", "30m,10m,ketteryysrata,30m_takaperin,nok_30m"],
  ["fysiikka", "Fysiikka", "vauhditon_pituus,tasatassut,kuntopallo_eteen_2kg,kuntopallo_taakse_2kg,cooper,punnerrus_30s,vatsat_30s"],
  ["lajitaito", "Lajitaito", "napy_1raja,napy_keskipieni,napy_2raja,kovat_koppi,kovat_pomppu,kovat_ilma"],
];
let S = { luokka: null };

export async function piirraKehitys(el, pelaaja) {
  if (!pelaaja) { el.innerHTML = ""; return; }
  const pid = pelaaja.id;
  const joukkueId = pelaaja.joukkue_id;

  // Hae tulokset ja tavoitteet
  const [raaka, tavRes] = await Promise.all([
    lataaTulokset(),
    sb.from("tavoitteet").select("*").eq("pelaaja_id", pid).order("luotu"),
  ]);
  const kaikki = parhaatTulokset(juoksutYhteen(raaka));
  const pidStr = String(pid);
  const omat = kaikki.filter((r) => r.pelaaja === pidStr && tila.testi[r.testi]);
  const tavRivit = tavRes.data || [];
  const testit = [...new Set(omat.map((x) => x.testi))].sort((a, b) => (tila.testi[a]?.jarjestys ?? 999) - (tila.testi[b]?.jarjestys ?? 999));

  if (!testit.length) { el.innerHTML = `<p class="tyhja">Ei vielä testituloksia.</p>`; return; }

  // Joukkuekaverit: samat testit
  const joukkue = tila.pelaajat.filter((p) => p.joukkue_id === joukkueId && p.aktiivinen && p.id !== pid);
  const joukkueIds = new Set(joukkue.map((p) => String(p.id)));
  const kaveritKaikki = kaikki.filter((r) => joukkueIds.has(r.pelaaja) && tila.testi[r.testi]);

  // Joukkueen parhaat tulokset pelaajittain per testi
  function joukkueParhaatPerTesti(testi) {
    const muut = kaveritKaikki.filter((r) => r.testi === testi);
    const byPelaaja = new Map();
    for (const r of muut) {
      const cur = byPelaaja.get(r.pelaaja);
      if (!cur || parannus(testi, r.arvo, cur) > 0) byPelaaja.set(r.pelaaja, r.arvo);
    }
    return [...byPelaaja.values()];
  }

  // Vahvuudet ja kehityskohteet: missä pelaaja on joukkueen kärjessä vs. häntäpäässä
  const vahvuudet = [], kehitys = [];
  for (const t of testit) {
    const T = tila.testi[t]; if (!T) continue;
    const omaPb = paras(t, omat.filter((x) => x.testi === t).map((x) => x.arvo));
    const kavArvot = joukkueParhaatPerTesti(t);
    if (kavArvot.length < 2) continue;
    const pp = T.pienempi_parempi;
    const kaikki = [...kavArvot, omaPb].filter((x) => x != null);
    const sorted = [...kaikki].sort((a, b) => pp ? a - b : b - a);
    const sija = sorted.indexOf(omaPb) + 1;
    const pct = kaikki.length > 1 ? Math.round(((kaikki.length - sija) / (kaikki.length - 1)) * 100) : 50;
    const item = { testi: t, nimi: T.nimi, omaPb, ka: keskiarvo(kavArvot), sija, n: kaikki.length, pct };
    if (pct >= 70) vahvuudet.push(item);
    else if (pct <= 30) kehitys.push(item);
  }
  vahvuudet.sort((a, b) => b.pct - a.pct);
  kehitys.sort((a, b) => a.pct - b.pct);

  // Luokat joissa on dataa
  const luokatDatalla = LUOKAT.filter(([, , tt]) => tt.split(",").some((t) => testit.includes(t)));
  if (!S.luokka || !luokatDatalla.some(([k]) => k === S.luokka)) S.luokka = luokatDatalla[0]?.[0] || "nopeus";

  el.innerHTML = `
    <h2 id="mk-otsikko">Minun kehitykseni</h2>
    <p class="pieni">Testitulosten kehityskaari, joukkuevertailu ja tavoitteet · ${esc(nimi(pelaaja))}</p>

    ${tavRivit.length ? `<section class="mk-osio" aria-label="Tavoitteet">
      <h3>Tavoitteet</h3>
      <div class="mk-tavoitteet">${tavRivit.map((g) => tavoiteKortti(g, omat)).join("")}</div>
    </section>` : ""}

    <section class="mk-osio" aria-label="Vahvuudet ja kehityskohteet">
      <h3>Vahvuudet ja kehityskohteet</h3>
      <p class="pieni">Sijoitus joukkueessa (paras tulos)</p>
      <div class="mk-vk-rivi">
        <div class="mk-vk">
          <h4 class="mk-vk-ots vahv">Vahvuudet</h4>
          ${vahvuudet.length ? vahvuudet.slice(0, 5).map((v) => vkRivi(v, true)).join("") : `<p class="pieni tyhja2">Ei selkeitä vahvuuksia vielä</p>`}
        </div>
        <div class="mk-vk">
          <h4 class="mk-vk-ots keh">Kehityskohteet</h4>
          ${kehitys.length ? kehitys.slice(0, 5).map((v) => vkRivi(v, false)).join("") : `<p class="pieni tyhja2">Ei selkeitä kehityskohteita</p>`}
        </div>
      </div>
    </section>

    <section class="mk-osio" aria-label="Kehityskaari">
      <h3>Kehityskaari testiluokittain</h3>
      <div class="mk-luokkavalitsin">${luokatDatalla.map(([k, n]) => `<button class="chip${k === S.luokka ? " valittu" : ""}" data-luokka="${k}">${esc(n)}</button>`).join("")}</div>
      <div id="mk-kaaviot"></div>
    </section>`;

  // Luokkavalitsin
  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-luokka]");
    if (!btn) return;
    S.luokka = btn.dataset.luokka;
    $$(".mk-luokkavalitsin .chip", el).forEach((b) => b.classList.toggle("valittu", b.dataset.luokka === S.luokka));
    piirraLuokanKaaviot($("#mk-kaaviot", el), omat, kaveritKaikki, joukkue);
  });

  piirraLuokanKaaviot($("#mk-kaaviot", el), omat, kaveritKaikki, joukkue);
}

function tavoiteKortti(g, omat) {
  const T = tila.testi[g.testi]; if (!T) return "";
  const { lahto, nyt, saavutettu, pct } = tavoiteTila(g, omat);
  const puuttuu = nyt != null && !saavutettu ? Math.abs(nyt - g.arvo) : null;
  return `<div class="mk-tav${saavutettu ? " saavutettu" : ""}">
    ${mittari(pct, saavutettu ? "✓" : `${Math.round(pct)}%`, "")}
    <div>
      <b>${esc(T.nimi)}</b>
      <div class="pieni">Tavoite: ${muotoile(g.arvo, g.testi)} ${esc(T.yksikko)}${g.takaraja ? ` · ${pvm(g.takaraja)} mennessä` : ""}</div>
      <div class="pieni">${lahto != null ? `Lähtö ${muotoile(lahto, g.testi)} → nyt ${muotoile(nyt, g.testi)}` : "Ei vielä tuloksia"}${puuttuu != null ? ` · puuttuu ${muotoile(puuttuu, g.testi)}` : ""}</div>
    </div>
  </div>`;
}

function vkRivi(v, vahvuus) {
  return `<div class="mk-vk-rivi2">
    <span class="mk-vk-nimi">${esc(v.nimi)}</span>
    <span class="mk-vk-sija">${v.sija}/${v.n}</span>
    ${palkki(v.pct)}
  </div>`;
}

function piirraLuokanKaaviot(kohde, omat, kaverit, joukkue) {
  const luokka = LUOKAT.find(([k]) => k === S.luokka);
  if (!luokka) { kohde.innerHTML = ""; return; }
  const testiKoodit = luokka[2].split(",").filter((t) => omat.some((r) => r.testi === t));
  if (!testiKoodit.length) { kohde.innerHTML = `<p class="tyhja">Ei tuloksia tässä luokassa.</p>`; return; }
  kohde.innerHTML = testiKoodit.map((t) => `<div class="mk-kaavio-wrap">
    <h4>${esc(tila.testi[t]?.nimi || t)} <small class="pieni">${esc(tila.testi[t]?.yksikko || "")}</small></h4>
    <canvas id="mk-c-${t}" height="220"></canvas>
    ${kaavioPohja(t, omat, kaverit, joukkue)}
  </div>`).join("");
  // Piirrä Chart.js -kaaviot
  for (const t of testiKoodit) piirraKaavio(t, omat, kaverit, joukkue);
}

function kaavioPohja(testi, omat, kaverit, joukkue) {
  const T = tila.testi[testi]; if (!T) return "";
  const rivit = omat.filter((r) => r.testi === testi).sort((a, b) => a.pvm.localeCompare(b.pvm));
  if (rivit.length < 2) return `<p class="pieni">Vain yksi tulos – kehityskäyrää ei voida piirtää.</p>`;
  const pb = paras(testi, rivit.map((r) => r.arvo));
  const viim = rivit.at(-1);
  const edel = rivit.at(-2);
  const muutos = edel ? parannus(testi, viim.arvo, edel.arvo) : null;
  const kavArvot = joukkueParhaatPerTestiHelper(testi, kaverit, joukkue);
  const ka = kavArvot.length ? keskiarvo(kavArvot) : null;
  return `<div class="mk-kaavio-kpi">
    <span class="kpi lukema pieni2"><span class="otsikko">Ennätys</span><span class="arvo">${muotoile(pb, testi)}</span></span>
    <span class="kpi lukema pieni2"><span class="otsikko">Viimeisin</span><span class="arvo">${muotoile(viim.arvo, testi)} <small>${pvmLyhyt(viim.pvm)}</small></span></span>
    ${muutos != null ? `<span class="kpi lukema pieni2"><span class="otsikko">Muutos</span><span class="arvo ${muutos > 0 ? "pb" : muutos < 0 ? "huono" : ""}">${muutosTeksti(muutos, testi)}</span></span>` : ""}
    ${ka != null ? `<span class="kpi lukema pieni2"><span class="otsikko">Joukkueen ka.</span><span class="arvo">${muotoile(ka, testi)}</span></span>` : ""}
  </div>`;
}

function joukkueParhaatPerTestiHelper(testi, kaverit, joukkue) {
  const muut = kaverit.filter((r) => r.testi === testi);
  const byPelaaja = new Map();
  for (const r of muut) {
    const cur = byPelaaja.get(r.pelaaja);
    if (!cur || parannus(testi, r.arvo, cur) > 0) byPelaaja.set(r.pelaaja, r.arvo);
  }
  return [...byPelaaja.values()];
}

function muutosTeksti(muutos, testi) {
  const pp = tila.testi[testi]?.pienempi_parempi;
  const merkki = muutos > 0 ? (pp ? "−" : "+") : (pp ? "+" : "−");
  return `${merkki}${Math.abs(muutos).toFixed(tila.testi[testi]?.yksikko === "s" ? 2 : 1).replace(".", ",")}`;
}

function piirraKaavio(testi, omat, kaverit, joukkue) {
  const canvas = document.getElementById(`mk-c-${testi}`); if (!canvas) return;
  const T = tila.testi[testi]; if (!T) return;
  const rivit = omat.filter((r) => r.testi === testi).sort((a, b) => a.pvm.localeCompare(b.pvm));
  // Parhaat per testikerta (päivä)
  const byPvm = new Map();
  for (const r of rivit) {
    const k = r.pvm;
    const cur = byPvm.get(k);
    if (!cur || parannus(testi, r.arvo, cur.arvo) > 0) byPvm.set(k, r);
  }
  const pisteet = [...byPvm.values()];
  if (pisteet.length < 1) return;

  const labels = pisteet.map((r) => pvmLyhyt(r.pvm));
  const data = pisteet.map((r) => +r.arvo);

  // Joukkueen keskiarvo viivana (koko joukkueen parhaat per pelaaja, viimeisin arvo)
  const kavArvot = joukkueParhaatPerTestiHelper(testi, kaverit, joukkue);
  const ka = kavArvot.length >= 2 ? keskiarvo(kavArvot) : null;

  const datasets = [{
    label: "Oma tulos",
    data,
    borderColor: "rgba(56,214,255,1)",
    backgroundColor: liukuvari(.25, 0),
    fill: true,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
  }];
  if (ka != null) {
    datasets.push({
      label: "Joukkueen ka.",
      data: new Array(data.length).fill(ka),
      borderColor: "rgba(245,168,0,.5)",
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
    });
  }

  piirra(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { reverse: !!T.pienempi_parempi, grid: { color: "rgba(245,168,0,.07)" } },
        x: { grid: { display: false } },
      },
      plugins: {
        legend: { display: datasets.length > 1, labels: { boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${muotoile(ctx.raw, testi)} ${T.yksikko}`,
          },
        },
      },
    },
  });
}
