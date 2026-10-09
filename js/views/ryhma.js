// Ryhmäanalyysi: kausien parhaat, kehitys kausi kaudelta ja ikävuosien ennätykset.
import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, kausi, paras, parannus, parhaatTulokset, pelaajaLinkki, mediaani, piirra, vari, SARJAVARIT } from "../util.js";

const TESTIT = ["30m", "10m", "lentava20", "nok_30m", "heitto_paikalta", "heitto_vauhti", "lyonti", "kuntopallo_taakse_2kg", "kuntopallo_eteen_2kg", "rinnalleveto_kg", "leuat_toistot", "tasatassut"];
let asetus = { testi: "30m", vuosi: "", joukkue: null, vainNykyiset: true, korostus: new Set() };

export async function nayta(main) {
  const kaikki = parhaatTulokset(await lataaTulokset());
  const testit = TESTIT.filter((t) => kaikki.some((x) => x.testi === t));
  if (asetus.joukkue == null) asetus.joukkue = String(tila.joukkueet.find((j) => j.julkinen !== false)?.id ?? "");
  const vuodet = [...new Set(tila.pelaajat.filter((p) => !asetus.joukkue || String(p.joukkue_id) === asetus.joukkue).map((p) => p.syntymavuosi).filter(Boolean))].sort();

  main.innerHTML = `
    <h1>Ryhmäanalyysi</h1>
    <p class="ingressi">Kauden paras tulos jokaiselta pelaajalta ja muutos edelliseen talveen. Valitse pelaajia taulukosta korostaaksesi heidät kaaviossa.</p>
    <div class="rivi" style="margin-bottom:14px">
      <select id="testi">${testit.map((t) => `<option value="${t}">${esc(tila.testi[t].nimi)}</option>`).join("")}</select>
      <select id="joukkue"><option value="">Kaikki ryhmät</option>${tila.joukkueet.map((j) => `<option value="${j.id}">${esc(j.nimi)}</option>`).join("")}</select>
      <select id="vuosi"><option value="">Kaikki ikäluokat</option>${vuodet.map((v) => `<option>${v}</option>`).join("")}</select>
      <label class="chip"><input type="checkbox" id="nyk" ${asetus.vainNykyiset ? "checked" : ""}>Vain nykyiset pelaajat</label>
    </div>
    <div class="paneeli"><div class="kaavio"><canvas id="kaudet"></canvas></div></div>
    <h2>Kauden parhaat</h2>
    <div class="taulu-wrap"><table id="kausitaulu"></table></div>
    <h2>Ennätykset ikävuosittain</h2>
    <p class="pieni">Paras tulos sinä vuonna, kun pelaaja täytti kyseisen iän. Viisi parasta per ikä.</p>
    <div class="ruudukko" id="ikaennatykset"></div>`;
  $("#testi").value = testit.includes(asetus.testi) ? asetus.testi : testit[0];
  $("#vuosi").value = asetus.vuosi;
  $("#joukkue").value = asetus.joukkue;
  $("#joukkue").onchange = (e) => { asetus.joukkue = e.target.value; asetus.vuosi = ""; nayta(main); };
  $("#testi").onchange = (e) => { asetus.testi = e.target.value; piirraKaikki(); };
  $("#vuosi").onchange = (e) => { asetus.vuosi = e.target.value; piirraKaikki(); };
  $("#nyk").onchange = (e) => { asetus.vainNykyiset = e.target.checked; piirraKaikki(); };

  function piirraKaikki() {
    const t = $("#testi").value, T = tila.testi[t];
    asetus.testi = t;
    const pelaajat = tila.pelaajat.filter((p) => (!asetus.joukkue || String(p.joukkue_id) === asetus.joukkue) && (!asetus.vuosi || String(p.syntymavuosi) === asetus.vuosi) && (!asetus.vainNykyiset || p.aktiivinen));
    const pid = new Set(pelaajat.map((p) => p.id));
    const rivit = kaikki.filter((x) => x.testi === t && pid.has(x.pelaaja));
    const kaudet = [...new Set(rivit.map((x) => kausi(x.pvm)))].sort();
    const kp = (p, ka) => paras(t, rivit.filter((x) => x.pelaaja === p && kausi(x.pvm) === ka).map((x) => x.arvo));
    const mukana = pelaajat.filter((p) => rivit.some((x) => x.pelaaja === p.id));

    // kaavio
    const datasets = mukana.map((p, i) => {
      const kor = asetus.korostus.has(p.id);
      const c = kor ? SARJAVARIT[[...asetus.korostus].indexOf(p.id) % 8] : vari("--line");
      return { label: nimi(p), data: kaudet.map((ka) => kp(p.id, ka)), borderColor: c, backgroundColor: c, borderWidth: kor ? 3 : 1, pointRadius: kor ? 4 : 2, spanGaps: true, order: kor ? 0 : 2 };
    });
    datasets.push({ label: "Mediaani", data: kaudet.map((ka) => mediaani(mukana.map((p) => kp(p.id, ka)).filter((x) => x != null))), borderColor: vari("--ink"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 1 });
    piirra($("#kaudet"), { type: "line", data: { labels: kaudet, datasets },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { filter: (c) => asetus.korostus.size === 0 || asetus.korostus.has(mukana[c.datasetIndex]?.id) || c.dataset.label === "Mediaani", callbacks: { label: (c) => `${c.dataset.label}: ${muotoile(c.parsed.y, t)}` } } },
        scales: { y: { reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko } } } } });

    // taulukko
    const viim = kaudet.at(-1), edel = kaudet.at(-2);
    const jarj = [...mukana].sort((a, b) => { const x = kp(a.id, viim), y = kp(b.id, viim); if (x == null) return 1; if (y == null) return -1; return T.pienempi_parempi ? x - y : y - x; });
    $("#kausitaulu").innerHTML = `<thead><tr><th></th><th>Pelaaja</th><th class="n">Synt.</th>${kaudet.map((k) => `<th class="n">${k}</th>`).join("")}<th class="n">Muutos</th></tr></thead>
      <tbody>${jarj.map((p) => { const a = kp(p.id, viim), b = kp(p.id, edel); const m = parannus(t, a, b);
        return `<tr><td><input type="checkbox" data-kor="${p.id}" ${asetus.korostus.has(p.id) ? "checked" : ""} aria-label="Korosta ${esc(nimi(p))}"></td><td>${pelaajaLinkki(p)}</td><td class="n">${p.syntymavuosi || ""}</td>
          ${kaudet.map((k) => { const v = kp(p.id, k); return `<td class="n">${muotoile(v, t)}</td>`; }).join("")}
          <td class="n ${m > 0 ? "pb" : m < 0 ? "huono" : ""}">${m != null ? muotoileMuutos(a - b, t) : ""}</td></tr>`; }).join("")}</tbody>`;
    $$("[data-kor]").forEach((c) => (c.onchange = () => { c.checked ? asetus.korostus.add(c.dataset.kor) : asetus.korostus.delete(c.dataset.kor); piirraKaikki(); }));

    // ikävuosien ennätykset (kaikki pelaajat, myös historialliset)
    const iat = new Map();
    for (const x of kaikki.filter((x) => x.testi === t)) {
      const p = tila.pelaaja[x.pelaaja];
      if (!p?.syntymavuosi) continue;
      const ika = +x.pvm.slice(0, 4) - p.syntymavuosi;
      const m = iat.get(ika) || new Map();
      if (!m.has(p.id) || parannus(t, x.arvo, m.get(p.id).arvo) > 0) m.set(p.id, x);
      iat.set(ika, m);
    }
    $("#ikaennatykset").innerHTML = [...iat.keys()].sort((a, b) => a - b).map((ika) => {
      const top = [...iat.get(ika).values()].sort((a, b) => (T.pienempi_parempi ? a.arvo - b.arvo : b.arvo - a.arvo)).slice(0, 5);
      return `<div class="paneeli"><h3 style="margin-top:0">${ika}-vuotiaat</h3><ol style="margin:0;padding-left:20px">${top.map((x) => `<li><span class="num" style="font-size:18px;font-weight:700">${muotoile(x.arvo, t)}</span> ${esc(nimi(tila.pelaaja[x.pelaaja]))} <span class="pieni">${x.pvm.slice(0, 4)}</span></li>`).join("")}</ol></div>`;
    }).join("");
  }
  piirraKaikki();
}
