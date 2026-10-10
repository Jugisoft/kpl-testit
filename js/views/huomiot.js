// Huomiot ja tietopankki: valmennuksen havainnot, AI-sparraus ja aihekohtaiset koosteet.
import { sb } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { LUOKAT, TILAT, JOUKKUEET, haeHuomiot, kommenttimaarat, haeKoosteet, tallennaHuomio, lataaNimet, kirjoittajanNimi, aikaSitten, md, luokkaMerkki } from "../keskus.js";

const suodatin = { luokka: "", vastustaja: "", tila: "avoimet", haku: "", nakyma: "huomiot" };
let kanava = null;

export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

export async function nayta(main) {
  await lataaNimet();
  const [huomiot, maarat, koosteet] = await Promise.all([haeHuomiot(), kommenttimaarat(), haeKoosteet()]);

  main.innerHTML = `
    <div class="sivu-paa">
      <div>
        <h1>Huomiot</h1>
        <p class="ingressi">Havainnot, ideat ja kysymykset omasta pelistä ja vastustajista. Jokainen huomio menee AI-sparraajalle, joka kommentoi sen ja päivittää aiheen koosteen tietopankkiin.</p>
      </div>
      <button class="btn ensisij" id="uusi-nappi">Uusi huomio</button>
    </div>
    <form id="uusi" class="paneeli huomiolomake" hidden>${lomake()}</form>

    <div class="valilehdet" role="tablist">
      <button role="tab" class="valilehti" data-n="huomiot" aria-selected="${suodatin.nakyma === "huomiot"}">Kaikki huomiot <span class="lkm">${huomiot.length}</span></button>
      <button role="tab" class="valilehti" data-n="tietopankki" aria-selected="${suodatin.nakyma === "tietopankki"}">Tietopankki <span class="lkm">${koosteet.length}</span></button>
    </div>
    <div id="nakyma"></div>`;

  kytkeLomake($("#uusi"), async (h) => { location.hash = `#/huomio/${h.id}`; });
  $("#uusi-nappi").onclick = () => { const f = $("#uusi"); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("[name=otsikko]").focus(); };
  $$(".valilehti", main).forEach((b) => (b.onclick = () => {
    suodatin.nakyma = b.dataset.n;
    $$(".valilehti", main).forEach((x) => x.setAttribute("aria-selected", x === b));
    piirra();
  }));

  const piirra = () => (suodatin.nakyma === "tietopankki" ? piirraKoosteet($("#nakyma"), koosteet, huomiot) : piirraLista($("#nakyma"), huomiot, maarat));
  piirra();

  poistu();
  kanava = sb.channel("huomiot-lista")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "huomiot" }, (m) => {
      if (huomiot.some((x) => x.id === m.new.id)) return;
      huomiot.unshift(m.new);
      if (suodatin.nakyma === "huomiot") piirra();
    }).subscribe();
}

export function lomake(oletus = {}) {
  return `
    <div class="lomake-rivi">
      <label class="kentta laaja">Otsikko
        <input type="text" name="otsikko" required maxlength="160" placeholder="Esim. ViVen lukkari syöttää kolmannella lyönnillä aina väärän" value="${esc(oletus.otsikko || "")}"></label>
    </div>
    <label class="kentta">Mitä huomasit tai mitä pitäisi pohtia
      <textarea name="teksti" rows="5" maxlength="8000" placeholder="Kirjoita vapaasti. Kerro tilanne, kuka huomasi ja mistä ottelusta tai videosta on kyse.">${esc(oletus.teksti || "")}</textarea></label>
    <div class="lomake-rivi">
      <label class="kentta">Aihe
        <select name="luokka">${Object.entries(LUOKAT).map(([k, v]) => `<option value="${k}"${(oletus.luokka || "idea") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="kentta">Vastustaja
        <select name="vastustaja"><option value="">–</option>${JOUKKUEET.map((j) => `<option${oletus.vastustaja === j ? " selected" : ""}>${j}</option>`).join("")}</select></label>
      <label class="kentta">Keneltä tieto tuli
        <input type="text" name="lahde" maxlength="120" placeholder="Esim. pelaaja, video 12.6., oma havainto" value="${esc(oletus.lahde || "")}"></label>
    </div>
    <div class="rivi"><button class="btn ensisij" type="submit">Tallenna huomio</button><span class="pieni">AI-sparraaja kommentoi tallennetun huomion muutamassa sekunnissa.</span></div>`;
}

export function kytkeLomake(form, valmis) {
  const luokka = form.querySelector("[name=luokka]"), vast = form.querySelector("[name=vastustaja]");
  vast.onchange = () => { if (vast.value && luokka.value === "idea") luokka.value = "vastustaja"; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    if (f.get("luokka") === "vastustaja" && !f.get("vastustaja")) { ilmoita("Valitse vastustaja.", true); vast.focus(); return; }
    const nappi = form.querySelector("[type=submit]");
    nappi.disabled = true;
    try {
      const h = await tallennaHuomio({ otsikko: f.get("otsikko"), teksti: f.get("teksti"), luokka: f.get("luokka"), vastustaja: f.get("vastustaja"), lahde: f.get("lahde") });
      ilmoita("Huomio tallennettu");
      form.reset();
      await valmis(h);
    } catch (err) {
      ilmoita("Tallennus epäonnistui: " + err.message, true);
    } finally { nappi.disabled = false; }
  };
}

function piirraLista(el, huomiot, maarat) {
  const vastustajat = [...new Set(huomiot.map((h) => h.vastustaja).filter(Boolean))].sort();
  el.innerHTML = `
    <div class="rivi suodattimet">
      <input type="search" id="haku" placeholder="Hae huomioista" value="${esc(suodatin.haku)}">
      <select id="s-luokka"><option value="">Kaikki aiheet</option>${Object.entries(LUOKAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <select id="s-vast"><option value="">Kaikki vastustajat</option>${vastustajat.map((v) => `<option>${esc(v)}</option>`).join("")}</select>
      <select id="s-tila"><option value="avoimet">Avoimet</option><option value="">Kaikki tilat</option>${Object.entries(TILAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
    </div>
    <ol class="huomiolista" id="lista"></ol>`;
  $("#s-luokka").value = suodatin.luokka; $("#s-vast").value = suodatin.vastustaja; $("#s-tila").value = suodatin.tila;
  const paivita = () => {
    const q = suodatin.haku.toLowerCase();
    const lista = huomiot.filter((h) =>
      (!suodatin.luokka || h.luokka === suodatin.luokka) &&
      (!suodatin.vastustaja || h.vastustaja === suodatin.vastustaja) &&
      (suodatin.tila === "" || (suodatin.tila === "avoimet" ? h.tila !== "arkisto" : h.tila === suodatin.tila)) &&
      (!q || (h.otsikko + " " + h.teksti + " " + (h.lahde || "")).toLowerCase().includes(q)));
    $("#lista").innerHTML = lista.map((h) => huomioRivi(h, maarat.get(h.id))).join("") ||
      `<li class="tyhja">${huomiot.length ? "Ei huomioita näillä ehdoilla." : "Ei vielä yhtään huomiota. Kirjaa ensimmäinen yläreunan napista."}</li>`;
  };
  $("#haku").oninput = (e) => { suodatin.haku = e.target.value; paivita(); };
  $("#s-luokka").onchange = (e) => { suodatin.luokka = e.target.value; paivita(); };
  $("#s-vast").onchange = (e) => { suodatin.vastustaja = e.target.value; paivita(); };
  $("#s-tila").onchange = (e) => { suodatin.tila = e.target.value; paivita(); };
  paivita();
}

export function huomioRivi(h, m) {
  const ote = (h.teksti || "").replace(/[*`#]/g, "").replace(/^\s*[-*]\s+/gm, "").replace(/\s+/g, " ").slice(0, 180);
  return `<li><a class="huomio-rivi tila-${esc(h.tila)}" href="#/huomio/${h.id}">
    <div class="h-paa">${luokkaMerkki(h)}${h.tila !== "uusi" ? `<span class="tilamerkki">${esc(TILAT[h.tila])}</span>` : ""}</div>
    <strong class="h-otsikko">${esc(h.otsikko)}</strong>
    ${ote ? `<span class="h-ote">${esc(ote)}${h.teksti.length > 180 ? "…" : ""}</span>` : ""}
    <span class="h-meta">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}${m ? `<span class="h-kommentit" title="Kommentteja">${m.n} ${m.n === 1 ? "kommentti" : "kommenttia"}${m.ai ? ", AI mukana" : ""}</span>` : h.ai_tila === "odottaa" ? `<span class="h-kommentit odottaa">AI miettii…</span>` : ""}</span>
  </a></li>`;
}

function piirraKoosteet(el, koosteet, huomiot) {
  if (!koosteet.length) {
    el.innerHTML = `<div class="paneeli tyhja-iso"><h2>Tietopankki on vielä tyhjä</h2><p>Kun valmennus kirjaa huomioita, AI-sparraaja kokoaa niistä jokaiselle aiheelle ja vastustajalle oman koosteen: mitä tiedetään, mitkä ovat hypoteesit ja mitä pitäisi kirjata seuraavaksi.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="koosteet">${koosteet.map((k) => {
    const lkm = k.aihe.startsWith("vastustaja:") ? huomiot.filter((h) => h.vastustaja === k.aihe.slice(11)).length : huomiot.filter((h) => h.luokka === k.aihe && !(h.luokka === "vastustaja" && h.vastustaja)).length;
    return `<details class="kooste paneeli"${koosteet.length <= 3 ? " open" : ""}>
      <summary><span class="k-otsikko">${esc(k.otsikko)}</span><span class="pieni">${lkm} ${lkm === 1 ? "huomio" : "huomiota"} · päivitetty ${aikaSitten(k.paivitetty)}</span></summary>
      <div class="md">${md(k.sisalto)}</div>
    </details>`;
  }).join("")}</div>
  <p class="vihje">Koosteet kirjoittaa AI-sparraaja huomioiden perusteella. Ne ovat työkalu ajatteluun, eivät faktaa: tarkista aina alkuperäisestä huomiosta.</p>`;
}
