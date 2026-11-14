// Valmentajan huomiointi (14.11.2026, Jugi): valmentaja reagoi (👍 🔥 💪) tai kommentoi lyhyesti pelaajan treeniä,
// tavoitetta, testiä tai koko viikkoa. Pelaaja näkee huomioinnit Oma Keskuksessa (Valmentajalta-kortti + merkit kohteissa)
// ja kuittaa ne nähdyiksi avaamalla sivun. Ei sähköpostia – varsinainen keskustelu käydään kasvotusten.
// Taulu huomioinnit (RLS: pelaaja itse + oman alueen valmennus), rpc merkitse_huomioinnit_nahdyiksi.
import { sb, tila } from "./db.js";
import { $, esc, ilmoita } from "./util.js";

export const REAKTIOT = { peukku: ["👍", "Peukku"], liekki: ["🔥", "Kova työ"], vahva: ["💪", "Vahva"] };
const KOHTEET = { treeni: "treeni", tavoite: "tavoite", testi: "testi", viikko: "viikko" };
const omaEmail = () => (tila.istunto?.user?.email || "").toLowerCase();

let nimet = null;
export async function lataaNimet() {
  if (nimet) return nimet;
  const { data } = await sb.rpc("valmentajien_nimet");
  nimet = Object.fromEntries((data || []).map((v) => [String(v.email).toLowerCase(), v.nimi || ""]));
  return nimet;
}
export const valmentajanNimi = (email) => ((nimet?.[email] || "").split(" ")[0] || String(email).split("@")[0]);

// Kaikki huomioinnit annetuille pelaajille (uusin ensin); valinnaisesti vain tietystä päivästä alkaen
export async function hae(pelaajaIdt, alkaen = null) {
  if (!pelaajaIdt.length) return [];
  let q = sb.from("huomioinnit").select("*").in("pelaaja_id", pelaajaIdt).order("luotu", { ascending: false });
  if (alkaen) q = q.gte("luotu", alkaen);
  const { data, error } = await q;
  if (error) { console.warn("huomioinnit", error.message); return []; }
  return data || [];
}
const kohteelle = (lista, kohde, id) => lista.filter((h) => h.kohde === kohde && String(h.kohde_id) === String(id));

// Merkit kohteen yhteydessä: reaktiot ryhmiteltynä + kommentit
function merkit(rivit) {
  const reakt = {};
  for (const h of rivit) if (h.reaktio) (reakt[h.reaktio] ||= []).push(valmentajanNimi(h.valmentaja));
  const kommentit = rivit.filter((h) => h.teksti);
  return `${Object.entries(reakt).map(([r, n]) => `<span class="hm-merkki" title="${esc(`${REAKTIOT[r][1]}: ${n.join(", ")}`)}">${REAKTIOT[r][0]} ${esc(n.join(", "))}</span>`).join("")}${kommentit.map((h) => `<span class="hm-kommentti"><b>${esc(valmentajanNimi(h.valmentaja))}</b> ${esc(h.teksti)}${h.valmentaja === omaEmail() ? ` <button class="linkkinappi" data-hm-poista="${h.id}" aria-label="Poista kommentti">Poista</button>` : ""}</span>`).join("")}`;
}
function sisus(rivit) {
  const omat = new Set(rivit.filter((h) => h.valmentaja === omaEmail() && h.reaktio).map((h) => h.reaktio));
  const napit = tila.ohjaaja ? `<span class="hm-napit">${Object.entries(REAKTIOT).map(([k, [ikoni, nimi]]) => `<button type="button" class="hm-nappi" data-hm-r="${k}" aria-pressed="${omat.has(k)}" aria-label="${nimi}" title="${nimi}">${ikoni}</button>`).join("")}<button type="button" class="hm-nappi" data-hm-kommentoi aria-label="Kommentoi" title="Kommentoi">💬</button></span>
    <form class="hm-lomake" hidden><input type="text" maxlength="500" placeholder="Lyhyt kommentti pelaajalle" aria-label="Kommentti"><button class="btn pieni-nappi">Lähetä</button></form>` : "";
  return merkit(rivit) + napit;
}
// Lohko kohteen alle. Pelaajalle näkyy vain, jos huomiointeja on; valmentajalle aina napit.
export function lohko(lista, pelaajaId, kohde, id) {
  const rivit = kohteelle(lista, kohde, id);
  if (!rivit.length && !tila.ohjaaja) return "";
  return `<div class="hm" data-hm-p="${esc(pelaajaId)}" data-hm-k="${KOHTEET[kohde]}" data-hm-id="${esc(id)}">${sisus(rivit)}</div>`;
}

// Tapahtumat (delegointi): päivittää vain kyseisen lohkon
export function kytke(el, kunMuuttuu) {
  if (el.dataset.hmKytketty) return;
  el.dataset.hmKytketty = "1";
  const paivitaLohko = async (lohkoEl) => {
    const { hmP: p, hmK: k, hmId: id } = lohkoEl.dataset;
    const { data } = await sb.from("huomioinnit").select("*").eq("pelaaja_id", p).eq("kohde", k).eq("kohde_id", id).order("luotu", { ascending: false });
    lohkoEl.innerHTML = sisus(data || []);
    kunMuuttuu?.();
  };
  el.addEventListener("click", async (e) => {
    const lohkoEl = e.target.closest(".hm"); if (!lohkoEl) return;
    const { hmP: p, hmK: k, hmId: id } = lohkoEl.dataset;
    const r = e.target.closest("[data-hm-r]"), komm = e.target.closest("[data-hm-kommentoi]"), poista = e.target.closest("[data-hm-poista]");
    if (r) {
      e.preventDefault(); r.disabled = true;
      const reaktio = r.dataset.hmR;
      const { error } = r.getAttribute("aria-pressed") === "true"
        ? await sb.from("huomioinnit").delete().eq("pelaaja_id", p).eq("kohde", k).eq("kohde_id", id).eq("reaktio", reaktio).eq("valmentaja", omaEmail())
        : await sb.from("huomioinnit").insert({ pelaaja_id: p, kohde: k, kohde_id: id, reaktio });
      if (error) { r.disabled = false; return ilmoita("Reaktio ei tallentunut: " + error.message, true); }
      await paivitaLohko(lohkoEl);
    } else if (komm) {
      e.preventDefault();
      const f = $(".hm-lomake", lohkoEl); f.hidden = !f.hidden; if (!f.hidden) $("input", f).focus();
    } else if (poista) {
      e.preventDefault();
      const { error } = await sb.from("huomioinnit").delete().eq("id", poista.dataset.hmPoista);
      if (error) return ilmoita(error.message, true);
      await paivitaLohko(lohkoEl);
    }
  });
  el.addEventListener("submit", async (e) => {
    const f = e.target.closest(".hm-lomake"); if (!f) return;
    e.preventDefault();
    const lohkoEl = f.closest(".hm"), teksti = $("input", f).value.trim();
    if (!teksti) return;
    const { hmP: p, hmK: k, hmId: id } = lohkoEl.dataset;
    const { error } = await sb.from("huomioinnit").insert({ pelaaja_id: p, kohde: k, kohde_id: id, teksti });
    if (error) return ilmoita("Kommentti ei tallentunut: " + error.message, true);
    ilmoita("Kommentti lähetetty");
    await paivitaLohko(lohkoEl);
  });
}

// Pelaajan Oma Keskus: Valmentajalta-kortti (uusimmat ensin). kuvaus(h) = mihin huomiointi liittyy.
export function valmentajaltaKortti(lista, kuvaus, oma) {
  if (!lista.length) return "";
  const uusia = oma ? lista.filter((h) => !h.nahty).length : 0;
  const nayta = lista.slice(0, 5);
  return `<section class="paneeli hm-kortti" aria-labelledby="hm-otsikko">
    <div class="oma-osa-paa"><h2 id="hm-otsikko">Valmentajalta</h2>${uusia ? `<span class="hm-uusia">${uusia} uutta</span>` : ""}</div>
    <ul class="hm-lista">${nayta.map((h) => `<li class="${oma && !h.nahty ? "uusi" : ""}">
      <span class="hm-kuka">${esc(valmentajanNimi(h.valmentaja).slice(0, 2).toUpperCase())}</span>
      <span><b>${esc(valmentajanNimi(h.valmentaja))}</b> <small>· ${esc(kuvaus(h))}</small><br>${h.reaktio ? `${REAKTIOT[h.reaktio][0]} ${esc(REAKTIOT[h.reaktio][1])}` : ""}${h.teksti ? esc(h.teksti) : ""}</span></li>`).join("")}</ul>
    ${lista.length > nayta.length ? `<p class="pieni">${lista.length - nayta.length} aiempaa huomiointia.</p>` : ""}
  </section>`;
}
export async function merkitseNahdyiksi() { await sb.rpc("merkitse_huomioinnit_nahdyiksi"); }

// Valmentajalle: pelaajat, joita kukaan ei ole huomioinut annettuna aikana
export function huomioimatta(pelaajat, lista, alkaen) {
  const huomioidut = new Set(lista.filter((h) => h.luotu >= alkaen).map((h) => h.pelaaja_id));
  return pelaajat.filter((p) => !huomioidut.has(p.id));
}
