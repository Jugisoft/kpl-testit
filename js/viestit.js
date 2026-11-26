// Viestit: valmentaja lähettää pelaajille viestejä, pelaaja näkee lukemattomat Oma Keskus -sivulla.
// Tietokantataulut: viestit, viesti_luettu (ks. Supabase-migraatio create_viestit_tables).
import { sb, tila } from "./db.js";
import { $, $$, esc, ilmoita } from "./util.js";
import { lataaNimet, kirjoittajanNimi } from "./keskus.js";

const PAIVA = 864e5;
const aikaSitten = (iso) => {
  const ms = Date.now() - new Date(iso);
  if (ms < 60e3) return "juuri nyt";
  if (ms < 3600e3) return `${Math.floor(ms / 60e3)} min sitten`;
  if (ms < PAIVA) return `${Math.floor(ms / 3600e3)} t sitten`;
  if (ms < 7 * PAIVA) return `${Math.floor(ms / PAIVA)} pv sitten`;
  return new Date(iso).toLocaleDateString("fi-FI", { day: "numeric", month: "numeric", year: "numeric" });
};
const omaEmail = () => (tila.istunto?.user?.email || "").toLowerCase();

// --- Hae pelaajan viestit (RLS hoitaa oikeudet: pelaaja näkee vain itselleen kohdistetut) ---
export async function haeViestit() {
  const { data } = await sb.from("viestit").select("*")
    .order("luotu", { ascending: false }).limit(50);
  // Katso käyttäjänä (26.11.2026): ylläpitäjä näkee kaikki viestit → näytetään vain katsotulle käyttäjälle kohdistetut
  if (tila.katselu) {
    const p = tila.pelaaja[tila.omaPelaaja];
    const ika = p?.syntymavuosi;
    return (data || []).filter((v) => (v.pelaaja_id ? v.pelaaja_id === tila.omaPelaaja : v.joukkue_id ? v.joukkue_id === p?.joukkue_id : v.ikaluokka ? v.ikaluokka === ika : true) && !!p);
  }
  return data || [];
}

// --- Hae omat lukemattomat viestit (juniori: vain itselleen kohdistetut) ---
export async function haeLukemattomat() {
  const viestit = await haeViestit();
  if (!viestit.length) return [];
  const { data: luetut } = await sb.from("viesti_luettu").select("viesti_id")
    .eq("kayttaja_email", omaEmail())
    .in("viesti_id", viestit.map((v) => v.id));
  const luettuSet = new Set((luetut || []).map((l) => l.viesti_id));
  return viestit.filter((v) => !luettuSet.has(v.id));
}

// --- Merkitse viesti luetuksi ---
export async function merkitseLuetuksi(viestiId) {
  await sb.from("viesti_luettu").upsert({ viesti_id: viestiId, kayttaja_email: omaEmail() }, { onConflict: "viesti_id,kayttaja_email" });
}

// --- Lähetä viesti ---
export async function lahetaViesti({ otsikko, teksti, pelaajaId, joukkueId, ikaluokka }) {
  const rivi = {
    lahettaja_email: omaEmail(),
    otsikko: otsikko.trim(),
    teksti: (teksti || "").trim(),
  };
  if (pelaajaId) rivi.pelaaja_id = pelaajaId;
  if (joukkueId) rivi.joukkue_id = joukkueId;
  if (ikaluokka) rivi.ikaluokka = ikaluokka;
  const { data, error } = await sb.from("viestit").insert(rivi).select().single();
  if (error) throw error;
  return data;
}

// --- Lukemattomien lukumäärä (alapalkin badge) ---
let _lukemattomatCache = null;
let _lukemattomatTs = 0;
export async function lukemattomienMaara() {
  // cache 30 s
  if (_lukemattomatCache !== null && Date.now() - _lukemattomatTs < 30e3) return _lukemattomatCache;
  const lkm = (await haeLukemattomat()).length;
  _lukemattomatCache = lkm;
  _lukemattomatTs = Date.now();
  return lkm;
}
export function nollaaCache() { _lukemattomatCache = null; _lukemattomatTs = 0; }

// --- Valmentajan viestilomake (oma.js kutsuu) ---
export function viestiLomake({ pelaajaId, pelaajanNimi, joukkueId, joukkueenNimi, ikaluokat }) {
  const kohdeVaihtoehdot = pelaajaId
    ? `<label class="chip"><input type="radio" name="viesti-kohde" value="pelaaja" checked>Vain ${esc(pelaajanNimi)}</label>
       ${joukkueId ? `<label class="chip"><input type="radio" name="viesti-kohde" value="joukkue">${esc(joukkueenNimi)}</label>` : ""}`
    : (ikaluokat || []).map((ik) => `<label class="chip"><input type="radio" name="viesti-kohde" value="ik-${ik.vuosi}" ${ik.oletus ? "checked" : ""}>${esc(ik.nimi)}</label>`).join("");

  return `<section class="paneeli viesti-osio" id="viesti-osio">
    <div class="oma-osa-paa"><h2>Lähetä viesti</h2></div>
    <form id="viesti-lomake" class="oma-lomake">
      <div class="oma-kentat">
        <label class="kentta">Otsikko<input type="text" name="viesti-otsikko" maxlength="200" required placeholder="esim. Tavoitteet päivitetty"></label>
      </div>
      <label class="kentta">Viesti<textarea name="viesti-teksti" rows="3" maxlength="2000" placeholder="valinnainen tarkempi viesti"></textarea></label>
      <div class="rivi">
        ${kohdeVaihtoehdot}
        <button class="btn ensisij" type="submit">Lähetä</button>
      </div>
    </form>
  </section>`;
}

// --- Kytke lomakkeen tapahtumat ---
export function kytkeViestiLomake(main, { pelaajaId, joukkueId }) {
  const form = $("#viesti-lomake", main);
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = form.elements;
    const otsikko = f["viesti-otsikko"].value.trim();
    if (!otsikko) return ilmoita("Kirjoita otsikko.", true);
    const kohde = form.querySelector('[name="viesti-kohde"]:checked')?.value || "pelaaja";
    const nappi = form.querySelector("[type=submit]");
    nappi.disabled = true;
    try {
      const params = { otsikko, teksti: f["viesti-teksti"].value };
      if (kohde === "pelaaja") {
        params.pelaajaId = pelaajaId;
      } else if (kohde === "joukkue") {
        params.joukkueId = joukkueId;
      } else if (kohde.startsWith("ik-")) {
        const vuosi = parseInt(kohde.replace("ik-", ""));
        params.joukkueId = joukkueId;
        params.ikaluokka = vuosi;
      }
      await lahetaViesti(params);
      form.reset();
      ilmoita("Viesti lähetetty");
    } catch (err) {
      ilmoita("Viestin lähetys ei onnistunut: " + err.message, true);
    } finally {
      nappi.disabled = false;
    }
  };
}

// --- Pelaajan viestibanneri: kaikki viestit, lukemattomat korostettuina ---
export function viestiBanneri(viestit, lukemattomatIdt) {
  if (!viestit.length) return "";
  const lkm = lukemattomatIdt ? lukemattomatIdt.size : 0;
  const otsikko = lkm ? `Viestit (${lkm} uutta)` : "Viestit";
  return `<section class="paneeli viesti-banneri" id="viesti-banneri">
    <div class="oma-osa-paa"><h2>${otsikko}</h2></div>
    <ol class="viesti-lista">${viestit.slice(0, 20).map((v) => {
      const uusi = lukemattomatIdt && lukemattomatIdt.has(v.id);
      return `
      <li class="viesti-rivi${uusi ? "" : " luettu"}" data-viesti-id="${v.id}">
        <div class="viesti-paa">
          <strong>${uusi ? "🔵 " : ""}${esc(v.otsikko)}</strong>
          <span class="pieni">${esc(kirjoittajanNimi(v.lahettaja_email))}, ${aikaSitten(v.luotu)}</span>
        </div>
        ${v.teksti ? `<p class="viesti-teksti">${esc(v.teksti)}</p>` : ""}
      </li>`;
    }).join("")}
    </ol>
  </section>`;
}

// --- Kytke viestibannerin tapahtumat: klikkaus merkitsee luetuksi ---
export function kytkeViestiBanneri(main, paivitaFn) {
  $$(".viesti-rivi", main).forEach((li) => {
    li.onclick = async () => {
      if (li.classList.contains("luettu")) return;
      li.classList.add("luettu");
      await merkitseLuetuksi(li.dataset.viestiId);
      nollaaCache();
      // päivitä badge
      if (paivitaFn) paivitaFn();
    };
  });
}
