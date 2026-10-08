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

const reitit = [
  { polku: /^\/?$/, nakyma: koti, julkinen: true, nav: "Tilastot" },
  { polku: /^\/kirjaudu$/, nakyma: kirjaudu, julkinen: true },
  { polku: /^\/kerrat$/, nakyma: kerrat, nav: "Testikerrat" },
  { polku: /^\/syota\/([\w-]+)$/, nakyma: syotto },
  { polku: /^\/kerta\/([\w-]+)$/, nakyma: kerta },
  { polku: /^\/pelaajat$/, nakyma: pelaajat, nav: "Pelaajat" },
  { polku: /^\/pelaaja\/([\w-]+)$/, nakyma: pelaaja },
  { polku: /^\/ryhma$/, nakyma: ryhma, nav: "Ryhmäanalyysi" },
  { polku: /^\/hallinta$/, nakyma: hallinta, nav: "Hallinta", admin: true },
];
const navLinkit = { "/": "#/", "/kerrat": "#/kerrat", "/pelaajat": "#/pelaajat", "/ryhma": "#/ryhma", "/hallinta": "#/hallinta" };

let nykyinen = null;
let navId = 0;

function piirraNav(polku) {
  const linkit = reitit.filter((r) => r.nav && (r.julkinen || tila.valmentaja) && (!r.admin || tila.admin));
  $("#nav").innerHTML = linkit.map((r) => {
    const href = Object.entries(navLinkit).find(([p]) => r.polku.test(p))?.[1] || "#/";
    const aktiivinen = r.polku.test(polku) || (r.nakyma === pelaajat && polku.startsWith("/pelaaja/")) || (r.nakyma === kerrat && /^\/(syota|kerta)\//.test(polku));
    return `<a href="${href}"${aktiivinen ? ' aria-current="page"' : ""}>${r.nav}</a>`;
  }).join("");
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
  piirraNav(polku);
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
      if (tila.valmentaja && !oli) { await lataaPelaajat(); if (location.hash.startsWith("#/kirjaudu")) location.hash = "#/kerrat"; else reititä(); }
    }
  });
  window.addEventListener("hashchange", reititä);
  reititä();
}

kaynnista().catch((e) => { $("#sisalto").innerHTML = `<h1>Yhteys tietokantaan epäonnistui</h1><p class="ingressi">${esc(e.message)}</p>`; });
