// Minun kehitykseni -sivunäkymä (14.11.2026)
// Reitti: #/minunkehitys tai #/minunkehitys/<pelaaja_id>
import { tila, nimi } from "../db.js";
import { $, esc } from "../util.js";
import { piirraKehitys } from "../minunkehitys.js";

let el;

export function nayta(params) {
  const pid = params?.[0] || tila.kayttaja?.pelaaja_id;
  const pelaaja = pid ? tila.pelaaja[pid] : null;
  if (!pelaaja) {
    el = document.getElementById("sisalto");
    el.innerHTML = `<p class="tyhja">Pelaajaa ei löytynyt.</p>`;
    return;
  }
  el = document.getElementById("sisalto");
  el.innerHTML = `<div class="lataus">Ladataan kehitystietoja…</div>`;
  piirraKehitys(el, pelaaja);
}

export function poistu() {
  if (el) el.innerHTML = "";
}
