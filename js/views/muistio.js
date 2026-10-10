// Muistio: valmennuksen muistiinpanot osioittain (aiheet ja joukkueet), OneNoten tapaan.
// Joukkueosiossa välilehdet: muistiinpanot, pelaajat, ottelumuistiot.
import { sb, tila } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import {
  JOUKKUEET, AIHEOSIOT, osioNimi, huomionOsio, koosteAvain, haeHuomiot, kommenttimaarat, haeKoosteet, lataaNimet, haePelaajat,
  kirjoittajanNimi, aikaSitten, md, luokkaMerkki, omaEmail, tallennaMuistiinpano, paivitaMuistiinpano, muistiinpanonTeksti, sukunimiJarjestys, pvmFi,
} from "../keskus.js";
import { haeLiitteet, lataaTiedostot, liitteetHtml, aktivoiLiitteet, poistaLiite, poistaHuomionTiedostot, tiedostoValitsin } from "../liitteet.js";

const OSIOT = [...AIHEOSIOT, ...JOUKKUEET];
const RAKENTEISET = ["lyonti", "ulkopeli"];
let kanava = null;
// Jaettu tila: myös pelaajasivu käyttää kortteja asetaKonteksti()-funktion kautta.
let K = { huomiot: [], maarat: new Map(), koosteet: [], liitteet: new Map(), pelaajat: new Map(), osio: "kaikki", valilehti: "muistiinpanot", haku: "", auki: new Set(), uudelleenpiirra: () => {} };
export const asetaKonteksti = (o) => Object.assign(K, o);
export const kontekstinHuomiot = () => K.huomiot;

export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }
const muista = (o) => { try { localStorage.setItem("kpl-osio", o); } catch { /* */ } };
const muistettu = () => { try { return localStorage.getItem("kpl-osio"); } catch { return null; } };
const onJoukkue = (o) => JOUKKUEET.includes(o);
const tanaan = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });

export async function nayta(main, osio, valilehti) {
  await lataaNimet();
  if (!osio) { const m = muistettu(); location.replace(`#/muistio/${m && (m === "kaikki" || OSIOT.includes(m)) ? m : "kaikki"}`); return; }
  osio = decodeURIComponent(osio);
  if (osio !== "kaikki" && !OSIOT.includes(osio)) osio = "kaikki";
  muista(osio);
  const [huomiot, maarat, koosteet, pelaajat, liitteet] = await Promise.all([haeHuomiot(), kommenttimaarat(), haeKoosteet(), haePelaajat(true), haeLiitteet()]);
  K = { ...K, huomiot, maarat, koosteet, pelaajat, liitteet, osio, valilehti: onJoukkue(osio) ? valilehti || "muistiinpanot" : "muistiinpanot", auki: K.osio === osio ? K.auki : new Set() };
  K.uudelleenpiirra = () => { const o = $(".osiot"); if (o) o.innerHTML = osiolista(); if (K.valilehti === "pelaajat") piirraOsio(); else piirraLista(); };

  main.innerHTML = `
    <div class="muistio">
      <nav class="osiot" aria-label="Osiot">${osiolista()}</nav>
      <section class="osio-sisalto" id="osio"></section>
    </div>`;
  piirraOsio();
  kuuntele();
}

function osiolista() {
  const lkm = (o) => K.huomiot.filter((h) => !RAKENTEISET.includes(h.tyyppi) && (o === "kaikki" || huomionOsio(h) === o)).length;
  const linkki = (o) => `<a href="#/muistio/${o}"${K.osio === o ? ' aria-current="page"' : ""}><span>${esc(osioNimi(o))}</span><span class="lkm">${lkm(o) || ""}</span></a>`;
  return `${linkki("kaikki")}<h3>Aiheet</h3>${AIHEOSIOT.map(linkki).join("")}<h3>Joukkueet</h3>${JOUKKUEET.map(linkki).join("")}`;
}

function piirraOsio() {
  const o = K.osio, v = K.valilehti, joukkue = onJoukkue(o);
  const kooste = K.koosteet.find((k) => k.aihe === koosteAvain(o));
  const pelaajia = [...K.pelaajat.values()].filter((p) => p.joukkue === o && p.aktiivinen).length;
  const muistioita = K.huomiot.filter((h) => h.tyyppi === "ottelumuistio" && h.vastustaja === o).length;
  $("#osio").innerHTML = `
    <div class="osio-otsikko">
      <h1>${esc(osioNimi(o))}</h1>
      <input type="search" id="haku" placeholder="Hae kaikista muistiinpanoista" value="${esc(K.haku)}" aria-label="Hae muistiinpanoista">
    </div>
    ${joukkue ? `<div class="valilehdet" role="tablist">
      ${[["muistiinpanot", "Muistiinpanot", ""], ["pelaajat", "Pelaajat", pelaajia], ["ottelumuistiot", "Ottelumuistiot", muistioita]]
        .map(([k, n, l]) => `<a role="tab" class="valilehti" href="#/muistio/${o}/${k}" aria-selected="${v === k}">${n}${l ? ` <span class="lkm">${l}</span>` : ""}</a>`).join("")}
    </div>` : ""}
    <div id="valilehti"></div>`;
  $("#haku").oninput = (e) => {
    K.haku = e.target.value;
    if (K.valilehti === "pelaajat" && K.haku) { K.valilehti = "muistiinpanot"; const pos = e.target.selectionStart; piirraOsio(); const h = $("#haku"); h.focus(); h.setSelectionRange(pos, pos); return; }
    piirraLista();
  };
  if (joukkue && v === "pelaajat") return piirraPelaajat();
  piirraKirjoitus();
  if (kooste && v === "muistiinpanot") $("#valilehti").insertAdjacentHTML("beforeend", `<details class="kooste"><summary><span class="k-otsikko">Jarvisin kooste</span><span class="pieni">${kooste.huomioita} muistiinpanosta, ${aikaSitten(kooste.paivitetty)}</span></summary><div class="md">${md(kooste.sisalto)}</div></details>`);
  $("#valilehti").insertAdjacentHTML("beforeend", `<ol class="muistiinpanot" id="lista"></ol>`);
  piirraLista();
}

function piirraKirjoitus() {
  const o = K.osio, joukkue = onJoukkue(o), ottelu = K.valilehti === "ottelumuistiot";
  const pelaajat = joukkue ? [...K.pelaajat.values()].filter((p) => p.joukkue === o && p.aktiivinen).sort(sukunimiJarjestys) : [];
  $("#valilehti").innerHTML = `
    <form id="uusi" class="uusi-muistiinpano">
      ${ottelu ? `<label class="kentta pvm-kentta">Ottelun päivä <input type="date" name="pvm" value="${tanaan()}" required></label>` : ""}
      <textarea name="teksti" rows="3" placeholder="${ottelu ? "Ottelumuistion teksti, tai liitä tiedosto (Word, Excel, kuva, PDF)." : o === "kaikki" ? "Kirjoita muistiinpano. Ensimmäinen rivi on otsikko." : `Kirjoita muistiinpano osioon ${esc(osioNimi(o))}. Ensimmäinen rivi on otsikko.`}"></textarea>
      <div class="rivi">
        ${o === "kaikki" ? `<label class="pieni">Osio <select name="osio">${OSIOT.map((x) => `<option value="${x}"${x === "idea" ? " selected" : ""}>${esc(osioNimi(x))}</option>`).join("")}</select></label>` : ""}
        ${joukkue && !ottelu ? `<label class="pieni">Pelaaja <select name="pelaaja"><option value="">Koko joukkue</option>${pelaajat.map((p) => `<option value="${p.id}">${esc(p.nimi)}</option>`).join("")}</select></label>` : ""}
        <span id="tiedostot" class="tiedostot"></span>
        <button class="btn ensisij" type="submit">Tallenna</button>
        <span class="pieni vihje-nappain">Ctrl + Enter tallentaa. Tiedoston voi myös vetää tähän.</span>
      </div>
    </form>`;
  const form = $("#uusi"), ta = form.querySelector("textarea"), valitsin = tiedostoValitsin($("#tiedostot"));
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const tiedostot = valitsin.tiedostot();
    if (!ta.value.trim() && !tiedostot.length) { ta.focus(); return ilmoita("Kirjoita teksti tai liitä tiedosto.", true); }
    const kohde = form.querySelector("[name=osio]")?.value || o;
    const lisa = {};
    if (ottelu) { lisa.tyyppi = "ottelumuistio"; lisa.ottelu_pvm = form.querySelector("[name=pvm]").value; lisa.otsikko = `Ottelumuistio ${pvmFi(lisa.ottelu_pvm)}`; }
    else if (!ta.value.trim()) lisa.otsikko = tiedostot[0].name;
    const pel = form.querySelector("[name=pelaaja]")?.value; if (pel) lisa.pelaaja_id = pel;
    const nappi = form.querySelector("[type=submit]"); nappi.disabled = true; if (tiedostot.length) nappi.textContent = "Tallennetaan…";
    try {
      const h = await tallennaMuistiinpano(ta.value, kohde, lisa);
      if (tiedostot.length) K.liitteet.set(h.id, await lataaTiedostot(h.id, tiedostot));
      if (!K.huomiot.some((x) => x.id === h.id)) K.huomiot.unshift(h);
      ta.value = ""; valitsin.tyhjenna();
      ilmoita(ottelu ? "Ottelumuistio tallennettu" : `Tallennettu osioon ${osioNimi(kohde)}`);
      K.uudelleenpiirra();
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); }
    finally { nappi.disabled = false; nappi.textContent = "Tallenna"; }
  };
}

function piirraLista() {
  const el = $("#lista"); if (!el) return;
  const q = K.haku.trim().toLowerCase();
  const pn = (h) => K.pelaajat.get(h.pelaaja_id)?.nimi || "";
  let lista;
  if (q) lista = K.huomiot.filter((h) => (h.otsikko + " " + h.teksti + " " + (h.vastustaja || "") + " " + pn(h)).toLowerCase().includes(q));
  else if (K.valilehti === "ottelumuistiot") lista = K.huomiot.filter((h) => h.tyyppi === "ottelumuistio" && h.vastustaja === K.osio).sort((a, b) => (b.ottelu_pvm || "").localeCompare(a.ottelu_pvm || ""));
  else lista = K.huomiot.filter((h) => !RAKENTEISET.includes(h.tyyppi) && (K.osio === "kaikki" || (huomionOsio(h) === K.osio && !(onJoukkue(K.osio) && h.tyyppi === "ottelumuistio"))));
  el.innerHTML = lista.map((h) => kortti(h, { osio: !!q || K.osio === "kaikki" })).join("") ||
    `<li class="tyhja">${q ? "Haulla ei löytynyt muistiinpanoja." : K.valilehti === "ottelumuistiot" ? "Ei vielä ottelumuistioita. Lisää ensimmäinen yllä: kirjoita tai liitä tiedosto." : "Tässä osiossa ei ole vielä muistiinpanoja. Kirjoita ensimmäinen yllä olevaan kenttään."}</li>`;
  kytkeKortit(el);
}

const TYYPPINIMI = { lyonti: "Lyönti", ulkopeli: "Ulkopeli", ottelumuistio: "Ottelumuistio" };
export function kortti(h, { osio = true, pelaaja = true } = {}) {
  const m = K.maarat.get(h.id);
  const p = h.pelaaja_id && K.pelaajat.get(h.pelaaja_id);
  const voiPoistaa = h.kirjoittaja === omaEmail() || tila.admin;
  return `<li class="muistiinpano tyyppi-${esc(h.tyyppi)}" data-id="${h.id}">
    <div class="m-meta">${osio ? luokkaMerkki(h) : ""}${h.tyyppi !== "muistiinpano" ? `<span class="tyyppimerkki">${TYYPPINIMI[h.tyyppi]}${h.ottelu_pvm ? ` ${pvmFi(h.ottelu_pvm)}` : ""}</span>` : ""}${pelaaja && p ? `<a class="pelaajamerkki" href="#/vp/${p.id}">${esc(p.nimi)}</a>` : ""}<span>${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}${h.muokattu && new Date(h.muokattu) - new Date(h.luotu) > 60000 ? " (muokattu)" : ""}</span></div>
    <div class="m-sisalto">${sisalto(h)}</div>
    <div class="m-toiminnot">
      ${RAKENTEISET.includes(h.tyyppi) ? "" : `<button class="linkkinappi" data-t="muokkaa">Muokkaa</button>`}
      <button class="linkkinappi" data-t="kommentit" aria-expanded="${K.auki.has(h.id)}">${m?.n ? `Kommentit (${m.n})` : "Kommentoi"}</button>
      ${voiPoistaa ? `<button class="linkkinappi" data-t="poista">Poista</button>` : ""}
    </div>
    <div class="m-kommentit" ${K.auki.has(h.id) ? "" : "hidden"}></div>
  </li>`;
}
const sisalto = (h) => `<h2 class="m-otsikko">${esc(h.otsikko)}</h2>${h.teksti ? `<div class="md">${md(h.teksti)}</div>` : ""}${liitteetHtml(K.liitteet.get(h.id))}`;

export function kytkeKortit(el) {
  $$(".muistiinpano", el).forEach((li) => {
    const id = li.dataset.id;
    const h = () => K.huomiot.find((x) => x.id === id);
    li.querySelector("[data-t=muokkaa]")?.addEventListener("click", () => muokkaa(li, h()));
    li.querySelector("[data-t=kommentit]").onclick = (e) => {
      const k = li.querySelector(".m-kommentit");
      const auki = k.hidden;
      k.hidden = !auki; e.currentTarget.setAttribute("aria-expanded", auki);
      if (auki) { K.auki.add(id); lataaKommentit(k, id); } else K.auki.delete(id);
    };
    li.querySelector("[data-t=poista]")?.addEventListener("click", async () => {
      if (!confirm("Poistetaanko kirjaus, sen kommentit ja liitteet pysyvästi?")) return;
      await poistaHuomionTiedostot(id);
      const { error } = await sb.from("huomiot").delete().eq("id", id);
      if (error) return ilmoita(error.message, true);
      K.huomiot = K.huomiot.filter((x) => x.id !== id);
      ilmoita("Poistettu");
      K.uudelleenpiirra();
    });
    if (K.auki.has(id)) lataaKommentit(li.querySelector(".m-kommentit"), id);
  });
  aktivoiLiitteet(el);
}

function muokkaa(li, h) {
  const s = li.querySelector(".m-sisalto");
  const joukkue = h.luokka === "vastustaja" ? h.vastustaja : null;
  const pelaajat = joukkue ? [...K.pelaajat.values()].filter((p) => p.joukkue === joukkue).sort(sukunimiJarjestys) : [];
  s.innerHTML = `<textarea class="m-muokkaus" rows="${Math.min(18, Math.max(4, muistiinpanonTeksti(h).split("\n").length + 1))}">${esc(muistiinpanonTeksti(h))}</textarea>
    ${liitteetHtml(K.liitteet.get(h.id), { muokattava: true })}
    <div class="rivi">
      ${h.tyyppi === "ottelumuistio" ? `<label class="pieni">Ottelun päivä <input type="date" name="pvm" value="${esc(h.ottelu_pvm || "")}"></label>`
        : `<label class="pieni">Osio <select name="osio">${OSIOT.map((x) => `<option value="${x}"${x === huomionOsio(h) ? " selected" : ""}>${esc(osioNimi(x))}</option>`).join("")}</select></label>`}
      ${joukkue && h.tyyppi === "muistiinpano" ? `<label class="pieni">Pelaaja <select name="pelaaja"><option value="">Koko joukkue</option>${pelaajat.map((p) => `<option value="${p.id}"${p.id === h.pelaaja_id ? " selected" : ""}>${esc(p.nimi)}</option>`).join("")}</select></label>` : ""}
      <span class="tiedostot"></span>
      <button class="btn ensisij pieni-nappi" data-t="tallenna">Tallenna</button><button class="btn pieni-nappi" data-t="peru">Peru</button></div>`;
  const ta = s.querySelector("textarea"), valitsin = tiedostoValitsin(s.querySelector(".tiedostot")); ta.focus();
  aktivoiLiitteet(s);
  $$("[data-poista-liite]", s).forEach((b) => (b.onclick = async () => {
    const l = (K.liitteet.get(h.id) || []).find((x) => x.id === b.dataset.poistaLiite);
    if (!l || !confirm(`Poistetaanko liite ${l.nimi}?`)) return;
    try { await poistaLiite(l); K.liitteet.set(h.id, K.liitteet.get(h.id).filter((x) => x.id !== l.id)); b.closest("li").remove(); ilmoita("Liite poistettu"); }
    catch (e) { ilmoita(e.message, true); }
  }));
  const tallenna = async () => {
    if (!ta.value.trim()) return ilmoita("Kirjaus ei voi olla tyhjä. Poista se, jos et tarvitse sitä.", true);
    try {
      const osioValinta = s.querySelector("[name=osio]")?.value;
      const uusi = await paivitaMuistiinpano(h.id, ta.value, osioValinta);
      const lisa = {};
      const pel = s.querySelector("[name=pelaaja]"); if (pel) lisa.pelaaja_id = pel.value || null;
      if (osioValinta && osioValinta !== huomionOsio(h)) lisa.pelaaja_id = null;
      const pvm = s.querySelector("[name=pvm]"); if (pvm) lisa.ottelu_pvm = pvm.value || null;
      if (Object.keys(lisa).length) { const { data, error } = await sb.from("huomiot").update(lisa).eq("id", h.id).select().single(); if (error) throw error; Object.assign(uusi, data); }
      Object.assign(h, uusi);
      const t = valitsin.tiedostot();
      if (t.length) K.liitteet.set(h.id, [...(K.liitteet.get(h.id) || []), ...(await lataaTiedostot(h.id, t))]);
      ilmoita("Muutokset tallennettu"); K.uudelleenpiirra();
    } catch (e) { ilmoita(e.message, true); }
  };
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); tallenna(); } if (e.key === "Escape") s.querySelector("[data-t=peru]").click(); };
  s.querySelector("[data-t=tallenna]").onclick = tallenna;
  s.querySelector("[data-t=peru]").onclick = () => { s.innerHTML = sisalto(h); aktivoiLiitteet(s); };
}

async function lataaKommentit(k, id) {
  const { data } = await sb.from("huomio_kommentit").select("*").eq("huomio_id", id).order("luotu");
  let lista = data || [];
  const piirra = () => {
    k.innerHTML = `<ol class="kommentit">${lista.map((c) => `<li class="kommentti${c.ai ? " ai" : ""}">
        <div class="k-kuka"><strong>${esc(kirjoittajanNimi(c.kirjoittaja, c.ai))}</strong><span class="pieni">${aikaSitten(c.luotu)}</span>
        ${!c.ai && (c.kirjoittaja === omaEmail() || tila.admin) ? `<button class="linkkinappi" data-poista="${c.id}">Poista</button>` : ""}</div>
        <div class="md">${md(c.teksti)}</div></li>`).join("")}</ol>
      <form class="kommentti-lomake"><textarea rows="2" required placeholder="Kirjoita kommentti" aria-label="Kommentti"></textarea><div><button class="btn pieni-nappi" type="submit">Lähetä</button></div></form>`;
    const f = k.querySelector("form"), ta = f.querySelector("textarea");
    ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const teksti = ta.value.trim(); if (!teksti) return;
      const { data: c, error } = await sb.from("huomio_kommentit").insert({ huomio_id: id, teksti }).select().single();
      if (error) return ilmoita(error.message, true);
      lista.push(c); paivitaMaara(id, 1); piirra(); k.querySelector("textarea").focus();
    };
    $$("[data-poista]", k).forEach((b) => (b.onclick = async () => {
      if (!confirm("Poistetaanko kommentti?")) return;
      const { error } = await sb.from("huomio_kommentit").delete().eq("id", b.dataset.poista);
      if (error) return ilmoita(error.message, true);
      lista = lista.filter((x) => x.id !== b.dataset.poista); paivitaMaara(id, -1); piirra();
    }));
  };
  piirra();
}

function paivitaMaara(id, d) {
  const m = K.maarat.get(id) || { n: 0, ai: 0 }; m.n = Math.max(0, m.n + d); K.maarat.set(id, m);
  const b = document.querySelector(`.muistiinpano[data-id="${id}"] [data-t=kommentit]`);
  if (b) b.textContent = m.n ? `Kommentit (${m.n})` : "Kommentoi";
}

// --- pelaajat-välilehti
function piirraPelaajat() {
  const o = K.osio;
  const kaikki = [...K.pelaajat.values()].filter((p) => p.joukkue === o).sort(sukunimiJarjestys);
  const lkm = (pid, t) => K.huomiot.filter((h) => h.pelaaja_id === pid && h.tyyppi === t).length;
  const kortit = (lista) => lista.map((p) => {
    const ly = lkm(p.id, "lyonti"), ul = lkm(p.id, "ulkopeli"), mu = lkm(p.id, "muistiinpano");
    const osat = [ly && `${ly} lyöntiä`, ul && `${ul} ulkopeli`, mu && `${mu} muistiinpanoa`].filter(Boolean);
    return `<li><a class="pelaajakortti" href="#/vp/${p.id}">
      <span class="pk-nimi">${p.numero != null ? `<span class="num">${p.numero}</span> ` : ""}${esc(p.nimi)}</span>
      ${p.kuvaus ? `<span class="pk-kuvaus">${esc(p.kuvaus)}</span>` : ""}
      <span class="pk-maarat${osat.length ? " on" : ""}">${osat.join(", ") || "Ei kirjauksia"}</span></a></li>`;
  }).join("");
  const akt = kaikki.filter((p) => p.aktiivinen), muut = kaikki.filter((p) => !p.aktiivinen);
  $("#valilehti").innerHTML = `
    <p class="pieni">Kokoonpano 2027 sopimustilanteen mukaan. Avaa pelaaja kirjataksesi lyöntejä, ulkopelin liikkeitä ja muistiinpanoja.</p>
    <ul class="pelaajaruudukko">${kortit(akt) || `<li class="tyhja">Ei pelaajia.</li>`}</ul>
    ${muut.length ? `<details class="muut-pelaajat"><summary>Ilman sopimusta tai harjoitusringissä (${muut.length})</summary><ul class="pelaajaruudukko">${kortit(muut)}</ul></details>` : ""}
    <form id="uusi-pelaaja" class="rivi uusi-pelaaja">
      <input type="text" name="nimi" required minlength="3" maxlength="80" placeholder="Etunimi Sukunimi" aria-label="Uuden pelaajan nimi">
      <button class="btn" type="submit">Lisää pelaaja</button>
    </form>`;
  $("#uusi-pelaaja").onsubmit = async (e) => {
    e.preventDefault();
    const nimi = e.target.nimi.value.trim().replace(/\s+/g, " ");
    const { data, error } = await sb.from("vastustajapelaajat").insert({ joukkue: o, nimi }).select().single();
    if (error) return ilmoita(/duplicate/.test(error.message) ? `${nimi} on jo listalla.` : error.message, true);
    K.pelaajat.set(data.id, data); ilmoita(`${nimi} lisätty`); piirraOsio();
  };
}

function kuuntele() {
  poistu();
  kanava = sb.channel("muistio")
    .on("postgres_changes", { event: "*", schema: "public", table: "huomiot" }, (m) => {
      if (m.eventType === "DELETE") K.huomiot = K.huomiot.filter((x) => x.id !== m.old.id);
      else if (m.eventType === "INSERT") { if (!K.huomiot.some((x) => x.id === m.new.id)) K.huomiot.unshift(m.new); }
      else { const h = K.huomiot.find((x) => x.id === m.new.id); if (h) Object.assign(h, m.new); }
      if (!document.querySelector(".m-muokkaus") && document.activeElement?.tagName !== "TEXTAREA") K.uudelleenpiirra();
    }).subscribe();
}

// Yksittäinen kirjaus (linkki Keskuksesta tai jaettu osoite)
export async function naytaYksi(main, id) {
  await lataaNimet();
  const [{ data: h }, maarat, pelaajat, liitteet] = await Promise.all([sb.from("huomiot").select("*").eq("id", id).maybeSingle(), kommenttimaarat(), haePelaajat(), haeLiitteet([id])]);
  if (!h) { main.innerHTML = `<h1>Muistiinpanoa ei löydy</h1><p class="ingressi">Se on ehkä poistettu.</p><p><a class="btn" href="#/muistio">Muistio</a></p>`; return; }
  K = { ...K, huomiot: [h], maarat, pelaajat, liitteet, osio: null, auki: new Set([h.id]) };
  const piirra = () => {
    if (!K.huomiot.length) { location.hash = `#/muistio/${huomionOsio(h)}`; return; }
    main.innerHTML = `<p class="murupolku"><a href="#/muistio/${esc(huomionOsio(h))}">${esc(osioNimi(huomionOsio(h)))}</a>${h.pelaaja_id && pelaajat.get(h.pelaaja_id) ? ` / <a href="#/vp/${h.pelaaja_id}">${esc(pelaajat.get(h.pelaaja_id).nimi)}</a>` : ""}</p><ol class="muistiinpanot yksi">${kortti(h)}</ol>`;
    kytkeKortit(main);
  };
  K.uudelleenpiirra = piirra;
  piirra();
}
