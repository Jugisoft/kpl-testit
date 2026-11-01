// Pelaajan oma Keskus (1.11.2026): #/oma (oma sivu) ja #/oma/<pelaaja_id> (valmentaja katsoo pelaajan sivua).
// Viikon ohjelma (valmentaja antaa pelaajalle tai koko ryhmälle, pelaaja kuittaa), tavoitteet (pelaaja ja valmentaja
// asettavat testeihin), omat testit, reaktioajat ja lyöntimissiot. Oikeudet rajataan tietokannassa (RLS).
import { sb, tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, pvmLyhyt, kausi, paras, parannus, testiParhaat, kuva, ilmoita, palkki } from "../util.js";
import { laske as laskeMissio } from "./lyonnit.js";

const PAIVA = 864e5;
const tanaan = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
const lisaaPv = (s, n) => new Date(new Date(s + "T12:00:00Z").getTime() + n * PAIVA).toISOString().slice(0, 10);
const maanantai = (s) => { const d = new Date(s + "T12:00:00Z"); return lisaaPv(s, -((d.getUTCDay() + 6) % 7)); };
function viikkoNro(s) { // ISO-viikko
  const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const v1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - v1) / PAIVA - 3 + ((v1.getUTCDay() + 6) % 7)) / 7);
}
const luku = (s) => { const x = parseFloat(String(s).replace(",", ".").replace(/\s/g, "")); return Number.isFinite(x) ? x : null; };
const omaEmail = () => (tila.istunto?.user?.email || "").toLowerCase();

let viikko = maanantai(tanaan());
let pid = null;

export async function nayta(main, id) {
  pid = id || tila.omaPelaaja || null;
  if (!pid || !tila.pelaaja[pid]) {
    if (tila.ohjaaja) return valitsePelaaja(main);
    main.innerHTML = `<h1>Oma Keskus</h1><p class="ingressi">Tunnustasi ei ole vielä liitetty pelaajaan. Pyydä ylläpitäjää liittämään se Hallinnassa, niin näet täällä omat testisi, tavoitteesi ja viikon ohjelman.</p>`;
    return;
  }
  await piirra(main);
}

function valitsePelaaja(main) {
  const ryhmat = tila.joukkueet.map((j) => [j, tila.pelaajat.filter((p) => p.joukkue_id === j.id && p.aktiivinen)]).filter(([, ps]) => ps.length);
  main.innerHTML = `<h1>Pelaajien oma Keskus</h1>
    <p class="ingressi">Valitse pelaaja, niin näet hänen sivunsa: viikon ohjelman, tavoitteet ja testit. Voit antaa ohjelmaa ja asettaa tavoitteita.</p>
    ${ryhmat.map(([j, ps]) => `<h2>${esc(j.nimi)}</h2><div class="oma-pelaajat">${ps.map((p) => `<a class="oma-pelaajalinkki" href="#/oma/${p.id}">${kuva(p)}<span>${esc(nimi(p))}</span></a>`).join("")}</div>`).join("")}`;
}

async function piirra(main) {
  const p = tila.pelaaja[pid];
  const oma = pid === tila.omaPelaaja;
  const joukkue = tila.joukkueet.find((j) => j.id === p.joukkue_id);
  const vkLoppu = lisaaPv(viikko, 6);

  const [kaikki, tav, ohj, missiot, kirjaukset] = await Promise.all([
    lataaTulokset().then(testiParhaat),
    sb.from("tavoitteet").select("*").eq("pelaaja_id", pid).order("luotu"),
    sb.from("ohjelma").select("*").eq("viikko", viikko).or(`pelaaja_id.eq.${pid},joukkue_id.eq.${p.joukkue_id}`).order("jarjestys").order("luotu"),
    oma ? sb.from("lyonti_missiot").select("*").eq("omistaja", omaEmail()).eq("arkistoitu", false) : Promise.resolve({ data: [] }),
    oma ? sb.from("lyonti_kirjaukset").select("*").eq("omistaja", omaEmail()) : Promise.resolve({ data: [] }),
  ]);
  const ohjelma = ohj.data || [];
  const kuit = ohjelma.length ? (await sb.from("ohjelma_kuittaukset").select("*").eq("pelaaja_id", pid).in("ohjelma_id", ohjelma.map((o) => o.id))).data || [] : [];
  const tehdyt = new Set(kuit.map((k) => k.ohjelma_id));

  const omat = kaikki.filter((x) => x.pelaaja === pid && tila.testi[x.testi]);
  const testit = [...new Set(omat.map((x) => x.testi))].sort((a, b) => tila.testi[a].jarjestys - tila.testi[b].jarjestys);
  const nykKausi = kausi(tanaan());
  const kortti = (t) => {
    const a = omat.filter((x) => x.testi === t);
    const viim = a.at(-1), edel = a.at(-2);
    const kaudella = a.filter((x) => kausi(x.pvm) === nykKausi);
    return { t, viim, edel, pb: paras(t, a.map((x) => x.arvo)), kausiParas: kaudella.length ? paras(t, kaudella.map((x) => x.arvo)) : null, sarja: a };
  };
  const normaalit = testit.filter((t) => !t.startsWith("rk_")).map(kortti).sort((a, b) => b.viim.pvm.localeCompare(a.viim.pvm));
  const reaktiot = testit.filter((t) => t.startsWith("rk_")).map(kortti);

  const valmiit = ohjelma.filter((o) => tehdyt.has(o.id)).length;
  const otsikko = oma ? `Hei, ${esc(p.etunimi)}` : esc(nimi(p));

  main.innerHTML = `
    <div class="oma-paa">
      ${kuva(p, true)}
      <div style="flex:1;min-width:0">
        <p class="oma-yla">${oma ? "Oma Keskus" : "Pelaajan oma Keskus"}</p>
        <h1>${otsikko}</h1>
        <div class="tagit">
          ${joukkue ? `<span>Ryhmä<b>${esc(joukkue.nimi)}</b></span>` : ""}
          <span>Viikko<b>${viikkoNro(viikko)}</b></span>
          <span>Ohjelma<b>${valmiit}/${ohjelma.length}</b></span>
          <span>Tavoitteita<b>${(tav.data || []).length}</b></span>
        </div>
      </div>
      <div class="oma-linkit">
        ${!oma && tila.ohjaaja ? `<a class="btn" href="#/oma">Vaihda pelaajaa</a>` : ""}
        <a class="btn" href="#/pelaaja/${pid}">Pelaajakortti</a>
      </div>
    </div>

    <div class="oma-ruudukko">
      <section class="paneeli oma-ohjelma" aria-labelledby="oh-otsikko">
        <div class="oma-osa-paa">
          <div><h2 id="oh-otsikko">Viikon ohjelma</h2><p class="pieni">Viikko ${viikkoNro(viikko)} · ${pvmLyhyt(viikko)}–${pvmLyhyt(vkLoppu)}${viikko === maanantai(tanaan()) ? " · tämä viikko" : ""}</p></div>
          <div class="rivi"><button class="btn oma-nuoli" data-vk="-7" aria-label="Edellinen viikko">‹</button><button class="btn oma-nuoli" data-vk="0" aria-label="Tämä viikko">Nyt</button><button class="btn oma-nuoli" data-vk="7" aria-label="Seuraava viikko">›</button></div>
        </div>
        ${ohjelma.length ? `<div class="oma-edistys">${palkki((100 * valmiit) / ohjelma.length)}<span class="num">${valmiit}/${ohjelma.length} tehty</span></div>` : ""}
        <ol class="oma-lista">${ohjelma.map((o) => `
          <li class="oma-harjoite${tehdyt.has(o.id) ? " tehty" : ""}">
            ${oma ? `<button class="oma-kuittaus" data-kuittaa="${o.id}" aria-pressed="${tehdyt.has(o.id)}" aria-label="${tehdyt.has(o.id) ? "Palauta tekemättömäksi" : "Merkitse tehdyksi"}: ${esc(o.otsikko)}"><span aria-hidden="true">✓</span></button>`
                  : `<span class="oma-kuittaus staattinen" aria-label="${tehdyt.has(o.id) ? "Tehty" : "Ei vielä tehty"}"><span aria-hidden="true">${tehdyt.has(o.id) ? "✓" : ""}</span></span>`}
            <div class="oma-harjoite-teksti">
              <div class="rivi" style="gap:8px"><b>${esc(o.otsikko)}</b>${o.maara ? `<span class="oma-maara">${esc(o.maara)}</span>` : ""}${o.joukkue_id ? `<span class="oma-tag">koko ryhmä</span>` : ""}</div>
              ${o.kuvaus ? `<p class="pieni">${esc(o.kuvaus)}</p>` : ""}
            </div>
            ${tila.ohjaaja ? `<button class="linkkinappi" data-poista-ohj="${o.id}" aria-label="Poista harjoite ${esc(o.otsikko)}">Poista</button>` : ""}
          </li>`).join("") || `<li class="tyhja">Tälle viikolle ei ole vielä ohjelmaa.</li>`}</ol>
        ${tila.ohjaaja ? `
        <form id="ohj-uusi" class="oma-lomake">
          <h3>Lisää harjoite viikolle ${viikkoNro(viikko)}</h3>
          <div class="oma-kentat">
            <label class="kentta">Harjoite<input type="text" name="otsikko" required maxlength="120" placeholder="esim. Kärkilähdöt 1-pesältä"></label>
            <label class="kentta">Määrä<input type="text" name="maara" maxlength="60" placeholder="esim. 3 × 10"></label>
          </div>
          <label class="kentta">Ohje<textarea name="kuvaus" rows="2" maxlength="1000" placeholder="valinnainen"></textarea></label>
          <div class="rivi">
            <label class="chip"><input type="radio" name="kohde" value="pelaaja" checked>Vain ${esc(p.etunimi)}</label>
            <label class="chip"><input type="radio" name="kohde" value="ryhma">Koko ryhmä${joukkue ? ` (${esc(joukkue.nimi)})` : ""}</label>
            <button class="btn ensisij">Lisää</button>
          </div>
        </form>` : ""}
      </section>

      <section class="paneeli oma-tavoitteet" aria-labelledby="tav-otsikko">
        <div class="oma-osa-paa"><h2 id="tav-otsikko">Tavoitteet</h2></div>
        <div id="tav-lista">${tavoitteet(tav.data || [], omat)}</div>
        <form id="tav-uusi" class="oma-lomake">
          <h3>Uusi tavoite</h3>
          <div class="oma-kentat">
            <label class="kentta">Testi<select name="testi" required>${testiValinnat(testit)}</select></label>
            <label class="kentta">Tavoite<input type="text" name="arvo" required inputmode="decimal" placeholder="esim. 4,20"></label>
            <label class="kentta">Mennessä<input name="takaraja" type="date"></label>
          </div>
          <div class="rivi"><span class="pieni" id="tav-yks"></span><button class="btn ensisij">Lisää tavoite</button></div>
        </form>
      </section>
    </div>

    <section aria-labelledby="testit-otsikko">
      <div class="oma-osa-paa"><h2 id="testit-otsikko">${oma ? "Minun testini" : "Testit"}</h2><a class="pieni" href="#/pelaaja/${pid}">Kaikki tulokset pelaajakortilla</a></div>
      ${normaalit.length ? `<div class="kpi-rivi">${normaalit.slice(0, 12).map(testiKortti).join("")}</div>` : `<p class="tyhja">Ei vielä testituloksia.</p>`}
    </section>

    ${reaktiot.length ? `<section aria-labelledby="rk-otsikko"><div class="oma-osa-paa"><h2 id="rk-otsikko">Reaktio ja lähtö</h2><span class="pieni">päivän mediaani, ms</span></div><div class="kpi-rivi">${reaktiot.map(testiKortti).join("")}</div></section>` : ""}

    ${oma ? `<section aria-labelledby="ly-otsikko"><div class="oma-osa-paa"><h2 id="ly-otsikko">Lyöntimissiot</h2><a class="pieni" href="#/lyonnit">Lyöntipäiväkirjaan</a></div>
      ${(missiot.data || []).length ? `<div class="oma-missiot">${(missiot.data || []).map((m) => missio(m, kirjaukset.data || [])).join("")}</div>` : `<p class="tyhja">Ei käynnissä olevia missioita. <a href="#/lyonnit">Aloita missio</a></p>`}</section>` : ""}`;

  // --- tapahtumat ---
  $$("[data-vk]", main).forEach((b) => (b.onclick = () => { const n = +b.dataset.vk; viikko = n ? lisaaPv(viikko, n) : maanantai(tanaan()); piirra(main); }));
  $$("[data-kuittaa]", main).forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const id = b.dataset.kuittaa, onTehty = b.getAttribute("aria-pressed") === "true";
    const { error } = onTehty
      ? await sb.from("ohjelma_kuittaukset").delete().eq("ohjelma_id", id).eq("pelaaja_id", pid)
      : await sb.from("ohjelma_kuittaukset").insert({ ohjelma_id: id, pelaaja_id: pid });
    if (error) { ilmoita("Kuittaus ei onnistunut: " + error.message, true); b.disabled = false; return; }
    piirra(main);
  }));
  $$("[data-poista-ohj]", main).forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from("ohjelma").delete().eq("id", b.dataset.poistaOhj);
    if (error) ilmoita("Poisto ei onnistunut: " + error.message, true); else piirra(main);
  }));
  const fo = $("#ohj-uusi", main);
  if (fo) fo.onsubmit = async (e) => {
    e.preventDefault();
    const f = fo.elements, ryhma = f.kohde.value === "ryhma";
    const rivi = { viikko, otsikko: f.otsikko.value.trim(), maara: f.maara.value.trim() || null, kuvaus: f.kuvaus.value.trim() || null, jarjestys: ohjelma.length,
      pelaaja_id: ryhma ? null : pid, joukkue_id: ryhma ? p.joukkue_id : null };
    if (!rivi.otsikko) return;
    const { error } = await sb.from("ohjelma").insert(rivi);
    if (error) { ilmoita("Tallennus ei onnistunut: " + error.message, true); return; }
    ilmoita(ryhma ? "Harjoite lisätty koko ryhmälle" : "Harjoite lisätty");
    piirra(main);
  };
  const ft = $("#tav-uusi", main);
  const yks = () => { const T = tila.testi[ft.elements.testi.value]; $("#tav-yks", main).textContent = T ? `${T.yksikko} · ${T.pienempi_parempi ? "pienempi on parempi" : "suurempi on parempi"}` : ""; };
  ft.elements.testi.onchange = yks; yks();
  ft.onsubmit = async (e) => {
    e.preventDefault();
    const f = ft.elements, arvo = luku(f.arvo.value);
    if (arvo == null) { ilmoita("Kirjoita tavoite numerona, esim. 4,20", true); return; }
    const { error } = await sb.from("tavoitteet").insert({ pelaaja_id: pid, testi: f.testi.value, arvo, takaraja: f.takaraja.value || null });
    if (error) { ilmoita("Tallennus ei onnistunut: " + error.message, true); return; }
    ilmoita("Tavoite lisätty"); piirra(main);
  };
  $$("[data-poista-tav]", main).forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from("tavoitteet").delete().eq("id", b.dataset.poistaTav);
    if (error) ilmoita("Poisto ei onnistunut: " + error.message, true); else piirra(main);
  }));
}

function testiValinnat(omatTestit) {
  const kaikki = tila.testit.filter((t) => !t.johdettu && t.aktiivinen !== false);
  const ensin = kaikki.filter((t) => omatTestit.includes(t.koodi)), muut = kaikki.filter((t) => !omatTestit.includes(t.koodi));
  const opt = (t) => `<option value="${t.koodi}">${esc(t.nimi)}</option>`;
  return (ensin.length ? `<optgroup label="Testatut">${ensin.map(opt).join("")}</optgroup>` : "") + `<optgroup label="Muut testit">${muut.map(opt).join("")}</optgroup>`;
}

// Tavoitteen eteneminen: lähtötaso = paras tulos ennen tavoitteen asettamista (tai ensimmäinen tulos), nyt = paras sen jälkeen
function tavoitteet(rivit, omat) {
  if (!rivit.length) return `<p class="tyhja">Ei vielä tavoitteita. Aseta ensimmäinen alla.</p>`;
  return `<ul class="oma-tav">${rivit.map((g) => {
    const T = tila.testi[g.testi]; if (!T) return "";
    const a = omat.filter((x) => x.testi === g.testi), raja = g.luotu.slice(0, 10);
    const ennen = a.filter((x) => x.pvm < raja), jalkeen = a.filter((x) => x.pvm >= raja);
    const lahto = ennen.length ? paras(g.testi, ennen.map((x) => x.arvo)) : a[0]?.arvo ?? null;
    const nyt = a.length ? paras(g.testi, (jalkeen.length ? jalkeen : a).map((x) => x.arvo)) : null;
    const saavutettu = nyt != null && parannus(g.testi, nyt, g.arvo) >= 0;
    const matka = lahto != null ? parannus(g.testi, g.arvo, lahto) : null;
    const pct = saavutettu ? 100 : lahto != null && nyt != null && matka > 0 ? Math.max(0, Math.min(100, (100 * parannus(g.testi, nyt, lahto)) / matka)) : 0;
    const puuttuu = nyt != null && !saavutettu ? Math.abs(nyt - g.arvo) : null;
    const voi = g.asettaja === omaEmail() || tila.ohjaaja || g.pelaaja_id === tila.omaPelaaja;
    return `<li class="${saavutettu ? "saavutettu" : ""}">
      <div class="rivi vali"><b>${esc(T.nimi)}</b><span class="oma-tav-arvo num">${saavutettu ? "✓ " : ""}${muotoile(g.arvo, g.testi)}<small> ${esc(T.yksikko)}</small></span></div>
      ${palkki(pct)}
      <div class="rivi vali pieni">
        <span>${lahto != null ? `Lähtötaso ${muotoile(lahto, g.testi)} · nyt ${muotoile(nyt, g.testi)}` : "Ei vielä tuloksia"}${puuttuu != null ? ` · puuttuu ${muotoile(puuttuu, g.testi)}` : ""}${saavutettu ? " · saavutettu" : ""}</span>
        <span>${g.takaraja ? `${pvm(g.takaraja)} mennessä · ` : ""}${voi ? `<button class="linkkinappi" data-poista-tav="${g.id}" aria-label="Poista tavoite ${esc(T.nimi)}">Poista</button>` : ""}</span>
      </div></li>`;
  }).join("")}</ul>`;
}

function testiKortti(x) {
  const T = tila.testi[x.t], muutos = x.edel ? parannus(x.t, x.viim.arvo, x.edel.arvo) : null;
  const nimiT = x.t === "nok_30m" ? "9×30 m, keskiarvo" : T.nimi;
  return `<a class="kpi lukema oma-testi" href="#/pelaaja/${pid}">
    <div class="otsikko">${esc(nimiT)}</div>
    <div><div class="arvo">${muotoile(x.pb, x.t)}<small>${esc(T.yksikko)}</small></div><div class="pieni">ennätys${x.kausiParas != null ? ` · kausi ${muotoile(x.kausiParas, x.t)}` : ""}</div></div>
    <div class="ala">Viimeisin ${muotoile(x.viim.arvo, x.t)} <span class="pieni">${pvmLyhyt(x.viim.pvm)}</span>${muutos != null ? ` <span class="${muutos > 0 ? "pb" : muutos < 0 ? "huono" : ""}">${muotoileMuutos(x.viim.arvo - x.edel.arvo, x.t)}</span>` : ""}</div>
  </a>`;
}

function missio(m, kirjaukset) {
  const s = laskeMissio(m, kirjaukset);
  return `<a class="paneeli oma-missio" href="#/lyonnit">
    <div class="rivi vali"><b>${esc(m.nimi || m.laji)}</b><span class="num">${Math.round(s.tehty).toLocaleString("fi-FI")} / ${m.tavoite.toLocaleString("fi-FI")}</span></div>
    ${palkki(s.pct)}
    <p class="pieni">${s.valmis ? "Valmis" : s.ero >= 0 ? `Edellä tahdista ${Math.round(s.ero)}` : `Jäljessä tahdista ${Math.round(-s.ero)}`} · päättyy ${pvm(m.loppu)}</p>
  </a>`;
}
