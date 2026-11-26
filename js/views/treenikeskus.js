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
const VALILEHDET = [["viikko", "Viikko"], ["rakenna", "Rakenna ohjelma"], ["suunnittele", "Suunnittele viikot"], ["asetukset", "Asetukset"]];
const KORI_AVAIN = "kpl-tk-kori", VK_AVAIN = "kpl-tk-viikkopohja";
// 26.11.2026 (Jugi): miehille ei valmennuksen valmiita ohjelmia (ne ovat junioreille ja haastajaryhmälle);
// miehillä valittavissa omat ohjelmat, valmennuksen henkilökohtaiset sekä perustreenit (laji, kunto, Superpesis-voimat)
const PERUSRYHMAT = ["Omatoiminen laji", "Omatoiminen kunto", "Superpesis-voimat"];
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
async function lataa(pid, alku = viikko, vkLoppu = lisaaPv(viikko, 6)) {
  const p = tila.pelaaja[pid];
  const msu = p.treeniprofiili === "msu";
  const [oh, pak, ohj, tot, sai, mui, ase, tie, tap, poi, ras, ilm, lii] = await Promise.all([
    sb.from("treeniohjelmat").select("*").eq("aktiivinen", true).order("jarjestys"),
    sb.from("treenipaketit").select("*").eq("pelaaja_id", pid).order("alku", { ascending: false }),
    sb.from("ohjelma").select("*").gte("paiva", alku).lte("paiva", vkLoppu).eq("pelaaja_id", pid),
    sb.from("omat_treenit").select("*").eq("pelaaja_id", pid).gte("pvm", alku).lte("pvm", vkLoppu).order("luotu"),
    sb.from("sairaudet").select("*").eq("pelaaja_id", pid).lte("alku", vkLoppu).gte("loppu", alku),
    pid === tila.omaPelaaja ? sb.from("omat_muistiot").select("*").eq("pelaaja_id", pid) : Promise.resolve({ data: [] }),
    sb.from("treeniasetukset").select("*").eq("pelaaja_id", pid).maybeSingle(),
    sb.from("ohjelmatiedostot").select("*").eq("pelaaja_id", pid).order("luotu", { ascending: false }),
    // yhteinen MSU-ohjelma = miesten tapahtumat (valmennuksen viikko-ohjelma, tuotu tapahtumat-tauluun); RLS antaa haastajalle
    // myös oman B-ryhmän Nimenhuudon tapahtumat, jotka suodatetaan pois alla
    sb.from("tapahtumat").select("joukkue_id,uid,pvm,alku,otsikko,paikka,peruttu").gte("pvm", alku).lte("pvm", vkLoppu).order("alku"),
    sb.from("poissaolot").select("uid").eq("pelaaja_id", pid),
    sb.from("rasitusarviot").select("uid,rpe").eq("pelaaja_id", pid).then((r) => r, () => ({ data: [] })),
    // 26.11.2026 (Viljami Lammila, korjaamo): haastajalle oman ryhmän Nimenhuudon IN-treenit viikolle
    msu ? Promise.resolve({ data: [] }) : sb.from("ilmoittautumiset").select("uid,tila").eq("pelaaja_id", pid).then((r) => r, () => ({ data: [] })),
    sb.from("liikkeet").select("*").eq("aktiivinen", true).or(`pelaaja_id.is.null,pelaaja_id.eq.${pid}`).order("jarjestys").order("nimi"),
  ]);
  const virhe = [oh, pak, ohj, tot, sai].find((r) => r.error);
  if (virhe) throw new Error(virhe.error.message);
  const ohjelmat = Object.fromEntries((oh.data || []).filter((o) => !o.pelaaja_id || o.pelaaja_id === pid).map((o) => [o.koodi, o]));
  // valittavat ohjelmat (viikolle ja kirjaukseen): miehillä ei valmennuksen yhteisiä valmiita ohjelmia
  const valittavat = Object.values(ohjelmat).filter((o) => o.pelaaja_id || !msu || PERUSRYHMAT.includes(o.ryhma));
  return {
    p, ohjelmat, valittavat, liikkeet: lii.data || [], paketit: pak.data || [],
    ohjelma: [...(ohj.data || []), ...(tap.data || [])
      .filter((e) => !e.peruttu && (msu ? e.joukkue_id === p.joukkue_id : e.joukkue_id !== p.joukkue_id && !tila.joukkueet.some((j) => j.id === e.joukkue_id && j.alue === "psu")))
      .map((e, i) => ({ id: e.uid, tapahtuma: true, joukkue_id: e.joukkue_id, pelaaja_id: null, paiva: e.pvm, otsikko: e.otsikko, kuvaus: [e.alku?.slice(0, 5).replace(":", "."), e.paikka].filter(Boolean).join(" "), jarjestys: i })),
      // haastaja: oman ryhmän Nimenhuuto-treenit, joihin IN (näkyvät aina, lasketaan kuormaan kuten Oma Keskuksessa)
      ...(() => { const inn = new Set((ilm.data || []).filter((x) => x.tila === "IN").map((x) => x.uid)), nahty = new Set();
        return (tap.data || []).filter((e) => !msu && !e.peruttu && e.joukkue_id === p.joukkue_id && inn.has(e.uid) && !nahty.has(e.uid) && nahty.add(e.uid))
          .map((e, i) => ({ id: e.uid, tapahtuma: true, nh: true, joukkue_id: e.joukkue_id, pelaaja_id: pid, paiva: e.pvm, otsikko: e.otsikko.replace(/^KPL B:\s*/, ""), kuvaus: e.alku?.slice(0, 5).replace(":", ".") || "", jarjestys: i })); })()],
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
      <p class="ingressi">${oma ? "Oma viikkosi, tulevat viikot ja tehdyt treenit. Rakenna omat ohjelmasi liikkeistä ja suunnittele viikot." : `Pelaajan suunnitelmat ja toteutuneet treenit. 🔒-huomiot näkyvät vain pelaajalle. <a href="#/oma/${pid}">Pelaajan oma Keskus →</a>`}</p></div>
    </div>
    <div class="tk-valilehdet" role="tablist">${lehdet.map(([k, t]) => `<button type="button" role="tab" class="chip" data-vl="${k}" aria-pressed="${valilehti === k}">${t}</button>`).join("")}</div>
    <div id="tk-vl"></div>
    <dialog id="tk-dialogi" class="tk-dialogi"></dialog>`;
  $$("[data-vl]", main).forEach((b) => (b.onclick = () => { valilehti = b.dataset.vl; piirra(main, pid, oma); }));
  const el = $("#tk-vl", main);
  const paivita = () => piirra(main, pid, oma);
  if (!VALILEHDET.some(([k]) => k === valilehti)) valilehti = "viikko";
  try {
    if (valilehti === "rakenna") return rakenna(el, paivita);
    if (valilehti === "suunnittele") return suunnittele(el, paivita);
    if (valilehti === "asetukset") return asetukset(el, paivita);
    return viikkoVl(el, paivita, main);
  } catch (e) {
    console.error(e);
    try { sessionStorage.removeItem(KORI_AVAIN + "2" + pid); sessionStorage.removeItem(VK_AVAIN + pid); } catch { /* ohitetaan */ }
    el.innerHTML = `<p class="ingressi">Sivua ei saatu näytettyä (${esc(e.message)}). <button class="btn" data-uudelleen>Yritä uudelleen</button></p>`;
    $("[data-uudelleen]", el).onclick = paivita;
  }
}

const rpePallo = (rpe) => (rpe ? `<i class="tk-rpe" style="background:${rpeVari(rpe, D.asetukset)}" title="Rasitus ${naytaRpe(rpe, D.asetukset.asteikko)}/${D.asetukset.asteikko}">${naytaRpe(rpe, D.asetukset.asteikko)}</i>` : "");
const tyyppiVari = (koodi) => T[D.ohjelmat[koodi]?.tyyppi]?.vari || "#888";

// ---------- Viikko ----------
function viikkoVl(el, paivita, main) {
  const paivat = viikonPaivat(viikko, D);
  const t = tanaan();
  // miehillä yhteinen treeni lasketaan tehdyksi, ellei pelaaja merkitse Olin poissa (sama kuin Oma Keskuksen kuormassa)
  const mukana = (s) => s.tapahtuma && (D.msu || s.nh) && s.paiva <= t && !D.poissa.has(s.id);
  const suunn = paivat.flatMap((d) => d.suunnitellut), tehty = suunn.filter((s) => s.toteuma || mukana(s)).length;
  const min = paivat.flatMap((d) => d.toteutuneet).reduce((s, x) => s + (x.kesto_min || 0), 0);
  const rpet = paivat.flatMap((d) => d.toteutuneet).map((x) => x.rpe).filter(Boolean);
  const kaRpe = rpet.length ? Math.round(rpet.reduce((a, b) => a + b, 0) / rpet.length) : null;
  const sairaat = paivat.filter((d) => d.sairas).length;
  const kohde = (s) => D.ohjelmat[s.treeniohjelma];
  const rivi = (s, d) => {
    if (s.tapahtuma && (D.msu || s.nh)) return yhteinenRivi(s, d.pvm <= t);
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
      <span class="tk-s-nimi">${esc(s.otsikko)} <span class="tk-tagi yhteinen">${s.nh ? "Nimenhuuto" : "yhteinen"}</span><small>${esc(s.kuvaus || "")}</small></span>
      ${menn ? `<span class="tk-s-tila">${poissa ? `<span class="tk-poissa">poissa</span>` : `✓ ${rpePallo(rpe)}`}</span>` : ""}
      ${D.oma && menn ? `<span class="tk-s-napit"><button class="linkkinappi" data-poissa="${esc(s.id)}" data-j="${s.joukkue_id}">${poissa ? "Olin mukana" : "Olin poissa"}</button>${poissa ? "" : `<button class="linkkinappi" data-ras="${esc(s.id)}">Rasitus</button>`}</span>` : ""}</li>`;
  };
  const ylim = (x) => `<li class="tk-s tehty ylim" style="--v:${tyyppiVari(x.ohjelma)}"><span class="tk-s-nimi">${esc(lyhyt(D.ohjelmat[x.ohjelma]?.nimi || T[x.tyyppi]?.nimi || "Treeni"))} <span class="tk-tagi">lisätty</span><small>${minStr(x.kesto_min || 0)}</small></span>
      <span class="tk-s-tila">✓ ${rpePallo(x.rpe)}</span>${D.oma ? `<span class="tk-s-napit"><button class="linkkinappi" data-muokkaa="${x.id}">Muokkaa</button></span>` : ""}</li>`;
  el.innerHTML = `
    ${D.oma ? `<button class="btn ensisij tk-kirjaa-iso" data-kirjaa-uusi>+ Kirjaa treeni</button>` : ""}
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
  // nopea kirjaus (myös Oma Keskuksen "Kirjaa treeni" -linkistä)
  const kirjaaUusi = () => kirjausLomake(dlg, { pvm: t }, paivita);
  $("[data-kirjaa-uusi]", el).onclick = kirjaaUusi;
  try { if (sessionStorage.getItem("kpl-tk-kirjaa")) { sessionStorage.removeItem("kpl-tk-kirjaa"); kirjaaUusi(); } } catch { /* ohitetaan */ }
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
  const lista = D.valittavat.length ? D.valittavat : Object.values(D.ohjelmat), ryhmat = [...new Set(lista.map((o) => o.ryhma))];
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
    <p class="pieni">${suunniteltu ? `Suunniteltu: ${esc(o ? lyhyt(o.nimi) : suunniteltu.otsikko || "")}. Jos teit jotain muuta, vaihda treeni.` : toteuma ? "Voit muuttaa treeniä, kestoa ja rasitusta jälkikäteen." : "Valitse tehty treeni, päivä, kesto ja rasitus."}</p>
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

// ---------- Rakenna ohjelma: liikkeet → kori → oma ohjelma ----------
// v2-kori (liikkeet); vanhan version kori (taulukko) ohitetaan
const lueKori = () => { try { const k = JSON.parse(sessionStorage.getItem(KORI_AVAIN + "2" + D.pid)); return k && Array.isArray(k.rivit) ? k : { rivit: [] }; } catch { return { rivit: [] }; } };
const tallennaKori = (k) => { try { sessionStorage.setItem(KORI_AVAIN + "2" + D.pid, JSON.stringify(k)); } catch { /* ohitetaan */ } };
let kategoria = null;
const omatOhjelmat = () => Object.values(D.ohjelmat).filter((o) => o.pelaaja_id === D.pid);
const valmiit = () => Object.values(D.ohjelmat).filter((o) => !o.pelaaja_id && o.kuvaus && !PERUSRYHMAT.includes(o.ryhma));
const voiMuokataOhjelmaa = (o) => (D.oma ? o.oma : !o.oma);

function rakenna(el, paivita) {
  const kori = lueKori();
  const kategoriat = [...new Set(D.liikkeet.filter((l) => !l.pelaaja_id).map((l) => l.kategoria))];
  const valinnat = [...kategoriat, ...(D.liikkeet.some((l) => l.pelaaja_id) ? ["Omat liikkeet"] : []), ...(!D.msu && valmiit().length ? ["Valmiit ohjelmat"] : [])];
  if (!valinnat.includes(kategoria)) kategoria = valinnat[0];
  const omat = omatOhjelmat();
  const liikeRivit = kategoria === "Omat liikkeet" ? D.liikkeet.filter((l) => l.pelaaja_id) : D.liikkeet.filter((l) => !l.pelaaja_id && l.kategoria === kategoria);
  const muokattava = kori.koodi ? D.ohjelmat[kori.koodi] : null;
  const liikeVoiMuokata = (l) => (l.pelaaja_id ? D.oma : !D.oma);
  el.innerHTML = `
    <section class="tk-osio"><h2>${D.oma ? "Omat ohjelmat" : "Pelaajan ohjelmat"}</h2>
      ${omat.length ? `<div class="tk-ohjelmat">${omat.map((o) => {
        const rivit = (o.liikkeet || []).length ? o.liikkeet.map((l) => `${l.nimi}${l.maara ? ` ${l.maara}` : ""}`) : (o.kuvaus || "").split("\n").filter((x) => x.trim());
        return `<article class="tk-ohjelma" style="--v:${T[o.tyyppi]?.vari || "#888"}"><header><b>${esc(lyhyt(o.nimi))}</b>${o.oma ? "" : `<span class="tk-tagi">valmennus</span>`}</header>
          <small>${esc(T[o.tyyppi]?.nimi || "")} · ${minStr(o.kesto_min || 0)} ${rpePallo(o.rpe)}</small>
          <ul>${rivit.slice(0, 6).map((r) => `<li>${esc(r)}</li>`).join("")}${rivit.length > 6 ? `<li class="pieni">+ ${rivit.length - 6} muuta</li>` : ""}</ul>
          <footer>${voiMuokataOhjelmaa(o) ? `<button class="linkkinappi" data-muokkaa-o="${esc(o.koodi)}">Muokkaa</button>` : ""}<a class="linkkinappi" href="#/ohjelmat/${esc(o.koodi)}">Avaa</a></footer></article>`; }).join("")}</div>`
        : `<p class="tyhja">${D.oma ? "Et ole vielä rakentanut omia ohjelmia. Valitse liikkeitä alta, kokoa ohjelma oikealla ja tallenna." : "Pelaajalla ei ole vielä omia ohjelmia."}</p>`}
    </section>
    <div class="tk-kauppa">
      <div class="tk-hylly">
        <label class="tk-kentta tk-kategoria"><span>Kategoria</span><select id="tk-kat">${valinnat.map((k) => `<option${k === kategoria ? " selected" : ""}>${esc(k)}</option>`).join("")}</select></label>
        ${kategoria === "Valmiit ohjelmat"
          ? `<div class="tk-tuotteet">${valmiit().map((o) => `<article class="tk-tuote" style="--v:${T[o.tyyppi]?.vari || "#888"}"><div><b>${esc(lyhyt(o.nimi))}</b><small>${esc(o.ryhma)}</small></div>
              <a class="linkkinappi" href="#/ohjelmat/${esc(o.koodi)}">Avaa</a><button class="btn pieni-nappi" data-kopioi="${esc(o.koodi)}">Kopioi koriin</button></article>`).join("")}</div>`
          : `<div class="tk-tuotteet">${liikeRivit.map((l) => `<article class="tk-tuote tk-liike"><div><b>${esc(l.nimi)}</b><small>${esc(l.oletus || "")}${l.kuvaus ? ` · ${esc(l.kuvaus)}` : ""}</small></div>
              ${liikeVoiMuokata(l) ? `<button class="linkkinappi" data-muokkaa-l="${l.id}" aria-label="Muokkaa liikettä ${esc(l.nimi)}">✎</button>` : ""}
              <button class="btn pieni-nappi" data-liike="${l.id}" aria-label="Lisää koriin: ${esc(l.nimi)}">+ Lisää</button></article>`).join("") || `<p class="tyhja">Ei liikkeitä tässä kategoriassa.</p>`}</div>`}
        <p><button class="btn" data-uusi-liike>+ Luo oma liike</button></p>
      </div>
      <aside class="tk-kori" aria-label="Ohjelma rakenteilla">
        <h2>${muokattava ? `Muokkaa: ${esc(lyhyt(muokattava.nimi))}` : "Uusi ohjelma"} <span class="num">(${kori.rivit.length})</span></h2>
        ${kori.rivit.length ? `<ol class="tk-kori-liikkeet">${kori.rivit.map((r, i) => `<li><b>${esc(r.nimi)}</b>
            <div class="tk-kori-rivi"><input data-i="${i}" data-k="maara" value="${esc(r.maara || "")}" placeholder="esim. 3 × 8" aria-label="Sarjat ja toistot: ${esc(r.nimi)}">
            <input data-i="${i}" data-k="huomio" value="${esc(r.huomio || "")}" placeholder="huomio / paino" aria-label="Huomio: ${esc(r.nimi)}">
            <button class="linkkinappi" data-ylos="${i}" aria-label="Siirrä ylös"${i ? "" : " disabled"}>↑</button><button class="linkkinappi" data-pois="${i}" aria-label="Poista ohjelmasta">✕</button></div></li>`).join("")}</ol>` : `<p class="tyhja">Lisää liikkeitä vasemmalta. Muokkaa sarjat ja toistot omiksesi.</p>`}
        <form class="tk-kassa">
          <label class="tk-kentta"><span>Ohjelman nimi</span><input name="nimi" required maxlength="60" value="${esc(kori.nimi || "")}" placeholder="esim. Oma voima A"></label>
          <div class="tk-kentta-rivi"><label class="tk-kentta"><span>Tyyppi <small>(kuormaan)</small></span><select name="tyyppi">${TYYPIT.filter((t) => t.k !== "testi").map((t) => `<option value="${t.k}"${t.k === (kori.tyyppi || "fysiikka") ? " selected" : ""}>${t.nimi}</option>`).join("")}</select></label>
          <label class="tk-kentta"><span>Kesto, min</span><input type="number" name="kesto" min="5" max="600" step="5" value="${kori.kesto || 60}"></label></div>
          <div class="tk-kentta"><span>Rasitus</span>${rpeValinta(kori.rpe || 6)}</div>
          <button class="btn ensisij"${kori.rivit.length ? "" : " disabled"}>${muokattava ? "Tallenna muutokset" : `Tallenna ohjelma${D.oma ? "" : " pelaajalle"}`}</button>
          ${muokattava ? `<button type="button" class="linkkinappi" data-peru>Peru muokkaus</button><button type="button" class="linkkinappi vaara" data-poista-o>Poista ohjelma</button>` : kori.rivit.length ? `<button type="button" class="linkkinappi" data-tyhjenna>Aloita alusta</button>` : ""}
        </form>
      </aside>
    </div>
    <section class="tk-osio"><h2>Ohjelmatiedostot</h2>
      <p class="pieni">${D.oma ? "Onko ohjelmasi Wordissa, Excelissä tai PDF:nä? Lataa se tänne. Tiedosto tallentuu valmennuksen Driveen nimelläsi – vain sinä ja valmennus näette sen – ja siitä voidaan tehdä sinulle valmis ohjelma." : "Pelaajan lataamat ohjelmatiedostot (valmennuksen Drive)."}</p>
      ${D.tiedostot.length ? `<ul class="tk-tiedostot">${D.tiedostot.map((x) => `<li>${D.oma ? `<span>📄 ${esc(x.nimi)}</span>` : `<a href="https://drive.google.com/file/d/${encodeURIComponent(x.drive_id)}/view" target="_blank" rel="noopener">${esc(x.nimi)} ↗</a>`}<small>${pvLyh(x.luotu.slice(0, 10))}</small></li>`).join("")}</ul>` : ""}
      ${D.oma ? `<label class="btn"><input type="file" id="tk-tiedosto" accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.txt" hidden>Lataa ohjelmatiedosto</label>` : ""}
    </section>`;
  const uudelleen = () => rakenna(el, paivita);
  const kassa = $(".tk-kassa", el);
  const muistaLomake = () => { const x = kassa.elements; Object.assign(kori, { nimi: x.nimi.value, tyyppi: x.tyyppi.value, kesto: +x.kesto.value, rpe: tallennusRpe(+([...x.rpe].find((r) => r.checked)?.value || 6), D.asetukset.asteikko) }); tallennaKori(kori); };
  $("#tk-kat", el).onchange = (e) => { muistaLomake(); kategoria = e.target.value; uudelleen(); };
  $$("[data-liike]", el).forEach((b) => (b.onclick = () => { const l = D.liikkeet.find((x) => x.id === b.dataset.liike); muistaLomake(); kori.rivit.push({ liike_id: l.id, nimi: l.nimi, maara: l.oletus || "" }); tallennaKori(kori); ilmoita(`Lisätty: ${l.nimi}`); uudelleen(); }));
  $$("[data-kopioi]", el).forEach((b) => (b.onclick = () => { const o = D.ohjelmat[b.dataset.kopioi]; muistaLomake();
    o.kuvaus.split("\n").map((r) => r.trim()).filter(Boolean).forEach((r) => kori.rivit.push({ liike_id: null, nimi: r, maara: "" }));
    Object.assign(kori, { nimi: kori.nimi || `Oma ${lyhyt(o.nimi)}`, tyyppi: o.tyyppi, kesto: o.kesto_min, rpe: o.rpe }); tallennaKori(kori); uudelleen(); }));
  $$("[data-i]", el).forEach((i) => (i.onchange = () => { kori.rivit[+i.dataset.i][i.dataset.k] = i.value.trim(); tallennaKori(kori); }));
  $$("[data-pois]", el).forEach((b) => (b.onclick = () => { muistaLomake(); kori.rivit.splice(+b.dataset.pois, 1); tallennaKori(kori); uudelleen(); }));
  $$("[data-ylos]", el).forEach((b) => (b.onclick = () => { const i = +b.dataset.ylos; if (!i) return; muistaLomake(); [kori.rivit[i - 1], kori.rivit[i]] = [kori.rivit[i], kori.rivit[i - 1]]; tallennaKori(kori); uudelleen(); }));
  $$("[data-muokkaa-o]", el).forEach((b) => (b.onclick = () => { const o = D.ohjelmat[b.dataset.muokkaaO];
    tallennaKori({ koodi: o.koodi, nimi: lyhyt(o.nimi), tyyppi: o.tyyppi, kesto: o.kesto_min, rpe: o.rpe,
      rivit: (o.liikkeet || []).length ? o.liikkeet : (o.kuvaus || "").split("\n").filter((x) => x.trim()).map((x) => ({ liike_id: null, nimi: x.trim(), maara: "" })) });
    uudelleen(); window.scrollTo({ top: el.querySelector(".tk-kori").getBoundingClientRect().top + scrollY - 90, behavior: "smooth" }); }));
  $$("[data-muokkaa-l]", el).forEach((b) => (b.onclick = () => liikeLomake($("#tk-dialogi"), D.liikkeet.find((x) => x.id === b.dataset.muokkaaL), kategoriat, paivita)));
  $("[data-uusi-liike]", el).onclick = () => liikeLomake($("#tk-dialogi"), null, kategoriat, paivita);
  $("[data-tyhjenna]", el)?.addEventListener("click", () => { tallennaKori({ rivit: [] }); uudelleen(); });
  $("[data-peru]", el)?.addEventListener("click", () => { tallennaKori({ rivit: [] }); uudelleen(); });
  $("[data-poista-o]", el)?.addEventListener("click", async () => {
    if (!confirm(`Poistetaanko ohjelma "${lyhyt(muokattava.nimi)}"? Jo kirjatut treenit säilyvät.`)) return;
    const { error } = await sb.from("treeniohjelmat").update({ aktiivinen: false }).eq("koodi", muokattava.koodi);
    if (error) return ilmoita("Poisto ei onnistunut: " + error.message, true);
    tallennaKori({ rivit: [] }); ilmoita("Ohjelma poistettu"); paivita();
  });
  kassa.onsubmit = async (e) => {
    e.preventDefault(); muistaLomake();
    if (!kori.rivit.length) return ilmoita("Lisää ohjelmaan liikkeitä", true);
    const liikkeet = kori.rivit.map((r) => ({ liike_id: r.liike_id || null, nimi: r.nimi, maara: r.maara || "", huomio: r.huomio || "" }));
    const rivi = { nimi: kori.nimi.trim(), tyyppi: kori.tyyppi, kesto_min: kori.kesto || 60, rpe: kori.rpe, liikkeet, paivitetty: new Date().toISOString(),
      kuvaus: liikkeet.map((l) => [l.nimi, l.maara, l.huomio && `(${l.huomio})`].filter(Boolean).join(" ")).join("\n") };
    const r = muokattava ? await sb.from("treeniohjelmat").update(rivi).eq("koodi", muokattava.koodi)
      : await sb.from("treeniohjelmat").insert({ ...rivi, koodi: `oma_${crypto.randomUUID().slice(0, 8)}`, ryhma: D.oma ? "Omat ohjelmat" : `Henkilökohtainen: ${nimi(D.p)}`, pelaaja_id: D.pid, oma: D.oma, aktiivinen: true, jarjestys: 900 });
    if (r.error) return ilmoita("Tallennus ei onnistunut: " + r.error.message, true);
    tallennaKori({ rivit: [] }); ilmoita(`Ohjelma tallennettu: ${rivi.nimi}. Lisää se viikolle Suunnittele viikot -välilehdellä tai päivän + Treeni -napilla.`); paivita();
  };
  const tied = $("#tk-tiedosto", el);
  if (tied) tied.onchange = () => lataaTiedosto(tied.files[0], paivita);
}

async function lataaTiedosto(file, paivita) {
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
}

function liikeLomake(dlg, l, kategoriat, paivita) {
  const f = avaaDialogi(dlg, `
    <header><h2>${l ? "Muokkaa liikettä" : "Uusi liike"}</h2><button class="tr-sulje" data-sulje aria-label="Sulje">✕</button></header>
    ${!D.oma && !l?.pelaaja_id ? `<p class="pieni">Valmennuksen liike näkyy kaikille pelaajille.</p>` : ""}
    <label class="tk-kentta"><span>Nimi</span><input name="nimi" required maxlength="60" value="${esc(l?.nimi || "")}" placeholder="esim. Bulgarian kyykky"></label>
    <label class="tk-kentta"><span>Kategoria</span><select name="kategoria">${kategoriat.map((k) => `<option${k === (l?.kategoria || kategoria) ? " selected" : ""}>${esc(k)}</option>`).join("")}</select></label>
    <label class="tk-kentta"><span>Oletus <small>(sarjat × toistot, aika tai matka)</small></span><input name="oletus" maxlength="40" value="${esc(l?.oletus || "")}" placeholder="esim. 3 × 8"></label>
    <label class="tk-kentta"><span>Ohje <small>(vapaaehtoinen)</small></span><input name="kuvaus" maxlength="200" value="${esc(l?.kuvaus || "")}"></label>
    <div class="tk-napit">${l ? `<button class="btn vaara" data-poista>Poista liike</button>` : ""}<button class="btn ensisij" value="ok">Tallenna</button></div>`);
  if (l) $("[data-poista]", f).onclick = async (e) => {
    e.preventDefault();
    if (!confirm("Poistetaanko liike? Ohjelmat, joissa se on, säilyvät.")) return;
    const { error } = await sb.from("liikkeet").update({ aktiivinen: false }).eq("id", l.id);
    if (error) return ilmoita("Poisto ei onnistunut: " + error.message, true);
    dlg.close(); paivita();
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const x = f.elements, rivi = { nimi: x.nimi.value.trim(), kategoria: x.kategoria.value, oletus: x.oletus.value.trim() || null, kuvaus: x.kuvaus.value.trim() || null };
    const r = l ? await sb.from("liikkeet").update(rivi).eq("id", l.id) : await sb.from("liikkeet").insert({ ...rivi, pelaaja_id: D.oma ? D.pid : null, jarjestys: 500 });
    if (r.error) return ilmoita("Tallennus ei onnistunut: " + r.error.message, true);
    if (!l && D.oma) kategoria = "Omat liikkeet";
    ilmoita("Liike tallennettu"); dlg.close(); paivita();
  };
}

// ---------- Suunnittele viikot: ohjelmat viikonpäiville voimassaoloajaksi ----------
const lueVk = () => { try { const k = JSON.parse(sessionStorage.getItem(VK_AVAIN + D.pid)); return Array.isArray(k) ? k.filter((x) => D.ohjelmat[x.koodi]) : []; } catch { return []; } };
const tallennaVk = (k) => { try { sessionStorage.setItem(VK_AVAIN + D.pid, JSON.stringify(k)); } catch { /* ohitetaan */ } };
let vkKategoria = null;

function suunnittele(el, paivita) {
  const kori = lueVk(), t = tanaan(), ma = lisaaPv(maanantai(t), 7);
  const ryhmat = [...new Set(D.valittavat.map((o) => (o.pelaaja_id ? "Omat ohjelmat" : o.ryhma)))].sort((a, b) => (a === "Omat ohjelmat" ? -1 : b === "Omat ohjelmat" ? 1 : 0));
  if (!ryhmat.includes(vkKategoria)) vkKategoria = ryhmat[0];
  const lista = D.valittavat.filter((o) => (o.pelaaja_id ? "Omat ohjelmat" : o.ryhma) === vkKategoria);
  const voiMuokata = (p) => !D.oma || p.tekija === "pelaaja";
  const tila_ = (p) => (p.loppu < t ? "päättynyt" : p.alku > t ? "tuleva" : "voimassa");
  const minivk = (p) => `<div class="tk-minivk">${VKP.map((v, i) => { const r = (p.rivit || []).filter((x) => +x.vp === i + 1); return `<div><small>${v}</small>${r.map((x) => `<i style="background:${tyyppiVari(x.koodi)}" title="${esc(D.ohjelmat[x.koodi]?.nimi || x.koodi)}"></i>`).join("")}</div>`; }).join("")}</div>`;
  el.innerHTML = `
    <p class="pieni">Valitse ohjelmat viikonpäiville ja anna voimassaoloaika – viikot täyttyvät automaattisesti. Yksittäisen päivän voit muuttaa Viikko-välilehdellä.</p>
    <div class="tk-kauppa">
      <div class="tk-hylly">
        <article class="tk-tuote tk-yhteinen"><div><b>Yhteinen viikko-ohjelma (MSU)</b><small>Treenaatko Kouvolassa valmennuksen yhteisen ohjelman mukaan? Valitse jakso alhaalta.</small></div></article>
        <label class="tk-kentta tk-kategoria"><span>Kategoria</span><select id="tk-vkat">${ryhmat.map((r) => `<option${r === vkKategoria ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
        <div class="tk-tuotteet">${lista.map((o) => `<article class="tk-tuote" style="--v:${T[o.tyyppi]?.vari || "#888"}"><div><b>${esc(lyhyt(o.nimi))}</b><small>${esc(T[o.tyyppi]?.nimi || "")}${o.kesto_min ? ` · ${minStr(o.kesto_min)}` : ""}</small></div>
          ${rpePallo(o.rpe)}<button class="btn pieni-nappi" data-koriin="${esc(o.koodi)}" aria-label="Lisää viikolle: ${esc(lyhyt(o.nimi))}">+ Lisää</button></article>`).join("") || `<p class="tyhja">${vkKategoria === "Omat ohjelmat" ? "Rakenna ensin ohjelma Rakenna ohjelma -välilehdellä." : "Ei ohjelmia."}</p>`}</div>
      </div>
      <aside class="tk-kori" aria-label="Viikkosuunnitelma">
        <h2>Viikkosuunnitelma <span class="num">(${kori.length})</span></h2>
        ${kori.length ? `<ol>${kori.map((k, i) => { const o = D.ohjelmat[k.koodi]; return `<li style="--v:${T[o?.tyyppi]?.vari || "#888"}">
          <b>${esc(lyhyt(o?.nimi || k.koodi))}</b>
          <div class="tk-kori-rivi"><select data-i="${i}" data-k="vp" aria-label="Viikonpäivä">${VKP.map((v, j) => `<option value="${j + 1}"${+k.vp === j + 1 ? " selected" : ""}>${v}</option>`).join("")}</select>
          <input type="number" data-i="${i}" data-k="kesto_min" value="${k.kesto_min}" min="5" max="600" step="5" aria-label="Kesto minuutteina"><span class="pieni">min</span>
          <select data-i="${i}" data-k="rpe" aria-label="Rasitus">${Array.from({ length: D.asetukset.asteikko }, (_, j) => j + 1).map((r) => `<option value="${tallennusRpe(r, D.asetukset.asteikko)}"${naytaRpe(k.rpe, D.asetukset.asteikko) === r ? " selected" : ""}>Rasitus ${r}</option>`).join("")}</select>
          <button class="linkkinappi" data-pois="${i}" aria-label="Poista suunnitelmasta">✕</button></div></li>`; }).join("")}</ol>
          <form class="tk-kassa">
            <label class="tk-kentta"><span>Suunnitelman nimi</span><input name="nimi" required maxlength="80" placeholder="esim. Talvijakso 1"></label>
            <div class="tk-kentta-rivi"><label class="tk-kentta"><span>Alkaa</span><input type="date" name="alku" value="${ma}" required></label>
            <label class="tk-kentta"><span>Päättyy</span><input type="date" name="loppu" value="${lisaaPv(ma, 27)}" required></label></div>
            <button class="btn ensisij">Tallenna viikoille${D.oma ? "" : " (pelaajalle)"}</button>
            <button type="button" class="linkkinappi" data-tyhjenna>Aloita alusta</button>
          </form>`
        : `<p class="tyhja">Lisää ohjelmia vasemmalta ja valitse jokaiselle viikonpäivä.</p>`}
      </aside>
    </div>
    <section class="tk-osio"><h2>Suunnitelmat</h2>
      ${D.paketit.length ? `<div class="tk-paketit">${D.paketit.map((p) => `<article class="tk-paketti ${tila_(p).replace("ä", "a")}">
        <header><b>${esc(p.nimi)}</b><span class="tk-tagi">${tila_(p)}</span>${p.yhteinen ? `<span class="tk-tagi yhteinen">yhteinen</span>` : ""}${p.tekija === "valmennus" ? `<span class="tk-tagi">valmennus</span>` : ""}</header>
        <p class="pieni">${pvLyh(p.alku)}${p.alku.slice(0, 4)}–${pvLyh(p.loppu)}${p.loppu.slice(0, 4)}${p.yhteinen ? " · valmennuksen yhteinen ohjelma" : ` · ${(p.rivit || []).length} treeniä viikossa`}</p>
        ${p.yhteinen ? "" : minivk(p)}
        ${voiMuokata(p) ? `<form class="tk-voimassa" data-p="${p.id}"><label><span class="pieni">Alkaa</span><input type="date" name="alku" value="${p.alku}"></label><label><span class="pieni">Päättyy</span><input type="date" name="loppu" value="${p.loppu}"></label>
          <button class="btn pieni-nappi">Muuta</button><button type="button" class="linkkinappi vaara" data-poista-p="${p.id}">Poista</button></form>` : ""}
      </article>`).join("")}</div>` : `<p class="tyhja">Ei vielä suunnitelmia.</p>`}
    </section>
    <section class="tk-osio"><h2>Seuraan yhteistä viikko-ohjelmaa</h2>
      <p class="pieni">Valitse jakso, jolloin treenaat valmennuksen yhteisen ohjelman mukaan. Yhteiset treenit näkyvät viikollasi, ja voit lisätä niiden rinnalle omia.</p>
      <form class="tk-voimassa" id="tk-yhteinen"><label><span class="pieni">Alkaa</span><input type="date" name="alku" value="${maanantai(t)}" required></label><label><span class="pieni">Päättyy</span><input type="date" name="loppu" value="${lisaaPv(maanantai(t), 27)}" required></label><button class="btn pieni-nappi">Seuraa jaksolla</button></form>
    </section>`;
  const uudelleen = () => suunnittele(el, paivita);
  $("#tk-vkat", el).onchange = (e) => { vkKategoria = e.target.value; uudelleen(); };
  $$("[data-koriin]", el).forEach((b) => (b.onclick = () => {
    const o = D.ohjelmat[b.dataset.koriin], vp = kori.length ? Math.min(7, +kori[kori.length - 1].vp + 1) : 1;
    kori.push({ koodi: o.koodi, vp, kesto_min: o.kesto_min || 60, rpe: o.rpe || T[o.tyyppi]?.rpe || 5 });
    tallennaVk(kori); ilmoita(`Lisätty: ${lyhyt(o.nimi)}`); uudelleen();
  }));
  $$("[data-i]", el).forEach((i) => (i.onchange = () => { kori[+i.dataset.i][i.dataset.k] = +i.value; tallennaVk(kori); }));
  $$("[data-pois]", el).forEach((b) => (b.onclick = () => { kori.splice(+b.dataset.pois, 1); tallennaVk(kori); uudelleen(); }));
  $("[data-tyhjenna]", el)?.addEventListener("click", () => { tallennaVk([]); uudelleen(); });
  const kassa = $(".tk-kassa", el);
  if (kassa) kassa.onsubmit = async (e) => {
    e.preventDefault();
    const { nimi: n, alku, loppu } = kassa.elements;
    if (loppu.value < alku.value) return ilmoita("Päättymispäivä ennen alkua", true);
    const rivit = [...kori].sort((a, b) => a.vp - b.vp).map((k) => ({ vp: +k.vp, koodi: k.koodi, kesto_min: +k.kesto_min, rpe: +k.rpe }));
    const r = await sb.from("treenipaketit").insert({ pelaaja_id: D.pid, nimi: n.value.trim(), alku: alku.value, loppu: loppu.value, rivit, tekija: D.oma ? "pelaaja" : "valmennus" }).select().single();
    if (r.error) return ilmoita("Tallennus ei onnistunut: " + r.error.message, true);
    const lkm = await kirjoitaPaivat(r.data, tanaan());
    tallennaVk([]);
    ilmoita(`Tallennettu: ${lkm} treeniä viikoille`);
    viikko = maanantai(alku.value > tanaan() ? alku.value : tanaan()); valilehti = "viikko"; paivita();
  };
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
    if (!confirm(`Poistetaanko "${p.nimi}"? Tulevat suunnitellut treenit poistuvat, tehdyt kirjaukset jäävät.`)) return;
    try {
      await poistaTulevat(p);
      const { error } = await sb.from("treenipaketit").delete().eq("id", p.id);
      if (error) throw error;
      ilmoita("Poistettu"); paivita();
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

// ---------- Asetukset ----------
function asetukset(el, paivita) {
  const a = D.asetukset.asteikko;
  const varit = D.asetukset.varit?.length === a ? D.asetukset.varit : OLETUSVARIT[a];
  const omat = D.liikkeet.filter((l) => l.pelaaja_id);
  const kategoriat = [...new Set(D.liikkeet.filter((l) => !l.pelaaja_id).map((l) => l.kategoria))];
  el.innerHTML = `
    <section class="tk-osio"><h2>Rasitusasteikko ja värit</h2>
      <p class="pieni">Käytä omaa asteikkoasi. Valmennukselle ja kuormalaskentaan arvo muunnetaan taustalla 1–10-asteikolle (1–5: 1 → 2, 3 → 6, 5 → 10).</p>
      <form id="tk-asteikko">
        <div class="chipit" role="radiogroup" aria-label="Asteikko">${[5, 10].map((x) => `<label class="chip"><input type="radio" name="asteikko" value="${x}"${x === a ? " checked" : ""}>1–${x}</label>`).join("")}</div>
        <div class="tk-varit">${varit.map((v, i) => `<label><span class="num">${i + 1}</span><input type="color" name="v${i}" value="${v}" aria-label="Väri rasitukselle ${i + 1}"></label>`).join("")}</div>
        <button class="btn ensisij">Tallenna</button> <button type="button" class="linkkinappi" data-oletus>Palauta oletusvärit</button>
      </form>
    </section>
    <section class="tk-osio"><h2>Omat liikkeet</h2>
      <p class="pieni">Liikkeet, joita olet itse luonut ohjelmiesi rakennusosiksi. Näkyvät vain sinulle ja valmennukselle.</p>
      ${omat.length ? `<ul class="tk-omat">${omat.map((l) => `<li style="--v:var(--cyan)"><b>${esc(l.nimi)}</b><small>${esc(l.kategoria)}${l.oletus ? ` · ${esc(l.oletus)}` : ""}</small><button class="linkkinappi" data-muokkaa-l="${l.id}">Muokkaa</button></li>`).join("")}</ul>` : ""}
      <button class="btn" data-uusi-liike>+ Luo oma liike</button>
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
  $("[data-uusi-liike]", el).onclick = () => liikeLomake($("#tk-dialogi"), null, kategoriat, paivita);
  $$("[data-muokkaa-l]", el).forEach((b) => (b.onclick = () => liikeLomake($("#tk-dialogi"), D.liikkeet.find((x) => x.id === b.dataset.muokkaaL), kategoriat, paivita)));
}

// ---------- Oma Keskus: tämä ja ensi viikko yhdellä silmäyksellä (26.11.2026, Jugi) ----------
export async function piirraViikkokortti(el, pid) {
  if (!el) return;
  const ma = maanantai(tanaan()), t = tanaan();
  let d;
  try { d = await lataa(pid, ma, lisaaPv(ma, 13)); } catch (e) { el.innerHTML = `<p class="pieni">Treenikeskusta ei saatu ladattua: ${esc(e.message)}</p>`; return; }
  const vanha = D; D = { ...d, pid, oma: pid === tila.omaPelaaja };
  const vkt = [ma, lisaaPv(ma, 7)].map((m) => viikonPaivat(m, D));
  const merkki = (s, menn) => (s.toteuma || (s.tapahtuma && (D.msu || s.nh) && menn && !D.poissa.has(s.id)) ? "✓" : "");
  const paiva = (x, i) => {
    const menn = x.pvm <= t, rivit = [...x.suunnitellut.map((s) => ({ nimi: s.treeniohjelma ? lyhyt(D.ohjelmat[s.treeniohjelma]?.nimi || s.otsikko) : s.otsikko, vari: s.tapahtuma ? "var(--cyan)" : tyyppiVari(s.treeniohjelma), ok: merkki(s, menn), poissa: s.tapahtuma && D.poissa.has(s.id) })),
      ...x.ylimaaraiset.map((y) => ({ nimi: lyhyt(D.ohjelmat[y.ohjelma]?.nimi || T[y.tyyppi]?.nimi || "Treeni"), vari: tyyppiVari(y.ohjelma), ok: "✓" }))];
    return `<div class="tkk-pv${x.pvm === t ? " tanaan" : ""}${x.sairas ? " sairas" : ""}"><b>${VKP[i]}<small>${pvLyh(x.pvm)}</small></b>
      ${x.sairas ? `<span class="tkk-r">🤒 sairas</span>` : ""}${rivit.map((r) => `<span class="tkk-r${r.poissa ? " poissa" : ""}" style="--v:${r.vari}">${esc(r.nimi)}${r.ok ? ` <em>${r.ok}</em>` : ""}</span>`).join("") || (x.sairas ? "" : `<span class="tkk-lepo">–</span>`)}</div>`;
  };
  el.innerHTML = `<div class="oma-osa-paa"><h2 id="tkk-otsikko">Treenikeskus</h2><a class="btn pieni-nappi" href="#/treenikeskus">Avaa Treenikeskus →</a></div>
    ${vkt.map((vk, n) => `<div class="tkk-vk"><span class="tkk-vk-nimi">${n ? "Ensi viikko" : "Tämä viikko"} <small>vk ${viikkoNumero(vk[0].pvm)}</small></span><div class="tkk-paivat">${vk.map(paiva).join("")}</div></div>`).join("")}
    ${!vkt.flat().some((x) => x.suunnitellut.length || x.toteutuneet.length) && D.oma ? `<p class="pieni">Ei vielä suunnitelmaa. <a href="#/treenikeskus">Rakenna ohjelma ja suunnittele viikot →</a></p>` : ""}`;
  // yhteenveto Oma Keskuksen tilannekorttiin: tämän viikon suunnitellut, tehdyt ja seuraava
  const VKP_NIMI = ["maanantaina", "tiistaina", "keskiviikkona", "torstaina", "perjantaina", "lauantaina", "sunnuntaina"];
  const tama = vkt[0].flatMap((x, i) => x.suunnitellut.map((s) => ({ s, x, i })));
  const nimiS = (s) => (s.treeniohjelma ? lyhyt(D.ohjelmat[s.treeniohjelma]?.nimi || s.otsikko) : s.otsikko);
  const seurR = tama.find(({ s, x }) => x.pvm > t || (x.pvm === t && !merkki(s, true)));
  // tehty = suunnitellut tehdyt + suunnitelman ulkopuolella kirjatut; n = tehty + suunnitellut tekemättömät
  const tehtySuunn = tama.filter(({ s, x }) => merkki(s, x.pvm <= t)).length, lisatyt = vkt[0].reduce((a, x) => a + x.ylimaaraiset.length, 0);
  const yht = { n: tama.length + lisatyt, tehty: tehtySuunn + lisatyt,
    seur: seurR ? { paiva: seurR.x.pvm === t ? "tänään" : seurR.x.pvm === lisaaPv(t, 1) ? "huomenna" : VKP_NIMI[seurR.i], nimi: nimiS(seurR.s) } : null };
  D = vanha;
  return yht;
}
