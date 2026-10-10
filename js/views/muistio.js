// Muistio: valmennuksen muistiinpanot osioittain (aiheet ja vastustajat), OneNoten tapaan.
import { sb, tila } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import {
  JOUKKUEET, AIHEOSIOT, osioNimi, huomionOsio, koosteAvain, haeHuomiot, kommenttimaarat, haeKoosteet, lataaNimet,
  kirjoittajanNimi, aikaSitten, md, luokkaMerkki, omaEmail, tallennaMuistiinpano, paivitaMuistiinpano, muistiinpanonTeksti,
} from "../keskus.js";

const OSIOT = [...AIHEOSIOT, ...JOUKKUEET];
let kanava = null;
let tilaM = { huomiot: [], maarat: new Map(), koosteet: [], osio: "kaikki", haku: "", auki: new Set() };

export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }
const muista = (o) => { try { localStorage.setItem("kpl-osio", o); } catch { /* */ } };
const muistettu = () => { try { return localStorage.getItem("kpl-osio"); } catch { return null; } };

export async function nayta(main, osio) {
  await lataaNimet();
  if (!osio) { const m = muistettu(); location.replace(`#/muistio/${m && (m === "kaikki" || OSIOT.includes(m)) ? m : "kaikki"}`); return; }
  osio = decodeURIComponent(osio);
  if (osio !== "kaikki" && !OSIOT.includes(osio)) osio = "kaikki";
  muista(osio);
  const [huomiot, maarat, koosteet] = await Promise.all([haeHuomiot(), kommenttimaarat(), haeKoosteet()]);
  tilaM = { ...tilaM, huomiot, maarat, koosteet, osio, auki: tilaM.osio === osio ? tilaM.auki : new Set() };

  main.innerHTML = `
    <div class="muistio">
      <nav class="osiot" aria-label="Osiot">${osiolista()}</nav>
      <section class="osio-sisalto" id="osio"></section>
    </div>`;
  piirraOsio();
  kuuntele(() => { $(".osiot").innerHTML = osiolista(); piirraLista(); });
}

function osiolista() {
  const lkm = (o) => tilaM.huomiot.filter((h) => o === "kaikki" || huomionOsio(h) === o).length;
  const linkki = (o) => `<a href="#/muistio/${o}"${tilaM.osio === o ? ' aria-current="page"' : ""}><span>${esc(osioNimi(o))}</span><span class="lkm">${lkm(o) || ""}</span></a>`;
  return `${linkki("kaikki")}<h3>Aiheet</h3>${AIHEOSIOT.map(linkki).join("")}<h3>Vastustajat</h3>${JOUKKUEET.map(linkki).join("")}`;
}

function piirraOsio() {
  const o = tilaM.osio;
  const kooste = tilaM.koosteet.find((k) => k.aihe === koosteAvain(o));
  $("#osio").innerHTML = `
    <div class="osio-otsikko">
      <h1>${esc(osioNimi(o))}</h1>
      <input type="search" id="haku" placeholder="Hae kaikista muistiinpanoista" value="${esc(tilaM.haku)}" aria-label="Hae muistiinpanoista">
    </div>
    <form id="uusi" class="uusi-muistiinpano">
      <textarea name="teksti" rows="3" required placeholder="${o === "kaikki" ? "Kirjoita muistiinpano." : `Kirjoita muistiinpano osioon ${esc(osioNimi(o))}.`} Ensimmäinen rivi on otsikko."></textarea>
      <div class="rivi">
        ${o === "kaikki" ? `<label class="pieni">Osio <select name="osio">${OSIOT.map((x) => `<option value="${x}"${x === "idea" ? " selected" : ""}>${esc(osioNimi(x))}</option>`).join("")}</select></label>` : ""}
        <button class="btn ensisij" type="submit">Tallenna</button>
        <span class="pieni vihje-nappain">Ctrl + Enter tallentaa</span>
      </div>
    </form>
    ${kooste ? `<details class="kooste"><summary><span class="k-otsikko">Jarvisin kooste</span><span class="pieni">${kooste.huomioita} muistiinpanosta, ${aikaSitten(kooste.paivitetty)}</span></summary><div class="md">${md(kooste.sisalto)}</div></details>` : ""}
    <ol class="muistiinpanot" id="lista"></ol>`;
  const form = $("#uusi"), ta = form.querySelector("textarea");
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!ta.value.trim()) return;
    const kohde = form.querySelector("[name=osio]")?.value || o;
    const nappi = form.querySelector("[type=submit]"); nappi.disabled = true;
    try {
      const h = await tallennaMuistiinpano(ta.value, kohde);
      if (!tilaM.huomiot.some((x) => x.id === h.id)) tilaM.huomiot.unshift(h);
      ta.value = "";
      ilmoita(`Tallennettu osioon ${osioNimi(kohde)}`);
      $(".osiot").innerHTML = osiolista(); piirraLista();
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); }
    finally { nappi.disabled = false; }
  };
  $("#haku").oninput = (e) => { tilaM.haku = e.target.value; piirraLista(); };
  piirraLista();
}

function piirraLista() {
  const el = $("#lista"); if (!el) return;
  const q = tilaM.haku.trim().toLowerCase();
  const lista = tilaM.huomiot.filter((h) => q
    ? (h.otsikko + " " + h.teksti + " " + (h.vastustaja || "")).toLowerCase().includes(q)
    : tilaM.osio === "kaikki" || huomionOsio(h) === tilaM.osio);
  const naytaOsio = q || tilaM.osio === "kaikki";
  el.innerHTML = lista.map((h) => kortti(h, naytaOsio)).join("") ||
    `<li class="tyhja">${q ? "Haulla ei löytynyt muistiinpanoja." : "Tässä osiossa ei ole vielä muistiinpanoja. Kirjoita ensimmäinen yllä olevaan kenttään."}</li>`;
  kytkeKortit(el);
}

export function kortti(h, naytaOsio = true) {
  const m = tilaM.maarat.get(h.id);
  const voiPoistaa = h.kirjoittaja === omaEmail() || tila.admin;
  return `<li class="muistiinpano" data-id="${h.id}">
    <div class="m-meta">${naytaOsio ? luokkaMerkki(h) : ""}<span>${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}${h.muokattu && new Date(h.muokattu) - new Date(h.luotu) > 60000 ? " (muokattu)" : ""}</span></div>
    <div class="m-sisalto">
      <h2 class="m-otsikko">${esc(h.otsikko)}</h2>
      ${h.teksti ? `<div class="md">${md(h.teksti)}</div>` : ""}
    </div>
    <div class="m-toiminnot">
      <button class="linkkinappi" data-t="muokkaa">Muokkaa</button>
      <button class="linkkinappi" data-t="kommentit" aria-expanded="${tilaM.auki.has(h.id)}">${m?.n ? `Kommentit (${m.n})` : "Kommentoi"}</button>
      ${voiPoistaa ? `<button class="linkkinappi" data-t="poista">Poista</button>` : ""}
    </div>
    <div class="m-kommentit" ${tilaM.auki.has(h.id) ? "" : "hidden"}></div>
  </li>`;
}

export function kytkeKortit(el) {
  $$(".muistiinpano", el).forEach((li) => {
    const id = li.dataset.id;
    const h = () => tilaM.huomiot.find((x) => x.id === id);
    li.querySelector("[data-t=muokkaa]").onclick = () => muokkaa(li, h());
    li.querySelector("[data-t=kommentit]").onclick = (e) => {
      const k = li.querySelector(".m-kommentit");
      const auki = k.hidden;
      k.hidden = !auki; e.currentTarget.setAttribute("aria-expanded", auki);
      if (auki) { tilaM.auki.add(id); lataaKommentit(k, id); } else tilaM.auki.delete(id);
    };
    li.querySelector("[data-t=poista]")?.addEventListener("click", async () => {
      if (!confirm("Poistetaanko muistiinpano ja sen kommentit pysyvästi?")) return;
      const { error } = await sb.from("huomiot").delete().eq("id", id);
      if (error) return ilmoita(error.message, true);
      tilaM.huomiot = tilaM.huomiot.filter((x) => x.id !== id);
      li.remove(); ilmoita("Muistiinpano poistettu");
      const o = $(".osiot"); if (o) o.innerHTML = osiolista();
    });
    if (tilaM.auki.has(id)) lataaKommentit(li.querySelector(".m-kommentit"), id);
  });
}

function muokkaa(li, h) {
  const s = li.querySelector(".m-sisalto");
  s.innerHTML = `<textarea class="m-muokkaus" rows="${Math.min(18, Math.max(4, muistiinpanonTeksti(h).split("\n").length + 1))}">${esc(muistiinpanonTeksti(h))}</textarea>
    <div class="rivi"><label class="pieni">Osio <select>${OSIOT.map((x) => `<option value="${x}"${x === huomionOsio(h) ? " selected" : ""}>${esc(osioNimi(x))}</option>`).join("")}</select></label>
    <button class="btn ensisij pieni-nappi" data-t="tallenna">Tallenna</button><button class="btn pieni-nappi" data-t="peru">Peru</button></div>`;
  const ta = s.querySelector("textarea"); ta.focus();
  const tallenna = async () => {
    if (!ta.value.trim()) return ilmoita("Muistiinpano ei voi olla tyhjä. Poista se, jos et tarvitse sitä.", true);
    try {
      const uusi = await paivitaMuistiinpano(h.id, ta.value, s.querySelector("select").value);
      Object.assign(h, uusi); ilmoita("Muutokset tallennettu");
      const o = $(".osiot"); if (o) o.innerHTML = osiolista();
      if ($("#lista")) piirraLista(); else { li.outerHTML = kortti(h); kytkeKortit($("#sisalto")); }
    } catch (e) { ilmoita(e.message, true); }
  };
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); tallenna(); } if (e.key === "Escape") s.querySelector("[data-t=peru]").click(); };
  s.querySelector("[data-t=tallenna]").onclick = tallenna;
  s.querySelector("[data-t=peru]").onclick = () => { s.innerHTML = `<h2 class="m-otsikko">${esc(h.otsikko)}</h2>${h.teksti ? `<div class="md">${md(h.teksti)}</div>` : ""}`; };
}

async function lataaKommentit(k, id) {
  const { data } = await sb.from("huomio_kommentit").select("*").eq("huomio_id", id).order("luotu");
  const piirra = (lista) => {
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
      lista.push(c); paivitaMaara(id, 1); piirra(lista); k.querySelector("textarea").focus();
    };
    $$("[data-poista]", k).forEach((b) => (b.onclick = async () => {
      if (!confirm("Poistetaanko kommentti?")) return;
      const { error } = await sb.from("huomio_kommentit").delete().eq("id", b.dataset.poista);
      if (error) return ilmoita(error.message, true);
      lista = lista.filter((x) => x.id !== b.dataset.poista); paivitaMaara(id, -1); piirra(lista);
    }));
  };
  let lista = data || [];
  piirra(lista);
}

function paivitaMaara(id, d) {
  const m = tilaM.maarat.get(id) || { n: 0, ai: 0 }; m.n = Math.max(0, m.n + d); tilaM.maarat.set(id, m);
  const b = document.querySelector(`.muistiinpano[data-id="${id}"] [data-t=kommentit]`);
  if (b) b.textContent = m.n ? `Kommentit (${m.n})` : "Kommentoi";
}

function kuuntele(paivita) {
  poistu();
  kanava = sb.channel("muistio")
    .on("postgres_changes", { event: "*", schema: "public", table: "huomiot" }, (m) => {
      if (m.eventType === "DELETE") tilaM.huomiot = tilaM.huomiot.filter((x) => x.id !== m.old.id);
      else if (m.eventType === "INSERT") { if (!tilaM.huomiot.some((x) => x.id === m.new.id)) tilaM.huomiot.unshift(m.new); }
      else { const h = tilaM.huomiot.find((x) => x.id === m.new.id); if (h) Object.assign(h, m.new); }
      if (!document.querySelector(".m-muokkaus")) paivita();
    }).subscribe();
}

// Yksittäinen muistiinpano (linkki Keskuksesta tai jaettu osoite)
export async function naytaYksi(main, id) {
  await lataaNimet();
  const [{ data: h }, maarat] = await Promise.all([sb.from("huomiot").select("*").eq("id", id).maybeSingle(), kommenttimaarat()]);
  if (!h) { main.innerHTML = `<h1>Muistiinpanoa ei löydy</h1><p class="ingressi">Se on ehkä poistettu.</p><p><a class="btn" href="#/muistio">Muistio</a></p>`; return; }
  tilaM = { ...tilaM, huomiot: [h], maarat, osio: null, auki: new Set([h.id]) };
  main.innerHTML = `<p class="murupolku"><a href="#/muistio/${esc(huomionOsio(h))}">${esc(osioNimi(huomionOsio(h)))}</a></p><ol class="muistiinpanot yksi">${kortti(h)}</ol>`;
  kytkeKortit(main);
}
