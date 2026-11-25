// Yksityinen muistiinpano (25.11.2026, Patrik Vartaman toive): "Vain minulle" -valinta ja tietoikkuna.
// Tallennus: huomiot.nakyvyys = 'oma'. Tietokanta (RLS) näyttää tällaisen kirjauksen vain kirjoittajalle,
// myös sen kommentit ja liitteet. Ylläpitäjä tai valmennus ei näe sitä Keskuksessa.
import { esc } from "./util.js";

export const onYksityinen = (h) => h?.nakyvyys === "oma";
export const yksityinenMerkki = (h) => (onYksityinen(h) ? `<span class="lukko yksityinen" title="Yksityinen: näkyy vain sinulle">🔒 vain sinulle</span>` : "");

const INFO = `
  <p><b>Yksityinen muistiinpano näkyy vain sinulle.</b> Sitä eivät näe muut pelaajat, valmennus eikä Keskuksen ylläpitäjä.</p>
  <ul>
    <li><b>Mihin:</b> omat havainnot ja muistutukset itsellesi, esimerkiksi "pelasin tämän tilanteen näin" tai "tämä tilanne pelataan jatkossa näin".</li>
    <li><b>Mitä se koskee:</b> myös muistiinpanon liitteet ja kommentit näkyvät vain sinulle.</li>
    <li><b>Jarvisin koosteet:</b> yksityisiä muistiinpanoja ei oteta mukaan koosteisiin.</li>
    <li><b>Voit muuttaa sen myöhemmin:</b> Muokkaa ja poista valinta, niin muistiinpano näkyy taas muille osion lukijoille. Valintaa voi muuttaa vain kirjoittaja itse.</li>
    <li><b>Tallennus:</b> muistiinpano tallentuu samaan Keskuksen tietokantaan kuin muut kirjaukset, ja tietokanta rajaa sen näkyvyyden. Tietokannan teknisellä ylläpidolla on pääsy tietokantaan, mutta yksityisiä muistiinpanoja ei lueta.</li>
  </ul>`;

let n = 0;
/** Valintaruutu + ⓘ-painike ja avautuva tietoikkuna. Kytke kytkeYksityinen(juuri):lla. */
export function yksityinenValinta(paalla = false, { nimi = "oma" } = {}) {
  const id = `yks-info-${++n}`;
  return `<span class="yksityinen-valinta">
    <label class="chip yks-chip"><input type="checkbox" name="${esc(nimi)}"${paalla ? " checked" : ""}>🔒 Vain minulle</label>
    <button type="button" class="info-nappi" aria-expanded="false" aria-controls="${id}" title="Mikä on yksityinen muistiinpano?">i</button>
    <span class="yks-info" id="${id}" role="note" hidden>${INFO}<button type="button" class="linkkinappi yks-sulje">Sulje</button></span>
  </span>`;
}
export function kytkeYksityinen(juuri) {
  juuri.querySelectorAll(".yksityinen-valinta").forEach((v) => {
    const nappi = v.querySelector(".info-nappi"), info = v.querySelector(".yks-info");
    const aseta = (auki) => { info.hidden = !auki; nappi.setAttribute("aria-expanded", auki); };
    nappi.onclick = () => aseta(info.hidden);
    v.querySelector(".yks-sulje").onclick = () => { aseta(false); nappi.focus(); };
    info.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); aseta(false); nappi.focus(); } });
  });
}
