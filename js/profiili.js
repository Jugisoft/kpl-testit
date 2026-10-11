// Pelaajaprofiilit (Jarvisin tekemät HTML-profiilit) ja niiden vikalista: lukijat kirjaavat korjaukset
// ja kehitysideat, Jarvis käsittelee ne ja merkitsee korjatuiksi. Koko lista on samalla työlista.
import { sb, tila } from "./db.js";
import { $, $$, esc, ilmoita } from "./util.js";
import { kirjoittajanNimi, aikaSitten, omaEmail } from "./keskus.js";

export const LUOKAT = [["sisalto", "Sisältö"], ["terminologia", "Terminologia"], ["puuttuu", "Puuttuu"], ["ulkoasu", "Ulkoasu"], ["muu", "Muu"]];
const LN = Object.fromEntries(LUOKAT);
const TILAT = { avoin: "Avoin", korjattu: "Korjattu", ei_muutosta: "Ei muutosta" };

export async function haeProfiili(pelaajaId) {
  const { data, error } = await sb.from("pelaajaprofiilit").select("*").eq("pelaaja_id", pelaajaId).maybeSingle();
  if (error) return null;
  return data;
}
// Kevyt lista: kenellä on profiili
export async function profiiliIdt() {
  const { data } = await sb.from("pelaajaprofiilit").select("pelaaja_id,versio,muokattu");
  return new Map((data || []).map((r) => [r.pelaaja_id, r]));
}

// Profiili omassa eristetyssä kehyksessä (omat tyylit ja skriptit eivät vuoda Keskukseen)
export function profiiliKehys(html) {
  const doc = `<!doctype html><html lang="fi" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">
<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${html}
<script>(function(){var l=0;function k(){var h=Math.ceil(document.body.getBoundingClientRect().height);if(h!==l){l=h;parent.postMessage({kplProfiili:h},"*")}}new ResizeObserver(k).observe(document.body);addEventListener("load",k);setTimeout(k,600)})();<\/script></body></html>`;
  return `<iframe class="profiilikehys" title="Pelaajaprofiili" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="${esc(doc)}"></iframe>`;
}
let kuuntelija = null;
export function kytkeKehys(el) {
  const f = el.querySelector(".profiilikehys"); if (!f) return;
  if (kuuntelija) removeEventListener("message", kuuntelija);
  kuuntelija = (e) => { if (e.source === f.contentWindow && e.data?.kplProfiili) f.style.height = Math.min(20000, e.data.kplProfiili + 4) + "px"; };
  addEventListener("message", kuuntelija);
}

// --- Vikalista
let kanava = null;
export function poistuVikalista() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

export async function piirraVikalista(el, pelaaja, profiili) {
  let lista = [];
  let luokka = "sisalto";
  const lataa = async () => {
    const { data, error } = await sb.from("profiili_vikalista").select("*").or(`pelaaja_id.eq.${pelaaja.id},koskee_pohjaa.eq.true`).order("luotu", { ascending: false }).limit(500);
    if (error) { el.querySelector(".vl-tila").textContent = "Vikalistaa ei saatu ladattua. Päivitä sivu."; return; }
    lista = data; piirra();
  };
  el.innerHTML = `<section class="vikalista paneeli">
    <div class="vl-paa"><h2>Vikalista</h2><span class="vl-lkm" title="Avoimet">–</span></div>
    <p class="pieni vl-tila">Kirjaa korjaus, puute tai kehitysidea. Jarvis käy listan läpi, päivittää profiilin ja merkitsee kohdan korjatuksi. Versio ${profiili.versio}.</p>
    <form class="vl-lomake" id="vl-lomake">
      <div class="chipit pieni-chipit" role="group" aria-label="Aihe">${LUOKAT.map(([k, n]) => `<button type="button" class="chip" data-vl-luokka="${k}" aria-pressed="${k === luokka}">${n}</button>`).join("")}</div>
      <textarea name="teksti" rows="3" maxlength="4000" required placeholder="Esim. Kakkostilanteessa hän lyö vapaata kumuraa kolmosen luukkuun, ei koppia. Tai: termi 'purkaja' → 'kakkosen purku'."></textarea>
      <div class="rivi"><label class="pieni vl-pohja"><input type="checkbox" name="pohja"> Koskee kaikkia profiileja</label><button class="btn ensisij pieni-nappi" type="submit">Lisää</button></div>
    </form>
    <ol class="vl-lista" id="vl-lista"><li class="pieni">Ladataan…</li></ol>
  </section>`;
  const piirra = () => {
    const avoimet = lista.filter((v) => v.tila === "avoin").length;
    el.querySelector(".vl-lkm").textContent = avoimet;
    const jarj = [...lista].sort((a, b) => (a.tila !== "avoin") - (b.tila !== "avoin") || b.luotu.localeCompare(a.luotu));
    $("#vl-lista", el).innerHTML = jarj.map((v) => `<li class="vl-rivi tila-${v.tila}">
      <div class="vl-meta"><span class="vl-merkki tila-${v.tila}">${TILAT[v.tila]}</span><span class="vl-luokka">${esc(LN[v.luokka] || v.luokka)}${v.koskee_pohjaa ? " · kaikki profiilit" : ""}</span>
        <span class="pieni harmaa">${esc(kirjoittajanNimi(v.kirjoittaja))}, ${aikaSitten(v.luotu)}${v.versio ? ` · v${v.versio}` : ""}</span></div>
      <div class="vl-teksti">${esc(v.teksti)}</div>
      ${v.vastaus ? `<div class="vl-vastaus"><b>${v.tila === "korjattu" ? "Korjattu" : "Vastaus"}:</b> ${esc(v.vastaus)}</div>` : ""}
      <div class="vl-toiminnot">
        ${tila.admin ? (v.tila === "avoin"
          ? `<button class="linkkinappi" data-vl="korjattu" data-id="${v.id}">Merkitse korjatuksi</button><button class="linkkinappi" data-vl="ei_muutosta" data-id="${v.id}">Ei muutosta</button>`
          : `<button class="linkkinappi" data-vl="avoin" data-id="${v.id}">Avaa uudelleen</button>`) : ""}
        ${(v.kirjoittaja === omaEmail() && v.tila === "avoin") || tila.admin ? `<button class="linkkinappi" data-vl-poista="${v.id}">Poista</button>` : ""}
      </div></li>`).join("") || `<li class="tyhja">Ei vielä merkintöjä. Ensimmäinen havainto lisätään yllä.</li>`;
    $$("[data-vl]", el).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const { error } = await sb.from("profiili_vikalista").update({ tila: b.dataset.vl, kasitelty: b.dataset.vl === "avoin" ? null : new Date().toISOString() }).eq("id", b.dataset.id);
      if (error) { ilmoita(error.message, true); b.disabled = false; } else lataa();
    }));
    $$("[data-vl-poista]", el).forEach((b) => (b.onclick = async () => {
      if (!confirm("Poistetaanko merkintä?")) return;
      const { error } = await sb.from("profiili_vikalista").delete().eq("id", b.dataset.vlPoista);
      if (error) ilmoita(error.message, true); else lataa();
    }));
  };
  const f = $("#vl-lomake", el);
  $$("[data-vl-luokka]", f).forEach((b) => (b.onclick = () => { luokka = b.dataset.vlLuokka; $$("[data-vl-luokka]", f).forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
  f.teksti.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const teksti = f.teksti.value.trim(); if (!teksti) return;
    const pohja = f.pohja.checked;
    const nappi = f.querySelector("[type=submit]"); nappi.disabled = true;
    const { error } = await sb.from("profiili_vikalista").insert({ pelaaja_id: pelaaja.id, koskee_pohjaa: pohja, luokka, teksti, versio: profiili.versio });
    nappi.disabled = false;
    if (error) return ilmoita("Tallennus epäonnistui: " + error.message, true);
    f.teksti.value = ""; f.pohja.checked = false; ilmoita("Kiitos, merkintä lisätty"); lataa();
  };
  await lataa();
  poistuVikalista();
  kanava = sb.channel("vikalista-" + pelaaja.id).on("postgres_changes", { event: "*", schema: "public", table: "profiili_vikalista" }, () => { if (document.activeElement?.tagName !== "TEXTAREA") lataa(); }).subscribe();
}
