// Cooper-vauhtitaulukko (7.11.2026, Jugin toive): valmentajan apu Cooper-testiin. Lähde: Cooper-taulukko (2).xlsx,
// välilehti Cooper-vauhti (kierros 261 m, ennuste = kuljettu matka / aika × 12 min). Taulukko käännetty käytännön muotoon:
// tavoitetulos riveinä ja kierroksen ohitusaika sarakkeina, sekä laskuri "kierros + aika → ennuste".
import { $ } from "./util.js";

export const KIERROS = 261, KESTO = 720;
const TAVOITTEET = Array.from({ length: 17 }, (_, i) => 1800 + i * 100); // 1800–3400 m
const mmss = (s) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };
const aikaSek = (t) => {
  const s = String(t).trim().replace(",", ".");
  let m = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d{3,4})$/); // 345 = 3:45, 1015 = 10:15
  if (m) return Math.floor(+m[1] / 100) * 60 + (+m[1] % 100);
  return null;
};
export const ennuste = (kierrokset, sek) => Math.round((kierrokset * KIERROS) / sek * KESTO);

export function cooperVauhtiHtml(auki = false) {
  const kierr = Array.from({ length: 12 }, (_, i) => i + 1);
  return `<details class="paneeli cv"${auki ? " open" : ""}><summary><strong>Cooper-vauhtitaulukko</strong><span class="pieni"> · valmentajan apu testin aikana</span></summary>
    <div class="cv-laskuri">
      <label class="kentta">Kierros<input type="number" id="cv-kierros" inputmode="numeric" min="1" max="14" value="4"></label>
      <label class="kentta">Aika (min:s)<input type="text" id="cv-aika" inputmode="numeric" placeholder="3:50" value="3:50" autocomplete="off"></label>
      <div class="cv-tulos" aria-live="polite"><span class="pieni">Ennuste 12 min</span><b class="num" id="cv-ennuste">–</b><span class="pieni" id="cv-kierrosaika"></span></div>
    </div>
    <p class="pieni">Kierros ${KIERROS} m. Ennuste olettaa, että juoksija pitää saman vauhdin loppuun. Aika kirjoitetaan muodossa 3:50 tai 350.</p>
    <p class="pieni cv-selite"><b>Taulukko:</b> milloin kierroksen pitää olla täynnä (min:s), jotta tavoitetulos syntyy. 1. sarake on samalla tasainen kierrosaika.</p>
    <div class="taulu-wrap cv-wrap"><table class="cv-taulu">
      <thead><tr><th scope="col">Tavoite</th>${kierr.map((k) => `<th scope="col" class="num">${k}.<small>${k * KIERROS} m</small></th>`).join("")}</tr></thead>
      <tbody>${TAVOITTEET.map((t) => { const kierrosS = (KESTO * KIERROS) / t; return `<tr><th scope="row" class="num">${t} m</th>${kierr.map((k) => { const s = kierrosS * k; return `<td class="num">${s <= KESTO ? mmss(s) : ""}</td>`; }).join("")}</tr>`; }).join("")}</tbody>
    </table></div>
  </details>`;
}

export function kytkeCooperVauhti(juuri = document) {
  const k = $("#cv-kierros", juuri), a = $("#cv-aika", juuri);
  if (!k || !a) return;
  const laske = () => {
    const s = aikaSek(a.value), n = +k.value;
    const ok = s && s > 0 && s <= KESTO && n > 0;
    $("#cv-ennuste", juuri).textContent = ok ? `${ennuste(n, s)} m` : "–";
    $("#cv-kierrosaika", juuri).textContent = ok ? `keskimäärin ${mmss(s / n)} / kierros` : (s > KESTO ? "aika yli 12 min" : "");
    // korosta taulukosta lähin tavoiterivi
    juuri.querySelectorAll(".cv-taulu tbody tr").forEach((tr) => tr.classList.remove("cv-lahin"));
    if (ok) { const e = ennuste(n, s), i = Math.round((e - 1800) / 100); juuri.querySelectorAll(".cv-taulu tbody tr")[i]?.classList.add("cv-lahin"); }
  };
  k.oninput = laske; a.oninput = laske; laske();
}

