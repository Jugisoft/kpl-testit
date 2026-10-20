// Pelaajavertailu (20.10.2026): kaksi KPL:n pelaajaa rinnakkain, YDIN 2027:n vertailu.html:n mallin mukaan.
// Testitulokset (ominaisuudet) luokittain + viralliset pelitilastot (taulu tilastot, Superpesis) + kehitys samassa iässä.
// Osoite #/vertailu/<A>/<B>. A = kulta (vasen), B = sininen (oikea).
import { sb, tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, kausi, paras, parannus, testiParhaat, kuva, piirra, vari } from "../util.js";
import { LUOKAT } from "./testit.js";

const VA = "#F5A800", VB = "#7DD3FC";
let S = { a: null, b: null, tapa: "kausi", testi: "30m", akseli: "ika" };
let tilastot = null; // ref_id -> [{kausi, vaihe, joukkue, data}]

const onSp = (pid) => /superpesis/i.test(tila.joukkueet.find((j) => j.id === tila.pelaaja[pid]?.joukkue_id)?.nimi || "");
const ryhmaNimi = (q) => (onSp(q.id) ? "Superpesis" : q.syntymavuosi && q.syntymavuosi >= 2007 ? `Juniorit ${q.syntymavuosi}` : "Muut");
const tNimi = (t) => (t === "nok_30m" ? "9×30 m (ka)" : t === "lentava20" ? "Lentävä 20 m" : tila.testi[t].nimi.replace(/^Edustuksen lyöntitesti: |^Lyöntitesti: /, "LT: ").replace(" juoksu", "").replace(" väliaika", ""));
const fmt = (t, v) => (v == null ? "–" : muotoile(v, t === "lentava20" ? "30m" : t));
const fi = (v, d = 1) => (v == null || !isFinite(v) ? "–" : v.toFixed(d).replace(".", ","));
// ikä testihetkellä (syntymäpäivää ei tiedetä: vuoden puoliväli)
const ikaPvm = (p, d) => (p?.syntymavuosi ? +d.slice(0, 4) + (+d.slice(5, 7) - 0.5) / 12 - p.syntymavuosi - 0.5 : null);

export async function nayta(main, a, b) {
  varastot.clear();
  const [rivit] = await Promise.all([lataaTulokset(), haeTilastot()]);
  const kaikki = testiParhaat(rivit);
  const testatut = new Set(kaikki.map((x) => x.pelaaja));
  const lista = tila.pelaajat.filter((q) => testatut.has(q.id) || tilastot.has(q.pesistulokset_id));
  if (a && tila.pelaaja[a]) S.a = a;
  if (b && tila.pelaaja[b]) S.b = b;
  if (!S.a || !tila.pelaaja[S.a]) S.a = lista.find((q) => q.aktiivinen && !onSp(q.id))?.id || lista[0]?.id;
  if (!S.b || !tila.pelaaja[S.b] || S.b === S.a) S.b = lista.find((q) => q.aktiivinen && q.id !== S.a && onSp(q.id) && testatut.has(q.id))?.id || lista.find((q) => q.id !== S.a)?.id;

  const valikko = (id, arvo) => {
    const ryhmat = new Map();
    lista.filter((q) => q.aktiivinen || q.id === arvo).forEach((q) => { const r = ryhmaNimi(q); (ryhmat.get(r) || ryhmat.set(r, []).get(r)).push(q); });
    const jarj = [...ryhmat.keys()].sort((x, y) => (x === "Superpesis" ? -1 : y === "Superpesis" ? 1 : x === "Muut" ? 1 : y === "Muut" ? -1 : x.localeCompare(y)));
    return `<select id="${id}">${jarj.map((r) => `<optgroup label="${esc(r)}">${ryhmat.get(r).sort((x, y) => nimi(x).localeCompare(nimi(y), "fi")).map((q) => `<option value="${q.id}"${q.id === arvo ? " selected" : ""}>${esc(nimi(q))}</option>`).join("")}</optgroup>`).join("")}</select>`;
  };

  main.innerHTML = `
    <div class="vt-paa"><div><span class="jtt-yla">Testit · Analyysi</span><h1>Pelaajavertailu</h1>
      <p class="ingressi">Kaksi pelaajaa rinnakkain: ominaisuudet testeistä ja suoritukset kentällä. Vahvempi korostettu.</p></div></div>
    <div class="vt-pick">
      <label class="a"><span>Pelaaja A</span>${valikko("vt-a", S.a)}</label>
      <button class="btn vt-vaihda" id="vt-vaihda" title="Vaihda puolia" aria-label="Vaihda puolia">⇄</button>
      <label class="b"><span>Pelaaja B</span>${valikko("vt-b", S.b)}</label>
    </div>
    <section class="vt-hero paneeli" id="vt-hero" aria-live="polite"></section>
    <div class="vt-cols">
      <section class="paneeli"><div class="vt-otsa"><h2>Testit</h2>
        <div class="jtt-segmentti" role="radiogroup" aria-label="Tulos">${[["kausi", "Kauden paras"], ["pb", "Ennätys"]].map(([k, n]) => `<button role="radio" data-tapa="${k}" aria-checked="${k === S.tapa}">${n}</button>`).join("")}</div></div>
        <p class="pieni" id="vt-tselite"></p><div id="vt-testit"></div></section>
      <div class="vt-oikea">
        <section class="paneeli"><div class="vt-otsa"><h2>Pelitilastot</h2><span class="pieni" id="vt-ptsel"></span></div><div id="vt-peli"></div></section>
        <section class="paneeli"><div class="vt-otsa"><h2>Kehitys</h2>
          <div class="jtt-segmentti" role="radiogroup" aria-label="Vaaka-akseli">${[["ika", "Samassa iässä"], ["pvm", "Ajan mukaan"]].map(([k, n]) => `<button role="radio" data-akseli="${k}" aria-checked="${k === S.akseli}">${n}</button>`).join("")}</div></div>
          <div class="chipit pieni-chipit" id="vt-tchips"></div>
          <div class="kaavio"><canvas id="vt-kaavio"></canvas></div><p class="vihje" id="vt-kselite"></p></section>
      </div>
    </div>`;

  const piirraKaikki = () => {
    history.replaceState(null, "", `#/vertailu/${S.a}/${S.b}`);
    hero(kaikki); testit(kaikki); peli(); kehitys(kaikki);
  };
  $("#vt-a").onchange = (e) => { S.a = e.target.value; piirraKaikki(); };
  $("#vt-b").onchange = (e) => { S.b = e.target.value; piirraKaikki(); };
  $("#vt-vaihda").onclick = () => { [S.a, S.b] = [S.b, S.a]; $("#vt-a").value = S.a; $("#vt-b").value = S.b; piirraKaikki(); };
  $$("[data-tapa]").forEach((x) => (x.onclick = () => { S.tapa = x.dataset.tapa; $$("[data-tapa]").forEach((y) => y.setAttribute("aria-checked", y === x)); hero(kaikki); testit(kaikki); }));
  $$("[data-akseli]").forEach((x) => (x.onclick = () => { S.akseli = x.dataset.akseli; $$("[data-akseli]").forEach((y) => y.setAttribute("aria-checked", y === x)); kehitys(kaikki); }));
  piirraKaikki();
}

async function haeTilastot() {
  if (tilastot) return;
  tilastot = new Map();
  const { data } = await sb.from("tilastot").select("ref_id,nimi,joukkue,kausi,vaihe,data").eq("tyyppi", "pelaaja");
  (data || []).forEach((r) => (tilastot.get(r.ref_id) || tilastot.set(r.ref_id, []).get(r.ref_id)).push(r));
}

// pelaajan arvo testissä: kauden paras uusimmalta kaudelta, jolla testi tehty, tai kaikkien aikojen ennätys
function arvoTesti(kaikki, pid, t) {
  const omat = kaikki.filter((x) => x.pelaaja === pid && x.testi === t);
  if (!omat.length) return null;
  if (S.tapa === "pb") { const v = paras(t, omat.map((x) => x.arvo)); return { v, k: kausi(omat.find((x) => x.arvo === v).pvm) }; }
  const k = kausi(omat.at(-1).pvm);
  return { v: paras(t, omat.filter((x) => kausi(x.pvm) === k).map((x) => x.arvo)), k };
}
// kaikkien testattujen arvot samalla tavalla laskettuna (palkkien prosenttipiste)
const varastot = new Map();
function prosentti(kaikki, t, v) {
  const avain = t + S.tapa;
  if (!varastot.has(avain)) { const pel = [...new Set(kaikki.filter((x) => x.testi === t).map((x) => x.pelaaja))]; varastot.set(avain, pel.map((pid) => arvoTesti(kaikki, pid, t)?.v).filter((x) => x != null)); }
  const a = varastot.get(avain); if (a.length < 2) return 50;
  return Math.round((100 * a.filter((x) => parannus(t, v, x) > 0).length) / (a.length - 1));
}

function yhteiset(kaikki) {
  const ta = new Set(kaikki.filter((x) => x.pelaaja === S.a).map((x) => x.testi)), tb = new Set(kaikki.filter((x) => x.pelaaja === S.b).map((x) => x.testi));
  return { ta, tb, mol: [...ta].filter((t) => tb.has(t)) };
}

function hero(kaikki) {
  const A = tila.pelaaja[S.a], B = tila.pelaaja[S.b];
  const { mol } = yhteiset(kaikki);
  let va = 0, vb = 0;
  mol.forEach((t) => { const a = arvoTesti(kaikki, S.a, t).v, b = arvoTesti(kaikki, S.b, t).v; const d = parannus(t, a, b); if (d > 0) va++; else if (d < 0) vb++; });
  const ala = (p) => `${esc(ryhmaNimi(p))}${p.syntymavuosi ? ` · s. ${p.syntymavuosi}` : ""}`;
  $("#vt-hero").innerHTML = `
    <div class="vt-p a">${kuva(A, true)}<b>${esc(nimi(A))}</b><small>${ala(A)}</small><a class="pieni" href="#/pelaaja/${A.id}">pelaajakortti</a></div>
    <div class="vt-keski"><small>Testit, parempi tulos</small><span class="vt-iso"><i class="a">${va}</i>–<i class="b">${vb}</i></span><small>${mol.length} yhteistä testiä${mol.length - va - vb ? ` · ${mol.length - va - vb} tasan` : ""}</small><div class="vt-hero-jako" id="vt-hero-jako"></div></div>
    <div class="vt-p b">${kuva(B, true)}<b>${esc(nimi(B))}</b><small>${ala(B)}</small><a class="pieni" href="#/pelaaja/${B.id}">pelaajakortti</a></div>`;
  JAKO.testit = { va, vb, n: mol.length };
  paivitaHeroJako();
}

// kaksipuolinen vertailurivi YDINin tapaan: palkit = prosenttipiste kaikista testatuista (testit) tai suhde (tilastot)
// prosenttijakauma: osuus vertailuista (tasapeli puoliksi kummallekin)
function jakauma(va, vb, n, otsikko) {
  if (!n) return "";
  const pa = Math.round((100 * (va + (n - va - vb) / 2)) / n), pb = 100 - pa;
  return `<div class="vt-jako" title="${esc(otsikko)}: ${va} – ${vb}${n - va - vb ? `, ${n - va - vb} tasan` : ""} (${n} vertailua)">
    <span class="a num">${pa} %</span><span class="vt-jako-pk"><i class="a" style="width:${pa}%"></i><i class="b" style="width:${pb}%"></i></span><span class="b num">${pb} %</span>
    <small>${esc(otsikko)} · ${va}–${vb}${n - va - vb ? ` · ${n - va - vb} tasan` : ""}</small></div>`;
}
const JAKO = { testit: null, peli: null };
function paivitaHeroJako() {
  const el = $("#vt-hero-jako"); if (!el) return;
  el.innerHTML = [["Testit", JAKO.testit], ["Kenttä", JAKO.peli]].filter(([, j]) => j && j.n).map(([n, j]) => jakauma(j.va, j.vb, j.n, n)).join("");
}
function rivi(lab, a, b, { fa = String, sa = "", sb = "", pa = null, pb = null, voittaja = 0 } = {}) {
  const wa = voittaja > 0, wb = voittaja < 0;
  return `<div class="vt-r"><span class="v a${wa ? " voitto" : ""}">${fa(a)}${sa ? `<small>${sa}</small>` : ""}</span>
    <span class="mid"><span class="lab">${esc(lab)}</span><span class="bars"><i>${pa != null ? `<b class="${wa ? "lead" : ""}" style="width:${Math.max(2, pa)}%"></b>` : ""}</i><i>${pb != null ? `<b class="${wb ? "lead" : ""}" style="width:${Math.max(2, pb)}%"></b>` : ""}</i></span></span>
    <span class="v b${wb ? " voitto" : ""}">${fa(b)}${sb ? `<small>${sb}</small>` : ""}</span></div>`;
}

function testit(kaikki) {
  const { ta, tb } = yhteiset(kaikki);
  const kaikkiT = [...new Set([...ta, ...tb])].filter((t) => tila.testi[t]);
  const ryhmat = LUOKAT.map(([k, n]) => [n, kaikkiT.filter((t) => tila.testi[t].luokka === k).sort((x, y) => (tila.testi[x].jarjestys ?? 99) - (tila.testi[y].jarjestys ?? 99))]).filter(([, x]) => x.length);
  const muut = kaikkiT.filter((t) => !LUOKAT.some(([k]) => k === tila.testi[t].luokka));
  if (muut.length) ryhmat.push(["Muut", muut]);
  $("#vt-tselite").textContent = S.tapa === "kausi"
    ? "Pelaajan paras tulos uusimmalta kaudelta, jolla testi on tehty (kausi pienellä). Palkki = monenko prosentin testatuista pelaaja ohittaa."
    : "Pelaajan kaikkien aikojen paras tulos (kausi pienellä). Palkki = monenko prosentin testatuista pelaaja ohittaa.";
  $("#vt-testit").innerHTML = (JAKO.testit?.n ? jakauma(JAKO.testit.va, JAKO.testit.vb, JAKO.testit.n, "Testit, parempi tulos") : "") + ryhmat.map(([n, ts]) => `<h3 class="vt-luokka">${esc(n)}</h3>` + ts.map((t) => {
    const a = arvoTesti(kaikki, S.a, t), b = arvoTesti(kaikki, S.b, t);
    const d = a && b ? parannus(t, a.v, b.v) : 0;
    return rivi(`${tNimi(t)} · ${tila.testi[t].yksikko}`, a?.v, b?.v, { fa: (v) => fmt(t, v), sa: a?.k || "", sb: b?.k || "",
      pa: a ? prosentti(kaikki, t, a.v) : null, pb: b ? prosentti(kaikki, t, b.v) : null, voittaja: d > 0 ? 1 : d < 0 ? -1 : 0 });
  }).join("")).join("") || `<p class="tyhja">Ei testituloksia.</p>`;
}

// Pelitilastot: taulu tilastot, vaihe "kpl_kaikki" = KPL:n pelaajien kaikki viralliset sarjat kausittain
// (05 Jarvis/Työkalut/vie_omat_tilastot.py); d = kauden yhteissummat, d.sarjat = sarjakohtaiset luvut.
// sarjavalinta pelaajakohtaisesti (Jugi 20.10.2026): pojat pelaavat eritasoisia sarjoja, joten kummallekin valitaan omat
const PS = { kausi: null, a: null, b: null }; // a/b = Set sarjojen nimistä tai null = kaikki sarjat
const SUMMA_K = ["O", "K", "L", "T", "KL", "KLY", "KL0", "KL1", "KL2", "KL3", "KLY0", "KLY1", "KLY2", "KLY3"];
function yhdista(d, valitut) {
  if (!d) return null;
  if (!valitut) return d;
  const ss = (d.sarjat || []).filter((x) => valitut.has(x.nimi));
  if (!ss.length) return null;
  const out = { sarjat: ss }; SUMMA_K.forEach((k) => (out[k] = ss.reduce((a, x) => a + (x[k] || 0), 0)));
  return out;
}
function peli() {
  const A = tila.pelaaja[S.a], B = tila.pelaaja[S.b];
  const omat = (p) => (tilastot.get(p.pesistulokset_id) || []).filter((r) => r.vaihe === "kpl_kaikki");
  const ra = omat(A), rb = omat(B);
  const kaudet = [...new Set([...ra, ...rb].map((r) => r.kausi))].sort((x, y) => y - x);
  if (!kaudet.length) {
    JAKO.peli = null; paivitaHeroJako();
    $("#vt-ptsel").textContent = "";
    $("#vt-peli").innerHTML = `<p class="pieni">Kummallakaan pelaajalla ei ole pelitilastoja (pesistulokset.fi-tunniste puuttuu tai ei otteluita).</p>`;
    return;
  }
  const yhteiset = kaudet.filter((k) => ra.some((r) => r.kausi === k) && rb.some((r) => r.kausi === k));
  if (!kaudet.includes(PS.kausi)) PS.kausi = yhteiset[0] ?? kaudet[0];
  const da = ra.find((r) => r.kausi === PS.kausi)?.data, db = rb.find((r) => r.kausi === PS.kausi)?.data;
  // valinnat nollataan, jos valittuja sarjoja ei ole tällä kaudella
  const tarkista = (k, d) => { if (PS[k] && !(d?.sarjat || []).some((x) => PS[k].has(x.nimi))) PS[k] = null; };
  tarkista("a", da); tarkista("b", db);
  const a = yhdista(da, PS.a), b = yhdista(db, PS.b);
  $("#vt-ptsel").innerHTML = `<select id="vt-kausi" aria-label="Kausi">${kaudet.map((k) => `<option${k === PS.kausi ? " selected" : ""}>${k}</option>`).join("")}</select>`;
  $("#vt-kausi").onchange = (e) => { PS.kausi = +e.target.value; peli(); };
  const valinnat = (k, d, p) => !d?.sarjat?.length ? "" : `<div class="vt-sv ${k}"><span class="vt-sv-nimi">${esc(p.etunimi)}</span>
    <button class="chip${!PS[k] ? " on" : ""}" data-sv="${k}" data-sarja="" aria-pressed="${!PS[k]}">Kaikki</button>
    ${d.sarjat.map((x) => { const on = !!PS[k]?.has(x.nimi); return `<button class="chip${on ? " on" : ""}" data-sv="${k}" data-sarja="${esc(x.nimi)}" aria-pressed="${on}" title="${esc(x.taso || "")}">${esc(x.nimi)} <small>${x.O}</small></button>`; }).join("")}</div>`;
  const svHtml = `<div class="vt-sarjavalinnat">${valinnat("a", da, A)}${valinnat("b", db, B)}</div>`;
  const sarjaLista = (d) => (d?.sarjat || []).map((x) => `${esc(x.nimi)} ${x.O}`).join(" · ");
  const y = (p) => (p ? (p.K || 0) + (p.L || 0) + (p.T || 0) : null);
  const pct = (p, k, n, min = 10) => (p && p[n] >= min ? (100 * p[k]) / p[n] : null);
  const vert = (va, vb, dir = 1) => (va == null || vb == null ? 0 : dir * (va - vb) > 0 ? 1 : dir * (va - vb) < 0 ? -1 : 0);
  const suhde = (va, vb) => { const m = Math.max(Math.abs(va || 0), Math.abs(vb || 0), 1e-9); return [va == null ? null : (100 * Math.abs(va)) / m, vb == null ? null : (100 * Math.abs(vb)) / m]; };
  const voitot = { va: 0, vb: 0, n: 0 };
  const r = (lab, va, vb, fa, opt = {}) => { const [pa, pb] = opt.sata ? [va, vb] : suhde(va, vb), w = opt.dir === 0 ? 0 : vert(va, vb, opt.dir ?? 1);
    if (opt.dir !== 0 && va != null && vb != null) { voitot.n++; if (w > 0) voitot.va++; else if (w < 0) voitot.vb++; }
    return rivi(lab, va, vb, { fa, pa, pb, voittaja: w, sa: opt.sa || "", sb: opt.sb || "" }); };
  const pr = (lab, k, n) => r(lab, pct(a, k, n), pct(b, k, n), (v) => (v == null ? "–" : fi(v) + " %"), { sata: true, sa: a ? `${a[k] ?? 0}/${a[n] ?? 0}` : "", sb: b ? `${b[k] ?? 0}/${b[n] ?? 0}` : "" });
  const puuttuu = [[A, a], [B, b]].filter(([, d]) => !d).map(([p]) => esc(nimi(p)));
  // urataulukko: kaikki kaudet rinnakkain (kaikki sarjat)
  const ura = kaudet.map((k) => { const x = ra.find((q) => q.kausi === k)?.data, z = rb.find((q) => q.kausi === k)?.data, ya = y(x), yb = y(z), kla = pct(x, "KL", "KLY"), klb = pct(z, "KL", "KLY");
    return `<tr${k === PS.kausi ? ' class="valittu"' : ""} data-ura="${k}"><td class="l">${k}</td><td>${x ? x.O : "–"}</td><td class="${ya != null && yb != null && ya / Math.max(1, x.O) > yb / Math.max(1, z.O) ? "ca" : ""}">${x ? `${ya} <small>${fi(ya / Math.max(1, x.O), 2)}</small>` : "–"}</td><td class="${kla != null && klb != null && kla > klb ? "ca" : ""}">${kla != null ? fi(kla) : "–"}</td>
      <td>${z ? z.O : "–"}</td><td class="${ya != null && yb != null && yb / Math.max(1, z.O) > ya / Math.max(1, x.O) ? "cb" : ""}">${z ? `${yb} <small>${fi(yb / Math.max(1, z.O), 2)}</small>` : "–"}</td><td class="${kla != null && klb != null && klb > kla ? "cb" : ""}">${klb != null ? fi(klb) : "–"}</td></tr>`; }).join("");
  $("#vt-peli").innerHTML = svHtml + (puuttuu.length ? `<p class="pieni">${puuttuu.join(" ja ")}: ei otteluita valituissa sarjoissa kaudella ${PS.kausi}.</p>` : "")
    + "%%JAKO%%" + [
    r("Ottelut", a?.O, b?.O, (v) => v ?? "–", { dir: 0 }),
    r("YHT", y(a), y(b), (v) => v ?? "–"),
    r("YHT / ottelu", a?.O ? y(a) / a.O : null, b?.O ? y(b) / b.O : null, (v) => fi(v, 2)),
    r("Kunnarit (K)", a?.K, b?.K, (v) => v ?? "–"),
    r("Lyödyt (L)", a?.L, b?.L, (v) => v ?? "–"),
    r("Tuodut (T)", a?.T, b?.T, (v) => v ?? "–"),
    pr("KL%", "KL", "KLY"),
    pr("KL% kentälle pääsy (0)", "KL0", "KLY0"),
    pr("KL% 1-tilanne", "KL1", "KLY1"),
    pr("KL% 2-tilanne", "KL2", "KLY2"),
    pr("KL% takatilanne (3)", "KL3", "KLY3"),
  ].join("") + rooliOsio(A, a, B, b)
    + `<h3 class="vt-luokka">Ura kausittain</h3><div class="taulu-wrap vt-ura"><table><thead><tr><th class="l">Kausi</th><th>O</th><th><span class="vt-piste a"></span>YHT <small>/ott.</small></th><th>KL%</th><th>O</th><th><span class="vt-piste b"></span>YHT <small>/ott.</small></th><th>KL%</th></tr></thead><tbody>${ura}</tbody></table></div>`
    + `<p class="vihje">Lähde pesistulokset.fi, kaikki viralliset sarjat. Valitse kummallekin pelaajalle sarjat erikseen (napit ylhäällä, numero = ottelut): eritasoisten sarjojen luvut eivät ole suoraan vertailukelpoisia. Rooli ja jakauma lasketaan valituista sarjoista; urataulukko on aina kaikista sarjoista. KL% = kärkilyöntien onnistumis-%, tilanne = kärkietenijän lähtöpesä (0 = lyöjä itse kentälle). Prosentit vähintään 10 yrityksestä. Urataulukon riviä klikkaamalla vaihtuu tarkasteltava kausi.</p>`;
  $("#vt-peli").innerHTML = $("#vt-peli").innerHTML.replace("%%JAKO%%", jakauma(voitot.va, voitot.vb, voitot.n, `Pelitilastot, vahvempi ${PS.kausi}${PS.a || PS.b ? " · valitut sarjat" : ""}`));
  JAKO.peli = voitot; paivitaHeroJako();
  $$("[data-ura]").forEach((tr) => (tr.onclick = () => { PS.kausi = +tr.dataset.ura; peli(); }));
  $$("[data-sv]").forEach((c) => (c.onclick = () => {
    const k = c.dataset.sv, n = c.dataset.sarja;
    if (!n) PS[k] = null;
    else { const v = new Set(PS[k] || []); v.has(n) ? v.delete(n) : v.add(n); PS[k] = v.size ? v : null; }
    peli();
  }));
}

function kehitys(kaikki) {
  const A = tila.pelaaja[S.a], B = tila.pelaaja[S.b];
  const { ta, tb, mol } = yhteiset(kaikki);
  const vaihtoehdot = [...new Set([...mol, ...ta, ...tb])].filter((t) => tila.testi[t]).sort((x, y) => (mol.includes(y) - mol.includes(x)) || (tila.testi[x].jarjestys ?? 99) - (tila.testi[y].jarjestys ?? 99));
  if (!vaihtoehdot.includes(S.testi)) S.testi = vaihtoehdot[0];
  $("#vt-tchips").innerHTML = vaihtoehdot.slice(0, 14).map((t) => `<button class="chip" data-vt="${t}" aria-pressed="${t === S.testi}">${esc(tNimi(t))}</button>`).join("");
  $$("[data-vt]").forEach((x) => (x.onclick = () => { S.testi = x.dataset.vt; kehitys(kaikki); }));
  const t = S.testi; if (!t) return;
  const T = tila.testi[t], ika = S.akseli === "ika" && A.syntymavuosi && B.syntymavuosi;
  const pisteet = (p) => kaikki.filter((x) => x.pelaaja === p.id && x.testi === t).map((x) => ({ x: ika ? ikaPvm(p, x.pvm) : new Date(x.pvm).getTime(), y: x.arvo, pvm: x.pvm }));
  const ds = [[A, VA], [B, VB]].map(([p, c]) => ({ label: nimi(p), data: pisteet(p), borderColor: c, backgroundColor: c, borderWidth: 3, pointRadius: 4, tension: 0.2 }));
  const vuodet = (ms) => new Date(ms).toISOString().slice(0, 7).split("-").reverse().map(Number).join("/");
  piirra($("#vt-kaavio"), { type: "line", data: { datasets: ds },
    options: { maintainAspectRatio: false, parsing: false, interaction: { mode: "nearest", intersect: false },
      scales: { x: { type: "linear", title: { display: true, text: ika ? "ikä (v)" : "aika" }, ticks: { callback: (v) => (ika ? fi(v, 0) : vuodet(v)) } },
        y: { reverse: !!T.pienempi_parempi, title: { display: true, text: T.yksikko }, ticks: { callback: (v) => fmt(t, v) } } },
      plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { title: (c) => c[0].raw.pvm.split("-").reverse().join("."), label: (c) => `${c.dataset.label}: ${fmt(t, c.raw.y)} ${T.yksikko}${ika ? ` (${fi(c.raw.x, 1)} v)` : ""}` } } } } });
  $("#vt-kselite").textContent = ika ? "Vaaka-akseli = pelaajan ikä testihetkellä (syntymävuoden mukaan). Näin eri-ikäisiä voi verrata samassa iässä." : "Tulokset testipäivän mukaan.";
}

// ---------- Rooli kentällä: missä tilanteissa pelaaja lyö kärkilyönnit ja tuoko vai lyökö juoksut
const TILANTEET = [["KLY0", "0", "kentälle pääsy"], ["KLY1", "1", "1-tilanne"], ["KLY2", "2", "2-tilanne"], ["KLY3", "3", "takatilanne"]];
const TVARIT = ["#94A3B8", "#7DD3FC", "#F5A800", "#2EE59D"];
// Roolit kärkilyöntien tilannejakauman mukaan (Jugi 20.10.2026): pääosin 0-tilanne = kärkietenijä,
// 1-tilanne = 1-tilanteen vaihtaja, 2-tilanne = 2-tilanteen vaihtaja, takatilanne = kotiuttaja
// vähintään puolet; jos takatilanne on yleisin mutta alle puolet, vaihtaja / kotiuttaja). Mikään tilanne ei yli 35 % = monipuolinen.
function rooli(d) {
  if (!d || !d.KLY || d.KLY < 20) return { nimi: "Liian vähän yrityksiä", syy: "alle 20 kärkilyöntiyritystä" };
  const o = [0, 1, 2, 3].map((n) => (d[`KLY${n}`] || 0) / d.KLY), pc = (x) => `${Math.round(x * 100)} %`;
  const max = Math.max(...o), n = o.indexOf(max);
  const toinen = [0, 1, 2, 3].filter((k) => k !== n).sort((a, b) => o[b] - o[a])[0];
  const lisa = o[toinen] >= 0.2 ? `, toiseksi eniten ${["0-tilanne", "1-tilanne", "2-tilanne", "takatilanne"][toinen]} ${pc(o[toinen])}` : "";
  if (max < 0.35) return { nimi: "Monipuolinen", syy: `mikään tilanne ei erotu (suurin ${["0-tilanne", "1-tilanne", "2-tilanne", "takatilanne"][n]} ${pc(max)})` };
  if (n === 0) return { nimi: "Kärkietenijä", syy: `${pc(o[0])} kärkilyönneistä 0-tilanteessa (kotipesältä kentälle)${lisa}` };
  if (n === 1) return { nimi: "1-tilanteen vaihtaja", syy: `${pc(o[1])} kärkilyönneistä 1-tilanteessa${lisa}` };
  if (n === 2) return { nimi: "2-tilanteen vaihtaja", syy: `${pc(o[2])} kärkilyönneistä 2-tilanteessa${lisa}` };
  const muut12 = o[1] + o[2];
  if (o[3] >= 0.5) return { nimi: "Kotiuttaja", syy: `${pc(o[3])} kärkilyönneistä takatilanteessa${lisa}` };
  return { nimi: "Vaihtaja / kotiuttaja", syy: `takatilanne ${pc(o[3])}, 1- ja 2-tilanne yhteensä ${pc(muut12)}` };
}
function rooliOsio(A, a, B, b) {
  const puoli = (p, d, cls) => {
    if (!d) return `<div class="vt-rooli ${cls}"><span class="vt-rooli-nimi">–</span><span class="pieni">${esc(nimi(p))}: ei pelitilastoja</span></div>`;
    const R = rooli(d);
    const palkki = d && d.KLY ? `<div class="vt-jakauma" aria-label="Kärkilyöntiyritykset tilanteittain">${TILANTEET.map(([k, lyh, n], i) => { const o = (100 * (d[k] || 0)) / d.KLY; return o > 0 ? `<i style="width:${o}%;background:${TVARIT[i]}" title="${n}: ${d[k]} yritystä (${Math.round(o)} %), KL% ${d[k] >= 10 ? fi((100 * d["KL" + lyh]) / d[k]) + " %" : "–"}">${o >= 12 ? lyh : ""}</i>` : ""; }).join("")}</div>` : `<div class="vt-jakauma tyhja"></div>`;
    return `<div class="vt-rooli ${cls}"><span class="vt-rooli-nimi">${esc(R.nimi)}</span>${palkki}<span class="pieni">${esc(R.syy)}</span>
      ${d ? `<span class="vt-lt"><b>${d.T || 0}</b> tuotua · <b>${d.L || 0}</b> lyötyä · <b>${d.K || 0}</b> kunnaria</span>` : `<span class="pieni">${esc(nimi(p))}: ei pelitilastoja</span>`}</div>`;
  };
  return `<h3 class="vt-luokka">Rooli kentällä</h3>
    <div class="vt-roolit">${puoli(A, a, "a")}${puoli(B, b, "b")}</div>
    <div class="vt-tselite">${TILANTEET.map(([, lyh, n], i) => `<span><i style="background:${TVARIT[i]}"></i>${lyh} = ${n}</span>`).join("")}</div>`;
}
