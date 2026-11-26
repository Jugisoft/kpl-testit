// Treenikeskus (26.11.2026, Elias Pitkäsen ja Jugin toive): miesten pelaajien (MSU) ja haastajaryhmän oma
// treenaamisen keskus. Välilehdet: Viikko (suunniteltu vs. toteutunut, tulevat viikot, sairaus, 🔒 huomiot),
// Kauppa (perusvalikoima + omat tuotteet → kori → viikkopohja voimassaoloajalle), Ohjelmani (paketit, yhteinen
// MSU-ohjelma, ohjelmatiedostot Driveen) ja Asetukset (oma rasitusasteikko ja värit, omat tuotteet).
// Data: treenipaketit → ohjelma-rivit (paketti_id), toteutus omat_treenit (ohjelma_id), sairaudet, omat_muistiot
// (vain pelaaja itse), treeniasetukset, ohjelmatiedostot. Logiikka js/treenikeskusydin.js.
import { sb, tila, nimi, SUPABASE_URL } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { T, TYYPIT, lisaaPv, maanantai, tanaanHki as tanaan, minStr, pvLyh, VKP } from "../kuormaydin.js";
import { tallennusRpe, naytaRpe, rpeVari, laajennaPaketti, viikonPaivat, viikkoNumero, OLETUSVARIT } from "../treenikeskusydin.js";

const PROFIILIT_TK = ["msu", "haastaja"];
const VKP_PITKA = ["Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai", "Sunnuntai"];
const VALILEHDET = [["viikko", "Viikko"], ["kauppa", "Rakenna ohjelma"], ["ohjelmat", "Ohjelmani"], ["asetukset", "Asetukset"]];
const KORI_AVAIN = "kpl-tk-kori";
let valilehti = "viikko";
let viikko = null;
let D = null; // ladattu data

export const kayttaaTreenikeskusta = (p) => !!p && PROFIILIT_TK.includes(p.treeniprofiili);
const omaEmail = () => (tila.istunto?.user?.email || "").toLowerCase();
const lyhyt = (n) => (n || "").replace(/\s*\((.*)\)$/, "");

export async function nayta(main, id) {
  viikko = viikko || maanantai(tanaan());
  const omaPid = tila.omaPelaaja && tila.pelaaja[tila.omaPelaaja] ? tila.omaPelaaja : null;
  if (tila.ohjaaja) {
    const pid = id && tila.pelaaja[id] ? id : null;
    const lista = tila.pelaajat.filter((p) => p.aktiivinen && kayttaaTreenikeskusta(p)).sort((a, b) => nimi(a).localeCompare(nimi(b), "fi"));
    const msu = lista.filter((p) => p.treeniprofiili === "msu"), haas = lista.filter((p) => p.treeniprofiili === "haastaja");
    main.innerHTML = `<div class="tr-valinta"><label class="jtt-valinta"><span>Pelaaja</span><select id="tk-pelaaja"><option value="">Valitse pelaaja…</option>
      ${[["MSU", msu], ["Haastajaryhmä", haas]].filter(([, l]) => l.length).map(([o, l]) => `<optgroup label="${o}">${l.map((p) => `<option value="${p.id}"${p.id === pid ? " selected" : ""}>${esc(nimi(p))}</option>`).join("")}</optgroup>`).join("")}</select></label></div><div id="tk-sisalto"></div>`;
    $("#tk-pelaaja").onchange = (e) => (location.hash = e.target.value ? `#/treenikeskus/${e.target.value}` : "#/treenikeskus");
    const el = $("#tk-sisalto", main);
    if (!pid) {
      el.innerHTML = `<h1>Treenikeskus</h1><p class="ingressi">Miesten pelaajien ja haastajaryhmän omat treeniohjelmat, viikot etukäteen ja toteutuneet treenit. Valitse pelaaja. Voit myös rakentaa pelaajalle ohjelman (näkyy hänellä merkinnällä "valmennus").</p>`;
      return;
    }
    if (valilehti === "asetukset") valilehti = "viikko";
    return piirra(el, pid, false);
  }
  const p = tila.pelaaja[omaPid];
  if (!kayttaaTreenikeskusta(p)) {
    main.innerHTML = `<h1>Treenikeskus</h1><p class="ingressi">Treenikeskus on miesten joukkueen pelaajille ja haastajaryhmälle. Omatoimiset treenit kirjataan <a href="#/treenit">Treenipäiväkirjaan</a>.</p>`;
    return;
  }
  await piirra(main, omaPid, true);
}

// ---------- data ----------
async function lataa(pid) {
  const p = tila.pelaaja[pid];
  const vkLoppu = lisaaPv(viikko, 6);
  const msu = p.treeniprofiili === "msu";
  const [oh, pak, ohj, tot, sai, mui, ase, tie, tap, poi, ras] = await Promise.all([
    sb.from("treeniohjelmat").select("*").eq("aktiivinen", true).order("jarjestys"),
    sb.from("treenipaketit").select("*").eq("pelaaja_id", pid).order("alku", { ascending: false }),
    sb.from("ohjelma").select("*").gte("paiva", viikko).lte("paiva", vkLoppu).eq("pelaaja_id", pid),
    sb.from("omat_treenit").select("*").eq("pelaaja_id", pid).gte("pvm", viikko).lte("pvm", vkLoppu).order("luotu"),
    sb.from("sairaudet").select("*").eq("pelaaja_id", pid).lte("alku", vkLoppu).gte("loppu", viikko),
    pid === tila.omaPelaaja ? sb.from("omat_muistiot").select("*").eq("pelaaja_id", pid) : Promise.resolve({ data: [] }),
    sb.from("treeniasetukset").select("*").eq("pelaaja_id", pid).maybeSingle(),
    sb.from("ohjelmatiedostot").select("*").eq("pelaaja_id", pid).order("luotu", { ascending: false }),
    // yhteinen MSU-ohjelma = miesten tapahtumat (valmennuksen viikko-ohjelma, tuotu tapahtumat-tauluun); RLS antaa haastajalle
    // myös oman B-ryhmän Nimenhuudon tapahtumat, jotka suodatetaan pois alla
    sb.from("tapahtumat").select("joukkue_id,uid,pvm,alku,otsikko,paikka,peruttu").gte("pvm", viikko).lte("pvm", vkLoppu).order("alku"),
    msu ? sb.from("poissaolot").select("uid").eq("pelaaja_id", pid) : Promise.resolve({ data: [] }),
    msu ? sb.from("rasitusarviot").select("uid,rpe").eq("pelaaja_id", pid) : Promise.resolve({ data: [] }),
  ]);
  const virhe = [oh, pak, ohj, tot, sai].find((r) => r.error);
  if (virhe) throw new Error(virhe.error.message);
  const ohjelmat = Object.fromEntries((oh.data || []).filter((o) => !o.pelaaja_id || o.pelaaja_id === pid).map((o) => [o.koodi, o]));
  return {
    p, ohjelmat, paketit: pak.data || [],
    ohjelma: [...(ohj.data || []), ...(tap.data || [])
      .filter((e) => !e.peruttu && (msu ? e.joukkue_id === p.joukkue_id : e.joukkue_id !== p.joukkue_id && !tila.joukkueet.some((j) => j.id === e.joukkue_id && j.alue === "psu")))
      .map((e, i) => ({ id: e.uid, tapahtuma: true, joukkue_id: e.joukkue_id, pelaaja_id: null, paiva: e.pvm, otsikko: e.otsikko, kuvaus: [e.alku?.slice(0, 5).replace(":", "."), e.paikka].filter(Boolean).join(" "), jarjestys: i }))],
    msu, poissa: new Set((poi.data || []).map((x) => x.uid)), rasitus: new Map((ras.data || []).map((x) => [x.uid, x.rpe])),
    toteumat: tot.data || [], sairaudet: sai.data || [],
    muistiot: Object.fromEntries((mui.data || []).map((m) => [m.kohde, m])),
    asetukset: ase.data || { asteikko: 10, varit: null }, tiedostot: tie.data || [],
  };
}

// ---------- runko ----------
async function piirra(main, pid, oma) {
  main.innerHTML = `<p class="lataa">Ladataan Treenikeskusta…</p>`;
  try { D = await lataa(pid); } catch (e) { main.innerHTML = `<h1>Treenikeskus</h1><p class="ingressi">Tietoja ei saatu haettua: ${esc(e.message)}</p>`; return; }
  D.pid = pid; D.oma = oma;
  const lehdet = VALILEHDET.filter(([k]) => oma || k !== "asetukset");
  main.innerHTML = `
    <div class="tk-paa">
      <div><span class="jtt-yla">${oma ? "Oma harjoittelu" : "Treenikeskus · valmennus"}</span><h1>${oma ? "Treenikeskus" : esc(nimi(D.p))}</h1>
      <p class="ingressi">${oma ? "Oma viikkosi, tulevat viikot ja tehdyt treenit. Rakenna oma ohjelmasi tai seuraa yhteistä ohjelmaa." : `Pelaajan suunnitelmat ja toteutuneet treenit. 🔒-huomiot näkyvät vain pelaajalle. <a href="#/oma/${pid}">Pelaajan oma Keskus →</a>`}</p></div>
    </div>
    <div class="tk-valilehdet" role="tablist">${lehdet.map(([k, t]) => `<button type="button" role="tab" class="chip" data-vl="${k}" aria-pressed="${valilehti === k}">${t}</button>`).join("")}</div>
    <div id="tk-vl"></div>
    <dialog id="tk-dialogi" class="tk-dialogi"></dialog>`;
  $$("[data-vl]", main).forEach((b) => (b.onclick = () => { valilehti = b.dataset.vl; piirra(main, pid, oma); }));
  const el = $("#tk-vl", main);
  const paivita = () => piirra(main, pid, oma);
  if (valilehti === "kauppa") return kauppa(el, paivita);
  if (valilehti === "ohjelmat") return ohjelmatVl(el, paivita);
  if (valilehti === "asetukset") return asetukset(el, paivita);
  return viikkoVl(el, paivita, main);
}

const rpePallo = (rpe) => (rpe ? `<i class="tk-rpe" style="background:${rpeVari(rpe, D.asetukset)}" title="Rasitus ${naytaRpe(rpe, D.asetukset.asteikko)}/${D.asetukset.asteikko}">${naytaRpe(rpe, D.asetukset.asteikko)}</i>` : "");
const tyyppiVari = (koodi) => T[D.ohjelmat[koodi]?.tyyppi]?.vari || "#888";

// ---------- Viikko ----------
function viikkoVl(el, paivita, main) {
  const paivat = viikonPaivat(viikko, D);
  const t = tanaan();
  // miehillä yhteinen treeni lasketaan tehdyksi, ellei pelaaja merkitse Olin poissa (sama kuin Oma Keskuksen kuormassa)
  const mukana = (s) => s.tapahtuma && D.msu && s.paiva <= t && !D.poissa.has(s.id);
  const suunn = paivat.flatMap((d) => d.suunnitellut), tehty = suunn.filter((s) => s.toteuma || mukana(s)).length;
  const min = paivat.flatMap((d) => d.toteutuneet).reduce((s, x) => s + (x.kesto_min || 0), 0);
  const rpet = paivat.flatMap((d) => d.toteutuneet).map((x) => x.rpe).filter(Boolean);
  const kaRpe = rpet.length ? Math.round(rpet.reduce((a, b) => a + b, 0) / rpet.length) : null;
  const sairaat = paivat.filter((d) => d.sairas).length;
  const kohde = (s) => D.ohjelmat[s.treeniohjelma];
  const rivi = (s, d) => {
    if (s.tapahtuma && D.msu) return yhteinenRivi(s, d.pvm <= t);
    const o = kohde(s), tot = s.toteuma, menn = d.pvm <= t;
    const nimiT = o ? lyhyt(o.nimi) : s.otsikko;
    const lahde = !s.pelaaja_id ? `<span class="tk-tagi yhteinen">yhteinen</span>` : s.luoja && s.luoja !== omaEmail() && D.oma ? `<span class="tk-tagi">valmennus</span>` : "";
    return `<li class="tk-s${tot ? " tehty" : menn ? " avoin" : ""}" style="--v:${o ? tyyppiVari(s.treeniohjelma) : "#91897D"}">
      <span class="tk-s-nimi">${esc(nimiT)} ${lahde}<small>${[tot ? minStr(tot.kesto_min || 0) : s.kesto_min || o?.kesto_min ? minStr(s.kesto_min || o.kesto_min) : "", !o && s.kuvaus ? esc(s.kuvaus) : "", tot && tot.ohjelma !== s.treeniohjelma && D.ohjelmat[tot.ohjelma] ? `tehtiin: ${esc(lyhyt(D.ohjelmat[tot.ohjelma].nimi))}` : ""].filter(Boolean).join(" · ")}</small></span>
      ${tot ? `<span class="tk-s-tila">✓ ${rpePallo(tot.rpe)}</span>` : s.rpe ? `<span class="tk-s-tila suunn">${rpePallo(s.rpe)}</span>` : ""}
      ${D.oma ? `<span class="tk-s-napit">${tot ? `<button class="linkkinappi" data-muokkaa="${tot.id}">Muokkaa</button>` : (menn ? `<button class="btn pieni-nappi" data-kirjaa="${s.id}">Kirjaa</button>` : "")}
        ${!tot && s.pelaaja_id && s.luoja === omaEmail() ? `<button class="linkkinappi" data-poista-s="${s.id}" aria-label="Poista suunniteltu ${esc(nimiT)}">✕</button>` : ""}</span>` : ""}</li>`;
  };
  const yhteinenRivi = (s, menn) => {
    const poissa = D.poissa.has(s.id), rpe = D.rasitus.get(s.id);
    return `<li class="tk-s${menn ? (poissa ? " poissa" : " tehty") : ""}" style="--v:var(--cyan)">
      <span class="tk-s-nimi">${esc(s.otsikko)} <span class="tk-tagi yhteinen">yhteinen</span><small>${esc(s.kuvaus || "")}</small></span>
      ${menn ? `<span class="tk-s-tila">${poissa ? `<span class="tk-poissa">poissa</span>` : `✓ ${rpePallo(rpe)}`}</span>` : ""}
      ${D.oma && menn ? `<span class="tk-s-napit"><button class="linkkinappi" data-poissa="${esc(s.id)}" data-j="${s.joukkue_id}">${poissa ? "Olin mukana" : "Olin poissa"}</button>${poissa ? "" : `<button class="linkkinappi" data-ras="${esc(s.id)}">Rasitus</button>`}</span>` : ""}</li>`;
  };
  const ylim = (x) => `<li class="tk-s tehty ylim" style="--v:${tyyppiVari(x.ohjelma)}"><span class="tk-s-nimi">${esc(lyhyt(D.ohjelmat[x.ohjelma]?.nimi || T[x.tyyppi]?.nimi || "Treeni"))} <span class="tk-tagi">lisätty</span><small>${minStr(x.kesto_min || 0)}</small></span>
      <span class="tk-s-tila">✓ ${rpePallo(x.rpe)}</span>${D.oma ? `<span class="tk-s-napit"><button class="linkkinappi" data-muokkaa="${x.id}">Muokkaa</button></span>` : ""}</li>`;
  el.innerHTML = `
    <div class="tk-vk-nav"><button class="btn" data-vk="-7" aria-label="Edellinen viikko">◀</button>
      <div><b>Viikko ${viikkoNumero(viikko)}</b><span class="pieni">${pvLyh(viikko)}–${pvLyh(lisaaPv(viikko, 6))}${viikko === maanantai(t) ? " · tämä viikko" : viikko > t ? " · tuleva" : ""}</span></div>
      <button class="btn" data-vk="7" aria-label="Seuraava viikko">▶</button>${viikko !== maanantai(t) ? `<button class="linkkinappi" data-vk="0">Tähän viikkoon</button>` : ""}</div>
    <div class="tk-yht"><div><span class="num">${tehty}/${suunn.length}</span><small>suunnitellusta tehty</small></div><div><span class="num">${min ? minStr(min) : "–"}</span><small>treeniä</small></div>
      <div><span class="num">${kaRpe ? naytaRpe(kaRpe, D.asetukset.asteikko) : "–"}</span><small>keskirasitus${kaRpe ? ` /${D.asetukset.asteikko}` : ""}</small></div>${sairaat ? `<div><span class="num">${sairaat}</span><small>sairaspäivää</small></div>` : ""}</div>
    <div class="tk-paivat">${paivat.map((d, i) => {
      const huom = D.muistiot["paiva:" + d.pvm];
      return `<section class="tk-paiva${d.pvm === t ? " tanaan" : ""}${d.sairas ? " sairas" : ""}" aria-label="${VKP_PITKA[i]} ${pvLyh(d.pvm)}">
        <header><b>${VKP[i]}</b><span class="num">${pvLyh(d.pvm)}</span>${d.sairas ? `<span class="tk-tagi sairas">🤒 sairas</span>` : ""}</header>
        ${d.suunnitellut.length || d.ylimaaraiset.length ? `<ul>${d.suunnitellut.map((s) => rivi(s, d)).join("")}${d.ylimaaraiset.map(ylim).join("")}</ul>` : `<p class="tk-lepo">${d.sairas ? "" : "Lepo"}</p>`}
        ${huom ? `<p class="tk-huom">🔒 ${esc(huom.teksti)}</p>` : ""}
        ${D.oma ? `<footer><button class="linkkinappi" data-lisaa="${d.pvm}">+ Treeni</button><button class="linkkinappi" data-sairas="${d.pvm}">${d.sairas ? "Sairaus…" : "🤒"}</button><button class="linkkinappi" data-huom="${d.pvm}" aria-label="Oma huomio päivälle">🔒</button></footer>` : ""}
      </section>`; }).join("")}</div>
    <p class="pieni tk-selite">Rasitus omalla asteikollasi (1–${D.asetukset.asteikko}). 🔒 = näkyy vain sinulle${D.oma ? "" : " (pelaajalle)"}. Tehdyt treenit näkyvät myös Oma Keskuksen kuormassa.</p>`;
  $$("[data-vk]", el).forEach((b) => (b.onclick = () => { viikko = b.dataset.vk === "0" ? maanantai(t) : lisaaPv(viikko, +b.dataset.vk); paivita(); }));
  if (!D.oma) return;
  const dlg = $("#tk-dialogi", main);
  $$("[data-kirjaa]", el).forEach((b) => (b.onclick = () => { const s = D.ohjelma.find((x) => x.id === b.dataset.kirjaa); kirjausLomake(dlg, { suunniteltu: s, pvm: s.paiva }, paivita); }));
  $$("[data-poissa]", el).forEach((b) => (b.onclick = async () => {
    const uid = b.dataset.poissa;
    const r = D.poissa.has(uid) ? await sb.from("poissaolot").delete().eq("pelaaja_id", D.pid).eq("uid", uid)
      : await sb.from("poissaolot").insert({ pelaaja_id: D.pid, joukkue_id: +b.dataset.j, uid });
    if (r.error) ilmoita("Tallennus ei onnistunut: " + r.error.message, true); else paivita();
  }));
  $$("[data-ras]", el).forEach((b) => (b.onclick = () => rasitusLomake(dlg, D.ohjelma.find((x) => x.id === b.dataset.ras), paivita)));
  $$("[data-muokkaa]", el).forEach((b) => (b.onclick = () => { const x = D.toteumat.find((y) => y.id === b.dataset.muokkaa); kirjausLomake(dlg, { toteuma: x, pvm: x.pvm }, paivita); }));
  $$("[data-lisaa]", el).forEach((b) => (b.onclick = () => lisaaLomake(dlg, b.dataset.lisaa, paivita)));
  $$("[data-sairas]", el).forEach((b) => (b.onclick = () => sairasLomake(dlg, b.dataset.sairas, paivita)));
  $$("[data-huom]", el).forEach((b) => (b.onclick = () => huomioLomake(dlg, "paiva:" + b.dataset.huom, `Oma huomio ${pvLyh(b.dataset.huom)}`, paivita)));
  $$("[data-poista-s]", el).forEach((b) => (b.onclick = async () => {
    if (!confirm("Poistetaanko suunniteltu treeni tältä päivältä?")) return;
    const { error } = await sb.from("ohjelma").delete().eq("id", b.dataset.poistaS);
    if (error) ilmoita("Poisto ei onnistunut: " + error.message, true); else paivita();
  }));
}

// rasitusvalinta omalla asteikolla ja väreillä
function rpeValinta(rpe10) {
  const a = D.asetukset.asteikko, valittu = naytaRpe(rpe10 || 5, a);
  return `<div class="tk-rpe-valinta" role="radiogroup" aria-label="Rasitus 1–${a}">${Array.from({ length: a }, (_, i) => i + 1).map((r) =>
    `<label style="--rv:${rpeVari(tallennusRpe(r, a), D.asetukset)}"><input type="radio" name="rpe" value="${r}"${r === valittu ? " checked" : ""}><span>${r}</span></label>`).join("")}</div>`;
}
const ohjelmaValinta = (valittu) => {
  const lista = Object.values(D.ohjelmat), ryhmat = [...new Set(lista.map((o) => o.ryhma))];
  return `<select name="koodi" required><option value="">Valitse treeni…</option>${ryhmat.map((r) => `<optgroup label="${esc(r)}">${lista.filter((o) => o.ryhma === r).map((o) => `<option value="${esc(o.koodi)}"${o.koodi === valittu ? " selected" : ""}>${esc(o.nimi)}</option>`).join("")}</optgroup>`).join("")}</select>`;
};
function avaaDialogi(dlg, html) {
  dlg.innerHTML = `<form method="dialog" class="tk-lomake">${html}</form>`;
  dlg.showModal();
  $("[data-sulje]", dlg).onclick = (e) => { e.preventDefault(); dlg.close(); };
  return $("form", dlg);
}

// kirjaus: suunnitellun toteutus tai olemassa olevan muokkaus (sisältö, kesto, rasitus, 🔒 huomio)
function kirjausLomake(dlg, { suunniteltu, toteuma, pvm }, paivita) {
  const koodi = toteuma?.ohjelma || suunniteltu?.treeniohjelma || "";
  const o = D.ohjelmat[koodi];
  const kesto = toteuma?.kesto_min || suunniteltu?.kesto_min || o?.kesto_min || 60;
  const rpe = toteuma?.rpe || suunniteltu?.rpe || o?.rpe || T[o?.tyyppi]?.rpe || 5;
  const huom = toteuma ? D.muistiot["treeni:" + toteuma.id]?.teksti || "" : "";
  const f = avaaDialogi(dlg, `
    <header><h2>${toteuma ? "Muokkaa treeniä" : "Kirjaa treeni"}</h2><button class="tr-sulje" data-sulje aria-label="Sulje">✕</button></header>
    <p class="pieni">${pvLyh(pvm)}${suunniteltu ? ` · suunniteltu: ${esc(o ? lyhyt(o.nimi) : suunniteltu.otsikko)}` : ""}. Jos teit jotain muuta, vaihda treeni.</p>
    <label class="tk-kentta"><span>Treeni</span>${ohjelmaValinta(koodi)}</label>
    <label class="tk-kentta"><span>Päivä</span><input type="date" name="pvm" value="${pvm}" max="${tanaan()}"></label>
    <label class="tk-kentta"><span>Kesto, min</span><input type="number" name="kesto" min="5" max="600" step="5" value="${kesto}" inputmode="numeric"></label>
    <div class="tk-kentta"><span>Rasitus</span>${rpeValinta(rpe)}</div>
    <label class="tk-kentta"><span>🔒 Oma huomio <small>(vain sinulle)</small></span><textarea name="huomio" rows="2" maxlength="1000">${esc(huom)}</textarea></label>
    <div class="tk-napit">${toteuma ? `<button class="btn vaara" data-poista>Poista kirjaus</button>` : ""}<button class="btn ensisij" value="ok">Tallenna</button></div>`);
  f.elements.koodi.onchange = () => { const u = D.ohjelmat[f.elements.koodi.value]; if (u?.kesto_min) f.elements.kesto.value = u.kesto_min; };
  if (toteuma) $("[data-poista]", f).onclick = async (e) => {
    e.preventDefault();
    if (!confirm("Poistetaanko kirjaus?")) return;
    const { error } = await sb.from("omat_treenit").delete().eq("id", toteuma.id);
    if (error) return ilmoita("Poisto ei onnistunut: " + error.message, true);
    await sb.from("omat_muistiot").delete().eq("pelaaja_id", D.pid).eq("kohde", "treeni:" + toteuma.id);
    dlg.close(); paivita();
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const x = f.elements, u = D.ohjelmat[x.koodi.value], k = +x.kesto.value, oma = +([...x.rpe].find((r) => r.checked)?.value || 0);
    if (!u) return ilmoita("Valitse treeni", true);
    if (!(k >= 5 && k <= 600)) return ilmoita("Kesto 5–600 minuuttia", true);
    if (!x.pvm.value || x.pvm.value > tanaan()) return ilmoita("Tulevaa treeniä ei voi kirjata tehdyksi", true);
    const a = D.asetukset.asteikko;
    const rivi = { pelaaja_id: D.pid, pvm: x.pvm.value, tyyppi: u.tyyppi, ohjelma: u.koodi, kesto_min: k, rpe: tallennusRpe(oma || 5, a), rpe_oma: oma || null, asteikko: a };
    if (suunniteltu?.id && !toteuma) rivi[suunniteltu.tapahtuma ? "tapahtuma_uid" : "ohjelma_id"] = suunniteltu.id;
    const r = toteuma ? await sb.from("omat_treenit").update(rivi).eq("id", toteuma.id).select().single() : await sb.from("omat_treenit").insert(rivi).select().single();
    if (r.error) return ilmoita("Tallennus ei onnistunut: " + r.error.message, true);
    await tallennaMuistio("treeni:" + r.data.id, x.huomio.value);
    ilmoita(`Tallennettu: ${lyhyt(u.nimi)} ${k} min`);
    dlg.close(); paivita();
  };
}

async function tallennaMuistio(kohde, teksti) {
  teksti = (teksti || "").trim();
  if (!teksti) { if (D.muistiot[kohde]) await sb.from("omat_muistiot").delete().eq("pelaaja_id", D.pid).eq("kohde", kohde); return; }
  const { error } = await sb.from("omat_muistiot").upsert({ pelaaja_id: D.pid, kohde, teksti, muokattu: new Date().toISOString() }, { onConflict: "pelaaja_id,kohde" });
  if (error) ilmoita("Huomiota ei saatu tallennettua: " + error.message, true);
}

// yksittäinen suunniteltu treeni päivälle (ilman ohjelmaa)
function lisaaLomake(dlg, pvm, paivita) {
  const f = avaaDialogi(dlg, `
    <header><h2>Lisää treeni ${pvLyh(pvm)}</h2><button class="tr-sulje" data-sulje aria-label="Sulje">✕</button></header>
    <label class="tk-kentta"><span>Treeni</span>${ohjelmaValinta("")}</label>
    <label class="tk-kentta"><span>Kesto, min</span><input type="number" name="kesto" min="5" max="600" step="5" value="60"></label>
    <div class="tk-kentta"><span>Suunniteltu rasitus</span>${rpeValinta(5)}</div>
    <div class="tk-napit">${pvm <= tanaan() ? `<button class="btn" data-suoraan>Tehty jo – kirjaa</button>` : ""}<button class="btn ensisij" value="ok">Lisää suunnitelmaan</button></div>`);
  f.elements.koodi.onchange = () => { const u = D.ohjelmat[f.elements.koodi.value]; if (u?.kesto_min) f.elements.kesto.value = u.kesto_min; };
  const suoraan = $("[data-suoraan]", f);
  if (suoraan) suoraan.onclick = (e) => { e.preventDefault(); const koodi = f.elements.koodi.value; dlg.close(); kirjausLomake(dlg, { toteuma: null, suunniteltu: koodi ? { treeniohjelma: koodi, kesto_min: +f.elements.kesto.value, id: null } : null, pvm }, paivita); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const x = f.elements, u = D.ohjelmat[x.koodi.value];
    if (!u) return ilmoita("Valitse treeni", true);
    const oma = +([...x.rpe].find((r) => r.checked)?.value || 5);
    const { error } = await sb.from("ohjelma").insert({ pelaaja_id: D.pid, viikko: maanantai(pvm), paiva: pvm, otsikko: lyhyt(u.nimi), treeniohjelma: u.koodi,
      kesto_min: +x.kesto.value || u.kesto_min, rpe: tallennusRpe(oma, D.asetukset.asteikko), luoja: omaEmail(), jarjestys: 50 });
    if (error) return ilmoita("Lisäys ei onnistunut: " + error.message, true);
    dlg.close(); paivita();
  };
}

function sairasLomake(dlg, pvm, paivita) {
  const olemassa = D.sairaudet.find((s) => s.alku <= pvm && pvm <= s.loppu);
  const kohde = olemassa ? "sairaus:" + olemassa.id : null;
  const f = avaaDialogi(dlg, `
    <header><h2>🤒 Sairaana</h2><button class="tr-sulje" data-sulje aria-label="Sulje">✕</button></header>
    <p class="pieni">Valmennus näkee, että olit sairaana. Lisätieto näkyy vain sinulle.</p>
    <label class="tk-kentta"><span>Alkaen</span><input type="date" name="alku" value="${olemassa?.alku || pvm}" required></label>
    <label class="tk-kentta"><span>Asti</span><input type="date" name="loppu" value="${olemassa?.loppu || pvm}" required></label>
    <label class="tk-kentta"><span>🔒 Lisätieto <small>(vain sinulle)</small></span><textarea name="lisa" rows="2" maxlength="1000">${esc(kohde ? D.muistiot[kohde]?.teksti || "" : "")}</textarea></label>
    <div class="tk-napit">${olemassa ? `<button class="btn vaara" data-poista>Poista merkintä</button>` : ""}<button class="btn ensisij" value="ok">Tallenna</button></div>`);
  if (olemassa) $("[data-poista]", f).onclick = async (e) => {
    e.preventDefault();
    const { error } = await sb.from("sairaudet").delete().eq("id", olemassa.id);
    if (error) return ilmoita("Poisto ei onnistunut: " + error.message, true);
    await sb.from("omat_muistiot").delete().eq("pelaaja_id", D.pid).eq("kohde", kohde);
    dlg.close(); paivita();
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const { alku, loppu, lisa } = f.elements;
    if (!alku.value || !loppu.value || loppu.value < alku.value) return ilmoita("Tarkista päivät", true);
    const r = olemassa ? await sb.from("sairaudet").update({ alku: alku.value, loppu: loppu.value }).eq("id", olemassa.id).select().single()
      : await sb.from("sairaudet").insert({ pelaaja_id: D.pid, alku: alku.value, loppu: loppu.value }).select().single();
    if (r.error) return ilmoita("Tallennus ei onnistunut: " + r.error.message, true);
    await tallennaMuistio("sairaus:" + r.data.id, lisa.value);
    dlg.close(); paivita();
  };
}

// miesten yhteinen treeni: oma rasitus (rasitusarviot, sama kuin Oma Keskuksen kuormassa)
function rasitusLomake(dlg, s, paivita) {
  const f = avaaDialogi(dlg, `<header><h2>${esc(s.otsikko)}</h2><button class="tr-sulje" data-sulje aria-label="Sulje">✕</button></header>
    <p class="pieni">${pvLyh(s.paiva)} · yhteinen treeni. Miltä treeni tuntui?</p>
    <div class="tk-kentta"><span>Rasitus</span>${rpeValinta(D.rasitus.get(s.id) || 5)}</div>
    <div class="tk-napit">${D.rasitus.has(s.id) ? `<button class="btn" data-poista>Palauta arvio</button>` : ""}<button class="btn ensisij" value="ok">Tallenna</button></div>`);
  const poista = () => sb.from("rasitusarviot").delete().eq("pelaaja_id", D.pid).eq("uid", s.id);
  if (D.rasitus.has(s.id)) $("[data-poista]", f).onclick = async (e) => { e.preventDefault(); await poista(); dlg.close(); paivita(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const oma = +([...f.elements.rpe].find((r) => r.checked)?.value || 5);
    await poista();
    const { error } = await sb.from("rasitusarviot").insert({ pelaaja_id: D.pid, uid: s.id, rpe: tallennusRpe(oma, D.asetukset.asteikko) });
    if (error) return ilmoita("Tallennus ei onnistunut: " + error.message, true);
    dlg.close(); paivita();
  };
}

function huomioLomake(dlg, kohde, otsikko, paivita) {
  const f = avaaDialogi(dlg, `<header><h2>🔒 ${esc(otsikko)}</h2><button class="tr-sulje" data-sulje aria-label="Sulje">✕</button></header>
    <p class="pieni">Näkyy vain sinulle – ei valmennukselle eikä koosteisiin.</p>
    <textarea name="teksti" rows="4" maxlength="2000">${esc(D.muistiot[kohde]?.teksti || "")}</textarea>
    <div class="tk-napit"><button class="btn ensisij" value="ok">Tallenna</button></div>`);
  f.onsubmit = async (e) => { e.preventDefault(); await tallennaMuistio(kohde, f.elements.teksti.value); dlg.close(); paivita(); };
}

// ---------- Kauppa: tuotteet → kori → viikkopohja ----------
const lueKori = () => { try { return JSON.parse(sessionStorage.getItem(KORI_AVAIN + D.pid)) || []; } catch { return []; } };
const tallennaKori = (k) => { try { sessionStorage.setItem(KORI_AVAIN + D.pid, JSON.stringify(k)); } catch { /* ohitetaan */ } };

function kauppa(el, paivita) {
  const kori = lueKori();
  const lista = Object.values(D.ohjelmat);
  const omaVal = lista.filter((o) => o.pelaaja_id && !o.oma), omat = lista.filter((o) => o.oma), perus = lista.filter((o) => !o.pelaaja_id);
  const ryhmat = [["Valmennuksen ohjelmasi sinulle", omaVal], ["Omat treenit", omat], ...[...new Set(perus.map((o) => o.ryhma))].map((r) => [r, perus.filter((o) => o.ryhma === r)])].filter(([, l]) => l.length);
  const ma = lisaaPv(maanantai(tanaan()), 7);
  const kortti = (o) => `<article class="tk-tuote" style="--v:${T[o.tyyppi]?.vari || "#888"}"><div><b>${esc(lyhyt(o.nimi))}</b><small>${esc(T[o.tyyppi]?.nimi || "")}${o.kesto_min ? ` · ${minStr(o.kesto_min)}` : ""}</small></div>
      ${rpePallo(o.rpe)}<button class="btn pieni-nappi" data-koriin="${esc(o.koodi)}" aria-label="Lisää ohjelmaan: ${esc(lyhyt(o.nimi))}">+ Lisää</button></article>`;
  el.innerHTML = `
    <div class="tk-kauppa">
      <div class="tk-hylly">
        <article class="tk-tuote tk-yhteinen"><div><b>Yhteinen viikko-ohjelma (MSU)</b><small>Valmennuksen yhteinen ohjelma Kouvolassa treenaaville. Valitse jakso Ohjelmani-välilehdellä.</small></div><button class="btn pieni-nappi" data-vl-yhteinen>Valitse jakso →</button></article>
        ${ryhmat.map(([r, l]) => `<section><h2>${esc(r)}</h2><div class="tk-tuotteet">${l.map(kortti).join("")}</div></section>`).join("")}
        ${D.oma ? `<p><button class="btn" data-uusi-tuote>+ Luo oma treeni</button></p>` : ""}
      </div>
      <aside class="tk-kori" aria-label="Uusi ohjelma">
        <h2>Uusi ohjelma <span class="num">(${kori.length} treeniä)</span></h2>
        ${kori.length ? `<ol>${kori.map((k, i) => { const o = D.ohjelmat[k.koodi]; return `<li style="--v:${T[o?.tyyppi]?.vari || "#888"}">
          <b>${esc(lyhyt(o?.nimi || k.koodi))}</b>
          <div class="tk-kori-rivi"><select data-i="${i}" data-k="vp" aria-label="Viikonpäivä">${VKP.map((v, j) => `<option value="${j + 1}"${+k.vp === j + 1 ? " selected" : ""}>${v}</option>`).join("")}</select>
          <input type="number" data-i="${i}" data-k="kesto_min" value="${k.kesto_min}" min="5" max="600" step="5" aria-label="Kesto minuutteina"><span class="pieni">min</span>
          <select data-i="${i}" data-k="rpe" aria-label="Rasitus">${Array.from({ length: D.asetukset.asteikko }, (_, j) => j + 1).map((r) => `<option value="${tallennusRpe(r, D.asetukset.asteikko)}"${naytaRpe(k.rpe, D.asetukset.asteikko) === r ? " selected" : ""}>R ${r}</option>`).join("")}</select>
          <button class="linkkinappi" data-pois="${i}" aria-label="Poista ohjelmasta">✕</button></div></li>`; }).join("")}</ol>
          <form class="tk-kassa">
            <label class="tk-kentta"><span>Ohjelman nimi</span><input name="nimi" required maxlength="80" placeholder="esim. Talvijakso 1"></label>
            <div class="tk-kentta-rivi"><label class="tk-kentta"><span>Alkaa</span><input type="date" name="alku" value="${ma}" required></label>
            <label class="tk-kentta"><span>Päättyy</span><input type="date" name="loppu" value="${lisaaPv(ma, 27)}" required></label></div>
            <button class="btn ensisij">Tallenna ohjelma${D.oma ? "" : " pelaajalle"}</button>
            <button type="button" class="linkkinappi" data-tyhjenna>Aloita alusta</button>
          </form>`
        : `<p class="tyhja">Lisää treenejä vasemmalta. Valitse jokaiselle viikonpäivä, kesto ja rasitus, anna ohjelmalle nimi ja voimassaoloaika – ohjelma täyttää viikot automaattisesti.</p>`}
      </aside>
    </div>`;
  $$("[data-koriin]", el).forEach((b) => (b.onclick = () => {
    const o = D.ohjelmat[b.dataset.koriin];
    const vp = kori.length ? Math.min(7, +kori[kori.length - 1].vp + 1) : 1;
    kori.push({ koodi: o.koodi, vp, kesto_min: o.kesto_min || 60, rpe: o.rpe || T[o.tyyppi]?.rpe || 5 });
    tallennaKori(kori); ilmoita(`Lisätty: ${lyhyt(o.nimi)}`); kauppa(el, paivita);
  }));
  $$("[data-i]", el).forEach((i) => (i.onchange = () => { kori[+i.dataset.i][i.dataset.k] = +i.value; tallennaKori(kori); }));
  $$("[data-pois]", el).forEach((b) => (b.onclick = () => { kori.splice(+b.dataset.pois, 1); tallennaKori(kori); kauppa(el, paivita); }));
  $("[data-tyhjenna]", el)?.addEventListener("click", () => { tallennaKori([]); kauppa(el, paivita); });
  $("[data-vl-yhteinen]", el).onclick = () => { valilehti = "ohjelmat"; paivita(); };
  $("[data-uusi-tuote]", el)?.addEventListener("click", () => tuoteLomake($("#tk-dialogi"), null, paivita));
  const kassa = $(".tk-kassa", el);
  if (kassa) kassa.onsubmit = async (e) => {
    e.preventDefault();
    const { nimi: n, alku, loppu } = kassa.elements;
    if (loppu.value < alku.value) return ilmoita("Päättymispäivä ennen alkua", true);
    const rivit = [...kori].sort((a, b) => a.vp - b.vp).map((k) => ({ vp: +k.vp, koodi: k.koodi, kesto_min: +k.kesto_min, rpe: +k.rpe }));
    const r = await sb.from("treenipaketit").insert({ pelaaja_id: D.pid, nimi: n.value.trim(), alku: alku.value, loppu: loppu.value, rivit, tekija: D.oma ? "pelaaja" : "valmennus" }).select().single();
    if (r.error) return ilmoita("Tallennus ei onnistunut: " + r.error.message, true);
    const lkm = await kirjoitaPaivat(r.data, tanaan());
    tallennaKori([]);
    ilmoita(`Ohjelma tallennettu: ${lkm} treeniä viikoille`);
    viikko = maanantai(alku.value > tanaan() ? alku.value : tanaan()); valilehti = "viikko"; paivita();
  };
}

// paketin päivät ohjelma-tauluun (alkaen-päivästä eteenpäin)
async function kirjoitaPaivat(paketti, alkaen, ohita = new Set()) {
  const rivit = laajennaPaketti(paketti, alkaen).filter((r) => !ohita.has(r.paiva + "|" + r.treeniohjelma)).map((r) => ({
    ...r, pelaaja_id: paketti.pelaaja_id, paketti_id: paketti.id, otsikko: lyhyt(D.ohjelmat[r.treeniohjelma]?.nimi || r.treeniohjelma), luoja: omaEmail() }));
  for (let i = 0; i < rivit.length; i += 200) {
    const { error } = await sb.from("ohjelma").insert(rivit.slice(i, i + 200));
    if (error) { ilmoita("Päivien tallennus ei onnistunut: " + error.message, true); return i; }
  }
  return rivit.length;
}

// tulevat, tekemättömät päivät pois (menneet ja kirjatut jäävät historiaan)
async function poistaTulevat(paketti) {
  const { data } = await sb.from("ohjelma").select("id,paiva,treeniohjelma").eq("paketti_id", paketti.id).gte("paiva", tanaan());
  const idt = (data || []).map((r) => r.id);
  if (!idt.length) return new Set();
  const { data: tot } = await sb.from("omat_treenit").select("ohjelma_id").in("ohjelma_id", idt);
  const kirjatut = new Set((tot || []).map((t) => t.ohjelma_id));
  const pois = idt.filter((id) => !kirjatut.has(id));
  if (pois.length) { const { error } = await sb.from("ohjelma").delete().in("id", pois); if (error) throw error; }
  return new Set((data || []).filter((r) => kirjatut.has(r.id)).map((r) => r.paiva + "|" + r.treeniohjelma));
}

// ---------- Ohjelmani ----------
function ohjelmatVl(el, paivita) {
  const t = tanaan();
  const voiMuokata = (p) => !D.oma || p.tekija === "pelaaja";
  const tila_ = (p) => (p.loppu < t ? "päättynyt" : p.alku > t ? "tuleva" : "voimassa");
  const minivk = (p) => `<div class="tk-minivk">${VKP.map((v, i) => { const r = (p.rivit || []).filter((x) => +x.vp === i + 1); return `<div><small>${v}</small>${r.map((x) => `<i style="background:${tyyppiVari(x.koodi)}" title="${esc(D.ohjelmat[x.koodi]?.nimi || x.koodi)}"></i>`).join("")}</div>`; }).join("")}</div>`;
  el.innerHTML = `
    <section class="tk-osio"><h2>Ohjelmat</h2>
      ${D.paketit.length ? `<div class="tk-paketit">${D.paketit.map((p) => `<article class="tk-paketti ${tila_(p).replace("ä", "a")}">
        <header><b>${esc(p.nimi)}</b><span class="tk-tagi">${tila_(p)}</span>${p.yhteinen ? `<span class="tk-tagi yhteinen">yhteinen</span>` : ""}${p.tekija === "valmennus" ? `<span class="tk-tagi">valmennus</span>` : ""}</header>
        <p class="pieni">${pvLyh(p.alku)}${p.alku.slice(0, 4)}–${pvLyh(p.loppu)}${p.loppu.slice(0, 4)}${p.yhteinen ? " · treenit valmennuksen yhteisestä ohjelmasta" : ` · ${(p.rivit || []).length} treeniä viikossa`}</p>
        ${p.yhteinen ? "" : minivk(p)}
        ${voiMuokata(p) ? `<form class="tk-voimassa" data-p="${p.id}"><label><span class="pieni">Alkaa</span><input type="date" name="alku" value="${p.alku}"></label><label><span class="pieni">Päättyy</span><input type="date" name="loppu" value="${p.loppu}"></label>
          <button class="btn pieni-nappi">Muuta voimassaoloa</button><button type="button" class="linkkinappi vaara" data-poista-p="${p.id}">Poista ohjelma</button></form>` : ""}
      </article>`).join("")}</div>` : `<p class="tyhja">Ei vielä ohjelmia. Rakenna ohjelma tai valitse jakso yhteiselle ohjelmalle.</p>`}
    </section>
    <section class="tk-osio"><h2>Seuraan yhteistä viikko-ohjelmaa</h2>
      <p class="pieni">Kun asut Kouvolassa ja treenaat valmennuksen yhteisen ohjelman mukaan, valitse jakso. Yhteiset treenit näkyvät viikollasi, ja voit lisätä niiden rinnalle omia.</p>
      <form class="tk-voimassa" id="tk-yhteinen"><label><span class="pieni">Alkaa</span><input type="date" name="alku" value="${maanantai(t)}" required></label><label><span class="pieni">Päättyy</span><input type="date" name="loppu" value="${lisaaPv(maanantai(t), 27)}" required></label><button class="btn pieni-nappi">Seuraa jaksolla</button></form>
    </section>
    <section class="tk-osio"><h2>Ohjelmatiedostot</h2>
      <p class="pieni">${D.oma ? "Onko ohjelmasi Wordissa, Excelissä tai PDF:nä? Lataa se tänne. Tiedosto tallentuu valmennuksen Driveen nimelläsi – vain sinä ja valmennus näette sen. Jarvis voi rakentaa siitä sinulle valmiin ohjelman." : "Pelaajan lataamat ohjelmatiedostot (valmennuksen Drive)."}</p>
      ${D.tiedostot.length ? `<ul class="tk-tiedostot">${D.tiedostot.map((x) => `<li>${D.oma ? `<span>📄 ${esc(x.nimi)}</span>` : `<a href="https://drive.google.com/file/d/${encodeURIComponent(x.drive_id)}/view" target="_blank" rel="noopener">${esc(x.nimi)} ↗</a>`}<small>${pvLyh(x.luotu.slice(0, 10))}</small></li>`).join("")}</ul>` : ""}
      ${D.oma ? `<label class="btn"><input type="file" id="tk-tiedosto" accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.txt" hidden>Lataa ohjelmatiedosto</label>` : ""}
    </section>`;
  $$("form.tk-voimassa[data-p]", el).forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const p = D.paketit.find((x) => x.id === f.dataset.p), { alku, loppu } = f.elements;
    if (!alku.value || loppu.value < alku.value) return ilmoita("Tarkista päivät", true);
    try {
      const ohita = await poistaTulevat(p);
      const u = await sb.from("treenipaketit").update({ alku: alku.value, loppu: loppu.value, muokattu: new Date().toISOString() }).eq("id", p.id).select().single();
      if (u.error) throw u.error;
      if (!u.data.yhteinen) await kirjoitaPaivat(u.data, tanaan(), ohita);
      ilmoita("Voimassaolo päivitetty"); paivita();
    } catch (err) { ilmoita("Muutos ei onnistunut: " + err.message, true); }
  }));
  $$("[data-poista-p]", el).forEach((b) => (b.onclick = async () => {
    const p = D.paketit.find((x) => x.id === b.dataset.poistaP);
    if (!confirm(`Poistetaanko ohjelma "${p.nimi}"? Tulevat suunnitellut treenit poistuvat, tehdyt kirjaukset jäävät.`)) return;
    try {
      await poistaTulevat(p);
      const { error } = await sb.from("treenipaketit").delete().eq("id", p.id);
      if (error) throw error;
      ilmoita("Ohjelma poistettu"); paivita();
    } catch (err) { ilmoita("Poisto ei onnistunut: " + err.message, true); }
  }));
  $("#tk-yhteinen", el).onsubmit = async (e) => {
    e.preventDefault();
    const { alku, loppu } = e.target.elements;
    if (loppu.value < alku.value) return ilmoita("Tarkista päivät", true);
    const { error } = await sb.from("treenipaketit").insert({ pelaaja_id: D.pid, nimi: "Yhteinen viikko-ohjelma (MSU)", alku: alku.value, loppu: loppu.value, yhteinen: true, rivit: [], tekija: D.oma ? "pelaaja" : "valmennus" });
    if (error) return ilmoita("Tallennus ei onnistunut: " + error.message, true);
    ilmoita("Yhteinen ohjelma näkyy viikoillasi"); paivita();
  };
  const tied = $("#tk-tiedosto", el);
  if (tied) tied.onchange = async () => {
    const file = tied.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return ilmoita("Tiedosto on yli 15 Mt", true);
    ilmoita("Ladataan tiedostoa…");
    const { data: { session } } = await sb.auth.getSession();
    const fd = new FormData(); fd.append("tiedosto", file);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/ohjelmatiedosto`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.virhe || `HTTP ${r.status}`);
      ilmoita("Tiedosto ladattu valmennuksen Driveen"); paivita();
    } catch (err) { ilmoita("Lataus ei onnistunut: " + err.message, true); }
  };
}

// ---------- Asetukset ----------
function asetukset(el, paivita) {
  const a = D.asetukset.asteikko;
  const varit = D.asetukset.varit?.length === a ? D.asetukset.varit : OLETUSVARIT[a];
  const omat = Object.values(D.ohjelmat).filter((o) => o.oma);
  el.innerHTML = `
    <section class="tk-osio"><h2>Rasitusasteikko ja värit</h2>
      <p class="pieni">Käytä omaa asteikkoasi. Valmennukselle ja kuormalaskentaan arvo muunnetaan taustalla 1–10-asteikolle (1–5: 1 → 2, 3 → 6, 5 → 10).</p>
      <form id="tk-asteikko">
        <div class="chipit" role="radiogroup" aria-label="Asteikko">${[5, 10].map((x) => `<label class="chip"><input type="radio" name="asteikko" value="${x}"${x === a ? " checked" : ""}>1–${x}</label>`).join("")}</div>
        <div class="tk-varit">${varit.map((v, i) => `<label><span class="num">${i + 1}</span><input type="color" name="v${i}" value="${v}" aria-label="Väri rasitukselle ${i + 1}"></label>`).join("")}</div>
        <button class="btn ensisij">Tallenna</button> <button type="button" class="linkkinappi" data-oletus>Palauta oletusvärit</button>
      </form>
    </section>
    <section class="tk-osio"><h2>Omat treenit</h2>
      <p class="pieni">Omat treenisi ohjelmien rakennusosiksi, esim. "Mäkivedot". Näkyvät vain sinulle ja valmennukselle.</p>
      ${omat.length ? `<ul class="tk-omat">${omat.map((o) => `<li style="--v:${T[o.tyyppi]?.vari}"><b>${esc(o.nimi)}</b><small>${esc(T[o.tyyppi]?.nimi || "")} · ${minStr(o.kesto_min || 0)}</small>${rpePallo(o.rpe)}<button class="linkkinappi" data-muokkaa-t="${esc(o.koodi)}">Muokkaa</button></li>`).join("")}</ul>` : ""}
      <button class="btn" data-uusi-tuote>+ Luo oma treeni</button>
    </section>`;
  const f = $("#tk-asteikko", el);
  [...f.elements.asteikko].forEach((r) => (r.onchange = () => { D.asetukset = { ...D.asetukset, asteikko: +r.value, varit: null }; asetukset(el, paivita); }));
  $("[data-oletus]", f).onclick = () => { D.asetukset = { ...D.asetukset, varit: null }; asetukset(el, paivita); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const uusiA = +[...f.elements.asteikko].find((r) => r.checked).value;
    const v = Array.from({ length: uusiA }, (_, i) => f.elements["v" + i]?.value).filter(Boolean);
    const { error } = await sb.from("treeniasetukset").upsert({ pelaaja_id: D.pid, asteikko: uusiA, varit: v.length === uusiA ? v : null, muokattu: new Date().toISOString() });
    if (error) return ilmoita("Tallennus ei onnistunut: " + error.message, true);
    ilmoita("Asetukset tallennettu"); paivita();
  };
  $("[data-uusi-tuote]", el).onclick = () => tuoteLomake($("#tk-dialogi"), null, paivita);
  $$("[data-muokkaa-t]", el).forEach((b) => (b.onclick = () => tuoteLomake($("#tk-dialogi"), D.ohjelmat[b.dataset.muokkaaT], paivita)));
}

function tuoteLomake(dlg, o, paivita) {
  const f = avaaDialogi(dlg, `
    <header><h2>${o ? "Muokkaa treeniä" : "Uusi oma treeni"}</h2><button class="tr-sulje" data-sulje aria-label="Sulje">✕</button></header>
    <label class="tk-kentta"><span>Nimi</span><input name="nimi" required maxlength="60" value="${esc(o?.nimi || "")}" placeholder="esim. Mäkivedot"></label>
    <label class="tk-kentta"><span>Perusryhmä <small>(kuormalaskentaan)</small></span><select name="tyyppi">${TYYPIT.filter((t) => t.k !== "testi").map((t) => `<option value="${t.k}"${t.k === (o?.tyyppi || "fysiikka") ? " selected" : ""}>${t.nimi}</option>`).join("")}</select></label>
    <label class="tk-kentta"><span>Oletuskesto, min</span><input type="number" name="kesto" min="5" max="600" step="5" value="${o?.kesto_min || 45}"></label>
    <div class="tk-kentta"><span>Oletusrasitus</span>${rpeValinta(o?.rpe || 5)}</div>
    <label class="tk-kentta"><span>Sisältö <small>(rivi per liike, vapaaehtoinen)</small></span><textarea name="kuvaus" rows="4">${esc(o?.kuvaus || "")}</textarea></label>
    <div class="tk-napit">${o ? `<button class="btn vaara" data-poista>Poista treeni</button>` : ""}<button class="btn ensisij" value="ok">Tallenna</button></div>`);
  if (o) $("[data-poista]", f).onclick = async (e) => {
    e.preventDefault();
    if (!confirm("Poistetaanko oma treeni? Jo kirjatut treenit säilyvät.")) return;
    const { error } = await sb.from("treeniohjelmat").update({ aktiivinen: false }).eq("koodi", o.koodi);
    if (error) return ilmoita("Poisto ei onnistunut: " + error.message, true);
    dlg.close(); paivita();
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const x = f.elements, oma = +([...x.rpe].find((r) => r.checked)?.value || 5);
    const rivi = { nimi: x.nimi.value.trim(), tyyppi: x.tyyppi.value, kesto_min: +x.kesto.value || 45, rpe: tallennusRpe(oma, D.asetukset.asteikko), kuvaus: x.kuvaus.value.trim() || null, paivitetty: new Date().toISOString() };
    const r = o ? await sb.from("treeniohjelmat").update(rivi).eq("koodi", o.koodi)
      : await sb.from("treeniohjelmat").insert({ ...rivi, koodi: `oma_${crypto.randomUUID().slice(0, 8)}`, ryhma: "Omat treenit", pelaaja_id: D.pid, oma: true, aktiivinen: true, jarjestys: 900 });
    if (r.error) return ilmoita("Tallennus ei onnistunut: " + r.error.message, true);
    ilmoita("Oma treeni tallennettu"); dlg.close(); paivita();
  };
}
