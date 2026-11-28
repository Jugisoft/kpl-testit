import { sb, tila, lataaPerus, tarkistaRooli, lataaPelaajat, KATSO_AVAIN } from "./js/db.js";
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
import * as treenit from "./js/views/treenit.js";
import * as ohjelmat from "./js/views/ohjelmat.js";
import * as ohje from "./js/views/ohje.js";
import * as korjaamo from "./js/views/korjaamo.js";
import * as oma from "./js/views/oma.js";
import * as minunpelisivu from "./js/views/minunpelisivu.js";
import * as minunkehityssivu from "./js/views/minunkehityssivu.js";
import * as kooste from "./js/views/kooste.js";
import * as kehittyneet from "./js/views/kehittyneet.js";
import * as seuranta from "./js/views/seuranta.js";
import * as talvisuper from "./js/views/talvisuper.js";
import * as treenikeskus from "./js/views/treenikeskus.js";
import * as huone from "./js/views/huone.js";
import { lukemattomienMaara } from "./js/viestit.js";

// Etusivu on Keskus kaikille käyttäjille. Ilman oikeuksia näkyy vain kirjautuminen.
const etusivu = keskus;

const reitit = [
  { polku: /^\/?$/, nakyma: etusivu },
  { polku: /^\/testit(?:\/([a-z]+))?(?:\/([a-z]+))?(?:\/([\w-]+))?$/, nakyma: testit, osio: "testit" },
  { polku: /^\/juoksu(?:\/([a-z0-9]+))?(?:\/([\w-]+))?$/, nakyma: juoksu, osio: "testit" },
  { polku: /^\/kehittyneet(?:\/([a-z]+))?(?:\/([\w-]+))?$/, nakyma: kehittyneet, osio: "testit" },
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
  { polku: /^\/treenit(?:\/([\w-]+))?$/, nakyma: treenit },
  { polku: /^\/ohjelmat(?:\/([\w-]+))?$/, nakyma: ohjelmat },
  { polku: /^\/treenikeskus(?:\/([\w-]+))?$/, nakyma: treenikeskus },
  { polku: /^\/huone(?:\/([a-z]+))?(?:\/([\w-]+))?$/, nakyma: huone, osio: "huone" },
  { polku: /^\/kerrat$/, nakyma: kerrat, osio: "testit" },
  { polku: /^\/syota\/([\w-]+)$/, nakyma: syotto, osio: "testit" },
  { polku: /^\/kerta\/([\w-]+)$/, nakyma: kerta, osio: "testit" },
  { polku: /^\/pelaajat$/, nakyma: pelaajat, osio: "testit" },
  { polku: /^\/pelaaja\/([\w-]+)$/, nakyma: pelaaja, osio: "testit" },
  { polku: /^\/ohje(?:\/([\w-]+))?$/, nakyma: ohje },
  { polku: /^\/korjaamo$/, nakyma: korjaamo },
  { polku: /^\/talvisuper$/, nakyma: talvisuper },
  { polku: /^\/hallinta$/, nakyma: hallinta, admin: true },
  { polku: /^\/oma(?:\/([\w-]+))?$/, nakyma: oma, osio: "oma" },
  { polku: /^\/minunpeli(?:\/([\w-]+))?$/, nakyma: minunpelisivu, osio: "oma" },
  { polku: /^\/minunkehitys(?:\/([\w-]+))?$/, nakyma: minunkehityssivu, osio: "oma" },
  { polku: /^\/kooste$/, nakyma: kooste, osio: "kooste" },
  { polku: /^\/seuranta$/, nakyma: seuranta, osio: "kooste" },
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
  treeni: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  ohjelma: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10l1.5 1.5 3-3M8.5 16l1.5 1.5 3-3M15 11h1M15 17h1"/>',
  oma: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  korjaamo: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.4 1.4 0 0 0 0 2l1 1a1.4 1.4 0 0 0 2 0l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.3-.5-.5-2.3z"/>',
  talvi: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2M3 10.3l3.2.5-1.2 3M21 13.7l-3.2-.5 1.2-3M3 13.7l3.2-.5L5 10.2M21 10.3l-3.2.5 1.2 3"/>',
  tk: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m8.5 15 2 2 4-4"/>',
  huone: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M9 21v-5h6v5M9 8h.01M15 8h.01M9 12h.01M15 12h.01"/>',
  ulos: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
};
const ikoni = (n) => `<svg class="ikoni" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IK[n]}</svg>`;
const onVastustaja = (p) => /^\/(vp\/|kortti)/.test(p) || /^\/muistio\/(vastustajat|IPV|JoMa|KeKi|KiPa|Manse|PattU|PuMu|SoJy|Tahko|Ura|ViVe)\b/.test(p);
// 28.11.2026: Kehittyneet (eniten parantaneet) vain valmennukselle; pelaajien valikosta poistetaan valikko()-funktiossa
const KEHITTYNEET = ["Kehittyneet", "#/kehittyneet", (p) => /^\/kehittyneet/.test(p)];
// [teksti, osoite, kuvake, aktiivinen]
const RYHMAT = [
  [null, [["Keskus", "#/", "koti", (p) => p === "/"]]],
  ["Oma harjoittelu", [
    ["Lyöntipäiväkirja", "#/lyonnit", "lyonnit", (p) => /^\/lyonnit/.test(p)],
    ["Testit", "#/testit", "testit", (p, r) => r?.osio === "testit", [
      ["Tulokset", "#/testit", (p) => /^\/testit/.test(p)],
      ["Juoksutestit", "#/juoksu", (p) => /^\/juoksu/.test(p)],
      KEHITTYNEET,
      ["Testikerrat", "#/kerrat", (p) => /^\/(kerrat|syota|kerta)/.test(p)],
      ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
      ["Vertailu", "#/vertailu", (p) => /^\/vertailu/.test(p)],
      ["Reaktioaika ↗", "https://jugisoft.github.io/reaktioaikalaskuri/", () => false]]],
  ]],
  ["Valmennus", [
    ["Oma peli", "#/muistio/KPL/yleiskuva", "muistio", (p) => /^\/(muistio|huomio)/.test(p) && !onVastustaja(p)],
    ["Vastustajat", "#/muistio/vastustajat", "vastustajat", onVastustaja],
    ["Pelikirja", "pelikirja.html?v=20261128-3", "pelikirja", () => false],
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
      KEHITTYNEET,
      ["Testikerrat", "#/kerrat", (p) => /^\/(kerrat|syota|kerta)/.test(p)],
      ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
      ["Vertailu", "#/vertailu", (p) => /^\/vertailu/.test(p)],
      ["Reaktioaika ↗", "https://jugisoft.github.io/reaktioaikalaskuri/", () => false]]],
  ]],
];
const ALAPALKKI_PSU = [["Testit", "#/testit/juniorit", "testit"], ["Juoksu", "#/juoksu/30m/juniorit", "juoksuodotus"], ["Pelaajat", "#/pelaajat", "muistio"], ["Vertailu", "#/vertailu", "analyysi"]];
const PSU_SALLITTU = (polku, r) => r?.osio === "testit" || /^\/(huone|oma|kooste|seuranta|treenit|treenikeskus|ohjelmat|lyonnit|ohje|korjaamo|kirjaudu)/.test(polku);
// Juniori-pelaaja (1.11.2026): oma Keskus, junioreiden testit (luku), lyöntipäiväkirja
const OMA = ["Oma Keskus", "#/oma", "oma", (p) => /^\/oma/.test(p)];
const TREENIT = ["Treenipäiväkirja", "#/treenit", "treeni", (p) => /^\/treenit/.test(p)];
const OHJELMAT = ["Treeniohjelmat", "#/ohjelmat", "ohjelma", (p) => /^\/ohjelmat/.test(p)];   // 6.11.2026: Anssin ohjelmat muistilappuna
// 26.11.2026: Treenikeskus – miesten (MSU) ja haastajaryhmän omat ohjelmat, viikot etukäteen
const TREENIKESKUS = ["Treenikeskus", "#/treenikeskus", "tk", (p) => /^\/treenikeskus/.test(p)];
const kayttaaTk = () => treenikeskus.kayttaaTreenikeskusta(tila.pelaaja?.[tila.omaPelaaja]);
const TALVI = ["Talvisuper", "#/talvisuper", "talvi", (p) => p === "/talvisuper"];
const MINUNPELI = ["Minun pelini", "#/minunpeli", "analyysi", (p) => /^\/minunpeli/.test(p)];
const MINUNKEHITYS = ["Minun kehitykseni", "#/minunkehitys", "📈", (p) => /^\/minunkehitys/.test(p)];
const RYHMAT_JUNIORI = [
  [null, [OMA, MINUNPELI, MINUNKEHITYS]],
  ["Harjoittelu", [
    TREENIT,
    OHJELMAT,
    ["Lyöntipäiväkirja", "#/lyonnit", "lyonnit", (p) => /^\/lyonnit/.test(p)],
    ["Testit", "#/testit/juniorit", "testit", (p, r) => r?.osio === "testit", [
      ["Tulokset", "#/testit/juniorit", (p) => /^\/testit/.test(p)],
      ["Juoksutestit", "#/juoksu/30m/juniorit", (p) => /^\/juoksu/.test(p)],
      ["Pelaajat", "#/pelaajat", (p) => /^\/pelaaja/.test(p)],
      ["Vertailu", "#/vertailu", (p) => /^\/vertailu/.test(p)]]],
  ]],
];
const ALAPALKKI_JUNIORI = [["Oma", "#/oma", "oma"], ["Treeni", "#/treenit", "treeni"], ["Lyönnit", "#/lyonnit", "lyonnit"], ["Testit", "#/testit/juniorit", "testit"]];
// Tarkkailija (25.11.2026): vain oma vastustaja (Muistio-joukkuesivu, pelaajasivut, vastustajakortti), Ohje ja korjaamo. Rajaus tietokannassa.
const TARKKAILIJA_SALLITTU = (polku) => new RegExp(`^/(muistio/${tila.tarkkailijaJoukkue}(/|$)|kortti/${tila.tarkkailijaJoukkue}$|vp/|huomio/|ohje|korjaamo|kirjaudu)`).test(polku);
const JUNIORI_SALLITTU = (polku, r) => (r?.osio === "testit" && !/^\/(kerrat|syota|kerta)/.test(polku)) || /^\/(oma|minunpeli|minunkehitys|lyonnit|treenit|treenikeskus|ohjelmat|ohje|korjaamo|kirjaudu)/.test(polku);
// Valikko roolin mukaan: pelaajalla Oma Keskus ylimpänä, valmentajilla Pelaajien Keskus Valmennus-ryhmässä
function valikko() {
  if (tila.juniori) {
    if (!kayttaaTk()) return [RYHMAT_JUNIORI, ALAPALKKI_JUNIORI];
    // haastajaryhmä (26.11.2026): Treenikeskus Harjoittelu-ryhmän ylimpänä ja alapalkissa Treenin tilalla
    // 26.11.2026 (Jugi): Treenikeskus korvaa Treenipäiväkirjan ja Treeniohjelmat (valmiit ohjelmat Rakenna ohjelma -sivulla)
    return [RYHMAT_JUNIORI.map(([o, l]) => [o, o === "Harjoittelu" ? [TREENIKESKUS, ...l.filter((x) => x !== TREENIT && x !== OHJELMAT)] : l]), ALAPALKKI_JUNIORI.map((x) => (x[1] === "#/treenit" ? ["Treeni", "#/treenikeskus", "tk"] : x))];
  }
  if (tila.tarkkailija) {
    const j = tila.tarkkailijaJoukkue, osoite = `#/muistio/${j}/yleiskuva`;
    return [[[`Vastustaja`, [[j, osoite, "vastustajat", (p) => /^\/(muistio|vp|kortti|huomio)/.test(p)]]]], [[j, osoite, "vastustajat"], ["Ohje", "#/ohje", "ohje"]]];
  }
  const pelaajat = ["Pelaajien Keskus", "#/oma", "oma", (p) => /^\/oma/.test(p)];
  const koosteL = ["Viikkokooste", "#/kooste", "kooste", (p) => /^\/kooste/.test(p)];
  const seurantaL = ["Tavoiteseuranta", "#/seuranta", "ohjelma", (p) => /^\/seuranta/.test(p)];   // 6.11.2026; 12.11.2026 nimi Tavoiteseuranta (omatoimiset Viikkokoosteessa)
  const lyontiseurantaL = ["Lyöntiseuranta", "#/lyonnit/seuranta", "lyonnit", (p) => /^\/lyonnit/.test(p)];   // 17.11.2026: PSU näkee junioreiden lyöntipäiväkirjat
  // 28.11.2026: Valmentajien huone – valmennuksen oma osio (muistiot, palaverit, tehtävät) ja valmentajan työkalut
  const HUONE = ["Valmentajien huone", "#/huone", "huone", (p) => /^\/huone/.test(p)];
  const huoneRyhma = ["Valmentajien huone", [HUONE, pelaajat, koosteL, seurantaL, lyontiseurantaL]];
  if (tila.psu) return [[...RYHMAT_PSU.map(([o, l]) => [o, [...l, TREENIT, OHJELMAT, TREENIKESKUS]]), huoneRyhma], [ALAPALKKI_PSU[0], ["Huone", "#/huone", "huone"], ...ALAPALKKI_PSU.slice(1, 3)]];
  const ryhmat = RYHMAT.map(([o, l]) => [o, [...l]]);
  if (!(tila.valmennus || tila.admin)) ryhmat.forEach((r) => (r[1] = r[1].map((x) => (Array.isArray(x[4]) ? [...x.slice(0, 4), x[4].filter((y) => y !== KEHITTYNEET)] : x))));
  const pelaajaRooli = tila.omaPelaaja || tila.spPelaaja;   // pelaajatunnus näkee Oma Keskuksen aina (liittämätön saa ohjeen)
  // treenipäiväkirja kaikille: pelaaja kirjaa, valmentaja katsoo pelaajan kirjauksia;
  // 26.11.2026 (Jugi): miehillä ja haastajilla vain Treenikeskus (ei rinnakkaisia kirjauspaikkoja)
  if (!kayttaaTk()) ryhmat[1][1].unshift(TREENIT, OHJELMAT);
  if (kayttaaTk() || tila.ohjaaja) ryhmat[1][1].unshift(TREENIKESKUS);
  if (pelaajaRooli) ryhmat[0][1].push(OMA);
  ryhmat[0][1].push(TALVI);   // 25.11.2026: Talvisuper oma välisivu ennen Oma harjoittelua (miehet ja valmennus)
  // 28.11.2026: valmentajan työkalut aina Valmentajien huoneessa (aiemmin katosivat, jos tunnukseen oli liitetty pelaaja)
  if (tila.ohjaaja) ryhmat.splice(1, 0, huoneRyhma);
  // pelaajalla puhelimen alapalkissa Oma, Treeni ja Lyönnit (1.11.2026); Testit ja Oma peli Valikossa
  const ala = pelaajaRooli ? [["Oma", "#/oma", "oma"], ALAPALKKI[0], kayttaaTk() ? ["Treeni", "#/treenikeskus", "tk"] : ["Treeni", "#/treenit", "treeni"], ALAPALKKI[1]] : tila.ohjaaja ? [ALAPALKKI[0], ["Huone", "#/huone", "huone"], ALAPALKKI[2], ALAPALKKI[3]] : ALAPALKKI;
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
  if (tila.jasen && tila.omaPelaaja) { naytaUudetHuomioinnit(); naytaLukemattomatViestit(); }
  const k = $("#kayttaja");
  if (tila.istunto) {
    const email = tila.istunto.user.email;
    k.innerHTML = `${tila.oikeaAdmin && !tila.katselu ? `<button id="katso" class="k-katso" title="Katso Keskusta toisen käyttäjän näkymänä">👁<span>Katso käyttäjänä</span></button>` : ""}<span class="k-nimi" title="${esc(email)}">${esc(email.split("@")[0])}</span><button id="ulos" title="Kirjaudu ulos">${ikoni("ulos")}<span>Kirjaudu ulos</span></button>`;
    $("#ulos").onclick = ulosKirjaudu;
    $("#katso")?.addEventListener("click", avaaKatsoValinta);
    naytaKatselupalkki();
  } else {
    k.innerHTML = `<a class="btn" style="padding:4px 12px" href="#/kirjaudu">Kirjaudu</a>`;
  }
}
// 14.11.2026: uudet valmentajan huomioinnit (reaktiot ja kommentit) merkkinä Oma Keskus -linkeissä heti kirjautuessa;
// kuitataan nähdyiksi, kun pelaaja avaa oman Keskuksensa.
async function naytaUudetHuomioinnit() {
  const { count, error } = await sb.from("huomioinnit").select("id", { count: "exact", head: true }).eq("pelaaja_id", tila.omaPelaaja).is("nahty", null);
  if (error || !count) return;
  document.querySelectorAll('#nav a[href="#/oma"], #alapalkki a[href="#/oma"]').forEach((a) => {
    if (a.querySelector(".nav-uusi")) return;
    a.insertAdjacentHTML("beforeend", `<b class="nav-uusi" aria-label="${count} uutta valmentajalta">${count}</b>`);
  });
}
// 15.11.2026: lukemattomien viestien badge Oma-linkissä
async function naytaLukemattomatViestit() {
  try {
    const lkm = await lukemattomienMaara();
    if (!lkm) return;
    document.querySelectorAll('#nav a[href="#/oma"], #alapalkki a[href="#/oma"]').forEach((a) => {
      if (a.querySelector(".nav-viesti")) return;
      a.insertAdjacentHTML("beforeend", `<b class="nav-viesti" aria-label="${lkm} lukematonta viestiä">${lkm}</b>`);
    });
  } catch (e) { /* hiljaa: viestit eivät ole kriittisiä */ }
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
// 26.11.2026 (Jugi): ylläpitäjän "Katso käyttäjänä" – näkymä kuin valitulla käyttäjällä (vain katselu, ks. db.js)
const ROOLI_NIMI = { admin: "Ylläpitäjä", valmentaja: "Valmennus", pelaaja: "Miesten pelaaja", sp_juniori: "Miesten pelaaja + juniori", juniori: "Juniori-pelaaja", psu: "PSU-valmennus", tarkkailija: "Tarkkailija" };
function vaihdaKatselu(email) {
  try { if (email) sessionStorage.setItem(KATSO_AVAIN, JSON.stringify({ email })); else sessionStorage.removeItem(KATSO_AVAIN); sessionStorage.removeItem("kpl-etusivu-ohitettu"); } catch { /* ohitetaan */ }
  location.replace(location.pathname + "#/");
  location.reload();
}
async function avaaKatsoValinta() {
  let d = $("#katso-dialogi");
  if (!d) { d = document.createElement("dialog"); d.id = "katso-dialogi"; d.className = "tk-dialogi"; document.body.append(d); }
  d.innerHTML = `<div class="tk-lomake"><p class="lataa">Ladataan käyttäjiä…</p></div>`;
  d.showModal();
  const { data, error } = await sb.from("valmentajat").select("email,nimi,rooli,pelaaja_id").order("nimi");
  if (error) { d.innerHTML = `<div class="tk-lomake"><p>${esc(error.message)}</p></div>`; return; }
  const profiili = (u) => { const p = u.pelaaja_id && tila.pelaaja[u.pelaaja_id]; return p?.treeniprofiili === "msu" ? "MSU" : p?.treeniprofiili === "haastaja" ? "haastaja" : p?.treeniprofiili === "reissu" ? "asuu muualla" : ""; };
  const ryhmat = ["pelaaja", "sp_juniori", "juniori", "valmentaja", "psu", "tarkkailija"].map((r) => [r, (data || []).filter((u) => u.rooli === r)]).filter(([, l]) => l.length);
  d.innerHTML = `<form method="dialog" class="tk-lomake">
    <header><h2>Katso käyttäjänä</h2><button class="tr-sulje" value="peru" aria-label="Sulje">✕</button></header>
    <p class="pieni">Keskus näytetään kuten valittu käyttäjä sen näkee: valikko, sivut ja hänen omat näkymänsä. Vain katselu – mitään ei voi tallentaa. Tiedot haetaan sinun oikeuksillasi, joten listoissa voi näkyä enemmän kuin käyttäjällä.</p>
    <label class="tk-kentta"><span>Käyttäjä</span><select name="email" required><option value="">Valitse…</option>
      ${ryhmat.map(([r, l]) => `<optgroup label="${esc(ROOLI_NIMI[r] || r)}">${l.map((u) => `<option value="${esc(u.email)}">${esc(u.nimi || u.email)}${profiili(u) ? ` (${profiili(u)})` : ""}</option>`).join("")}</optgroup>`).join("")}</select></label>
    <div class="tk-napit"><button class="btn ensisij" value="ok">Näytä</button></div></form>`;
  const f = $("form", d);
  f.onsubmit = (e) => { if (e.submitter?.value === "peru") return; e.preventDefault(); if (f.elements.email.value) vaihdaKatselu(f.elements.email.value); };
}
function naytaKatselupalkki() {
  $("#katselupalkki")?.remove();
  document.body.classList.toggle("katselutila", !!tila.katselu);
  if (!tila.katselu) return;
  const b = document.createElement("div");
  b.id = "katselupalkki"; b.className = "katselupalkki"; b.setAttribute("role", "status");
  b.innerHTML = `<span>👁 Katselet käyttäjänä: <b>${esc(tila.katselu.nimi)}</b> · ${esc(ROOLI_NIMI[tila.katselu.rooli] || tila.katselu.rooli)} · vain katselu</span><span><button class="btn pieni-nappi" data-vaihda>Vaihda</button> <button class="btn ensisij pieni-nappi" data-palaa>Palaa omaan näkymään</button></span>`;
  document.body.prepend(b);
  $("[data-vaihda]", b).onclick = avaaKatsoValinta;
  $("[data-palaa]", b).onclick = () => vaihdaKatselu(null);
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
  if (tila.tarkkailija && !TARKKAILIJA_SALLITTU(polku)) { location.replace(`#/muistio/${tila.tarkkailijaJoukkue}/yleiskuva`); return; }
  // 14.11.2026: miesten pelaajan etusivu = oma Keskus (valmennuksen etusivu Keskus-linkistä alapalkissa ja valikossa)
  if (tila.spPelaaja && !tila.valmennus && r.nakyma === etusivu && !sessionStorage.getItem("kpl-etusivu-ohitettu")) { sessionStorage.setItem("kpl-etusivu-ohitettu", "1"); location.replace("#/oma"); return; }
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
