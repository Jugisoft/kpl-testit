// Minun kehitykseni -sivunäkymä (14.11.2026)
// Reitti: #/minunkehitys tai #/minunkehitys/<pelaaja_id>
import { tila, nimi } from "../db.js";
import { $, esc } from "../util.js";
import { piirraKehitys } from "../minunkehitys.js";

let el;

export function nayta(main, pelaajaId) {
  const pid = pelaajaId || tila.kayttaja?.pelaaja_id;
  const pelaaja = pid ? tila.pelaaja[pid] : null;
  if (!pelaaja) {
    main.innerHTML = `<p class="tyhja">Pelaajaa ei löytynyt.</p>`;
    return;
  }
  el = main;
  main.innerHTML = `<div class="lataus">Ladataan kehitystietoja…</div>`;
  piirraKehitys(main, pelaaja);
}

export function poistu() {
  if (el) el.innerHTML = "";
}
