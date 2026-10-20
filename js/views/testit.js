// Testit: yksi näkymä edustukselle (Superpesis) ja junioreille. Testit luokiteltu
// luokka → alaluokka (testit.luokka / testit.alaluokka). Osoite #/testit/<ryhmä>/<luokka>/<testi>.
import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, pvmLyhyt, kausi, paras, parannus, parhaatTulokset, juoksutYhteen, pelaajaLinkki, mediaani, keskiarvo, piirra, vari, SARJAVARIT, miniPylvaat } from "../util.js";

export const LUOKAT = [
  ["fysiikka", "Fysiikka", "Räjähtävä voima, maksimivoima, lihaskestävyys ja kestävyys"],
  ["voima", "Lyönti- ja heittovoima", "Tutkamittaukset: heitot ja lyönnit"],
  ["nopeus", "Nopeus", "Pikanopeus, ketteryys ja nopeuskestävyys"],
  ["lajitaito", "Lajitaito", "Lyöntitaito: näpyt, lyöntitestit ja kovat lyönnit"],
];
export const LUOKKANIMI = Object.fromEntries(LUOKAT.map(([k, n]) => [k, n]));
const ALAJARJ = ["Räjähtävä voima", "Maksimivoima", "Lihaskestävyys", "Kestävyys", "Lyöntivoima", "Heittovoima", "Pikanopeus", "Ketteryys", "Nopeuskestävyys", "Lyöntitaito", "Kiinniotto"];
const RYHMAT = [["superpesis", "Superpesis", "Edustus"], ["juniorit", "Juniorit", "Ikäluokittain"]];
const LT = ["lt_napyt", "lt_1raja_pomppu", "lt_2raja_pomppu", "lt_keskipomppu", "lt_kumura", "lt_viistari", "lt_koppi"];
const MAILAT = ["oma", "Optima", "Ultima"];
const maila = (r) => (r.huomio || "").match(/^Maila:\s*(.+)$/i)?.[1] || "";
const kevat = (s) => +s.slice(0, 4) + (+s.slice(5, 7) >= 7 ? 1 : 0);
const tnimi = (T) => T.nimi.replace(/^Edustuksen lyöntitesti: /, "Lyöntitesti: ");
const desi = (x) => (x == null ? "" : x.toFixed(1).replace(".", ","));

let S = { ryhma: "superpesis", luokka: "voima", testi: null, ikaluokka: "", nykyiset: true, korostus: new Set() };
const muistetut = {}; // ryhmä|luokka -> viimeksi valittu testi

export async function nayta(main, ryhma, luokka, testi) {
  if (RYHMAT.some(([k]) => k === ryhma)) S.ryhma = ryhma;
  if (LUOKKANIMI[luokka]) S.luokka = luokka;
  S.testi = testi || null;

  const kaikki = juoksutYhteen(await lataaTulokset());
  const spJ = new Set(tila.joukkueet.filter((j) => /superpesis/i.test(j.nimi)).map((j) => j.id));
  const onSp = (kertaId) => spJ.has(tila.kerta[kertaId]?.joukkue_id);
  const raaka = { superpesis: kaikki.filter((r) => r.hyvaksytty && onSp(r.testikerta_id)), juniorit: kaikki.filter((r) => r.hyvaksytty && tila.kerta[r.testikerta_id] && !onSp(r.testikerta_id)) };

  // Parhaat tulokset kerralla. Juoksujen piikkiajat on yhdistetty muihin (juoksutYhteen); muille testeille tarkenne: tyhjä, tai jos sitä ei ole, yleisin.
  const data = {};
  for (const [g, rr] of Object.entries(raaka)) {
    const tark = new Map();
    rr.forEach((r) => { const m = tark.get(r.testi) || new Map(); m.set(r.tarkenne, (m.get(r.tarkenne) || 0) + 1); tark.set(r.testi, m); });
    const valinta = {};
    for (const [t, m] of tark) valinta[t] = m.has("") ? "" : [...m].sort((a, b) => b[1] - a[1])[0][0];
    if (valinta["30m"] === "" && valinta["10m"] === "") valinta.lentava20 = "";
    const tarkenteet = new Set(Object.values(valinta));
    const parhaat = [...tarkenteet].flatMap((tk) => parhaatTulokset(rr, { tarkenne: tk }).map((x) => ({ ...x, tarkenne: tk })))
      .filter((x) => valinta[x.testi] === x.tarkenne && tila.pelaaja[x.pelaaja]);
    data[g] = { raaka: rr, parhaat, valinta };
  }

  const testitLuokassa = (l) => tila.testit.filter((t) => t.luokka === l)
    .sort((a, b) => ALAJARJ.indexOf(a.alaluokka) - ALAJARJ.indexOf(b.alaluokka) || a.jarjestys - b.jarjestys);
  const onDataa = (g, t) => data[g].parhaat.some((x) => x.testi === t);
  const lkm = (g, l) => testitLuokassa(l).filter((t) => onDataa(g, t.koodi)).length;

  // Ensimmäisellä avauksella ryhmä ja luokka, joissa on dataa
  if (!luokka && !lkm(S.ryhma, S.luokka)) S.luokka = LUOKAT.find(([k]) => lkm(S.ryhma, k))?.[0] || S.luokka;

  main.innerHTML = `
    <div class="testit-paa">
      <div><h1>Testit</h1><p class="ingressi">Kaikki testit samassa paikassa: valitse ryhmä, testiluokka ja testi.</p></div>
      <div class="rivi"><a class="btn ensisij" href="#/kerrat">Syötä tuloksia</a><a class="btn" href="#/pelaajat">Pelaajakortit</a></div>
    </div>
    <div class="ryhmavalinta" role="tablist" aria-label="Ryhmä">${RYHMAT.map(([k, n, ala]) => `<button role="tab" class="ryhmanappi" data-ryhma="${k}" aria-selected="${k === S.ryhma}"><b>${n}</b><span>${ala}</span></button>`).join("")}</div>
    <div class="valilehdet luokkavalinta" role="tablist" aria-label="Testiluokka" id="luokat"></div>
    <div id="luokka-sisalto"></div>
    <div id="testi-sisalto"></div>`;

  const paivitaOsoite = () => history.replaceState(null, "", `#/testit/${S.ryhma}/${S.luokka}${S.testi ? "/" + S.testi : ""}`);

  function piirraLuokat() {
    $("#luokat").innerHTML = LUOKAT.map(([k, n]) => { const c = lkm(S.ryhma, k);
      return `<button role="tab" class="valilehti${c ? "" : " tyhja-luokka"}" data-luokka="${k}" aria-selected="${k === S.luokka}">${n}<span class="lkm">${c}</span></button>`; }).join("");
    $$("[data-luokka]").forEach((b) => (b.onclick = () => { S.luokka = b.dataset.luokka; S.testi = null; piirraLuokka(); piirraLuokat(); }));
  }

  function piirraLuokka() {
    const g = S.ryhma, D = data[g];
    const testit = testitLuokassa(S.luokka);
    const mukana = testit.filter((t) => onDataa(g, t.koodi));
    const puuttuu = testit.filter((t) => !onDataa(g, t.koodi) && !t.johdettu && t.aktiivinen !== false && !(g === "juniorit" && t.koodi.startsWith("lt_")));
    if (!S.testi || !mukana.some((t) => t.koodi === S.testi)) S.testi = muistetut[g + "|" + S.luokka] && mukana.some((t) => t.koodi === muistetut[g + "|" + S.luokka]) ? muistetut[g + "|" + S.luokka] : mukana[0]?.koodi || null;
    const alat = [...new Set(mukana.map((t) => t.alaluokka || "Muut"))];
    const kuvaus = LUOKAT.find(([k]) => k === S.luokka)[2];
    $("#luokka-sisalto").innerHTML = `<p class="pieni luokka-kuvaus">${esc(kuvaus)}.</p>
      ${S.luokka === "nopeus" || S.luokka === "fysiikka" ? `<a class="jtt-banneri" href="#/juoksu/${S.luokka === "fysiikka" ? "cooper" : "30m"}/${g}"><b>Juoksutestit</b><span>30 m, nopeuskestävyys 9×30 m ja Cooper: tulostaulu, ikäluokat, vertailu miehiin ja pelaajan juoksuprofiili</span><i aria-hidden="true">→</i></a>` : ""}
      ${alat.map((a) => `<section class="alaluokka"><h3>${esc(a)}</h3><div class="testiruudut">${mukana.filter((t) => (t.alaluokka || "Muut") === a).map((t) => ruutu(g, t)).join("")}</div></section>`).join("")
        || `<div class="paneeli tyhja-paneeli"><b>Ei vielä tuloksia tässä luokassa.</b><p class="pieni">${g === "superpesis" ? "Edustuksen testit näkyvät tässä heti, kun ensimmäinen testikerta on syötetty." : "Juniorien tulokset näkyvät tässä, kun testikerta on syötetty."}</p></div>`}
      ${puuttuu.length ? `<p class="pieni ei-testattu">Ei vielä testattu ${g === "superpesis" ? "edustuksessa" : "junioreilla"}: ${puuttuu.map((t) => esc(t.nimi)).join(", ")}</p>` : ""}`;
    $$("[data-testiruutu]").forEach((b) => (b.onclick = () => { S.testi = b.dataset.testiruutu; muistetut[g + "|" + S.luokka] = S.testi; S.korostus.clear();
      $$("[data-testiruutu]").forEach((x) => x.setAttribute("aria-pressed", x === b)); piirraTesti(true); }));
    piirraTesti(false);
  }

  // Testiruutu: viimeisin ryhmän mediaani, kehitys ja ennätys
  function ruutu(g, T) {
    const t = T.koodi, D = data[g], rr = D.parhaat.filter((x) => x.testi === t);
    let arvo, ala, sarja;
    if (g === "superpesis") {
      const kerrat = [...new Set(rr.map((x) => x.kerta))].sort((a, b) => tila.kerta[a].pvm.localeCompare(tila.kerta[b].pvm));
      sarja = kerrat.map((k) => mediaani(rr.filter((x) => x.kerta === k).map((x) => x.arvo)));
      const vk = kerrat.at(-1), n = rr.filter((x) => x.kerta === vk).length;
      arvo = sarja.at(-1); ala = `${pvmLyhyt(tila.kerta[vk].pvm)} · ${n} pelaajaa · ${kerrat.length} ${kerrat.length === 1 ? "kerta" : "kertaa"}`;
    } else {
      const kaudet = [...new Set(rr.map((x) => kausi(x.pvm)))].sort();
      sarja = kaudet.map((ka) => { const pp = new Map(); rr.filter((x) => kausi(x.pvm) === ka).forEach((x) => pp.set(x.pelaaja, paras(t, [pp.get(x.pelaaja), x.arvo]))); return mediaani([...pp.values()]); });
      const n = new Set(rr.filter((x) => kausi(x.pvm) === kaudet.at(-1)).map((x) => x.pelaaja)).size;
      arvo = sarja.at(-1); ala = `talvi ${kaudet.at(-1)} · ${n} pelaajaa`;
    }
    const enn = [...rr].sort((a, b) => (T.pienempi_parempi ? a.arvo - b.arvo : b.arvo - a.arvo))[0];
    return `<button class="testiruutu" data-testiruutu="${t}" aria-pressed="${t === S.testi}">
      <span class="tr-nimi">${esc(tnimi(T))}${D.valinta[t] ? ` <span class="merkki harmaa">${esc(D.valinta[t])}</span>` : ""}</span>
      <span class="tr-arvo">${muotoile(arvo, t)}<small>${esc(T.yksikko)}</small></span>
      <span class="tr-ala">mediaani · ${ala}</span>
      ${miniPylvaat(sarja, T.pienempi_parempi)}
      <span class="tr-enn">Ennätys <b>${muotoile(enn.arvo, t)}</b> ${esc(nimi(tila.pelaaja[enn.pelaaja]))}</span>
    </button>`;
  }

  function piirraTesti(vieritys) {
    paivitaOsoite();
    const el = $("#testi-sisalto");
    if (!S.testi) { el.innerHTML = ""; return; }
    const T = tila.testi[S.testi], tk = data[S.ryhma].valinta[S.testi];
    el.innerHTML = `<div class="testi-otsikko" id="testi-ankkuri">
        <div><span class="pieni">${esc(LUOKKANIMI[T.luokka] || "")} · ${esc(T.alaluokka || "")}</span><h2>${esc(tnimi(T))}</h2></div>
        <p class="pieni">${esc(T.yksikko)}${tk ? ` · ${esc(tk)}` : ""} · ${T.pienempi_parempi ? "pienempi on parempi" : "suurempi on parempi"}${T.johdettu ? " · laskettu 30 m − 10 m samasta juoksusta" : ""}</p>
      </div><div id="testi-runko"></div>`;
    (S.ryhma === "superpesis" ? superpesis : juniorit)($("#testi-runko"), T);
    if (vieritys) $("#testi-ankkuri").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Superpesis: pelaajat testikerroittain
  function superpesis(el, T) {
    const t = T.koodi, D = data.superpesis;
    const rr = D.parhaat.filter((x) => x.testi === t);
    const kerrat = [...new Set(rr.map((x) => x.kerta))].map((k) => tila.kerta[k]).sort((a, b) => a.pvm.localeCompare(b.pvm));
    const arvo = (p, k) => rr.find((x) => x.pelaaja === p && x.kerta === k)?.arvo ?? null;
    const pelaajat = [...new Set(rr.map((x) => x.pelaaja))].map((id) => tila.pelaaja[id]);
    const vk = kerrat.at(-1);
    const avainArvo = (p) => arvo(p.id, vk.id) ?? paras(t, kerrat.map((k) => arvo(p.id, k.id)));
    pelaajat.sort((a, b) => { const x = avainArvo(a), y = avainArvo(b); return T.pienempi_parempi ? x - y : y - x; });
    const pylvaat = kerrat.length <= 3;
    const fmt = (v) => (v == null ? "" : muotoile(v, t));

    el.innerHTML = `
      <div class="paneeli"><div class="kaavio" style="height:${pylvaat ? Math.max(300, pelaajat.length * 26 + 60) : 340}px"><canvas id="k-sp"></canvas></div></div>
      <p class="vihje">${pylvaat ? "Pelaajan paras tulos kullakin testikerralla. Uusin kerta korostettuna." : "Ohut viiva on pelaaja, katkoviiva joukkueen mediaani. Valitse pelaajia taulukosta korostaaksesi heidät."}</p>
      <div class="taulu-wrap" style="margin-top:12px"><table id="t-sp"></table></div>
      ${t === "lyonti" ? `<h3>Lyönnit mailoittain</h3><div class="taulu-wrap"><table id="t-mailat"></table></div><p class="vihje">Tyhjä solu: mailalla ei lyöty kyseisellä kerralla. Korostettu on pelaajan kovin lyönti kerralla.</p>` : ""}
      ${LT.includes(t) ? `<h3>Lyöntiprofiili, talven keskiarvot</h3><div class="taulu-wrap"><table id="t-profiili"></table></div><p class="vihje">Pelaajan keskiarvo kaikilta lyöntitestikerroilta. Mitä kirkkaampi solu, sitä parempi tulos joukkueen sisällä. Pelaajat tekevät joko 1-raja- tai keskipomppu- ja joko kumura- tai viistaritestin, joten osa soluista jää tyhjäksi.</p>` : ""}`;

    const kaavio = () => {
      if (pylvaat) {
        piirra($("#k-sp"), { type: "bar",
          data: { labels: pelaajat.map(nimi), datasets: kerrat.map((k, i) => { const uusin = i === kerrat.length - 1;
            return { label: pvm(k.pvm), data: pelaajat.map((p) => arvo(p.id, k.id)), backgroundColor: uusin ? "rgba(245,168,0,.75)" : "rgba(145,137,125,.45)", borderColor: uusin ? vari("--cyan") : vari("--ink-3"), borderWidth: 1, borderRadius: 3, barPercentage: .9, categoryPercentage: .8 }; }) },
          options: { indexAxis: "y", maintainAspectRatio: false,
            scales: { x: { beginAtZero: false, reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko } }, y: { ticks: { autoSkip: false } } },
            plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.x)} ${T.yksikko}` } } } } });
        return;
      }
      const varit = ["#F5A800", "#FF3B4E", "#2EE59D", "#FFC93C", "#A78BFA", "#C98A00", "#F472B6"];
      const md = kerrat.map((k) => mediaani(pelaajat.map((p) => arvo(p.id, k.id)).filter((x) => x != null)));
      const ds = pelaajat.map((p) => { const kor = S.korostus.has(p.id), c = kor ? varit[[...S.korostus].indexOf(p.id) % varit.length] : "rgba(145,137,125,.45)";
        return { label: nimi(p), data: kerrat.map((k) => arvo(p.id, k.id)), borderColor: c, backgroundColor: c, borderWidth: kor ? 3 : 1, pointRadius: kor ? 4 : 2, spanGaps: true, order: kor ? 0 : 2 }; });
      ds.push({ label: "Joukkueen mediaani", data: md, borderColor: vari("--ink"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 1 });
      piirra($("#k-sp"), { type: "line", data: { labels: kerrat.map((k) => pvmLyhyt(k.pvm)), datasets: ds },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false },
          tooltip: { filter: (c) => !S.korostus.size || S.korostus.has(pelaajat[c.datasetIndex]?.id) || c.datasetIndex === pelaajat.length,
            callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
          scales: { y: { reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko } } } } });
    };

    const md = kerrat.map((k) => mediaani(pelaajat.map((p) => arvo(p.id, k.id)).filter((x) => x != null)));
    $("#t-sp").innerHTML = `<thead><tr>${pylvaat ? "" : "<th></th>"}<th>Pelaaja</th>${kerrat.map((k) => `<th class="n">${pvmLyhyt(k.pvm)}</th>`).join("")}<th class="n">Ennätys</th><th class="n">Ensimmäinen → viimeisin</th></tr></thead>
      <tbody>${pelaajat.map((p) => { const v = kerrat.map((k) => arvo(p.id, k.id)), ok = v.filter((x) => x != null), e = paras(t, ok), m = ok.length >= 2 ? parannus(t, ok.at(-1), ok[0]) : null;
        return `<tr>${pylvaat ? "" : `<td><input type="checkbox" data-kor="${p.id}" ${S.korostus.has(p.id) ? "checked" : ""} aria-label="Korosta ${esc(nimi(p))}"></td>`}<td>${pelaajaLinkki(p)}</td>
          ${v.map((x) => `<td class="n${x != null && x === e && ok.length > 1 ? " pb" : ""}">${fmt(x)}</td>`).join("")}<td class="n"><b>${fmt(e)}</b></td>
          <td class="n ${m > 0 ? "pb" : m < 0 ? "huono" : ""}">${m != null ? muotoileMuutos(ok.at(-1) - ok[0], t) : ""}</td></tr>`; }).join("")}
        <tr class="yhteensa">${pylvaat ? "" : "<td></td>"}<td><b>Mediaani</b></td>${md.map((x) => `<td class="n"><b>${fmt(x)}</b></td>`).join("")}<td></td><td></td></tr></tbody>`;
    $$("[data-kor]", el).forEach((c) => (c.onchange = () => { c.checked ? S.korostus.add(c.dataset.kor) : S.korostus.delete(c.dataset.kor); kaavio(); }));
    kaavio();

    if (t === "lyonti") {
      const raw = D.raaka.filter((r) => r.testi === "lyonti" && r.tarkenne === "");
      const am = (p, k, m) => { const v = raw.filter((r) => r.pelaaja_id === p && r.testikerta_id === k && (!m || maila(r) === m)).map((r) => r.arvo); return v.length ? Math.max(...v) : null; };
      $("#t-mailat").innerHTML = `<thead><tr><th>Pelaaja</th>${MAILAT.map((m) => `<th class="n" colspan="${kerrat.length}">${m === "oma" ? "Oma maila" : m}</th>`).join("")}</tr>
        <tr><th></th>${MAILAT.map(() => kerrat.map((k) => `<th class="n">${pvmLyhyt(k.pvm)}</th>`).join("")).join("")}</tr></thead>
        <tbody>${pelaajat.map((p) => `<tr><td>${pelaajaLinkki(p)}</td>${MAILAT.map((m) => kerrat.map((k) => { const v = am(p.id, k.id, m), max = am(p.id, k.id);
          return `<td class="n${v != null && v === max ? " pb" : ""}">${fmt(v)}</td>`; }).join("")).join("")}</tr>`).join("")}</tbody>`;
    }
    if (LT.includes(t)) {
      const lt = LT.filter((tt) => tila.testi[tt]);
      const kaikkiLt = D.parhaat.filter((x) => LT.includes(x.testi));
      const profKa = (p, tt) => { const v = kaikkiLt.filter((x) => x.pelaaja === p && x.testi === tt).map((x) => x.arvo); return v.length ? keskiarvo(v) : null; };
      const lp = [...new Set(kaikkiLt.map((x) => x.pelaaja))].map((id) => tila.pelaaja[id]).sort((a, b) => nimi(a).localeCompare(nimi(b), "fi"));
      const rajat = Object.fromEntries(lt.map((tt) => { const v = lp.map((p) => profKa(p.id, tt)).filter((x) => x != null); return [tt, [Math.min(...v), Math.max(...v)]]; }));
      $("#t-profiili").innerHTML = `<thead><tr><th>Pelaaja</th>${lt.map((tt) => `<th class="n${tt === t ? " valittu-sarake" : ""}">${esc(tnimi(tila.testi[tt]).replace("Lyöntitesti: ", ""))}</th>`).join("")}<th class="n">Kertoja</th></tr></thead>
        <tbody>${lp.map((p) => `<tr><td>${pelaajaLinkki(p)}</td>${lt.map((tt) => { const v = profKa(p.id, tt); if (v == null) return `<td class="n"></td>`;
          const [lo, hi] = rajat[tt], s = hi > lo ? (v - lo) / (hi - lo) : .5;
          return `<td class="n" style="background:rgba(245,168,0,${(.06 + .5 * s).toFixed(2)})">${desi(v)}</td>`; }).join("")}
          <td class="n">${new Set(kaikkiLt.filter((x) => x.pelaaja === p.id).map((x) => x.kerta)).size}</td></tr>`).join("")}</tbody>`;
    }
  }

  // ---------- Juniorit: ikäluokat samassa iässä, kauden parhaat, ikävuosiennätykset
  function juniorit(el, T) {
    const t = T.koodi, D = data.juniorit;
    const rr = D.parhaat.filter((x) => x.testi === t);
    // pelaajan paras tulos kevätkaudella (talvi 2025–26 → kevät 2026); ikä = kevät − syntymävuosi
    const kp = new Map();
    for (const x of rr) {
      const p = tila.pelaaja[x.pelaaja]; const kv = kevat(x.pvm), k = `${x.pelaaja}|${kv}`;
      const o = kp.get(k); if (!o || parannus(t, x.arvo, o.arvo) > 0) kp.set(k, { pelaaja: x.pelaaja, syntymavuosi: p.syntymavuosi, kevat: kv, arvo: x.arvo, pvm: x.pvm });
    }
    const kausiparhaat = [...kp.values()];
    const solut = new Map();
    kausiparhaat.filter((x) => x.syntymavuosi).forEach((x) => { const k = `${x.syntymavuosi}|${x.kevat - x.syntymavuosi}`; (solut.get(k) || solut.set(k, { v: x.syntymavuosi, ika: x.kevat - x.syntymavuosi, kevat: x.kevat, a: [] }).get(k)).a.push(x.arvo); });
    const kvart = (a, q) => { const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
    const ika = [...solut.values()].filter((s) => s.a.length >= 3).map((s) => ({ ...s, n: s.a.length, md: mediaani(s.a), q1: kvart(s.a, .25), q3: kvart(s.a, .75), kausi: `${s.kevat - 1}–${String(s.kevat).slice(2)}` }));
    const vuodet = [...new Set(ika.map((x) => x.v))].sort();
    const iat = [...new Set(ika.map((x) => x.ika))].sort((a, b) => a - b);
    const loyda = (v, i) => ika.find((x) => x.v === v && x.ika === i);
    const pel = [...new Set(rr.map((x) => x.pelaaja))].map((id) => tila.pelaaja[id]);
    const ikaluokat = [...new Set(pel.map((p) => p.syntymavuosi).filter(Boolean))].sort();
    if (S.ikaluokka && !ikaluokat.includes(+S.ikaluokka)) S.ikaluokka = "";

    el.innerHTML = `
      ${ika.length ? `<h3>Ikäluokat samassa iässä</h3>
      <div class="paneeli"><div class="kaavio"><canvas id="k-ika" aria-label="Ikäluokkien tulokset iän mukaan"></canvas></div></div>
      <p class="vihje">Viiva kulkee ikäluokan läpi talvi talvelta. Piste on ikäluokan pelaajien kauden parhaiden tulosten mediaani; ikä on se, jonka pelaaja täyttää talven aikana (talvella 2025–26 vuonna 2009 syntynyt on 17). Ontto piste = alle viisi pelaajaa, suuntaa-antava. Mukana ikäluokat, joista vähintään kolme pelaajaa.</p>
      <div class="taulu-wrap" style="margin-top:12px"><table id="ika-taulu"></table></div>` : `<p class="pieni">Ikäluokkavertailuun tarvitaan vähintään kolme saman ikäluokan pelaajaa samalta talvelta.</p>`}
      <h3>Kauden parhaat pelaajittain</h3>
      <div class="rivi" style="margin-bottom:10px">
        <select id="j-ikaluokka" aria-label="Ikäluokka"><option value="">Kaikki ikäluokat</option>${ikaluokat.map((v) => `<option${String(v) === String(S.ikaluokka) ? " selected" : ""}>${v}</option>`).join("")}</select>
        <label class="chip"><input type="checkbox" id="j-nyk" ${S.nykyiset ? "checked" : ""}>Vain nykyiset pelaajat</label>
      </div>
      <div class="paneeli"><div class="kaavio"><canvas id="k-kaudet"></canvas></div></div>
      <div class="taulu-wrap" style="margin-top:12px"><table id="t-kaudet"></table></div>
      <h3>Ennätykset ikävuosittain</h3>
      <p class="pieni">Paras tulos sinä talvena, jona pelaaja täytti kyseisen iän. Viisi parasta per ikä, myös entiset pelaajat.</p>
      <div class="ruudukko" id="ikaennatykset"></div>`;

    if (ika.length) {
      piirra($("#k-ika"), { type: "line",
        data: { labels: iat.map((i) => `${i} v`), datasets: vuodet.map((v, i) => { const c = SARJAVARIT[i % 8];
          return { label: `${v} syntyneet`, spanGaps: true, borderColor: c, backgroundColor: c, borderWidth: 3, tension: .25,
            pointRadius: iat.map((a) => (loyda(v, a) ? 6 : 0)), pointHoverRadius: 8,
            pointBackgroundColor: iat.map((a) => (loyda(v, a)?.n < 5 ? vari("--surface") : c)), pointBorderWidth: 2,
            data: iat.map((a) => loyda(v, a)?.md ?? null) }; }) },
        options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          scales: { x: { title: { display: true, text: "ikä talven aikana" }, grid: { display: false } }, y: { reverse: !!T.pienempi_parempi, title: { display: true, text: `${T.yksikko}${T.pienempi_parempi ? " (ylempänä parempi)" : ""}` } } },
          plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: {
            title: (c) => `${iat[c[0].dataIndex]}-vuotiaat`,
            label: (c) => { const x = loyda(vuodet[c.datasetIndex], iat[c.dataIndex]); return x ? `${x.v}: ${muotoile(x.md, t)} ${T.yksikko} (talvi ${x.kausi}, ${x.n} pelaajaa, puolet välillä ${muotoile(x.q1, t)}–${muotoile(x.q3, t)})` : ""; } } } } } });
      $("#ika-taulu").innerHTML = `<thead><tr><th>Ikä</th>${vuodet.map((v) => `<th class="n">${v} synt.</th>`).join("")}${vuodet.length >= 2 ? '<th class="n">Ero</th>' : ""}</tr></thead>
        <tbody>${iat.map((a) => { const s = vuodet.map((v) => loyda(v, a)), arvot = s.filter(Boolean).map((x) => x.md);
          const pa = paras(t, arvot), hu = arvot.length ? (T.pienempi_parempi ? Math.max(...arvot) : Math.min(...arvot)) : null;
          return `<tr><td>${a} v</td>${s.map((x) => x ? `<td class="n"><span class="${arvot.length > 1 && x.md === pa ? "pb" : ""}" style="font:600 18px var(--num)">${muotoile(x.md, t)}</span> <span class="pieni">${x.kausi} · ${x.n}</span></td>` : '<td class="n tyhja">–</td>').join("")}
            ${vuodet.length >= 2 ? `<td class="n">${arvot.length > 1 ? muotoile(Math.abs(hu - pa), t) + " " + esc(T.yksikko) : ""}</td>` : ""}</tr>`; }).join("")}</tbody>`;
    }

    const kaudet = () => {
      const pelaajat = pel.filter((p) => (!S.ikaluokka || String(p.syntymavuosi) === String(S.ikaluokka)) && (!S.nykyiset || p.aktiivinen));
      const ks = [...new Set(kausiparhaat.filter((x) => pelaajat.some((p) => p.id === x.pelaaja)).map((x) => x.kevat))].sort();
      const arvo = (p, kv) => kp.get(`${p}|${kv}`)?.arvo ?? null;
      const nimiK = (kv) => `${kv - 1}–${String(kv).slice(2)}`;
      const ds = pelaajat.map((p) => { const kor = S.korostus.has(p.id), c = kor ? SARJAVARIT[[...S.korostus].indexOf(p.id) % 8] : "rgba(145,137,125,.4)";
        return { label: nimi(p), data: ks.map((kv) => arvo(p.id, kv)), borderColor: c, backgroundColor: c, borderWidth: kor ? 3 : 1, pointRadius: kor ? 4 : 2, spanGaps: true, order: kor ? 0 : 2 }; });
      ds.push({ label: "Mediaani", data: ks.map((kv) => mediaani(pelaajat.map((p) => arvo(p.id, kv)).filter((x) => x != null))), borderColor: vari("--ink"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 1 });
      piirra($("#k-kaudet"), { type: "line", data: { labels: ks.map(nimiK), datasets: ds },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { filter: (c) => !S.korostus.size || S.korostus.has(pelaajat[c.datasetIndex]?.id) || c.dataset.label === "Mediaani", callbacks: { label: (c) => `${c.dataset.label}: ${muotoile(c.parsed.y, t)}` } } },
          scales: { y: { reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko } } } } });
      const viim = ks.at(-1), edel = ks.at(-2);
      const nayt = pelaajat.filter((p) => ks.some((kv) => arvo(p.id, kv) != null));
      const jarj = [...nayt].sort((a, b) => { const x = arvo(a.id, viim), y = arvo(b.id, viim); if (x == null) return y == null ? 0 : 1; if (y == null) return -1; return T.pienempi_parempi ? x - y : y - x; });
      $("#t-kaudet").innerHTML = `<thead><tr><th></th><th>Pelaaja</th><th class="n">Synt.</th>${ks.map((kv) => `<th class="n">${nimiK(kv)}</th>`).join("")}<th class="n">Muutos</th></tr></thead>
        <tbody>${jarj.map((p) => { const a = arvo(p.id, viim), b = arvo(p.id, edel), m = parannus(t, a, b);
          return `<tr><td><input type="checkbox" data-kor="${p.id}" ${S.korostus.has(p.id) ? "checked" : ""} aria-label="Korosta ${esc(nimi(p))}"></td><td>${pelaajaLinkki(p)}</td><td class="n">${p.syntymavuosi || ""}</td>
            ${ks.map((kv) => `<td class="n">${arvo(p.id, kv) == null ? "" : muotoile(arvo(p.id, kv), t)}</td>`).join("")}
            <td class="n ${m > 0 ? "pb" : m < 0 ? "huono" : ""}">${m != null ? muotoileMuutos(a - b, t) : ""}</td></tr>`; }).join("") || `<tr><td colspan="9" class="tyhja">Ei pelaajia valinnoilla.</td></tr>`}</tbody>`;
      $$("[data-kor]", el).forEach((c) => (c.onchange = () => { c.checked ? S.korostus.add(c.dataset.kor) : S.korostus.delete(c.dataset.kor); kaudet(); }));
    };
    $("#j-ikaluokka").onchange = (e) => { S.ikaluokka = e.target.value; kaudet(); };
    $("#j-nyk").onchange = (e) => { S.nykyiset = e.target.checked; kaudet(); };
    kaudet();

    const ik = new Map();
    for (const x of kausiparhaat) { if (!x.syntymavuosi) continue; const a = x.kevat - x.syntymavuosi; (ik.get(a) || ik.set(a, []).get(a)).push(x); }
    $("#ikaennatykset").innerHTML = [...ik.keys()].sort((a, b) => a - b).map((a) => {
      const top = ik.get(a).sort((x, y) => (T.pienempi_parempi ? x.arvo - y.arvo : y.arvo - x.arvo)).slice(0, 5);
      return `<div class="paneeli"><h3 style="margin-top:0">${a}-vuotiaat</h3><ol class="ennatyslista">${top.map((x) => `<li><span class="num">${muotoile(x.arvo, t)}</span> ${esc(nimi(tila.pelaaja[x.pelaaja]))} <span class="pieni">${x.kevat - 1}–${String(x.kevat).slice(2)}</span></li>`).join("")}</ol></div>`;
    }).join("");
  }

  $$("[data-ryhma]").forEach((b) => (b.onclick = () => {
    S.ryhma = b.dataset.ryhma; S.korostus.clear();
    $$("[data-ryhma]").forEach((x) => x.setAttribute("aria-selected", x === b));
    if (!lkm(S.ryhma, S.luokka)) S.luokka = LUOKAT.find(([k]) => lkm(S.ryhma, k))?.[0] || S.luokka;
    S.testi = null; piirraLuokat(); piirraLuokka();
  }));
  piirraLuokat();
  piirraLuokka();
  if (testi) $("#testi-ankkuri")?.scrollIntoView({ block: "start" });
}
