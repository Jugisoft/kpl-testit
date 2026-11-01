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
import * as juoksu from "./js/views/juoksu.js";
import * as vertailu from "./js/views/vertailu.js";
import * as kortti from "./js/views/kortti.js";
import * as juoksuodotus from "./js/views/juoksuodotus.js";
import * as lyonnit from "./js/views/lyonnit.js";
import * as ohje from "./js/views/ohje.js";
import * as korjaamo from "./js/views/korjaamo.js";
import * as oma from "./js/views/oma.js";
import * as kooste from "./js/views/kooste.js";

// Etusivu on Keskus kaikille käyttäjille. Ilman oikeuksia näkyy vain kirjautuminen.
const etusivu = keskus;

const reitit = [
  { polku: /^\/?$/, nakyma: etusivu },
  { polku: /^\/testit(?:\/([a-z]+))?(?:\/([a-z]+))?(?:\/([\w-]+))?$/, nakyma: testit, osio: "testit" },
  { polku: /^\/juoksu(?:\/([a-z0-9]+))?(?:\/([\w-]+))?$/, nakyma: juoksu, osio: "testit" },
  { polku: /^\/vertailu(?:\/([\w-]+))?(?:\/([\w-]+))?$/, nakyma: vertailu, osio: "testit" },
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
  { polku: /^\/juoksuodotus$/, nakyma: juoksuodotus },
  { polku: /^\/lyonnit(?:\/(seuranta|p))?(?:\/([^/]+))?$/, nakyma: lyonnit },
  { polku: /^\/kerrat$/, nakyma: kerrat, osio: "testit" },
  { polku: /^\/syota\/([\w-]+)$/, nakyma: syotto, osio: "testit" },
  { polku: /^\/kerta\/([\w-]+)$/, nakyma: kerta, osio: "testit" },
  { polku: /^\/pelaajat$/, nakyma: pelaajat, osio: "testit" },
  { polku: /^\/pelaaja\/([\w-]+)$/, nakyma: pelaaja, osio: "testit" },
  { polku: /^\/ohje(?:\/([\w-]+))?$/, nakyma: ohje },
  { polku: /^\/korjaamo$/, nakyma: korjaamo },
  { polku: /^\/hallinta$/, nakyma: hallinta, admin: true },
  { polku: /^\/oma(?:\/([\w-]+))?$/, nakyma: oma, osio: "oma" },
  { polku: /^\/kooste$/, nakyma: kooste, osio: "kooste" },
];

// Sivupalkki (16.10.2026, YDIN 2027:n mallin mukaan): ryhmät, kuvakkeet, Testien alasivut sisennettynä.
const IK = {
  koti: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  lyonnit: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  testit: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 2.5h5M12 2.5V6"/>',
  muistio: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  vastustajat: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  pelikirja: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/>',
  analyysi: '<path d="M4 20V11M10 20V5M16 20v-6M2.5 20.5h19"/>',
  juoksuodotus: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
  siirrot: '<path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4"/>',
  ohje: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.4M12 17h.01"/>',
  hallinta: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  valikko: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  kooste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
  oma: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  korjaamo: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.4 1.4 0 0 0 0 2l1 1a1.4 1.4 0 0 0 2 0l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.3-.5-.5-2.3z"/>',
  ulos: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
};
const ikoni = (n) => `<svg class="ikoni" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IK[n]}</svg>`;
const onVastustaja = (p) => /^\/(vp\/|kortti)/.test(p) || /^\/muistio\/(vastustajat|IPV|JoMa|KeKi|KiPa|Manse|PattU|PuMu|SoJy|Tahko|Ura|ViVe)\b/.test(p);
// [teksti, osoite, kuvake, aktiivinen]
const RYHMAT = [
  [null, [["Keskus", "#/", "koti", (p) => p === "/"]]],
  ["Oma harjoittelu", [
    ["Lyöntipäiväkirja", "#/lyonnit", "lyonnit", (p) => /^\/lyonnit/.test(p)],
    ["Testit", "#/testit", "testit", (p, r) => r?.osio === "testit", [
      ["Tulokset", "#/testit", (p) => /^\/testit/.test(p)],
      ["Juoksutestit", "#/juoksu", (p) => /^\/juoksu/.test(p)],
      ["Testikerrat", "#/kerrat", (p) => /^\/(kerrat|syota|kerta)/.test(p)],
      ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
      ["Vertailu", "#/vertailu", (p) => /^\/vertailu/.test(p)],
      ["Reaktioaika ↗", "https://jugisoft.github.io/reaktioaikalaskuri/", () => false]]],
  ]],
  ["Valmennus", [
    ["Oma peli", "#/muistio/KPL/yleiskuva", "muistio", (p) => /^\/(muistio|huomio)/.test(p) && !onVastustaja(p)],
    ["Vastustajat", "#/muistio/vastustajat", "vastustajat", onVastustaja],
    ["Pelikirja", "pelikirja.html?v=20261101-13", "pelikirja", () => false],
  ]],
  ["Analyysi", [
    ["Analyysi", "#/analyysi", "analyysi", (p) => p === "/analyysi"],
    ["Juoksuodotus", "#/juoksuodotus", "juoksuodotus", (p) => p === "/juoksuodotus"],
    ["Siirtomarkkinat", "#/siirtomarkkinat", "siirrot", (p) => p === "/siirtomarkkinat"],
  ]],
];
// Puhelimen alapalkki: neljä tärkeintä + Valikko
const ALAPALKKI = [["Keskus", "#/", "koti"], ["Lyönnit", "#/lyonnit", "lyonnit"], ["Testit", "#/testit", "testit"], ["Oma peli", "#/muistio/KPL/yleiskuva", "muistio"]];
// PSU-valmennus (31.10.2026): vain junioreiden testit ja reaktioajat. Rajaus on tietokannassa; tämä vain näyttää oikeat sivut.
const RYHMAT_PSU = [
  ["Juniorit · PSU", [
    ["Testit", "#/testit/juniorit", "testit", (p, r) => r?.osio === "testit", [
      ["Tulokset", "#/testit/juniorit", (p) => /^\/testit/.test(p)],
      ["Juoksutestit", "#/juoksu/30m/juniorit", (p) => /^\/juoksu/.test(p)],
      ["Testikerrat", "#/kerrat", (p) => /^\/(kerrat|syota|kerta)/.test(p)],
      ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
      ["Vertailu", "#/vertailu", (p) => /^\/vertailu/.test(p)],
      ["Reaktioaika ↗", "https://jugisoft.github.io/reaktioaikalaskuri/", () => false]]],
  ]],
];
const ALAPALKKI_PSU = [["Testit", "#/testit/juniorit", "testit"], ["Juoksu", "#/juoksu/30m/juniorit", "juoksuodotus"], ["Pelaajat", "#/pelaajat", "muistio"], ["Vertailu", "#/vertailu", "analyysi"]];
const PSU_SALLITTU = (polku, r) => r?.osio === "testit" || /^\/(oma|kooste|ohje|korjaamo|kirjaudu)/.test(polku);
// Juniori-pelaaja (1.11.2026): oma Keskus, junioreiden testit (luku), lyöntipäiväkirja
const OMA = ["Oma Keskus", "#/oma", "oma", (p) => /^\/oma/.test(p)];
const RYHMAT_JUNIORI = [
  [null, [OMA]],
  ["Harjoittelu", [
    ["Lyöntipäiväkirja", "#/lyonnit", "lyonnit", (p) => /^\/lyonnit/.test(p)],
    ["Testit", "#/testit/juniorit", "testit", (p, r) => r?.osio === "testit", [
      ["Tulokset", "#/testit/juniorit", (p) => /^\/testit/.test(p)],
      ["Juoksutestit", "#/juoksu/30m/juniorit", (p) => /^\/juoksu/.test(p)],
      ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
      ["Vertailu", "#/vertailu", (p) => /^\/vertailu/.test(p)]]],
  ]],
];
const ALAPALKKI_JUNIORI = [["Oma", "#/oma", "oma"], ["Lyönnit", "#/lyonnit", "lyonnit"], ["Testit", "#/testit/juniorit", "testit"], ["Juoksu", "#/juoksu/30m/juniorit", "juoksuodotus"]];
const JUNIORI_SALLITTU = (polku, r) => (r?.osio === "testit" && !/^\/(kerrat|syota|kerta)/.test(polku)) || /^\/(oma|lyonnit|ohje|korjaamo|kirjaudu)/.test(polku);
// Valikko roolin mukaan: pelaajalla Oma Keskus ylimpänä, valmentajilla Pelaajien Keskus Valmennus-ryhmässä
function valikko() {
  if (tila.juniori) return [RYHMAT_JUNIORI, ALAPALKKI_JUNIORI];
  const pelaajat = ["Pelaajien Keskus", "#/oma", "oma", (p) => /^\/oma/.test(p)];
  const koosteL = ["Viikkokooste", "#/kooste", "kooste", (p) => /^\/kooste/.test(p)];
  if (tila.psu) return [RYHMAT_PSU.map(([o, l]) => [o, [...l, pelaajat, koosteL]]), ALAPALKKI_PSU];
  const ryhmat = RYHMAT.map(([o, l]) => [o, [...l]]);
  const pelaajaRooli = tila.omaPelaaja || tila.spPelaaja;   // pelaajatunnus näkee Oma Keskuksen aina (liittämätön saa ohjeen)
  if (pelaajaRooli) ryhmat[0][1].push(OMA);
  else if (tila.ohjaaja) ryhmat.find(([o]) => o === "Valmennus")[1].push(pelaajat, koosteL);
  const ala = pelaajaRooli ? [ALAPALKKI[0], ["Oma", "#/oma", "oma"], ...ALAPALKKI.slice(2)] : ALAPALKKI;
  return [ryhmat, ala];
}

let nykyinen = null;
let navId = 0;

function piirraNav(polku, r) {
  const linkki = ([teksti, href, ik, aktiivinen, ali]) => {
    const on = aktiivinen(polku, r);
    return `<a class="nav-linkki" href="${href}"${on ? ' aria-current="page"' : ""}>${ikoni(ik)}<span>${teksti}</span></a>`
      + (ali && on ? `<div class="nav-ali">${ali.map(([t, h, a]) => `<a href="${h}"${a(polku, r) ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</div>` : "");
  };
  document.body.classList.toggle("kirjautunut", !!tila.jasen);
  let aktiivinenNimi = "";
  if (tila.jasen) {
    const [ryhmat, alapalkki] = valikko();
    const kaikki = [...ryhmat.flatMap(([, l]) => l), ["Ohje", "#/ohje", "ohje", (p) => /^\/ohje/.test(p)], ["Pärnäsen korjaamo", "#/korjaamo", "korjaamo", (p) => p === "/korjaamo"], ["Hallinta", "#/hallinta", "hallinta", (p) => p === "/hallinta"]];
    aktiivinenNimi = kaikki.find((l) => l[3](polku, r))?.[0] || "";
    $("#nav").innerHTML = ryhmat.map(([otsikko, linkit]) => `<div class="nav-ryhma">${otsikko ? `<div class="nav-otsikko">${otsikko}</div>` : ""}${linkit.map(linkki).join("")}</div>`).join("")
      + `<div class="nav-ryhma nav-ala">${linkki(["Ohje", "#/ohje", "ohje", (p) => /^\/ohje/.test(p)])}${linkki(["Pärnäsen korjaamo", "#/korjaamo", "korjaamo", (p) => p === "/korjaamo"])}${tila.admin ? linkki(["Hallinta", "#/hallinta", "hallinta", (p) => p === "/hallinta"]) : ""}</div>`;
    $("#alapalkki").innerHTML = alapalkki.map(([t, h, ik]) => `<a href="${h}"${kaikki.find((l) => l[1] === h)?.[3](polku, r) ? ' aria-current="page"' : ""}>${ikoni(ik)}<span>${t}</span></a>`).join("")
      + `<button type="button" id="avaa-valikko" aria-controls="sivupalkki" aria-expanded="false">${ikoni("valikko")}<span>Valikko</span></button>`;
    $("#avaa-valikko").onclick = () => avaaValikko(true);
  } else {
    $("#nav").innerHTML = ""; $("#alapalkki").innerHTML = "";
  }
  $("#mp-sivu").textContent = aktiivinenNimi;
  avaaValikko(false);
  const k = $("#kayttaja");
  if (tila.istunto) {
    const email = tila.istunto.user.email;
    k.innerHTML = `<span class="k-nimi" title="${esc(email)}">${esc(email.split("@")[0])}</span><button id="ulos" title="Kirjaudu ulos">${ikoni("ulos")}<span>Kirjaudu ulos</span></button>`;
    $("#ulos").onclick = ulosKirjaudu;
  } else {
    k.innerHTML = `<a class="btn" style="padding:4px 12px" href="#/kirjaudu">Kirjaudu</a>`;
  }
}
// Uloskirjautuminen (1.11.2026, korjaamo): näkyvä palaute heti, istunto poistetaan paikallisesti
// (ei jää odottamaan verkkoa) ja sivu ladataan kirjautumissivulle ylhäältä alkaen.
async function ulosKirjaudu() {
  const nappi = $("#ulos");
  if (nappi) { nappi.disabled = true; nappi.querySelector("span").textContent = "Kirjaudutaan ulos…"; }
  document.body.classList.add("uloskirjautuu");
  $("#sisalto").innerHTML = `<div class="ulos-ilmoitus"><img src="img/kpl-logo-192.png" alt="" width="72" height="72"><h1>Kirjaudutaan ulos…</h1></div>`;
  window.scrollTo(0, 0);
  try { await Promise.race([sb.auth.signOut({ scope: "local" }), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { console.error(e); }
  // varmuuden vuoksi: poista istuntoavaimet, vaikka signOut ei ehtinyt
  try { Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch {}
  try { sessionStorage.setItem("kpl-ulos", "1"); } catch {}
  location.replace(location.pathname + "#/kirjaudu");
  location.reload();
}
function avaaValikko(auki) {
  document.body.classList.toggle("valikko-auki", auki);
  $("#verho").hidden = !auki;
  $("#avaa-valikko")?.setAttribute("aria-expanded", auki);
}
document.addEventListener("click", (e) => { if (e.target.id === "verho") avaaValikko(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") avaaValikko(false); });

let edellinenPolku = null;
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
  if (tila.psu && !PSU_SALLITTU(polku, r)) { location.replace("#/testit/juniorit"); return; }
  if (tila.juniori && !JUNIORI_SALLITTU(polku, r)) { location.replace("#/oma"); return; }
  // toisen pelaajan oma Keskus vain valmentajille
  if (r.osio === "kooste" && !tila.ohjaaja) { location.replace("#/oma"); return; }
  if (r.osio === "oma" && parametrit[0] && !tila.ohjaaja && parametrit[0] !== tila.omaPelaaja) { location.replace("#/oma"); return; }
  nykyinen?.poistu?.();
  tuhoaKaaviot();
  // uusi sivu alkaa ylhäältä (ei saman sivun sisäisissä vaihdoissa, esim. Ohjeen osiot)
  const juuri = polku.split("/")[1] || "";
  if (edellinenPolku !== null && edellinenPolku !== juuri) window.scrollTo(0, 0);
  edellinenPolku = juuri;
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

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
async function kaynnista() {
  // OAuth-paluu (?code=...) käsitellään supabase-js:ssä; siivotaan osoite
  if (location.search.includes("code=")) {
    await sb.auth.getSession();
    history.replaceState(null, "", location.pathname + (location.hash || "#/"));
  }
  await tarkistaRooli();
  if (tila.jasen) await Promise.all([lataaPerus(), lataaPelaajat()]);
  // Kuuntelijan työ siirretään pois supabase-js:n sisäisestä lukosta (setTimeout): muuten
  // getSession() kuuntelijan sisällä jumittaa signOut-kutsun (1.11.2026).
  sb.auth.onAuthStateChange((tapahtuma) => setTimeout(async () => {
    if (document.body.classList.contains("uloskirjautuu")) return;
    if (tapahtuma === "SIGNED_IN" || tapahtuma === "SIGNED_OUT") {
      const oli = tila.jasen;
      await tarkistaRooli();
      if (tila.jasen && !oli) { await Promise.all([lataaPerus(), lataaPelaajat()]); if (location.hash.startsWith("#/kirjaudu")) location.hash = "#/"; else reititä(); }
      else if (!tila.jasen) reititä();
    }
  }, 0));
  window.addEventListener("hashchange", reititä);
  reititä();
}

kaynnista().catch((e) => { $("#sisalto").innerHTML = `<h1>Yhteys tietokantaan epäonnistui</h1><p class="ingressi">${esc(e.message)}</p>`; });
