// Kuka tarvitsee huomiota (28.11.2026, Jugi): Valmentajien huone → Pelaaja-analyysi. Joukkueen pelaajat yhdellä
// listalla liikennevaloin + avautuva pelaajan syväsukellus ja sanallinen analyysi. Laskenta js/huomioydin.js;
// kuorma ja läsnäolo samalla putkella kuin Viikkokooste (js/kuorma.js, js/kuormaydin.js).
// Miehet (MSU): ei Nimenhuudon IN/OUT:ia → läsnäolon tilalla oman Treenikeskus-suunnitelman toteutuminen.
import { sb, tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, testiParhaat, muotoile, parannus, pvmLyhyt } from "../util.js";
import { haeKuormaRivit, haeKalenteri } from "../kuorma.js";
import { lisaaPv, maanantai, tanaanHki, kooste as laskeKooste, minStr } from "../kuormaydin.js";
import { tavoiteTila } from "./oma.js";
import { laske as laskeMissio } from "./lyonnit.js";
import { hae as haeHm } from "../huomiointi.js";
import { pelaajanTulokset, ryhmanNormit, profiili, kuukausiaSitten } from "../kokonaisydin.js";
import { laasnaolo, suunnitelma, kuorma, kirjaukset, tavoitteet, missio, testikehitys, pisteet, tarvitseeHuomiota, sanallinen, SWC } from "../huomioydin.js";

const VARI = { pun: "Huomio", kelt: "Seuraa", vihr: "Kunnossa", odottaa: "Odottaa", ei: "–" };
let valittuJ = null, auki = null;
const tNimi = (t) => (t === "nok_30m" ? "9×30 m" : (tila.testi[t]?.nimi || t).replace(/^Edustuksen lyöntitesti: /, "LT: "));

export async function piirraHuomio(el, alueet, avaaVertailu) {
  const sallitut = [...(alueet.includes("sp") ? [3] : []), ...(alueet.includes("psu") ? [1, 2] : [])];
  const joukkueet = tila.joukkueet.filter((j) => sallitut.includes(j.id) && tila.pelaajat.some((p) => p.joukkue_id === j.id && p.aktiivinen));
  if (!joukkueet.length) { el.innerHTML = `<p class="pieni">Ei pelaajia.</p>`; return; }
  if (!joukkueet.some((j) => j.id === valittuJ)) valittuJ = joukkueet[0].id;
  el.innerHTML = `${joukkueet.length > 1 ? `<div class="pieni-chipit vh-tyokalurivi" role="group" aria-label="Joukkue">${joukkueet.map((j) => `<button type="button" class="chip" data-hj="${j.id}" aria-pressed="${j.id === valittuJ}">${esc(j.nimi)}</button>`).join("")}</div>` : ""}<div id="hu-sis"><p class="lataa">Lasketaan signaaleja…</p></div>`;
  $$("[data-hj]", el).forEach((b) => (b.onclick = () => { valittuJ = +b.dataset.hj; auki = null; piirraHuomio(el, alueet, avaaVertailu); }));
  const s = $("#hu-sis", el);
  try { await piirraJoukkue(s, valittuJ, avaaVertailu); }
  catch (e) { console.error(e); s.innerHTML = `<p class="pieni">Signaaleja ei voitu laskea: ${esc(e.message || e)}</p>`; }
}

async function piirraJoukkue(el, joukkue, avaaVertailu) {
  const msu = joukkue === 3;
  const jNimi = tila.joukkueet.find((j) => j.id === joukkue)?.nimi || "";
  const pelaajat = tila.pelaajat.filter((p) => p.joukkue_id === joukkue && p.aktiivinen && p.treeniprofiili !== "ei_b").sort((a, b) => nimi(a).localeCompare(nimi(b), "fi"));
  const ids = pelaajat.map((p) => p.id);
  const tn = tanaanHki(), alku = lisaaPv(tn, -84), vk = maanantai(tn);

  const [nh, rivit, tavRes, lyojat, hm, sairRes, ohjRes] = await Promise.all([
    haeKalenteri(joukkue, alku, lisaaPv(tn, 7)),
    lataaTulokset().then(testiParhaat),
    sb.from("tavoitteet").select("*").in("pelaaja_id", ids),
    sb.rpc("lyojat_pelaajat"),
    haeHm(ids, lisaaPv(tn, -56)),
    sb.from("sairaudet").select("pelaaja_id,alku,loppu").in("pelaaja_id", ids).gte("loppu", lisaaPv(tn, -14)),
    msu ? sb.from("ohjelma").select("id,pelaaja_id,paiva").in("pelaaja_id", ids).gte("paiva", lisaaPv(tn, -28)).lt("paiva", tn) : Promise.resolve({ data: [] }),
  ]);
  const testipaivat = {};
  for (const t of rivit) if (t.pvm >= alku && t.pvm <= tn && ids.includes(t.pelaaja)) (testipaivat[t.pelaaja] ||= new Set()).add(t.pvm);
  const data = await haeKuormaRivit(pelaajat, nh.tapahtumat || [], alku, lisaaPv(tn, 7), Object.fromEntries(Object.entries(testipaivat).map(([k, v]) => [k, [...v]])));
  const k = laskeKooste(pelaajat.map((p) => ({ id: p.id, nimi: nimi(p), profiili: p.treeniprofiili, rivit: data.tulos[p.id] })), vk, tn);
  const kRivi = Object.fromEntries(k.rivit.map((r) => [r.id, r]));

  // lyöntimissiot
  const emailP = Object.fromEntries((lyojat.data || []).filter((x) => ids.includes(x.pelaaja_id)).map((x) => [String(x.email).toLowerCase(), x.pelaaja_id]));
  const emailit = Object.keys(emailP);
  const [msRes, kirjRes] = emailit.length ? await Promise.all([
    sb.from("lyonti_missiot").select("*").in("omistaja", emailit).eq("arkistoitu", false),
    sb.from("lyonti_kirjaukset").select("omistaja,laji,pvm,maara").in("omistaja", emailit),
  ]) : [{ data: [] }, { data: [] }];
  const missiot = {};
  for (const m of msRes.data || []) { const pid = emailP[String(m.omistaja).toLowerCase()]; if (pid) (missiot[pid] ||= []).push({ m, s: laskeMissio(m, kirjRes.data || []) }); }

  // testinormit joukkueen sisällä (viimeisin tulos, 24 kk) – kokonaisprofiiliin ja kehityksen mittakaavaan
  const ikkunassa = (r) => kuukausiaSitten(r.pvm, tn) <= 24;
  const normit = ryhmanNormit(rivit, ids, tila.testi, "viimeisin", ikkunassa);
  const luokat = Object.fromEntries(tila.testit.map((t) => [t.koodi, t.luokka]));
  const nimet = Object.fromEntries(tila.testit.map((t) => [t.koodi, tNimi(t.koodi)]));

  const tulos = pelaajat.map((p) => {
    const kr = kRivi[p.id] || {};
    const omat = (data.tulos[p.id] || []).filter((r) => (r.lahde === "oma" || r.lahde === "lyonti") && r.pvm <= tn);
    const viimeisin = omat.length ? omat.map((r) => r.pvm).sort().at(-1) : null;
    // MSU: suunnitellut päivät (oma suunnitelma) vs. päivät, joilta löytyy tehty treeni
    let su = null;
    if (msu) {
      const suunn = (ohjRes.data || []).filter((o) => o.pelaaja_id === p.id);
      const tehdyt = new Set((data.omat || []).filter((o) => o.pelaaja_id === p.id).flatMap((o) => [o.pvm, o.ohjelma_id]));
      const paivat = [...new Set(suunn.map((o) => o.paiva))];
      su = suunnitelma(paivat.length, paivat.filter((d) => tehdyt.has(d) || suunn.some((o) => o.paiva === d && tehdyt.has(o.id))).length);
    }
    const tav = (tavRes.data || []).filter((g) => g.pelaaja_id === p.id && tila.testi[g.testi]).map((g) => {
      const om = rivit.filter((x) => x.pelaaja === p.id && x.testi === g.testi);
      return { ...g, ...tavoiteTila(g, om), tuloksiaJalkeen: om.some((x) => x.pvm >= g.luotu.slice(0, 10)) };
    });
    // testikehitys: viimeisin (≤ 12 kk) vs. edellinen tulos, mittakaavana joukkueen keskihajonta
    const muutokset = [];
    for (const t of new Set(rivit.filter((x) => x.pelaaja === p.id).map((x) => x.testi))) {
      const T = tila.testi[t], n = normit.get(t);
      if (!T || T.johdettu || !n) continue;
      const a = rivit.filter((x) => x.pelaaja === p.id && x.testi === t).sort((x, y) => x.pvm.localeCompare(y.pvm));
      const viim = a.at(-1), ed = a.filter((x) => x.pvm < viim.pvm && kuukausiaSitten(x.pvm, viim.pvm) <= 18).at(-1);
      if (!ed || kuukausiaSitten(viim.pvm, tn) > 12) continue;
      muutokset.push({ testi: t, nimi: tNimi(t), z: parannus(t, viim.arvo, ed.arvo) / n.sd, uusi: viim, vanha: ed });
    }
    const prof = profiili(pelaajanTulokset(rivit, p.id, tila.testi, "viimeisin", ikkunassa), normit, tila.testi);
    const sair = (sairRes.data || []).filter((x) => x.pelaaja_id === p.id).sort((a, b) => b.loppu.localeCompare(a.loppu))[0];
    const hmViim = hm.filter((h) => h.pelaaja_id === p.id).map((h) => h.luotu.slice(0, 10)).sort().at(-1) || null;
    const sig = {
      ...(msu ? { suunnitelma: su } : { laasnaolo: laasnaolo(kr.os4, kr.ry4Yht) }),
      kuorma: kuorma(kr.acwr ?? null, kr.lepoViim7),
      kirjaukset: kirjaukset(viimeisin, tn),
      tavoitteet: tavoitteet(tav, tn),
      missio: missio((missiot[p.id] || []).map((x) => x.s)),
      testit: testikehitys(muutokset),
    };
    return { p, sig, piste: pisteet(sig) + (tarvitseeHuomiota(sig) ? 10 : 0), huomio: tarvitseeHuomiota(sig), tav, muutokset, prof, sair, hmViim, rivit: data.tulos[p.id] || [], ms: missiot[p.id] || [] };
  }).sort((a, b) => b.piste - a.piste || nimi(a.p).localeCompare(nimi(b.p), "fi"));

  renderoi(el, { tulos, msu, jNimi, luokat, nimet }, avaaVertailu);
}

function renderoi(el, ctx, avaaVertailu) {
  const { tulos, msu, jNimi, luokat, nimet } = ctx;
  const sarakkeet = [[msu ? "suunnitelma" : "laasnaolo", msu ? "Suunnitelma" : "Läsnäolo"], ["kuorma", "Kuorma"], ["kirjaukset", "Kirjaukset"], ["tavoitteet", "Tavoitteet"], ["missio", "Lyöntimissio"], ["testit", "Testikehitys"]];
  const lkm = (avain, tila_) => tulos.filter((x) => x.sig[avain]?.tila === tila_).length;
  const huomio = tulos.filter((x) => x.huomio).length;
  el.innerHTML = `
    <div class="hu-kpi">
      <div><b class="num">${huomio}</b><span>tarvitsee huomiota</span></div>
      <div><b class="num">${lkm("kuorma", "pun") + lkm("kuorma", "kelt")}</b><span>kuorma poikkeaa</span></div>
      <div><b class="num">${tulos.filter((x) => (x.sig.kirjaukset.arvo ?? 99) > 7).length}</b><span>ei kirjauksia viikkoon</span></div>
      <div><b class="num">${msu ? lkm("suunnitelma", "pun") : lkm("laasnaolo", "pun")}</b><span>${msu ? "suunnitelma jäänyt vajaaksi" : "läsnäolo matala"}</span></div>
      <div><b class="num">${tulos.filter((x) => x.sair).length}</b><span>sairauspäiviä 2 vk</span></div>
    </div>
    <div class="hu-taulu" role="table" aria-label="Kuka tarvitsee huomiota – ${esc(jNimi)}">
      <div class="hu-rivi hu-otsikot" role="row"><span role="columnheader">Pelaaja</span>${sarakkeet.map(([, n]) => `<span role="columnheader">${n}</span>`).join("")}<span role="columnheader">Huomioitu</span></div>
      ${tulos.map((x) => `
      <div class="hu-rivi${auki === x.p.id ? " auki" : ""}" role="row" data-hp="${x.p.id}" tabindex="0" aria-expanded="${auki === x.p.id}">
        <span role="cell" class="hu-nimi">${x.huomio ? '<i class="hu-lippu" title="Tarvitsee huomiota: vähintään kaksi punaista signaalia tai punainen kuorma"></i>' : ""}${esc(nimi(x.p))}${x.sair ? ` <span title="Sairauspäiviä ${pvmLyhyt(x.sair.alku)}–${pvmLyhyt(x.sair.loppu)}">🤒</span>` : ""}</span>
        ${sarakkeet.map(([a]) => { const g = x.sig[a] || { tila: "ei", teksti: "" }; return `<span role="cell" class="hu-solu hu-${g.tila}" title="${esc(VARI[g.tila])}"><i aria-hidden="true"></i>${esc(g.teksti)}</span>`; }).join("")}
        <span role="cell" class="hu-solu pieni">${x.hmViim ? pvmLyhyt(x.hmViim) : "yli 8 vk"}</span>
      </div>
      ${auki === x.p.id ? `<div class="hu-syva" role="row"><div role="cell">${syvasukellus(x, jNimi, luokat, nimet, msu)}</div></div>` : ""}`).join("")}
    </div>
    <p class="pieni kv-selite">Punainen = huomio nyt, keltainen = seuraa, vihreä = kunnossa, harmaa = ei vielä dataa tai odottaa testiä. Punainen pallo nimen edessä = tarvitsee huomiota (vähintään kaksi punaista signaalia tai punainen kuorma); heistä ja muista eniten huomiota tarvitsevat ylimpänä. Kuorma = viimeisen 7 päivän kuorma suhteessa pelaajan omaan 4 viikon tasoon (kuten Viikkokoosteessa). ${msu ? "Suunnitelma = oman Treenikeskus-suunnitelman päivistä tehtyjä 4 viikossa." : "Läsnäolo = ryhmätreenit 4 viikossa Nimenhuudon mukaan."} Testikehitys = viimeisin tulos vs. edellinen; muutos lasketaan todelliseksi, kun se on vähintään ${String(SWC).replace(".", ",")} × ryhmän hajonta. Avaa pelaaja klikkaamalla.</p>`;

  const avaa = (pid) => { auki = auki === pid ? null : pid; renderoi(el, ctx, avaaVertailu); };
  $$("[data-hp]", el).forEach((r) => { r.onclick = () => avaa(r.dataset.hp); r.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); avaa(r.dataset.hp); } }; });
  $$("[data-kv]", el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); avaaVertailu?.(b.dataset.kv); }));
}

function syvasukellus(x, jNimi, luokat, nimet, msu) {
  const { p, sig, prof, tav, muutokset, ms } = x;
  const lauseet = sanallinen({ etunimi: p.etunimi, indeksi: prof.indeksi, testit: prof.testit, luokat, nimet, ryhmaNimi: jNimi, signaalit: sig, kehitys: sig.testit });
  const tn = tanaanHki();
  // 12 viikon kalenteri: viikon minuutit ja kuormapisteet
  const viikot = [...Array(12)].map((_, i) => { const a = lisaaPv(maanantai(tn), -7 * (11 - i)), b = lisaaPv(a, 6); const r = x.rivit.filter((y) => y.pvm >= a && y.pvm <= b && y.pvm <= tn); return { a, min: r.reduce((s, y) => s + y.min, 0), au: r.reduce((s, y) => s + y.au, 0) }; });
  const maxAu = Math.max(1, ...viikot.map((v) => v.au));
  return `
    <div class="hu-syva-grid">
      <section><h3>Sanallinen analyysi</h3><div class="hu-analyysi">${lauseet.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
        <p class="hu-linkit"><button class="btn pieni-nappi" data-kv="${p.id}">Kokonaisvertailu</button> <a class="btn pieni-nappi" href="#/pelaaja/${p.id}">Testikäyrät</a> <a class="btn pieni-nappi" href="#/oma/${p.id}">Pelaajan Keskus</a></p></section>
      <section><h3>Kuorma 12 viikkoa</h3>
        <div class="hu-viikot">${viikot.map((v) => `<span title="vk alkaen ${pvmLyhyt(v.a)}: ${minStr(v.min)}, ${Math.round(v.au)} AU"><i style="height:${Math.max(3, (100 * v.au) / maxAu)}%"></i><small>${+v.a.slice(8, 10)}.${+v.a.slice(5, 7)}</small></span>`).join("")}</div>
        ${x.sair ? `<p class="pieni">🤒 Sairauspäiviä ${pvmLyhyt(x.sair.alku)}–${pvmLyhyt(x.sair.loppu)}</p>` : ""}
        <h3>Tavoitteet</h3>
        ${tav.length ? `<ul class="hu-lista">${tav.map((g) => `<li><span>${esc(tNimi(g.testi))} ${muotoile(g.arvo, g.testi)}</span><span class="pieni">${g.saavutettu ? "✓ saavutettu" : g.tuloksiaJalkeen ? `${Math.round(g.pct)} %` : "odottaa testiä"}${g.takaraja ? ` · ${pvmLyhyt(g.takaraja)}` : ""}</span></li>`).join("")}</ul>` : `<p class="pieni">Ei tavoitteita.</p>`}
        <h3>Lyöntimissiot</h3>
        ${ms.length ? `<ul class="hu-lista">${ms.map(({ m, s }) => `<li><span>${esc(m.nimi || m.laji || "Missio")}: ${Math.round(s.tehty)} / ${m.tavoite}</span><span class="pieni">${s.valmis ? "✓ valmis" : `${s.ero >= 0 ? "+" : "−"}${Math.abs(Math.round(s.ero))} aikataulusta`}</span></li>`).join("")}</ul>` : `<p class="pieni">Ei aktiivisia missioita.</p>`}</section>
      <section><h3>Testikehitys</h3>
        ${muutokset.length ? `<ul class="hu-lista">${[...muutokset].sort((a, b) => b.z - a.z).map((m) => `<li class="${m.z >= SWC ? "ylos" : m.z <= -SWC ? "alas" : ""}"><span>${esc(m.nimi)}</span><span class="num">${muotoile(m.vanha.arvo, m.testi)} → ${muotoile(m.uusi.arvo, m.testi)} <small>${m.z >= SWC ? "↑" : m.z <= -SWC ? "↓" : "≈"}</small></span></li>`).join("")}</ul>` : `<p class="pieni">Ei verrattavia tuloksia (viimeisin testi yli 12 kk sitten tai vain yksi tulos).</p>`}</section>
    </div>`;
}
