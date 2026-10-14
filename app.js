import { sb, tila, lataaPerus, tarkistaRooli, lataaPelaajat } from "./js/db.js";
import { $, esc, tuhoaKaaviot, ilmoita } from "./js/util.js";
import * as kirjaudu from "./js/views/kirjaudu.js";
import * as kerrat from "./js/views/kerrat.js";
import * as syotto from "./js/views/syotto.js";
import * as kerta from "./js/views/kerta.js";
import * as pelaajat from "./js/views/pelaajat.js";
import * as pelaaja from "./js/views/pelaaja.js";
import * as hallinta from "./js/views/hallinta.js";
import * as keskus from "./js/views/keskus.js";
import * as muistio from "./js/views/muistio.js";
import * as vpelaaja from "./js/views/vpelaaja.js";
import * as siirtomarkkinat from "./js/views/siirtomarkkinat.js";
import * as analyysi from "./js/views/analyysi.js";
import * as testit from "./js/views/testit.js";
import * as kortti from "./js/views/kortti.js";

// Etusivu on Keskus kaikille käyttäjille. Ilman oikeuksia näkyy vain kirjautuminen.
const etusivu = keskus;

const reitit = [
  { polku: /^\/?$/, nakyma: etusivu },
  { polku: /^\/testit(?:\/([a-z]+))?(?:\/([a-z]+))?(?:\/([\w-]+))?$/, nakyma: testit, osio: "testit" },
  // vanhat osoitteet
  { polku: /^\/(superpesis|ryhma|tilastot)$/, nakyma: { nayta: (m, x) => location.replace(x === "superpesis" ? "#/testit/superpesis" : "#/testit/juniorit") } },
  { polku: /^\/kirjaudu$/, nakyma: kirjaudu, julkinen: true },
  { polku: /^\/muistio(?:\/([^/]+))?(?:\/([^/]+))?$/, nakyma: muistio },
  { polku: /^\/vp\/([\w-]+)(?:\/([a-z]+))?$/, nakyma: vpelaaja },
  { polku: /^\/huomio\/([\w-]+)$/, nakyma: { nayta: muistio.naytaYksi, poistu: muistio.poistu } },
  { polku: /^\/huomiot$/, nakyma: { nayta: () => location.replace("#/muistio") } },
  { polku: /^\/kortti(?:\/([\w]+))?$/, nakyma: kortti },
  { polku: /^\/siirtomarkkinat$/, nakyma: siirtomarkkinat },
  { polku: /^\/analyysi$/, nakyma: analyysi },
  { polku: /^\/kerrat$/, nakyma: kerrat, osio: "testit" },
  { polku: /^\/syota\/([\w-]+)$/, nakyma: syotto, osio: "testit" },
  { polku: /^\/kerta\/([\w-]+)$/, nakyma: kerta, osio: "testit" },
  { polku: /^\/pelaajat$/, nakyma: pelaajat, osio: "testit" },
  { polku: /^\/pelaaja\/([\w-]+)$/, nakyma: pelaaja, osio: "testit" },
  { polku: /^\/hallinta$/, nakyma: hallinta, admin: true },
];

// Päävalikko: [teksti, osoite, aktiivinen kun polku täsmää]
const PAAVALIKKO = [
  ["Keskus", "#/", (p) => p === "/"],
  ["Muistio", "#/muistio", (p) => /^\/(muistio|huomio|vp\/|kortti)/.test(p)],
  ["Siirtomarkkinat", "#/siirtomarkkinat", (p) => p === "/siirtomarkkinat"],
  ["Analyysi", "#/analyysi", (p) => p === "/analyysi"],
  ["Testit", "#/testit", (p, r) => r?.osio === "testit"],
];
const TESTIVALIKKO = [
  ["Tulokset", "#/testit", (p) => /^\/testit/.test(p)],
  ["Testikerrat", "#/kerrat", (p) => /^\/(kerrat|syota|kerta)/.test(p)],
  ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
];

let nykyinen = null;
let navId = 0;

function piirraNav(polku, r) {
  const linkki = ([teksti, href, aktiivinen]) => `<a href="${href}"${aktiivinen(polku, r) ? ' aria-current="page"' : ""}>${teksti}</a>`;
  if (tila.jasen) {
    $("#nav").innerHTML = PAAVALIKKO.map(linkki).join("") + `<a href="pelikirja.html">Pelikirja</a>` + (tila.admin ? linkki(["Hallinta", "#/hallinta", (p) => p === "/hallinta"]) : "");
  } else {
    $("#nav").innerHTML = "";
  }
  const ali = $("#alinav");
  ali.hidden = !(tila.jasen && r?.osio === "testit");
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
  if (!r.julkinen && !tila.jasen) {
    if (!tila.istunto) { if (polku !== "/kirjaudu") location.hash = "#/kirjaudu"; return; }
    nykyinen?.poistu?.();
    $("#sisalto").innerHTML = `<div class="ei-oikeuksia"><h1>Ei käyttöoikeutta</h1><p class="ingressi">Olet kirjautunut osoitteella <b>${esc(tila.istunto.user.email)}</b>, mutta sille ei ole annettu oikeuksia KPL Keskukseen. Pyydä ylläpitäjää lisäämään osoite.</p></div>`;
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
  await tarkistaRooli();
  if (tila.jasen) await Promise.all([lataaPerus(), lataaPelaajat()]);
  sb.auth.onAuthStateChange(async (tapahtuma) => {
    if (tapahtuma === "SIGNED_IN" || tapahtuma === "SIGNED_OUT") {
      const oli = tila.jasen;
      await tarkistaRooli();
      if (tila.jasen && !oli) { await Promise.all([lataaPerus(), lataaPelaajat()]); if (location.hash.startsWith("#/kirjaudu")) location.hash = "#/"; else reititä(); }
      else if (!tila.jasen) reititä();
    }
  });
  window.addEventListener("hashchange", reititä);
  reititä();
}

kaynnista().catch((e) => { $("#sisalto").innerHTML = `<h1>Yhteys tietokantaan epäonnistui</h1><p class="ingressi">${esc(e.message)}</p>`; });
