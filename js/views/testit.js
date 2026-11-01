// Testit: yksi näkymä edustukselle (Superpesis) ja junioreille. Testit luokiteltu
// luokka → alaluokka (testit.luokka / testit.alaluokka). Osoite #/testit/<ryhmä>/<luokka>/<testi>.
import { tila, nimi, lataaTulokset, sallitutRyhmat } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, pvmLyhyt, kausi, paras, parannus, parhaatTulokset, juoksutYhteen, pelaajaLinkki, mediaani, keskiarvo, piirra, vari, SARJAVARIT, kuva } from "../util.js";

export const LUOKAT = [
  ["fysiikka", "Fysiikka", "Räjähtävä voima, maksimivoima, lihaskestävyys ja kestävyys"],
  ["voima", "Lyönti- ja heittovoima", "Tutkamittaukset: heitot ja lyönnit"],
  ["nopeus", "Nopeus", "Pikanopeus, ketteryys, nopeuskestävyys sekä reaktio ja lähtö"],
  ["lajitaito", "Lajitaito", "Lyöntitaito: näpyt, lyöntitestit ja kovat lyönnit"],
];
export const LUOKKANIMI = Object.fromEntries(LUOKAT.map(([k, n]) => [k, n]));
const ALAJARJ = ["Räjähtävä voima", "Maksimivoima", "Lihaskestävyys", "Kestävyys", "Lyöntivoima", "Heittovoima", "Pikanopeus", "Ketteryys", "Nopeuskestävyys", "Reaktio ja lähtö", "Lyöntitaito", "Kiinniotto"];
const RYHMAT = [["superpesis", "Superpesis", "Edustus"], ["juniorit", "Juniorit", "Ikäluokittain"]];
const LT = ["lt_napyt", "lt_1raja_pomppu", "lt_2raja_pomppu", "lt_keskipomppu", "lt_kumura", "lt_viistari", "lt_koppi"];
const MAILAT = ["oma", "Optima", "Ultima"];
const maila = (r) => (r.huomio || "").match(/^Maila:\s*(.+)$/i)?.[1] || "";
const kevat = (s) => +s.slice(0, 4) + (+s.slice(5, 7) >= 7 ? 1 : 0);
const tnimi = (T) => T.nimi.replace(/^Edustuksen lyöntitesti: /, "Lyöntitesti: ");
const desi = (x) => (x == null ? "" : x.toFixed(1).replace(".", ","));
// sijoitus ryhmässä (1 = paras) ja montako prosenttia ryhmästä ohitetaan
function sijoitus(t, arvo, arvot) {
  if (arvo == null || !arvot.length) return null;
  const pp = tila.testi[t]?.pienempi_parempi, e = 1e-9;
  const parempia = arvot.filter((x) => (pp ? x < arvo - e : x > arvo + e)).length;
  const huonompia = arvot.filter((x) => (pp ? x > arvo + e : x < arvo - e)).length;
  return { sija: parempia + 1, n: arvot.length, pct: arvot.length > 1 ? Math.round((huonompia / (arvot.length - 1)) * 100) : 100 };
}
// pieni kehityskäyrä (ylös = parempi), sama kuin juoksutesteissä
function kipina(arvot, pp) {
  const v = arvot.filter((x) => x != null);
  if (v.length < 2) return "";
  const min = Math.min(...v), max = Math.max(...v), w = 120, h = 30, vali = max - min || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 6) + 3, pp ? 3 + ((x - min) / vali) * (h - 6) : h - 3 - ((x - min) / vali) * (h - 6)]);
  return `<svg class="jtt-kipina" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 3.5 : 2}" fill="${i === pts.length - 1 ? "var(--cyan)" : "var(--ink-3)"}"/>`).join("")}</svg>`;
}

let S = { ryhma: "superpesis", luokka: "voima", testi: null, ikaluokka: "", nykyiset: true, korostus: new Set(), tarkastelu: {} };
const muistetut = {}; // ryhmä|luokka -> viimeksi valittu testi

export async function nayta(main, ryhma, luokka, testi) {
  if (RYHMAT.some(([k]) => k === ryhma)) S.ryhma = ryhma;
  const sallitut = sallitutRyhmat();
  if (sallitut && !sallitut.includes(S.ryhma)) S.ryhma = sallitut[0];
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

  // Ulkoasu juoksutestien mallilla (korjaamo 1.11.2026): testikortit, ryhmäsegmentti, KPI-kortit,
  // tulostaulu radalla (tulos, edellinen, mediaani) ja kehityskaaviot omina osioinaan.
  main.innerHTML = `
    <div class="jtt-paa">
      <div><span class="jtt-yla" id="tst-yla">Testit</span><h1>Testit</h1>
        <p class="ingressi">Valitse ryhmä, testiluokka ja testi. Klikkaa pelaajan sijaa korostaaksesi hänet kaaviossa.</p></div>
      <div class="rivi">${tila.juniori ? "" : `<a class="btn ensisij" href="#/kerrat">Syötä tuloksia</a>`}<a class="btn" href="#/pelaajat">Pelaajakortit</a></div>
    </div>
    <div class="jtt-ohjaimet tst-ylaohjaimet">
      <div class="jtt-segmentti" role="radiogroup" aria-label="Ryhmä">${RYHMAT.filter(([k]) => !sallitut || sallitut.includes(k)).map(([k, n]) => `<button role="radio" data-ryhma="${k}" aria-checked="${k === S.ryhma}">${n}</button>`).join("")}</div>
      <div class="tst-luokat" role="tablist" aria-label="Testiluokka" id="luokat"></div>
    </div>
    <div id="luokka-sisalto"></div>
    <div id="testi-sisalto"></div>`;

  const paivitaOsoite = () => history.replaceState(null, "", `#/testit/${S.ryhma}/${S.luokka}${S.testi ? "/" + S.testi : ""}`);

  function piirraLuokat() {
    $("#luokat").innerHTML = LUOKAT.map(([k, n]) => { const c = lkm(S.ryhma, k);
      return `<button role="tab" class="tst-luokka${c ? "" : " tyhja-luokka"}" data-luokka="${k}" aria-selected="${k === S.luokka}">${n}<span class="lkm">${c}</span></button>`; }).join("");
    $("#tst-yla").textContent = `Testit · ${RYHMAT.find(([k]) => k === S.ryhma)[1]} · ${LUOKKANIMI[S.luokka]}`;
    $$("[data-luokka]").forEach((b) => (b.onclick = () => { S.luokka = b.dataset.luokka; S.testi = null; S.korostus.clear(); piirraLuokka(); piirraLuokat(); }));
  }

  function piirraLuokka() {
    const g = S.ryhma;
    const testit = testitLuokassa(S.luokka);
    const mukana = testit.filter((t) => onDataa(g, t.koodi));
    const puuttuu = testit.filter((t) => !onDataa(g, t.koodi) && !t.johdettu && t.aktiivinen !== false && !(g === "juniorit" && t.koodi.startsWith("lt_")));
    if (!S.testi || !mukana.some((t) => t.koodi === S.testi)) S.testi = muistetut[g + "|" + S.luokka] && mukana.some((t) => t.koodi === muistetut[g + "|" + S.luokka]) ? muistetut[g + "|" + S.luokka] : mukana[0]?.koodi || null;
    const alat = [...new Set(mukana.map((t) => t.alaluokka || "Muut"))];
    const kuvaus = LUOKAT.find(([k]) => k === S.luokka)[2];
    $("#luokka-sisalto").innerHTML = `<p class="jtt-kuvaus">${esc(kuvaus)}.</p>
      ${S.luokka === "nopeus" || S.luokka === "fysiikka" ? `<a class="jtt-banneri" href="#/juoksu/${S.luokka === "fysiikka" ? "cooper" : "30m"}/${g}"><b>Juoksutestit</b><span>30 m, nopeuskestävyys 9×30 m ja Cooper: tulostaulu, ikäluokat, vertailu miehiin ja pelaajan juoksuprofiili</span><i aria-hidden="true">→</i></a>` : ""}
      ${alat.map((a) => `<section class="tst-ala"><h3>${esc(a)}</h3><div class="tst-kortit" role="tablist" aria-label="${esc(a)}">${mukana.filter((t) => (t.alaluokka || "Muut") === a).map((t) => kortti(g, t)).join("")}</div></section>`).join("")
        || `<div class="paneeli jtt-tyhja"><h2>Ei vielä tuloksia</h2><p class="pieni">${g === "superpesis" ? "Edustuksen testit näkyvät tässä heti, kun ensimmäinen testikerta on syötetty." : "Juniorien tulokset näkyvät tässä, kun testikerta on syötetty."}</p></div>`}
      ${puuttuu.length ? `<p class="pieni ei-testattu">Ei vielä testattu ${g === "superpesis" ? "edustuksessa" : "junioreilla"}: ${puuttuu.map((t) => esc(t.nimi)).join(", ")}</p>` : ""}`;
    $$("[data-testiruutu]").forEach((b) => (b.onclick = () => { S.testi = b.dataset.testiruutu; muistetut[g + "|" + S.luokka] = S.testi; S.korostus.clear();
      $$("[data-testiruutu]").forEach((x) => x.setAttribute("aria-selected", x === b)); piirraTesti(true); }));
    piirraTesti(false);
  }

  // Testikortti: viimeisin ryhmän mediaani, kehityskäyrä ja ennätys
  function kortti(g, T) {
    const t = T.koodi, D = data[g], rr = D.parhaat.filter((x) => x.testi === t);
    let arvo, ala, sarja;
    if (g === "superpesis") {
      const kerrat = [...new Set(rr.map((x) => x.kerta))].sort((a, b) => tila.kerta[a].pvm.localeCompare(tila.kerta[b].pvm));
      sarja = kerrat.map((k) => mediaani(rr.filter((x) => x.kerta === k).map((x) => x.arvo)));
      const vk = kerrat.at(-1), n = rr.filter((x) => x.kerta === vk).length;
      arvo = sarja.at(-1); ala = `${pvmLyhyt(tila.kerta[vk].pvm)} · ${n} pelaajaa`;
    } else {
      const kaudet = [...new Set(rr.map((x) => kausi(x.pvm)))].sort();
      sarja = kaudet.map((ka) => { const pp = new Map(); rr.filter((x) => kausi(x.pvm) === ka).forEach((x) => pp.set(x.pelaaja, paras(t, [pp.get(x.pelaaja), x.arvo]))); return mediaani([...pp.values()]); });
      const n = new Set(rr.filter((x) => kausi(x.pvm) === kaudet.at(-1)).map((x) => x.pelaaja)).size;
      arvo = sarja.at(-1); ala = `kausi ${kaudet.at(-1)} · ${n} pelaajaa`;
    }
    const enn = [...rr].sort((a, b) => (T.pienempi_parempi ? a.arvo - b.arvo : b.arvo - a.arvo))[0];
    return `<button class="jtt-testikortti tst-kortti" role="tab" data-testiruutu="${t}" aria-selected="${t === S.testi}">
      <span class="jtt-tk-nimi">${esc(tnimi(T))}${D.valinta[t] ? ` <span class="merkki harmaa">${esc(D.valinta[t])}</span>` : ""}</span>
      <span class="jtt-tk-arvo">${muotoile(arvo, t)}<small>${esc(T.yksikko)}</small></span>
      <span class="jtt-tk-ala">mediaani · ${ala}</span>
      <span class="jtt-tk-ala tst-enn">Ennätys <b>${muotoile(enn.arvo, t)}</b> ${esc(nimi(tila.pelaaja[enn.pelaaja]))}</span>
      ${kipina(sarja, T.pienempi_parempi)}
    </button>`;
  }

  function piirraTesti(vieritys) {
    paivitaOsoite();
    const el = $("#testi-sisalto");
    if (!S.testi) { el.innerHTML = ""; return; }
    const T = tila.testi[S.testi], tk = data[S.ryhma].valinta[S.testi];
    el.innerHTML = `<div class="tst-otsikko" id="testi-ankkuri">
        <span class="jtt-yla">${esc(LUOKKANIMI[T.luokka] || "")}${T.alaluokka ? ` · ${esc(T.alaluokka)}` : ""}</span><h2>${esc(tnimi(T))}</h2>
        <p class="jtt-kuvaus">${esc(T.yksikko)}${tk ? ` · ${esc(tk)}` : ""} · ${T.pienempi_parempi ? "pienempi on parempi" : "suurempi on parempi"}${T.johdettu ? " · laskettu 30 m − 10 m samasta juoksusta" : ""}</p>
      </div>
      <div class="jtt-ohjaimet" id="tst-ohjaimet"></div>
      <div id="testi-runko"></div>`;
    ohjaimet(T);
    if (vieritys) $("#testi-ankkuri").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Tarkastelu: testikerta tai kauden paras (sama malli molemmille ryhmille)
  function ohjaimet(T) {
    const g = S.ryhma, t = T.koodi, rr = data[g].parhaat.filter((x) => x.testi === t);
    const kerrat = [...new Set(rr.map((x) => x.kerta))].map((k) => tila.kerta[k]).sort((a, b) => b.pvm.localeCompare(a.pvm));
    const kaudet = [...new Set(rr.map((x) => kausi(x.pvm)))].sort().reverse();
    const avain = g + "|" + t;
    let val = S.tarkastelu[avain];
    const ok = (v) => v && ((v.startsWith("k:") && kerrat.some((k) => "k:" + k.id === v)) || (v.startsWith("s:") && kaudet.includes(v.slice(2))));
    if (!ok(val)) val = g === "superpesis" ? (kerrat[0] ? "k:" + kerrat[0].id : null) : kaudet[0] ? "s:" + kaudet[0] : null;
    const ikaluokat = g === "juniorit" ? [...new Set(rr.map((x) => tila.pelaaja[x.pelaaja]?.syntymavuosi).filter(Boolean))].sort() : [];
    if (S.ikaluokka && !ikaluokat.includes(+S.ikaluokka)) S.ikaluokka = "";
    $("#tst-ohjaimet").innerHTML = `
      <label class="jtt-valinta"><span>Tarkastelu</span><select id="tst-val">
        ${kerrat.length ? `<optgroup label="Testikerta">${kerrat.map((k) => `<option value="k:${k.id}"${"k:" + k.id === val ? " selected" : ""}>${pvm(k.pvm)}${k.nimi ? ` · ${esc(k.nimi)}` : ""}</option>`).join("")}</optgroup>` : ""}
        <optgroup label="Kauden paras">${kaudet.map((ka) => `<option value="s:${ka}"${"s:" + ka === val ? " selected" : ""}>Kausi ${ka}, paras tulos</option>`).join("")}</optgroup>
      </select></label>
      ${ikaluokat.length > 1 ? `<div class="jtt-chipit" role="radiogroup" aria-label="Ikäluokka"><button class="chip" data-ika="" aria-pressed="${!S.ikaluokka}">Kaikki</button>${ikaluokat.map((v) => `<button class="chip" data-ika="${v}" aria-pressed="${String(v) === String(S.ikaluokka)}">${v}</button>`).join("")}</div>` : ""}
      <button class="chip" id="tst-nyk" aria-pressed="${S.nykyiset}">Vain nykyiset pelaajat</button>`;
    $("#tst-val").onchange = (e) => { S.tarkastelu[avain] = e.target.value; ohjaimet(T); };
    $$("[data-ika]", $("#tst-ohjaimet")).forEach((b) => (b.onclick = () => { S.ikaluokka = b.dataset.ika; ohjaimet(T); }));
    $("#tst-nyk").onclick = () => { S.nykyiset = !S.nykyiset; ohjaimet(T); };
    runko($("#testi-runko"), T, val);
  }

  // ---------- Runko: KPI-kortit, tulostaulu, kehitys ja testikohtaiset lisäosiot
  function runko(el, T, val) {
    const g = S.ryhma, t = T.koodi, D = data[g];
    const kaikki = D.parhaat.filter((x) => x.testi === t);
    const pv = (x) => tila.pelaaja[x.pelaaja];
    const mukaan = (pid) => { const p = tila.pelaaja[pid]; return p && (!S.nykyiset || p.aktiivinen !== false) && (!S.ikaluokka || String(p.syntymavuosi) === String(S.ikaluokka)); };
    const parasMap = (a) => { const m = new Map(); a.forEach((x) => { const o = m.get(x.pelaaja); if (!o || parannus(t, x.arvo, o.arvo) > 0) m.set(x.pelaaja, x); }); return m; };
    if (!val) { el.innerHTML = `<div class="paneeli jtt-tyhja"><h2>Ei tuloksia</h2></div>`; return; }
    const onKerta = val.startsWith("k:"), ka = onKerta ? kausi(tila.kerta[val.slice(2)].pvm) : val.slice(2);
    let lista;
    if (onKerta) lista = kaikki.filter((x) => x.kerta === val.slice(2) && mukaan(x.pelaaja));
    else lista = [...parasMap(kaikki.filter((x) => kausi(x.pvm) === ka && mukaan(x.pelaaja))).values()];
    // vertailukohta: sama pelaaja edellisellä kerralla (testikerta) tai edellisellä kaudella (kauden paras)
    const edellinen = (x) => {
      if (onKerta) return kaikki.filter((y) => y.pelaaja === x.pelaaja && y.pvm < x.pvm).sort((a, b) => a.pvm.localeCompare(b.pvm)).at(-1) || null;
      const ed = [...new Set(kaikki.filter((y) => y.pelaaja === x.pelaaja && kausi(y.pvm) < ka).map((y) => kausi(y.pvm)))].sort().at(-1);
      return ed ? parasMap(kaikki.filter((y) => y.pelaaja === x.pelaaja && kausi(y.pvm) === ed)).get(x.pelaaja) : null;
    };
    const kpIka = g === "juniorit" ? parasMap(kaikki.filter((y) => kausi(y.pvm) === ka)) : null;
    const rivit = lista.map((x) => {
      const aiemmat = kaikki.filter((y) => y.pelaaja === x.pelaaja && y.pvm < x.pvm).map((y) => y.arvo);
      const pbEnnen = aiemmat.length ? paras(t, aiemmat) : null, ed = edellinen(x);
      const sy = pv(x).syntymavuosi;
      const ikaA = kpIka && sy ? [...kpIka.values()].filter((y) => tila.pelaaja[y.pelaaja]?.syntymavuosi === sy).map((y) => y.arvo) : [];
      return { x, v: x.arvo, ed, uusiPb: pbEnnen != null && parannus(t, x.arvo, pbEnnen) > 0, enn: paras(t, kaikki.filter((y) => y.pelaaja === x.pelaaja).map((y) => y.arvo)),
        kerrat: new Set(kaikki.filter((y) => y.pelaaja === x.pelaaja).map((y) => y.kerta)).size, ikaS: ikaA.length >= 2 ? sijoitus(t, kpIka.get(x.pelaaja)?.arvo ?? x.arvo, ikaA) : null };
    }).sort((a, b) => (T.pienempi_parempi ? a.v - b.v : b.v - a.v));
    const arvot = rivit.map((r) => r.v);
    rivit.forEach((r) => (r.sija = sijoitus(t, r.v, arvot)));
    if (!rivit.length) { el.innerHTML = `<div class="paneeli jtt-tyhja"><h2>Ei tuloksia valinnoilla</h2><p class="pieni">Kokeile toista ikäluokkaa tai poista "Vain nykyiset pelaajat".</p></div>`; return; }
    const md = mediaani(arvot), huippu = rivit[0];
    const vrt = rivit.filter((r) => r.ed);
    const parani = vrt.filter((r) => parannus(t, r.v, r.ed.arvo) > 0).length;
    const mdMuutos = mediaani(vrt.map((r) => r.v - r.ed.arvo));
    const ennKaikki = [...kaikki].sort((a, b) => (T.pienempi_parempi ? a.arvo - b.arvo : b.arvo - a.arvo))[0];
    const otsikko = onKerta ? `${pvm(tila.kerta[val.slice(2)].pvm)}${tila.kerta[val.slice(2)].nimi ? ` · ${esc(tila.kerta[val.slice(2)].nimi)}` : ""}` : `Kausi ${ka} · pelaajan paras tulos`;
    const vrtNimi = onKerta ? "edellisestä kerrasta" : "edellisestä kaudesta";
    const fmt = (v) => (v == null ? "–" : muotoile(v, t));

    el.innerHTML = `
      <div class="jtt-kpit">
        <div class="jtt-kpi"><span class="jtt-kpi-ots">Mediaani</span><span class="jtt-kpi-arvo">${fmt(md)}<small>${esc(T.yksikko)}</small></span><span class="jtt-kpi-ala">${rivit.length} pelaajaa</span></div>
        <div class="jtt-kpi"><span class="jtt-kpi-ots">Paras</span><span class="jtt-kpi-arvo">${fmt(huippu.v)}<small>${esc(T.yksikko)}</small></span><span class="jtt-kpi-ala">${esc(nimi(pv(huippu.x)))}</span></div>
        <div class="jtt-kpi"><span class="jtt-kpi-ots">Kaikkien aikojen ennätys</span><span class="jtt-kpi-arvo">${fmt(ennKaikki.arvo)}<small>${esc(T.yksikko)}</small></span><span class="jtt-kpi-ala">${esc(nimi(tila.pelaaja[ennKaikki.pelaaja]))} · ${pvmLyhyt(ennKaikki.pvm)}</span></div>
        <div class="jtt-kpi"><span class="jtt-kpi-ots">Kehitys ${vrtNimi}</span><span class="jtt-kpi-arvo">${vrt.length ? `${parani}<small>/ ${vrt.length}</small>` : "–"}</span><span class="jtt-kpi-ala">${vrt.length ? `paransi · mediaani ${muotoileMuutos(mdMuutos, t)} ${esc(T.yksikko)}` : "ei aiempia tuloksia"}</span></div>
      </div>

      <section class="jtt-osio"><div class="jtt-osio-paa"><h2>Tulostaulu</h2><span class="pieni">${otsikko}</span></div>
        <div class="jtt-selite"><span><i class="jtt-pallo"></i>tulos</span><span><i class="jtt-pallo haamu"></i>${onKerta ? "edellinen kerta" : "edellinen kausi"}</span><span><i class="jtt-pallo pb"></i>uusi ennätys</span><span><i class="jtt-mdviiva"></i>mediaani</span><span>oikealla = parempi</span></div>
        <div class="jtt-taulu tst-taulu" id="tst-taulu" role="table" aria-label="Tulostaulu"></div></section>

      <section class="jtt-osio"><div class="jtt-osio-paa"><h2>Kehitys</h2><span class="pieni">${g === "superpesis" ? "testikerroittain, pelaajan paras kerralla" : "kausittain, pelaajan kauden paras"}</span></div>
        <p class="pieni">Ohut viiva on pelaaja, katkoviiva mediaani. ${T.pienempi_parempi ? "Ylempänä on parempi. " : ""}Korosta pelaajia tulostaulun sijanumerosta.</p>
        <div class="paneeli"><div class="kaavio"><canvas id="tst-kehitys"></canvas></div></div></section>

      ${t === "lyonti" && g === "superpesis" ? `<section class="jtt-osio"><div class="jtt-osio-paa"><h2>Lyönnit mailoittain</h2><span class="pieni">kovin lyönti kerralla</span></div><div class="taulu-wrap"><table id="t-mailat"></table></div><p class="vihje">Tyhjä solu: mailalla ei lyöty kyseisellä kerralla. Korostettu on pelaajan kovin lyönti kerralla.</p></section>` : ""}
      ${LT.includes(t) && g === "superpesis" ? `<section class="jtt-osio"><div class="jtt-osio-paa"><h2>Lyöntiprofiili</h2><span class="pieni">talven keskiarvot</span></div><div class="taulu-wrap"><table id="t-profiili"></table></div><p class="vihje">Pelaajan keskiarvo kaikilta lyöntitestikerroilta. Mitä kirkkaampi solu, sitä parempi tulos joukkueen sisällä. Pelaajat tekevät joko 1-raja- tai keskipomppu- ja joko kumura- tai viistaritestin, joten osa soluista jää tyhjäksi.</p></section>` : ""}
      ${g === "juniorit" ? `<div id="tst-juniorit"></div>` : ""}`;

    const piirraTaulu = () => {
      const kaikkiArvot = rivit.flatMap((r) => [r.v, r.ed?.arvo]).filter((x) => x != null);
      let lo = Math.min(...kaikkiArvot), hi = Math.max(...kaikkiArvot);
      const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.02 || 1; lo -= pad; hi += pad;
      const pos = (v) => (T.pienempi_parempi ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo)) * 100;
      $("#tst-taulu").innerHTML = `
        <div class="jtt-r jtt-ots" role="row"><span role="columnheader">#</span><span role="columnheader">Pelaaja</span><span role="columnheader" class="jtt-rata-ots">${esc(tnimi(T))}</span><span role="columnheader" class="n">Tulos</span><span role="columnheader" class="n">Muutos</span><span role="columnheader" class="n jtt-lisa">Ennätys</span><span role="columnheader" class="n jtt-lisa2">${g === "juniorit" ? "Ikäluokassa" : "Kertoja"}</span></div>
        ${rivit.map((r) => {
          const p = pv(r.x), kor = S.korostus.has(p.id), sy = p.syntymavuosi;
          const m = r.ed ? parannus(t, r.v, r.ed.arvo) : null, plus = m > 0, miinus = m < 0;
          return `<div class="jtt-r${kor ? " korostettu" : ""}" role="row">
            <span role="cell"><button class="jtt-sija" data-kor="${p.id}" aria-pressed="${kor}" title="Korosta kaaviossa">${r.sija?.sija ?? "–"}</button></span>
            <span role="cell" class="jtt-nimi"><a href="#/pelaaja/${p.id}">${kuva(p)}<span><b>${esc(nimi(p))}</b><small>${g === "superpesis" ? "Superpesis" : sy ? `${sy} · ${kevat(r.x.pvm) - sy} v` : "juniori"}</small></span></a></span>
            <span role="cell" class="jtt-rata" aria-hidden="true"><i class="jtt-md" style="left:${pos(md)}%"></i>
              ${r.ed ? `<i class="jtt-yhd ${plus ? "plus" : miinus ? "miinus" : ""}" style="left:${Math.min(pos(r.ed.arvo), pos(r.v))}%;width:${Math.abs(pos(r.v) - pos(r.ed.arvo))}%"></i><i class="jtt-pallo haamu" style="left:${pos(r.ed.arvo)}%" title="Edellinen ${fmt(r.ed.arvo)} (${pvmLyhyt(r.ed.pvm)})"></i>` : ""}
              <i class="jtt-pallo${r.uusiPb ? " pb" : ""}" style="left:${pos(r.v)}%"></i></span>
            <span role="cell" class="n jtt-tulos">${fmt(r.v)}${r.uusiPb ? `<em class="jtt-pb" title="Uusi ennätys">PB</em>` : ""}</span>
            <span role="cell" class="n jtt-muutos ${plus ? "plus" : miinus ? "miinus" : ""}" title="${r.ed ? `Edellinen ${fmt(r.ed.arvo)} ${esc(T.yksikko)}, ${pvm(r.ed.pvm)}` : "Ensimmäinen tulos"}">${r.ed ? `${plus ? "▲" : miinus ? "▼" : "•"} ${muotoileMuutos(r.v - r.ed.arvo, t)}` : `<span class='pieni'>1. tulos</span>`}</span>
            <span role="cell" class="n jtt-lisa">${fmt(r.enn)}</span>
            <span role="cell" class="n jtt-lisa2">${g === "juniorit" ? (r.ikaS ? `<span class="jtt-ikas ${r.ikaS.pct >= 67 ? "hyva" : r.ikaS.pct >= 34 ? "keski" : "heikko"}" title="Kauden parhaiden perusteella ikäluokassa ${sy}">${r.ikaS.sija}./${r.ikaS.n}</span>` : "<span class='pieni'>–</span>") : r.kerrat}</span>
          </div>`; }).join("")}`;
      $$("[data-kor]", $("#tst-taulu")).forEach((b) => (b.onclick = () => { S.korostus.has(b.dataset.kor) ? S.korostus.delete(b.dataset.kor) : S.korostus.add(b.dataset.kor); piirraTaulu(); kehitys(); }));
    };

    // kehityskaavio: kerrat (Superpesis) tai kaudet (juniorit); näytetään tulostaulun pelaajat
    const pelaajat = [...new Set(rivit.map((r) => r.x.pelaaja))];
    const kehitys = () => {
      const varit = ["#F5A800", "#FF3B4E", "#2EE59D", "#7DD3FC", "#A78BFA", "#C98A00", "#F472B6"];
      let labels, arvo;
      if (g === "superpesis") {
        const kk = [...new Set(kaikki.map((x) => x.kerta))].map((k) => tila.kerta[k]).sort((a, b) => a.pvm.localeCompare(b.pvm));
        labels = kk.map((k) => pvmLyhyt(k.pvm));
        arvo = (pid) => kk.map((k) => kaikki.find((x) => x.pelaaja === pid && x.kerta === k.id)?.arvo ?? null);
      } else {
        const ks = [...new Set(kaikki.map((x) => kausi(x.pvm)))].sort();
        labels = ks;
        arvo = (pid) => ks.map((k) => parasMap(kaikki.filter((x) => x.pelaaja === pid && kausi(x.pvm) === k)).get(pid)?.arvo ?? null);
      }
      const sarjat = pelaajat.map((pid) => [pid, arvo(pid)]);
      const ds = sarjat.map(([pid, a]) => { const kor = S.korostus.has(pid), c = kor ? varit[[...S.korostus].indexOf(pid) % varit.length] : "rgba(145,137,125,.4)";
        return { label: nimi(tila.pelaaja[pid]), data: a, borderColor: c, backgroundColor: c, borderWidth: kor ? 3 : 1, pointRadius: kor ? 4 : 2, spanGaps: true, order: kor ? 0 : 2, _pid: pid }; });
      ds.push({ label: "Mediaani", data: labels.map((_, i) => mediaani(sarjat.map(([, a]) => a[i]).filter((x) => x != null))), borderColor: vari("--ink"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, order: 1 });
      piirra($("#tst-kehitys"), { type: "line", data: { labels, datasets: ds },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false },
          tooltip: { filter: (c) => !S.korostus.size || S.korostus.has(c.dataset._pid) || c.dataset.label === "Mediaani", callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
          scales: { y: { reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko } }, x: { grid: { display: false } } } } });
    };
    piirraTaulu();
    kehitys();
    if (g === "superpesis") lisaosiot(T);
    else juniorit($("#tst-juniorit"), T);
  }

  // ---------- Superpesis: mailat ja lyöntiprofiili
  function lisaosiot(T) {
    const t = T.koodi, D = data.superpesis, fmt = (v) => (v == null ? "" : muotoile(v, t));
    const rr = D.parhaat.filter((x) => x.testi === t);
    const kerrat = [...new Set(rr.map((x) => x.kerta))].map((k) => tila.kerta[k]).sort((a, b) => a.pvm.localeCompare(b.pvm));
    const pelaajat = [...new Set(rr.map((x) => x.pelaaja))].map((id) => tila.pelaaja[id]).sort((a, b) => nimi(a).localeCompare(nimi(b), "fi"));
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

  // ---------- Juniorit: ikäluokat samassa iässä ja ennätykset ikävuosittain
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

    el.innerHTML = `
      <section class="jtt-osio"><div class="jtt-osio-paa"><h2>Ikäluokat samassa iässä</h2><span class="pieni">mediaani kauden parhaista</span></div>
      ${ika.length ? `<p class="pieni">Viiva kulkee ikäluokan läpi talvi talvelta. Ikä on se, jonka pelaaja täyttää talven aikana (talvella 2025–26 vuonna 2009 syntynyt on 17). Ontto piste = alle viisi pelaajaa, suuntaa-antava. Mukana ikäluokat, joista vähintään kolme pelaajaa.</p>
      <div class="paneeli"><div class="kaavio"><canvas id="k-ika" aria-label="Ikäluokkien tulokset iän mukaan"></canvas></div></div>
      <div class="taulu-wrap" style="margin-top:12px"><table id="ika-taulu"></table></div>` : `<p class="pieni">Ikäluokkavertailuun tarvitaan vähintään kolme saman ikäluokan pelaajaa samalta talvelta.</p>`}</section>
      <section class="jtt-osio"><div class="jtt-osio-paa"><h2>Ennätykset ikävuosittain</h2><span class="pieni">viisi parasta per ikä, myös entiset pelaajat</span></div>
      <div class="tst-ennatykset" id="ikaennatykset"></div></section>`;

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

    const ik = new Map();
    for (const x of kausiparhaat) { if (!x.syntymavuosi) continue; const a = x.kevat - x.syntymavuosi; (ik.get(a) || ik.set(a, []).get(a)).push(x); }
    $("#ikaennatykset").innerHTML = [...ik.keys()].sort((a, b) => a - b).map((a) => {
      const top = ik.get(a).sort((x, y) => (T.pienempi_parempi ? x.arvo - y.arvo : y.arvo - x.arvo)).slice(0, 5);
      return `<div class="jtt-kpi tst-ennkortti"><span class="jtt-kpi-ots">${a}-vuotiaat</span><span class="jtt-kpi-arvo">${muotoile(top[0].arvo, t)}<small>${esc(T.yksikko)}</small></span><span class="jtt-kpi-ala">${esc(nimi(tila.pelaaja[top[0].pelaaja]))} · ${top[0].kevat - 1}–${String(top[0].kevat).slice(2)}</span>
        ${top.length > 1 ? `<ol class="tst-enn-lista" start="2">${top.slice(1).map((x) => `<li><span class="num">${muotoile(x.arvo, t)}</span> ${esc(nimi(tila.pelaaja[x.pelaaja]))} <span class="pieni">${x.kevat - 1}–${String(x.kevat).slice(2)}</span></li>`).join("")}</ol>` : ""}</div>`;
    }).join("");
  }

  $$("[data-ryhma]").forEach((b) => (b.onclick = () => {
    S.ryhma = b.dataset.ryhma; S.korostus.clear();
    $$("[data-ryhma]").forEach((x) => x.setAttribute("aria-checked", x === b));
    if (!lkm(S.ryhma, S.luokka)) S.luokka = LUOKAT.find(([k]) => lkm(S.ryhma, k))?.[0] || S.luokka;
    S.testi = null; piirraLuokat(); piirraLuokka();
  }));
  piirraLuokat();
  piirraLuokka();
  if (testi) $("#testi-ankkuri")?.scrollIntoView({ block: "start" });
}
