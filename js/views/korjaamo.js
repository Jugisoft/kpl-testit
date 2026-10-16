// Pärnäsen korjaamo (16.10.2026): Keskuksen korjausehdotukset ja kehitysideat yhdessä listassa tiloineen.
// Muistio on valmennuksen sisällölle, tämä sivu Keskuksen kehittämiselle. Jarvis käsittelee avoimet pyynnöstä
// (ohje vaultissa: 05 Jarvis/Ohjeet/KPL Keskus - korjaamo.md), ylläpitäjä voi myös vaihtaa tilan ja vastata täällä.
import { sb, tila } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { lataaNimet, kirjoittajanNimi, aikaSitten, omaEmail } from "../keskus.js";

export const SIVUT = ["Keskus", "Lyöntipäiväkirja", "Testit", "Muistio", "Vastustajat", "Pelikirja", "Analyysi", "Juoksuodotus", "Siirtomarkkinat", "Ohje", "Muu"];
const TILAT = { avoin: "Avoin", tyon_alla: "Työn alla", korjattu: "Korjattu", ei_muutosta: "Ei muutosta" };
const TYYPIT = { korjaus: "Korjaus", idea: "Idea" };
const n = { tyyppi: "korjaus", sivu: "", suodatin: "avoimet" };
let kanava = null;
export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

export async function nayta(main) {
  await lataaNimet();
  const { data, error } = await sb.from("korjaamo").select("*").order("luotu", { ascending: false }).limit(1000);
  if (error) throw error;
  let rivit = data;

  const piirra = () => {
    const avoimet = rivit.filter((r) => r.tila === "avoin" || r.tila === "tyon_alla");
    const valmiit = rivit.filter((r) => r.tila === "korjattu" || r.tila === "ei_muutosta");
    const lista = n.suodatin === "avoimet" ? avoimet : n.suodatin === "valmiit" ? valmiit : rivit;
    main.innerHTML = `
      <div class="kj-paa">
        <div><h1>Pärnäsen korjaamo</h1>
        <p class="ingressi">Korjausehdotukset ja kehitysideat Keskukseen. Kirjaa tänne, mikä ei toimi tai mitä kaipaat, ja seuraa tilaa. Valmennuksen havainnot kuuluvat edelleen Muistioon.</p></div>
        <div class="kj-luvut"><div><span class="num">${avoimet.filter((r) => r.tila === "avoin").length}</span><small>avoinna</small></div><div><span class="num">${avoimet.filter((r) => r.tila === "tyon_alla").length}</span><small>työn alla</small></div><div><span class="num">${valmiit.length}</span><small>käsitelty</small></div></div>
      </div>

      <form id="kj-uusi" class="paneeli kj-uusi">
        <div class="rivi">
          <div class="chipit pieni-chipit" role="group" aria-label="Tyyppi">${Object.entries(TYYPIT).map(([k, t]) => `<button type="button" class="chip" data-tyyppi="${k}" aria-pressed="${n.tyyppi === k}">${t}</button>`).join("")}</div>
          <label class="kj-sivu">Mitä sivua koskee <select name="sivu"><option value="">Valitse (vapaaehtoinen)</option>${SIVUT.map((s) => `<option${n.sivu === s ? " selected" : ""}>${s}</option>`).join("")}</select></label>
        </div>
        <textarea name="teksti" rows="3" maxlength="4000" required placeholder="${n.tyyppi === "idea" ? "Esim. Lyöntipäiväkirjaan voisi saada viikkotavoitteen" : "Esim. Testit: nopeuskestävyyden 9. veto ei näy puhelimella"}"></textarea>
        <div class="rivi"><button class="btn ensisij">Lähetä</button><span class="pieni">Ctrl + Enter lähettää. Oman avoimen ehdotuksen voi poistaa.</span></div>
      </form>

      <div class="kj-tabit" role="tablist">
        ${[["avoimet", `Avoimet (${avoimet.length})`], ["valmiit", `Käsitellyt (${valmiit.length})`], ["kaikki", `Kaikki (${rivit.length})`]].map(([k, t]) => `<button type="button" role="tab" data-suodatin="${k}" aria-selected="${n.suodatin === k}">${t}</button>`).join("")}
      </div>
      <ul class="kj-lista">${lista.map(rivi).join("") || `<li class="tyhja">${n.suodatin === "avoimet" ? "Ei avoimia ehdotuksia." : "Ei ehdotuksia."}</li>`}</ul>`;

    const f = $("#kj-uusi"), ta = f.elements.teksti;
    $$("[data-tyyppi]", f).forEach((b) => (b.onclick = () => { n.tyyppi = b.dataset.tyyppi; $$("[data-tyyppi]", f).forEach((x) => x.setAttribute("aria-pressed", x === b)); ta.placeholder = n.tyyppi === "idea" ? "Esim. Lyöntipäiväkirjaan voisi saada viikkotavoitteen" : "Esim. Testit: nopeuskestävyyden 9. veto ei näy puhelimella"; ta.focus(); }));
    f.elements.sivu.onchange = (e) => (n.sivu = e.target.value);
    ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const teksti = ta.value.trim(); if (!teksti) return;
      const nappi = f.querySelector(".ensisij"); nappi.disabled = true;
      const { data: r, error: err } = await sb.from("korjaamo").insert({ tyyppi: n.tyyppi, sivu: n.sivu || null, teksti }).select().single();
      nappi.disabled = false;
      if (err) return ilmoita("Lähetys epäonnistui: " + err.message, true);
      if (!rivit.some((x) => x.id === r.id)) rivit.unshift(r);
      n.suodatin = "avoimet"; ilmoita("Kiitos, ehdotus kirjattu"); piirra();
    };
    $$("[data-suodatin]").forEach((b) => (b.onclick = () => { n.suodatin = b.dataset.suodatin; piirra(); }));
    $$("[data-poista]").forEach((b) => (b.onclick = async () => {
      if (b.dataset.vahvista !== "1") { b.dataset.vahvista = "1"; b.textContent = "Poistetaanko?"; b.classList.add("vaara"); return; }
      const { error: err } = await sb.from("korjaamo").delete().eq("id", b.dataset.poista);
      if (err) return ilmoita("Poisto epäonnistui: " + err.message, true);
      rivit = rivit.filter((x) => x.id !== b.dataset.poista); piirra();
    }));
    // Ylläpitäjä: tila ja vastaus
    $$("[data-tila]").forEach((s) => (s.onchange = () => paivita(s.dataset.tila, { tila: s.value, kasitelty: s.value === "korjattu" || s.value === "ei_muutosta" ? new Date().toISOString() : null })));
    $$("[data-vastaus]").forEach((t) => (t.onchange = () => paivita(t.dataset.vastaus, { vastaus: t.value.trim() || null })));
  };

  const paivita = async (id, muutos) => {
    const { error: err } = await sb.from("korjaamo").update(muutos).eq("id", id);
    if (err) return ilmoita("Tallennus epäonnistui: " + err.message, true);
    Object.assign(rivit.find((x) => x.id === id), muutos); ilmoita("Tallennettu"); piirra();
  };

  piirra();
  poistu();
  kanava = sb.channel("korjaamo").on("postgres_changes", { event: "*", schema: "public", table: "korjaamo" }, (m) => {
    if (m.eventType === "DELETE") rivit = rivit.filter((x) => x.id !== m.old.id);
    else { const i = rivit.findIndex((x) => x.id === m.new.id); if (i >= 0) rivit[i] = m.new; else rivit.unshift(m.new); }
    if (!document.activeElement || !main.contains(document.activeElement) || document.activeElement.tagName === "BUTTON") piirra();
  }).subscribe();
}

function rivi(r) {
  const oma = r.kirjoittaja === omaEmail();
  return `<li class="kj-rivi kj-${r.tila}">
    <div class="kj-merkit"><span class="kj-tila">${TILAT[r.tila]}</span><span class="kj-tyyppi">${TYYPIT[r.tyyppi]}</span>${r.sivu ? `<span class="kj-sivumerkki">${esc(r.sivu)}</span>` : ""}</div>
    <div class="kj-teksti">${esc(r.teksti)}</div>
    <div class="pieni">${esc(kirjoittajanNimi(r.kirjoittaja))}, ${aikaSitten(r.luotu)}${r.kasitelty ? ` · käsitelty ${aikaSitten(r.kasitelty)}` : ""}</div>
    ${r.vastaus && !tila.admin ? `<div class="kj-vastaus"><b>Vastaus:</b> ${esc(r.vastaus)}</div>` : ""}
    ${tila.admin ? `<div class="kj-hallinta">
        <label>Tila <select data-tila="${r.id}">${Object.entries(TILAT).map(([k, t]) => `<option value="${k}"${k === r.tila ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="kj-kasvaa">Vastaus <input type="text" data-vastaus="${r.id}" value="${esc(r.vastaus || "")}" placeholder="Mitä tehtiin tai miksi ei"></label>
        <button type="button" class="btn ly-pieni" data-poista="${r.id}">Poista</button></div>`
      : oma && r.tila === "avoin" ? `<div class="kj-hallinta"><button type="button" class="btn ly-pieni" data-poista="${r.id}">Poista</button></div>` : ""}
  </li>`;
}
