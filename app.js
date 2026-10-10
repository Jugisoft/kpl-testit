import { sb, tila, lataaPerus, tarkistaRooli, lataaPelaajat } from "./js/db.js";
import { $, esc, tuhoaKaaviot, ilmoita } from "./js/util.js";
import * as koti from "./js/views/koti.js";
import * as kirjaudu from "./js/views/kirjaudu.js";
import * as kerrat from "./js/views/kerrat.js";
import * as syotto from "./js/views/syotto.js";
import * as kerta from "./js/views/kerta.js";
import * as pelaajat from "./js/views/pelaajat.js";
import * as pelaaja from "./js/views/pelaaja.js";
import * as ryhma from "./js/views/ryhma.js";
import * as hallinta from "./js/views/hallinta.js";
import * as superpesis from "./js/views/superpesis.js";
import * as keskus from "./js/views/keskus.js";
import * as muistio from "./js/views/muistio.js";
import * as siirtomarkkinat from "./js/views/siirtomarkkinat.js";
import * as analyysi from "./js/views/analyysi.js";

// Valmentajalle etusivu on Keskus, muille julkiset tilastot.
const etusivu = { nayta: (main, ...a) => (tila.valmentaja ? keskus : koti).nayta(main, ...a), poistu: () => keskus.poistu?.() };

const reitit = [
  { polku: /^\/?$/, nakyma: etusivu, julkinen: true },
  { polku: /^\/tilastot$/, nakyma: koti, julkinen: true, osio: "testit" },
  { polku: /^\/kirjaudu$/, nakyma: kirjaudu, julkinen: true },
  { polku: /^\/muistio(?:\/([^/]+))?$/, nakyma: muistio },
  { polku: /^\/huomio\/([\w-]+)$/, nakyma: { nayta: muistio.naytaYksi, poistu: muistio.poistu } },
  { polku: /^\/huomiot$/, nakyma: { nayta: () => location.replace("#/muistio") } },
  { polku: /^\/siirtomarkkinat$/, nakyma: siirtomarkkinat },
  { polku: /^\/analyysi$/, nakyma: analyysi },
  { polku: /^\/kerrat$/, nakyma: kerrat, osio: "testit" },
  { polku: /^\/syota\/([\w-]+)$/, nakyma: syotto, osio: "testit" },
  { polku: /^\/kerta\/([\w-]+)$/, nakyma: kerta, osio: "testit" },
  { polku: /^\/pelaajat$/, nakyma: pelaajat, osio: "testit" },
  { polku: /^\/pelaaja\/([\w-]+)$/, nakyma: pelaaja, osio: "testit" },
  { polku: /^\/ryhma$/, nakyma: ryhma, osio: "testit" },
  { polku: /^\/superpesis$/, nakyma: superpesis, osio: "testit" },
  { polku: /^\/hallinta$/, nakyma: hallinta, admin: true },
];

// Päävalikko: [teksti, osoite, aktiivinen kun polku täsmää]
const PAAVALIKKO = [
  ["Keskus", "#/", (p) => p === "/"],
  ["Muistio", "#/muistio", (p) => /^\/(muistio|huomio)/.test(p)],
  ["Siirtomarkkinat", "#/siirtomarkkinat", (p) => p === "/siirtomarkkinat"],
  ["Analyysi", "#/analyysi", (p) => p === "/analyysi"],
  ["Testit", "#/superpesis", (p, r) => r?.osio === "testit"],
];
const TESTIVALIKKO = [
  ["Edustus", "#/superpesis", (p) => p === "/superpesis"],
  ["Testikerrat", "#/kerrat", (p) => /^\/(kerrat|syota|kerta)/.test(p)],
  ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
  ["Ryhmäanalyysi", "#/ryhma", (p) => p === "/ryhma"],
  ["Julkiset tilastot", "#/tilastot", (p) => p === "/tilastot"],
];

let nykyinen = null;
let navId = 0;

function piirraNav(polku, r) {
  const linkki = ([teksti, href, aktiivinen]) => `<a href="${href}"${aktiivinen(polku, r) ? ' aria-current="page"' : ""}>${teksti}</a>`;
  if (tila.valmentaja) {
    $("#nav").innerHTML = PAAVALIKKO.map(linkki).join("") + `<a href="pelikirja.html">Pelikirja</a>` + (tila.admin ? linkki(["Hallinta", "#/hallinta", (p) => p === "/hallinta"]) : "");
  } else {
    $("#nav").innerHTML = linkki(["Tilastot", "#/", (p) => p === "/" || p === "/tilastot"]);
  }
  const ali = $("#alinav");
  ali.hidden = !(tila.valmentaja && r?.osio === "testit");
  ali.innerHTML = ali.hidden ? "" : TESTIVALIKKO.map(linkki).join("");
  const k = $("#kayttaja");
  if (tila.istunto) {
    const email = tila.istunto.user.email;
    k.innerHTML = `<span title="${esc(email)}">${esc(email.split("@")[0])}</span><button id="ulos">Kirjaudu ulos</button>`;
    $("#ulos").onclick = async () => { await sb.auth.signOut(); location.hash = "#/"; location.reload(); };
  } else {
    k.innerHTML = `<a class="btn" style="padding:4px 12px" href="#/kirjaudu">Kirjaudu</a>`;
  }
}

async function reititä() {
  const polku = location.hash.replace(/^#/, "") || "/";
  const r = reitit.find((x) => x.polku.test(polku)) || reitit[0];
  const parametrit = polku.match(r.polku)?.slice(1) || [];
  piirraNav(polku, r);
  if (!r.julkinen && !tila.valmentaja) {
    location.hash = tila.istunto ? "#/" : "#/kirjaudu";
    if (tila.istunto) ilmoita("Tunnuksellasi ei ole valmentajan oikeuksia.", true);
    return;
  }
  if (r.admin && !tila.admin) { location.hash = "#/"; return; }
  nykyinen?.poistu?.();
  tuhoaKaaviot();
  const id = ++navId;
  const sivu = $("#sisalto");
  const main = document.createElement("div");
  main.innerHTML = `<p class="lataa">Ladataan…</p>`;
  sivu.replaceChildren(main);
  nykyinen = r.nakyma;
  try {
    await r.nakyma.nayta(main, ...parametrit);
  } catch (e) {
    if (id !== navId) return;
    console.error(e);
    main.innerHTML = `<h1>Jokin meni pieleen</h1><p class="ingressi">${esc(e.message || e)}</p><p><a class="btn" href="#/">Etusivulle</a></p>`;
  }
  if (id === navId) sivu.focus({ preventScroll: true });
}

async function kaynnista() {
  // OAuth-paluu (?code=...) käsitellään supabase-js:ssä; siivotaan osoite
  if (location.search.includes("code=")) {
    await sb.auth.getSession();
    history.replaceState(null, "", location.pathname + (location.hash || "#/"));
  }
  await Promise.all([lataaPerus(), tarkistaRooli()]);
  if (tila.valmentaja) await lataaPelaajat();
  sb.auth.onAuthStateChange(async (tapahtuma) => {
    if (tapahtuma === "SIGNED_IN" || tapahtuma === "SIGNED_OUT") {
      const oli = tila.valmentaja;
      await tarkistaRooli();
      if (tila.valmentaja && !oli) { await lataaPelaajat(); if (location.hash.startsWith("#/kirjaudu")) location.hash = "#/"; else reititä(); }
    }
  });
  window.addEventListener("hashchange", reititä);
  reititä();
}

kaynnista().catch((e) => { $("#sisalto").innerHTML = `<h1>Yhteys tietokantaan epäonnistui</h1><p class="ingressi">${esc(e.message)}</p>`; });
