// Miesten Superpesis: edustuksen tutkatestit (heitot, lyönnit mailoittain) ja lyöntitestit.
// Ryhmä "Miehet Superpesis" ei näy julkisissa tilastoissa (joukkueet.julkinen = false).
import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, pvmLyhyt, keskiarvo, piirra, vari, pelaajaLinkki } from "../util.js";

const RYHMA = "Miehet Superpesis";
const LT = ["lt_napyt", "lt_1raja_pomppu", "lt_2raja_pomppu", "lt_keskipomppu", "lt_kumura", "lt_viistari", "lt_koppi"];
const LYH = { lt_napyt: "Näpyt", lt_1raja_pomppu: "1-raja pomppu", lt_2raja_pomppu: "2-raja pomppu", lt_keskipomppu: "Keskipomppu", lt_kumura: "Kumura", lt_viistari: "Viistäri/pystäri", lt_koppi: "Koppi",
  heitto_paikalta: "Heitto paikaltaan", heitto_vauhti: "Heitto vauhdista", lyonti: "Lyönti" };
const TUTKA = ["heitto_paikalta", "heitto_vauhti", "lyonti"];
const MAILAT = ["oma", "Optima", "Ultima"];
let valLt = "lt_napyt", valTutka = "lyonti", korostus = new Set();

const maila = (r) => (r.huomio || "").match(/^Maila:\s*(.+)$/i)?.[1] || "";
const yks = (t) => tila.testi[t]?.yksikko || "";

export async function nayta(main) {
  const J = tila.joukkueet.find((j) => j.nimi === RYHMA);
  if (!J) { main.innerHTML = `<h1>Miesten Superpesis</h1><p class="ingressi">Ryhmää “${RYHMA}” ei löytynyt.</p>`; return; }
  const kaikki = await lataaTulokset();
  const kerrat = tila.kerrat.filter((k) => k.joukkue_id === J.id).sort((a, b) => a.pvm.localeCompare(b.pvm));
  const kid = new Set(kerrat.map((k) => k.id));
  const rivit = kaikki.filter((r) => kid.has(r.testikerta_id) && r.hyvaksytty);
  const pelaajat = tila.pelaajat.filter((p) => p.joukkue_id === J.id || rivit.some((r) => r.pelaaja_id === p.id))
    .sort((a, b) => nimi(a).localeCompare(nimi(b), "fi"));
  const kpvm = Object.fromEntries(kerrat.map((k) => [k.id, k.pvm]));
  const ltKerrat = kerrat.filter((k) => rivit.some((r) => r.testikerta_id === k.id && r.testi.startsWith("lt_")));
  const tutkaKerrat = kerrat.filter((k) => rivit.some((r) => r.testikerta_id === k.id && TUTKA.includes(r.testi)));

  // pelaajan paras tulos kerralla (lyönnissä valinnaisesti tietyllä mailalla)
  const arvo = (p, k, t, m) => { const v = rivit.filter((r) => r.pelaaja_id === p && r.testikerta_id === k && r.testi === t && (!m || maila(r) === m)).map((r) => r.arvo); return v.length ? Math.max(...v) : null; };
  const parasRivi = (t) => rivit.filter((r) => r.testi === t).sort((a, b) => b.arvo - a.arvo)[0];

  const testattu = new Set(rivit.map((r) => r.pelaaja_id)).size;
  const kovinLyonti = parasRivi("lyonti"), kovinHeitto = parasRivi("heitto_vauhti");
  const napyKa = ltKerrat.map((k) => keskiarvo(pelaajat.map((p) => arvo(p.id, k.id, "lt_napyt")).filter((x) => x != null)));
  const kpiRuutu = (otsikko, arvoHtml, ala) => `<div class="kpi"><div class="otsikko">${otsikko}</div><div class="arvo">${arvoHtml}</div><div class="ala">${ala}</div></div>`;

  main.innerHTML = `
    <h1>Miesten Superpesis</h1>
    <p class="ingressi">Edustuksen talvitestit: tutkatestit (heitot ja lyönnit mailoittain) sekä lyöntitestit. Näkyy vain valmentajille, ei julkisissa tilastoissa.</p>
    <div class="kpi-rivi">
      ${kpiRuutu("Testattuja pelaajia", `${testattu}`, `${kerrat.length} testikertaa · ${rivit.length} tulosta`)}
      ${kovinLyonti ? kpiRuutu("Kovin lyönti", `${muotoile(kovinLyonti.arvo, "lyonti")}<small>km/h</small>`, `${esc(nimi(tila.pelaaja[kovinLyonti.pelaaja_id]))} · ${esc(maila(kovinLyonti) || "maila ?")} · ${pvmLyhyt(kpvm[kovinLyonti.testikerta_id])}`) : ""}
      ${kovinHeitto ? kpiRuutu("Kovin heitto vauhdista", `${muotoile(kovinHeitto.arvo, "heitto_vauhti")}<small>km/h</small>`, `${esc(nimi(tila.pelaaja[kovinHeitto.pelaaja_id]))} · ${pvmLyhyt(kpvm[kovinHeitto.testikerta_id])}`) : ""}
      ${napyKa.length >= 2 ? kpiRuutu("Näpyt, joukkueen keskiarvo", `${napyKa.at(-1).toFixed(1).replace(".", ",")}<small>pist.</small>`, `${pvmLyhyt(ltKerrat.at(-1).pvm)} · alussa ${napyKa[0].toFixed(1).replace(".", ",")} (${pvmLyhyt(ltKerrat[0].pvm)})`) : ""}
    </div>

    <h2>Tutkatestit</h2>
    <div class="chipit" style="margin-bottom:10px">${TUTKA.map((t) => `<button class="chip" data-tutka="${t}" aria-pressed="${t === valTutka}">${LYH[t]}</button>`).join("")}</div>
    <div class="paneeli"><div class="kaavio" style="height:${Math.max(300, pelaajat.length * 26 + 60)}px"><canvas id="k-tutka" aria-label="Tutkatulokset pelaajittain"></canvas></div></div>
    <p class="vihje">Pelaajan paras tulos kullakin testikerralla. Lyönnissä paras mailasta riippumatta; mailakohtaiset tulokset alla.</p>
    <div class="taulu-wrap" style="margin-top:12px"><table id="t-tutka"></table></div>

    <h3>Lyönnit mailoittain</h3>
    <div class="taulu-wrap"><table id="t-mailat"></table></div>
    <p class="vihje">Tyhjä solu: mailalla ei lyöty kyseisellä kerralla. Korostettu on pelaajan kovin lyönti kerralla.</p>

    <h2>Lyöntitestit</h2>
    <div class="chipit" style="margin-bottom:10px">${LT.map((t) => `<button class="chip" data-lt="${t}" aria-pressed="${t === valLt}">${LYH[t]}</button>`).join("")}</div>
    <div class="paneeli"><div class="kaavio"><canvas id="k-lt" aria-label="Lyöntitestin kehitys"></canvas></div></div>
    <p class="vihje">Ohut viiva on pelaaja, katkoviiva joukkueen keskiarvo. Valitse pelaajia taulukosta korostaaksesi heidät.</p>
    <div class="taulu-wrap" style="margin-top:12px"><table id="t-lt"></table></div>

    <h3>Lyöntiprofiili, talven keskiarvot</h3>
    <div class="taulu-wrap"><table id="t-profiili"></table></div>
    <p class="vihje">Pelaajan keskiarvo kaikilta lyöntitestikerroilta. Mitä kirkkaampi solu, sitä parempi tulos joukkueen sisällä. Pelaajat tekevät joko 1-raja- tai keskipomppu- ja joko kumura- tai viistäritestin, joten osa soluista jää tyhjäksi.</p>`;

  const fmt = (v, t) => (v == null ? "" : muotoile(v, t));
  const muutosSolu = (a, b, t) => { if (a == null || b == null) return `<td class="n"></td>`; const d = a - b; return `<td class="n ${d > 0 ? "pb" : d < 0 ? "huono" : ""}">${muotoileMuutos(d, t)}</td>`; };

  // ---- tutka: kaavio + taulukko
  function tutka() {
    const t = valTutka, eka = tutkaKerrat[0], vika = tutkaKerrat.at(-1);
    const mukana = pelaajat.filter((p) => tutkaKerrat.some((k) => arvo(p.id, k.id, t) != null))
      .sort((a, b) => (arvo(b.id, vika.id, t) ?? arvo(b.id, eka.id, t) ?? 0) - (arvo(a.id, vika.id, t) ?? arvo(a.id, eka.id, t) ?? 0));
    const varit = [vari("--ink-3"), vari("--cyan")];
    piirra($("#k-tutka"), { type: "bar",
      data: { labels: mukana.map(nimi), datasets: tutkaKerrat.map((k, i) => ({ label: pvm(k.pvm), data: mukana.map((p) => arvo(p.id, k.id, t)), backgroundColor: i === tutkaKerrat.length - 1 ? "rgba(56,214,255,.75)" : "rgba(111,132,163,.45)", borderColor: varit[i === tutkaKerrat.length - 1 ? 1 : 0], borderWidth: 1, borderRadius: 3, barPercentage: .9, categoryPercentage: .8 })) },
      options: { indexAxis: "y", maintainAspectRatio: false,
        scales: { x: { min: t === "lyonti" ? 140 : 100, title: { display: true, text: "km/h" } }, y: { ticks: { autoSkip: false } } },
        plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x} km/h` } } } } });

    $("#t-tutka").innerHTML = `<thead><tr><th>Pelaaja</th>${TUTKA.map((x) => `<th class="n" colspan="${tutkaKerrat.length + 1}">${LYH[x]}</th>`).join("")}</tr>
      <tr><th></th>${TUTKA.map(() => tutkaKerrat.map((k) => `<th class="n">${pvmLyhyt(k.pvm)}</th>`).join("") + `<th class="n">Muutos</th>`).join("")}</tr></thead>
      <tbody>${pelaajat.filter((p) => tutkaKerrat.some((k) => TUTKA.some((x) => arvo(p.id, k.id, x) != null))).map((p) => `<tr><td>${pelaajaLinkki(p)}</td>${TUTKA.map((x) => {
        const v = tutkaKerrat.map((k) => arvo(p.id, k.id, x));
        return v.map((y) => `<td class="n">${fmt(y, x)}</td>`).join("") + muutosSolu(v.at(-1), v[0], x);
      }).join("")}</tr>`).join("")}</tbody>`;
  }

  // ---- lyönnit mailoittain
  $("#t-mailat").innerHTML = `<thead><tr><th>Pelaaja</th>${MAILAT.map((m) => `<th class="n" colspan="${tutkaKerrat.length}">${m === "oma" ? "Oma maila" : m}</th>`).join("")}</tr>
    <tr><th></th>${MAILAT.map(() => tutkaKerrat.map((k) => `<th class="n">${pvmLyhyt(k.pvm)}</th>`).join("")).join("")}</tr></thead>
    <tbody>${pelaajat.filter((p) => tutkaKerrat.some((k) => arvo(p.id, k.id, "lyonti") != null)).map((p) => `<tr><td>${pelaajaLinkki(p)}</td>${MAILAT.map((m) => tutkaKerrat.map((k) => {
      const v = arvo(p.id, k.id, "lyonti", m), max = arvo(p.id, k.id, "lyonti");
      return `<td class="n${v != null && v === max ? " pb" : ""}">${fmt(v, "lyonti")}</td>`; }).join("")).join("")}</tr>`).join("")}</tbody>`;

  // ---- lyöntitestit: kaavio + taulukko
  function lyontitesti() {
    const t = valLt;
    const mukana = pelaajat.filter((p) => ltKerrat.some((k) => arvo(p.id, k.id, t) != null));
    const ka = ltKerrat.map((k) => keskiarvo(mukana.map((p) => arvo(p.id, k.id, t)).filter((x) => x != null)));
    const sarjat = ["#38D6FF", "#FF3B4E", "#2EE59D", "#FFC93C", "#A78BFA", "#2E7BFF", "#F472B6"];
    const ds = mukana.map((p) => { const kor = korostus.has(p.id), c = kor ? sarjat[[...korostus].indexOf(p.id) % sarjat.length] : "rgba(111,132,163,.45)";
      return { label: nimi(p), data: ltKerrat.map((k) => arvo(p.id, k.id, t)), borderColor: c, backgroundColor: c, borderWidth: kor ? 3 : 1, pointRadius: kor ? 4 : 2, spanGaps: true, order: kor ? 0 : 2 }; });
    ds.push({ label: "Joukkueen keskiarvo", data: ka, borderColor: vari("--ink"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 1 });
    piirra($("#k-lt"), { type: "line", data: { labels: ltKerrat.map((k) => pvmLyhyt(k.pvm)), datasets: ds },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false },
        tooltip: { filter: (c) => !korostus.size || korostus.has(mukana[c.datasetIndex]?.id) || c.datasetIndex === mukana.length,
          callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? "–" : c.datasetIndex === mukana.length ? c.parsed.y.toFixed(1).replace(".", ",") : c.parsed.y}` } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: yks(t) } } } } });

    const jarj = [...mukana].sort((a, b) => (keskiarvo(ltKerrat.map((k) => arvo(b.id, k.id, t)).filter((x) => x != null)) ?? 0) - (keskiarvo(ltKerrat.map((k) => arvo(a.id, k.id, t)).filter((x) => x != null)) ?? 0));
    $("#t-lt").innerHTML = `<thead><tr><th></th><th>Pelaaja</th>${ltKerrat.map((k) => `<th class="n">${pvmLyhyt(k.pvm)}</th>`).join("")}<th class="n">Ka</th><th class="n">Ensimmäinen → viimeisin</th></tr></thead>
      <tbody>${jarj.map((p) => { const v = ltKerrat.map((k) => arvo(p.id, k.id, t)), ok = v.filter((x) => x != null);
        return `<tr><td><input type="checkbox" data-kor="${p.id}" ${korostus.has(p.id) ? "checked" : ""} aria-label="Korosta ${esc(nimi(p))}"></td><td>${pelaajaLinkki(p)}</td>
          ${v.map((x) => `<td class="n">${fmt(x, t)}</td>`).join("")}<td class="n"><b>${ok.length ? keskiarvo(ok).toFixed(1).replace(".", ",") : ""}</b></td>${ok.length >= 2 ? muutosSolu(ok.at(-1), ok[0], t) : `<td class="n"></td>`}</tr>`; }).join("")}
        <tr><td></td><td><b>Joukkueen keskiarvo</b></td>${ka.map((x) => `<td class="n"><b>${x == null ? "" : x.toFixed(1).replace(".", ",")}</b></td>`).join("")}<td></td><td></td></tr></tbody>`;
    $$("[data-kor]").forEach((c) => (c.onchange = () => { c.checked ? korostus.add(c.dataset.kor) : korostus.delete(c.dataset.kor); lyontitesti(); }));
  }

  // ---- lyöntiprofiili (lämpökartta)
  const profKa = (p, t) => { const v = ltKerrat.map((k) => arvo(p, k.id, t)).filter((x) => x != null); return v.length ? keskiarvo(v) : null; };
  const rajat = Object.fromEntries(LT.map((t) => { const v = pelaajat.map((p) => profKa(p.id, t)).filter((x) => x != null); return [t, [Math.min(...v), Math.max(...v)]]; }));
  $("#t-profiili").innerHTML = `<thead><tr><th>Pelaaja</th>${LT.map((t) => `<th class="n">${LYH[t]}</th>`).join("")}<th class="n">Kertoja</th></tr></thead>
    <tbody>${pelaajat.filter((p) => LT.some((t) => profKa(p.id, t) != null)).map((p) => `<tr><td>${pelaajaLinkki(p)}</td>${LT.map((t) => {
      const v = profKa(p.id, t); if (v == null) return `<td class="n"></td>`;
      const [lo, hi] = rajat[t], s = hi > lo ? (v - lo) / (hi - lo) : .5;
      return `<td class="n" style="background:rgba(56,214,255,${(.06 + .5 * s).toFixed(2)})">${v.toFixed(1).replace(".", ",")}</td>`; }).join("")}
      <td class="n">${new Set(rivit.filter((r) => r.pelaaja_id === p.id && r.testi.startsWith("lt_")).map((r) => r.testikerta_id)).size}</td></tr>`).join("")}</tbody>`;

  $$("[data-tutka]").forEach((b) => (b.onclick = () => { valTutka = b.dataset.tutka; $$("[data-tutka]").forEach((x) => x.setAttribute("aria-pressed", x === b)); tutka(); }));
  $$("[data-lt]").forEach((b) => (b.onclick = () => { valLt = b.dataset.lt; $$("[data-lt]").forEach((x) => x.setAttribute("aria-pressed", x === b)); lyontitesti(); }));
  if (tutkaKerrat.length) tutka();
  if (ltKerrat.length) lyontitesti();
}
