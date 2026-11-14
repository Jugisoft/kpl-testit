// Minun pelini – oma sivu (14.11.2026): junioripelaajan pelitilastot omana näkymänään.
// Wrapper-moduuli, joka lataa pelaajan tiedot ja kutsuu minunpeli_tilastot.js:n piirra-funktiota.
// Reitti: #/minunpeli (oma) tai #/minunpeli/<pelaaja_id> (valmentaja katsoo).
import { tila } from "../db.js";
import { $ } from "../util.js";
import { piirraMinunPeliTilastot } from "../minunpeli_tilastot.js";

export async function nayta(main, id) {
  // Pelaajatunnus: URL-parametri, oma pelaajatunnus tai SP-pelaaja
  const pid = id || tila.omaPelaaja || tila.spPelaaja;
  if (!pid) { main.innerHTML = `<p class="tyhja">Ei pelaajatunnusta.</p>`; return; }

  const p = tila.pelaaja[pid];
  if (!p) { main.innerHTML = `<p class="tyhja">Pelaajaa ei löytynyt.</p>`; return; }

  main.innerHTML = `<section id="minun-peli" aria-labelledby="mp-otsikko"><p class="lataa">Ladataan pelitilastoja…</p></section>`;
  piirraMinunPeliTilastot($("#minun-peli", main), p);
}

export function poistu() {}
