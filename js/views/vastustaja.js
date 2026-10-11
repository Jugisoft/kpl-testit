// Vastustajan purku: sisäpeli pelaajittain ja tilanteittain (roolit + lyönnit),
// ulkopeli kollektiivisesti tilanteittain (fläppitaulu, yhteinen kuvaus, havainnot).
import { sb } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { tallennaMuistiinpano, kirjoittajanNimi, aikaSitten, md, sukunimiJarjestys, haeSiirtomarkkinat, omaEmail } from "../keskus.js";
import { kenttaSvg, kenttaPiste, TILANTEET, LYONTITYYPIT, TULOKSET, ROOLIT, PAINOT, tyyppiTieto } from "../kentta.js";
import { chipit, kytkeChipit, T, PALOT, LYONNIT, voiPoistaa, nimiTaulu } from "./vpelaaja.js";
import { kortti, kytkeKortit, kontekstinHuomiot } from "./muistio.js";
import { piirraFlappi, onLuonnosta } from "./flappi.js";
import { kuvaKehys, kytkeKuva } from "../pelaajakuva.js";

// Välimuisti valitun joukkueen rakenteisista kirjauksista, jaetuista teksteistä ja Pelikirjan kuvioista
const V = { joukkue: null, kirj: [], tekstit: new Map(), kuviot: [], nimi: "" };
// Valinnat säilyvät uudelleenpiirroissa
const s = { pelaaja: "", tilanne: "", roolitila: false };
const lyv = { pelaaja: "", tilanne: "", palot: "", lyonti: "", tyyppi: "", tulos: "", piste: null };
let ulkoTilanne = "Yleinen";

export const SARAKKEET = [...TILANTEET, "Jokeri"];
const lyhyt = (t) => ({ "Ajolähtö (1–2–3)": "Ajo" }[t] || t.replace("-tilanne", ""));

export function nollaaVastustaja() { V.joukkue = null; }

export async function lataaVastustaja(joukkue) {
  if (V.joukkue === joukkue) return;
  if (V.joukkue !== null && V.joukkue !== joukkue) { s.pelaaja = ""; lyv.pelaaja = ""; s.roolitila = false; }
  const [kirj, tekstit, kuviot, sm] = await Promise.all([
    sb.from("huomiot").select("*").eq("vastustaja", joukkue).in("tyyppi", ["lyonti", "ulkopeli"]).order("luotu", { ascending: false }).limit(5000),
    sb.from("vastustaja_tekstit").select("*").eq("joukkue", joukkue),
    sb.from("vastustaja_kuviot").select("*").eq("joukkue", joukkue),
    haeSiirtomarkkinat().catch(() => null),
  ]);
  if (kirj.error) throw kirj.error;
  V.joukkue = joukkue;
  V.kirj = kirj.data || [];
  V.tekstit = new Map((tekstit.data || []).map((t) => [t.avain, t]));
  V.nimi = sm?.joukkueiden_nimet?.[joukkue] || joukkue;
  V.kuviot = kuviot.data || [];
}

// Realtime: muistion kanava välittää muutokset tänne
export function vastustajaMuutos(taulu, m) {
  if (!V.joukkue) return;
  if (taulu === "vastustaja_kuviot") {
    const r = m.eventType === "DELETE" ? m.old : m.new;
    if (m.eventType === "DELETE") { V.kuviot = V.kuviot.filter((k) => k.id !== r.id); return; }
    if (r.joukkue !== V.joukkue) return;
    const i = V.kuviot.findIndex((k) => k.id === r.id);
    if (i >= 0) V.kuviot[i] = r; else V.kuviot.push(r);
    return;
  }
  if (taulu === "vastustaja_tekstit") {
    const r = m.new?.joukkue ? m.new : m.old;
    if (r?.joukkue !== V.joukkue) return;
    if (m.eventType === "DELETE") V.tekstit.delete(r.avain); else V.tekstit.set(r.avain, r);
    return;
  }
  if (m.eventType === "DELETE") { V.kirj = V.kirj.filter((x) => x.id !== m.old.id); return; }
  const h = m.new;
  if (h.vastustaja !== V.joukkue || !["lyonti", "ulkopeli"].includes(h.tyyppi)) return;
  const i = V.kirj.findIndex((x) => x.id === h.id);
  if (i >= 0) V.kirj[i] = h; else V.kirj.unshift(h);
}
export { onLuonnosta };
export const lyontienMaara = (joukkue) => (V.joukkue === joukkue ? V.kirj.filter((h) => h.tyyppi === "lyonti").length : 0);

// --- Jaettu, kaikkien muokattava teksti (sisäpelin yleiskuva, ulkopeli tilanteittain)
function tekstiLohko(avain, otsikko, ohje) {
  const t = V.tekstit.get(avain);
  return `<section class="jaettu-teksti" data-avain="${esc(avain)}">
    <div class="jt-paa"><h2>${esc(otsikko)}</h2>
      ${t?.teksti ? `<span class="pieni">${esc(kirjoittajanNimi(t.muokkaaja))}, ${aikaSitten(t.muokattu)}</span>` : ""}
      <button class="linkkinappi" data-jt="muokkaa">${t?.teksti ? "Muokkaa" : "Kirjoita"}</button></div>
    <div class="jt-sisalto">${t?.teksti ? `<div class="md">${md(t.teksti)}</div>` : `<p class="jt-tyhja">${esc(ohje)}</p>`}</div>
  </section>`;
}

function kytkeTekstit(el, piirra) {
  $$(".jaettu-teksti", el).forEach((lohko) => {
    const avain = lohko.dataset.avain;
    lohko.querySelector("[data-jt=muokkaa]").onclick = () => {
      const alku = V.tekstit.get(avain);
      const sis = lohko.querySelector(".jt-sisalto");
      sis.innerHTML = `<textarea class="m-muokkaus" rows="${Math.min(16, Math.max(5, (alku?.teksti || "").split("\n").length + 2))}" placeholder="${esc(lohko.querySelector(".jt-tyhja")?.textContent || "")}">${esc(alku?.teksti || "")}</textarea>
        <div class="rivi"><button class="btn ensisij pieni-nappi" data-jt="tallenna">Tallenna</button><button class="btn pieni-nappi" data-jt="peru">Peru</button><span class="pieni">Kaikki valmentajat näkevät ja voivat muokata. Ctrl + Enter tallentaa.</span></div>`;
      lohko.querySelector("[data-jt=muokkaa]").hidden = true;
      const ta = sis.querySelector("textarea"); ta.focus();
      const tallenna = async () => {
        const { data: nyt } = await sb.from("vastustaja_tekstit").select("*").eq("joukkue", V.joukkue).eq("avain", avain).maybeSingle();
        if (nyt && nyt.muokattu !== alku?.muokattu && nyt.muokkaaja !== omaEmail() &&
          !confirm(`${kirjoittajanNimi(nyt.muokkaaja)} muokkasi tätä tekstiä sillä aikaa (${aikaSitten(nyt.muokattu)}). Korvataanko hänen versionsa omallasi?`)) return;
        const { data, error } = await sb.from("vastustaja_tekstit").upsert({ joukkue: V.joukkue, avain, teksti: ta.value.trim() }).select().single();
        if (error) return ilmoita("Tallennus epäonnistui: " + error.message, true);
        V.tekstit.set(avain, data); ilmoita("Tallennettu"); piirra();
      };
      ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); tallenna(); } if (e.key === "Escape") piirra(); };
      sis.querySelector("[data-jt=tallenna]").onclick = tallenna;
      sis.querySelector("[data-jt=peru]").onclick = piirra;
    };
  });
}

// ======================= SISÄPELI =======================
// Valitaan pelaaja pomppuvalikosta: kuva ja tiedot (roolit, mitä lyö tilanteittain). "Koko joukkue" näyttää roolitaulukon.
export function piirraSisapeli(el, pelaajat) {
  const piirra = () => piirraSisapeli(el, pelaajat);
  const joukkue = V.joukkue;
  const kaikki = [...pelaajat.values()].filter((p) => p.joukkue === joukkue).sort(sukunimiJarjestys);
  const akt = kaikki.filter((p) => p.aktiivinen);
  const lyonnit = V.kirj.filter((h) => h.tyyppi === "lyonti");
  if (s.pelaaja && !pelaajat.has(s.pelaaja)) s.pelaaja = "";
  // Valikossa ja taulukossa myös ne, joilla on kirjauksia vaikka eivät ole kokoonpanossa
  const rivit = [...akt, ...kaikki.filter((p) => !p.aktiivinen && lyonnit.some((h) => h.pelaaja_id === p.id))];
  const TY = nimiTaulu(LYONTITYYPIT), TU = nimiTaulu(TULOKSET);
  const valittuP = s.pelaaja ? pelaajat.get(s.pelaaja) : null;
  const omat = valittuP ? lyonnit.filter((h) => h.pelaaja_id === valittuP.id) : lyonnit;
  const suodatetut = omat.filter((h) => !s.tilanne || h.tiedot?.tilanne === s.tilanne);
  const roolissa = s.tilanne ? rivit.filter((p) => (p.roolit || []).includes(s.tilanne)) : [];
  const pnimi = (h) => pelaajat.get(h.pelaaja_id)?.nimi || "";
  const nro = (p) => (p.numero != null ? `${p.numero} ` : "");
  const roolitLyhyt = (p) => (p.roolit || []).filter((r) => SARAKKEET.includes(r)).map(lyhyt).join(", ");
  const pelaajaValinta = (nimi, arvo, tyhja, roolit = false) => `<select name="${nimi}" id="${nimi}"><option value="">${tyhja}</option>${akt.map((p) => `<option value="${p.id}"${p.id === arvo ? " selected" : ""}>${esc(nro(p) + p.nimi)}${roolit && roolitLyhyt(p) ? ` · ${esc(roolitLyhyt(p))}` : ""}</option>`).join("")}${
    kaikki.filter((p) => !p.aktiivinen).length ? `<optgroup label="Ei kokoonpanossa">${kaikki.filter((p) => !p.aktiivinen).map((p) => `<option value="${p.id}"${p.id === arvo ? " selected" : ""}>${esc(p.nimi)}</option>`).join("")}</optgroup>` : ""}</select>`;

  const solu = (p, t) => {
    const hs = lyonnit.filter((h) => h.pelaaja_id === p.id && h.tiedot?.tilanne === t);
    const rooli = (p.roolit || []).includes(t);
    const lask = {}; hs.forEach((h) => { const k = h.tiedot?.tyyppi; if (k) lask[k] = (lask[k] || 0) + 1; });
    const ylin = Object.entries(lask).sort((a, b) => b[1] - a[1])[0];
    const otsikko = `${p.nimi}, ${t}${rooli ? " (suunniteltu rooli)" : ""}${hs.length ? `: ${hs.length} lyöntiä${ylin ? `, yleisin ${TY[ylin[0]]}` : ""}` : ""}`;
    return `<td class="rm-solu${rooli ? " rooli" : ""}"><button type="button" data-p="${p.id}" data-t="${esc(t)}" title="${esc(otsikko)}" aria-label="${esc(otsikko)}">
      ${hs.length ? `<span class="num">${hs.length}</span>${ylin ? `<span class="pallura" style="background:${tyyppiTieto(ylin[0])?.[2]}"></span>` : ""}` : rooli ? `<span class="rm-merkki">rooli</span>` : ""}</button></td>`;
  };

  // Pelaajan profiili: lyhyt yhteenveto tekstinä
  const profiili = (hs) => {
    if (!hs.length) return `<p class="pieni">Ei vielä kirjattuja lyöntejä. Kirjaa alla, niin profiili muodostuu tähän.</p>`;
    const lask = {}; hs.forEach((h) => { const k = h.tiedot?.tyyppi; if (k) lask[k] = (lask[k] || 0) + 1; });
    const yleisimmat = Object.entries(lask).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const puoli = hs.filter((h) => h.tiedot?.x != null);
    const vasen = puoli.filter((h) => h.tiedot.x < -5).length, oikea = puoli.filter((h) => h.tiedot.x > 5).length, keski = puoli.length - vasen - oikea;
    const suunta = puoli.length >= 3 ? [[vasen, "3-rajalle"], [keski, "keskelle"], [oikea, "2-rajalle"]].sort((a, b) => b[0] - a[0])[0] : null;
    const juoksut = hs.filter((h) => h.tiedot?.tulos === "juoksu").length;
    return `<ul class="pk-faktat">
      <li><b class="num">${hs.length}</b> lyöntiä kirjattu</li>
      ${yleisimmat.length ? `<li>Lyö eniten: ${yleisimmat.map(([k, n]) => `<span class="nowrap"><span class="pallura" style="background:${tyyppiTieto(k)?.[2]}"></span>${esc(TY[k])} ${n}</span>`).join(", ")}</li>` : ""}
      ${suunta ? `<li>Suunta pääosin ${suunta[1]} (${suunta[0]}/${puoli.length})</li>` : ""}
      ${juoksut ? `<li><b class="num">${juoksut}</b> juoksua</li>` : ""}
    </ul>`;
  };
  const muistiinpanot = valittuP ? kontekstinHuomiot().filter((h) => h.pelaaja_id === valittuP.id && h.tyyppi === "muistiinpano").slice(0, 3) : [];
  const indeksi = rivit.findIndex((p) => p.id === s.pelaaja);

  el.innerHTML = `
    ${tekstiLohko("sisapeli:yleinen", "Sisäpelin yleiskuva", "Miten joukkue pelaa sisällä? Esim. pelinjohtajan tyyli, lyöntijärjestyksen runko, jokerit, mitä tilanteita he hakevat.")}

    <div class="pelaajavalitsin">
      <button type="button" class="btn pieni-nappi pv-nuoli" id="pv-edel" aria-label="Edellinen pelaaja"${rivit.length ? "" : " disabled"}>‹</button>
      <label class="pv-valinta"><span class="sr">Pelaaja</span>${pelaajaValinta("pv-valinta", s.pelaaja, "Koko joukkue", true)}</label>
      <button type="button" class="btn pieni-nappi pv-nuoli" id="pv-seur" aria-label="Seuraava pelaaja"${rivit.length ? "" : " disabled"}>›</button>
    </div>

    ${valittuP ? `
    <section class="pelaajakortti-iso">
      <div class="pki-kuva">${kuvaKehys(valittuP)}</div>
      <div class="pki-tiedot">
        <div class="pki-paa"><h2>${valittuP.numero != null ? `<span class="num pki-nro">${valittuP.numero}</span>` : ""}${esc(valittuP.nimi)}</h2>
          <a class="pieni" href="#/vp/${valittuP.id}">Pelaajasivu</a>${indeksi >= 0 ? `<span class="pieni harmaa">${indeksi + 1} / ${rivit.length}</span>` : ""}</div>
        <label class="pki-kuvaus"><span class="sr">Kuvaus</span><input type="text" id="pki-kuvaus" maxlength="300" value="${esc(valittuP.kuvaus || "")}" placeholder="Lyhyt kuvaus, esim. vasenkätinen kärkilyöjä, nopea etenijä"></label>
        <div class="pki-osa"><span class="osa-nimi">Suunniteltu rooli <span class="pieni">napauta valitaksesi</span></span>
          <div class="chipit pieni-chipit" id="pki-roolit">${SARAKKEET.map((t) => `<button type="button" class="chip rooli-chip" data-rooli="${esc(t)}" aria-pressed="${(valittuP.roolit || []).includes(t)}">${esc(t === "Jokeri" ? "Jokeri" : lyhyt(t) + "-tilanne").replace("Ajo-tilanne", "Ajolähtö")}</button>`).join("")}</div></div>
        <div class="pki-osa"><span class="osa-nimi">Mitä lyö</span>${profiili(omat)}</div>
        ${ryhmaYhteenveto(omat, (h) => h.tiedot?.tilanne || "Tilanne ei kirjattu", "Tilanne", "Tilanteittain")}
        ${muistiinpanot.length ? `<div class="pki-osa"><span class="osa-nimi">Muistiinpanot</span><ul class="pki-mp">${muistiinpanot.map((h) => `<li><a href="#/huomio/${h.id}">${esc(h.otsikko)}</a> <span class="pieni harmaa">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}</span></li>`).join("")}</ul></div>` : ""}
      </div>
    </section>` : `
    <section class="roolimatriisi-osio">
      <div class="osio-paa"><h2>Roolit ja lyönnit tilanteittain</h2>
        <button type="button" class="btn pieni-nappi${s.roolitila ? " ensisij" : ""}" id="roolitila" aria-pressed="${s.roolitila}">${s.roolitila ? "Valmis" : "Merkitse roolit"}</button></div>
      <p class="pieni">${s.roolitila ? "Napauta ruutua merkitäksesi, missä tilanteessa pelaajaa on suunniteltu käytettävän. Napauta uudelleen poistaaksesi." : "Korostettu ruutu = suunniteltu rooli. Luku = kirjatut lyönnit ja väri yleisin lyönti. Napauta ruutua avataksesi pelaajan."}</p>
      <div class="taulu-wrap"><table class="roolimatriisi${s.roolitila ? " muokkaus" : ""}">
        <thead><tr><th class="rm-nimi">Pelaaja</th>${SARAKKEET.map((t) => `<th><button type="button" class="rm-sarake${s.tilanne === t ? " valittu" : ""}" data-sarake="${esc(t)}" title="${esc(t)}">${esc(lyhyt(t))}</button></th>`).join("")}<th class="n">Yht.</th></tr></thead>
        <tbody>${rivit.map((p) => `<tr class="${p.aktiivinen ? "" : "ei-akt"}">
          <th class="rm-nimi"><button type="button" class="rm-pelaaja" data-valitse="${p.id}">${p.numero != null ? `<span class="num">${p.numero}</span> ` : ""}${esc(p.nimi)}</button>${p.kuvaus ? `<span class="rm-kuvaus">${esc(p.kuvaus)}</span>` : ""}</th>
          ${SARAKKEET.map((t) => solu(p, t)).join("")}
          <td class="n">${lyonnit.filter((h) => h.pelaaja_id === p.id).length || ""}</td></tr>`).join("") || `<tr><td colspan="${SARAKKEET.length + 2}" class="tyhja">Ei pelaajia. Lisää pelaaja alta.</td></tr>`}
        </tbody></table></div>
    </section>`}

    <div class="kirjaus-ruudukko" id="lyonnit">
      <form class="paneeli kirjauslomake" id="vly-lomake">
        <h2>Kirjaa lyönti</h2>
        <label class="kentta">Lyöjä ${pelaajaValinta("pelaaja", lyv.pelaaja, "Valitse pelaaja")}</label>
        <div class="lomakeosa"><span class="osa-nimi">Tilanne</span><div data-ryhma="tilanne">${chipit("Tilanne", T, lyv.tilanne)}</div></div>
        <div class="lomakeosa kaksi"><div><span class="osa-nimi">Palot</span><div data-ryhma="palot">${chipit("Palot", PALOT, lyv.palot)}</div></div>
          <div><span class="osa-nimi">Lyönti</span><div data-ryhma="lyonti">${chipit("Monesko lyönti", LYONNIT, lyv.lyonti)}</div></div></div>
        <div class="lomakeosa"><span class="osa-nimi">Lyönti</span><div data-ryhma="tyyppi">${chipit("Lyöntityyppi", LYONTITYYPIT, lyv.tyyppi)}</div></div>
        <div class="lomakeosa"><span class="osa-nimi">Lopputulos</span><div data-ryhma="tulos">${chipit("Lopputulos", TULOKSET, lyv.tulos)}</div></div>
        <div class="lomakeosa"><span class="osa-nimi">Mihin pallo meni <span class="pieni">napauta kenttää</span></span><div id="vly-kentta" class="kentta-kehys"></div></div>
        <label class="kentta">Lisätieto <textarea name="teksti" rows="2" placeholder="Esim. ottelu tai video, syötön korkeus, etenijän lähtö"></textarea></label>
        <div class="rivi"><button class="btn ensisij" type="submit">Tallenna lyönti</button><span class="pieni">Valinnat jäävät voimaan seuraavaa kirjausta varten.</span></div>
      </form>
      <section>
        <h2>Lyöntikartta${valittuP ? `: ${esc(valittuP.nimi)}` : ""} <span class="pieni">${suodatetut.length} / ${omat.length}</span></h2>
        <div class="chipit pieni-chipit s-tilanne" id="s-tilanne"><button type="button" class="chip" data-s="" aria-pressed="${!s.tilanne}">Kaikki tilanteet</button>${TILANTEET.map((t) => `<button type="button" class="chip" data-s="${esc(t)}" aria-pressed="${t === s.tilanne}">${esc(lyhyt(t))}</button>`).join("")}</div>
        ${s.tilanne && !valittuP ? `<p class="roolissa"><b>${esc(s.tilanne)}</b>: ${roolissa.length ? `suunniteltu rooli ${roolissa.map((p) => esc(p.nimi)).join(", ")}` : "ei merkittyjä rooleja"}</p>` : ""}
        <div class="kentta-kehys iso">${kenttaSvg({ id: "vly-kartta", pisteet: suodatetut.filter((h) => h.tiedot?.x != null).map((h) => ({ x: h.tiedot.x, y: h.tiedot.y, vari: tyyppiTieto(h.tiedot.tyyppi)?.[2] || "#F6F2EA", otsikko: `${pnimi(h)}: ${h.otsikko}`, id: h.id })) })}</div>
        <p class="selite">${LYONTITYYPIT.filter(([k]) => suodatetut.some((h) => h.tiedot?.tyyppi === k)).map(([, n, v]) => `<span><span class="pallura" style="background:${v}"></span>${n}</span>`).join("")}</p>
        ${valittuP ? "" : ryhmaYhteenveto(suodatetut, pnimi, "Pelaaja", s.tilanne ? `Kuka lyö ${lyhyt(s.tilanne)}-tilanteessa` : "Pelaajittain")}
        <div class="taulu-wrap"><table class="kirjaustaulu"><thead><tr>${valittuP ? "" : "<th>Pelaaja</th>"}<th>Tilanne</th><th>Palot</th><th>Lyönti</th><th>Tyyppi</th><th>Tulos</th><th>Lisätieto</th><th></th></tr></thead><tbody>
          ${suodatetut.slice(0, 200).map((h) => { const t = h.tiedot || {}; return `<tr>${valittuP ? "" : `<td><button type="button" class="linkkinappi" data-valitse="${h.pelaaja_id}">${esc(pnimi(h))}</button></td>`}<td>${esc(lyhyt(t.tilanne || ""))}</td><td class="n">${t.palot ?? ""}</td><td class="n">${t.lyonti ? `${t.lyonti}.` : ""}</td>
            <td>${t.tyyppi ? `<span class="pallura" style="background:${tyyppiTieto(t.tyyppi)?.[2]}"></span>${esc(TY[t.tyyppi] || t.tyyppi)}` : ""}</td><td>${esc(TU[t.tulos] || "")}</td>
            <td class="pieni">${esc(h.teksti || "")}<br><span class="harmaa">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}</span></td>
            <td>${voiPoistaa(h) ? `<button class="linkkinappi" data-poista="${h.id}">Poista</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="8" class="tyhja">${omat.length ? "Ei lyöntejä tässä tilanteessa." : "Ei vielä lyöntejä. Kirjaa ensimmäinen lomakkeella."}</td></tr>`}
        </tbody></table></div>
      </section>
    </div>

    <details class="muut-pelaajat"><summary>Pelaajien hallinta</summary>
      <p class="pieni">Kokoonpano 2027 sopimustilanteen mukaan. Numeron ja kokoonpanon voi muuttaa pelaajasivulla.</p>
      ${kaikki.filter((p) => !p.aktiivinen).length ? `<p class="pieni">Ei kokoonpanossa: ${kaikki.filter((p) => !p.aktiivinen).map((p) => `<a href="#/vp/${p.id}">${esc(p.nimi)}</a>`).join(", ")}</p>` : ""}
      <form id="uusi-pelaaja" class="rivi uusi-pelaaja">
        <input type="text" name="nimi" required minlength="3" maxlength="80" placeholder="Etunimi Sukunimi" aria-label="Uuden pelaajan nimi">
        <button class="btn" type="submit">Lisää pelaaja</button>
      </form>
    </details>`;

  kytkeTekstit(el, piirra);
  const valitse = (id, tilanne = null) => {
    s.pelaaja = id || ""; if (tilanne !== null) s.tilanne = tilanne;
    if (id) lyv.pelaaja = id; if (tilanne) lyv.tilanne = tilanne;
    piirra(); $(".pelaajavalitsin", el)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $("#pv-valinta", el).onchange = (e) => { s.pelaaja = e.target.value; if (s.pelaaja) lyv.pelaaja = s.pelaaja; piirra(); };
  const askel = (d) => { if (!rivit.length) return; const i = indeksi < 0 ? (d > 0 ? -1 : rivit.length) : indeksi; const n = rivit[(i + d + rivit.length) % rivit.length]; s.pelaaja = n.id; lyv.pelaaja = n.id; piirra(); };
  $("#pv-edel", el).onclick = () => askel(-1);
  $("#pv-seur", el).onclick = () => askel(1);
  $$("[data-valitse]", el).forEach((b) => (b.onclick = () => valitse(b.dataset.valitse)));

  if (valittuP) {
    kytkeKuva(el, valittuP, piirra);
    $("#pki-kuvaus", el).onchange = async (e) => {
      const kuvaus = e.target.value.trim() || null;
      const { error } = await sb.from("vastustajapelaajat").update({ kuvaus }).eq("id", valittuP.id);
      if (error) return ilmoita(error.message, true);
      valittuP.kuvaus = kuvaus; ilmoita("Kuvaus tallennettu");
    };
    $$("#pki-roolit [data-rooli]", el).forEach((b) => (b.onclick = async () => {
      const t = b.dataset.rooli, p = valittuP;
      const roolit = (p.roolit || []).includes(t) ? p.roolit.filter((x) => x !== t) : [...(p.roolit || []), t];
      const { error } = await sb.from("vastustajapelaajat").update({ roolit }).eq("id", p.id);
      if (error) return ilmoita(error.message, true);
      p.roolit = roolit; b.setAttribute("aria-pressed", roolit.includes(t));
      const opt = $(`#pv-valinta option[value="${p.id}"]`, el); if (opt) opt.textContent = `${nro(p)}${p.nimi}${roolitLyhyt(p) ? ` · ${roolitLyhyt(p)}` : ""}`;
    }));
  } else {
    $("#roolitila", el).onclick = () => { s.roolitila = !s.roolitila; piirra(); };
    $$(".rm-solu button", el).forEach((b) => (b.onclick = async () => {
      const p = pelaajat.get(b.dataset.p), t = b.dataset.t;
      if (s.roolitila) {
        const roolit = (p.roolit || []).includes(t) ? p.roolit.filter((x) => x !== t) : [...(p.roolit || []), t];
        const { error } = await sb.from("vastustajapelaajat").update({ roolit }).eq("id", p.id);
        if (error) return ilmoita(error.message, true);
        p.roolit = roolit; return piirra();
      }
      valitse(p.id, t === "Jokeri" ? "" : t);
    }));
    $$("[data-sarake]", el).forEach((b) => (b.onclick = () => {
      if (b.dataset.sarake === "Jokeri") return;
      s.tilanne = s.tilanne === b.dataset.sarake ? "" : b.dataset.sarake; piirra();
    }));
  }
  $$("#s-tilanne .chip", el).forEach((b) => (b.onclick = () => { s.tilanne = b.dataset.s; if (s.tilanne) lyv.tilanne = s.tilanne; piirra(); }));
  $("#uusi-pelaaja", el).onsubmit = async (e) => {
    e.preventDefault();
    const nimi = e.target.nimi.value.trim().replace(/\s+/g, " ");
    const { data, error } = await sb.from("vastustajapelaajat").insert({ joukkue, nimi }).select().single();
    if (error) return ilmoita(/duplicate/.test(error.message) ? `${nimi} on jo listalla.` : error.message, true);
    pelaajat.set(data.id, data); ilmoita(`${nimi} lisätty`); valitse(data.id);
  };
  $$("[data-poista]", el).forEach((b) => (b.onclick = async () => {
    if (!confirm("Poistetaanko lyönti?")) return;
    const { error } = await sb.from("huomiot").delete().eq("id", b.dataset.poista);
    if (error) return ilmoita(error.message, true);
    V.kirj = V.kirj.filter((x) => x.id !== b.dataset.poista); ilmoita("Lyönti poistettu"); piirra();
  }));

  // Kirjauslomake
  const f = $("#vly-lomake", el);
  const kentta = () => { $("#vly-kentta", el).innerHTML = kenttaSvg({ id: "vly-valinta", valittu: lyv.piste, aktiivinen: true }); $("#vly-valinta", el).onclick = (e) => { lyv.piste = kenttaPiste(e.currentTarget, e); kentta(); }; };
  kentta();
  ["tilanne", "palot", "lyonti", "tyyppi", "tulos"].forEach((k) => kytkeChipit(f, lyv, k));
  if (valittuP && !lyv.pelaaja) { lyv.pelaaja = valittuP.id; f.pelaaja.value = valittuP.id; }
  f.pelaaja.onchange = (e) => (lyv.pelaaja = e.target.value);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const p = pelaajat.get(f.pelaaja.value);
    if (!p) { f.pelaaja.focus(); return ilmoita("Valitse lyöjä.", true); }
    const teksti = f.teksti.value.trim();
    if (!lyv.tilanne && !lyv.tyyppi && !lyv.piste && !teksti) return ilmoita("Valitse vähintään tilanne, lyönti tai kohta kentältä.", true);
    const osat = [lyv.tilanne, lyv.palot && `${lyv.palot} ${lyv.palot === "1" ? "palo" : "paloa"}`, lyv.lyonti && `${lyv.lyonti}. lyönti`].filter(Boolean).join(", ");
    const otsikko = `${osat || "Lyönti"}${lyv.tyyppi ? `: ${TY[lyv.tyyppi]}` : ""}${lyv.tulos ? ` (${TU[lyv.tulos].toLowerCase()})` : ""}`;
    const tiedot = { tilanne: lyv.tilanne || null, palot: lyv.palot === "" ? null : +lyv.palot, lyonti: lyv.lyonti === "" ? null : +lyv.lyonti, tyyppi: lyv.tyyppi || null, tulos: lyv.tulos || null, ...(lyv.piste || {}) };
    const nappi = f.querySelector("[type=submit]"); nappi.disabled = true;
    try {
      const h = await tallennaMuistiinpano(teksti ? `${otsikko}\n${teksti}` : otsikko, joukkue, { tyyppi: "lyonti", pelaaja_id: p.id, tiedot });
      if (!V.kirj.some((x) => x.id === h.id)) V.kirj.unshift(h);
      lyv.pelaaja = p.id; lyv.piste = null; ilmoita(`Lyönti tallennettu: ${p.nimi}`); piirra();
      $("#vly-lomake", el)?.scrollIntoView({ block: "nearest" });
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); nappi.disabled = false; }
  };
}

function ryhmaYhteenveto(lyonnit, avain, sarake, otsikko) {
  if (lyonnit.length < 2) return "";
  const TY = nimiTaulu(LYONTITYYPIT);
  const ryhmat = new Map();
  lyonnit.forEach((h) => { const k = avain(h) || "–"; (ryhmat.get(k) || ryhmat.set(k, []).get(k)).push(h); });
  const rivit = [...ryhmat].sort((a, b) => b[1].length - a[1].length).map(([k, hs]) => {
    const lask = {}; hs.forEach((h) => { const t = h.tiedot?.tyyppi; if (t) lask[t] = (lask[t] || 0) + 1; });
    const ylin = Object.entries(lask).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${TY[t]} ${n}`).join(", ");
    const puoli = hs.filter((h) => h.tiedot?.x != null);
    const vasen = puoli.filter((h) => h.tiedot.x < -5).length, oikea = puoli.filter((h) => h.tiedot.x > 5).length;
    const onn = hs.filter((h) => ["onnistui", "juoksu"].includes(h.tiedot?.tulos)).length, tul = hs.filter((h) => h.tiedot?.tulos).length, juoksut = hs.filter((h) => h.tiedot?.tulos === "juoksu").length;
    return `<tr><td>${esc(sarake === "Tilanne" ? lyhyt(k) : k)}</td><td class="n">${hs.length}</td><td>${esc(ylin || "–")}</td><td class="pieni">${puoli.length ? `3-raja ${vasen} · keski ${puoli.length - vasen - oikea} · 2-raja ${oikea}` : ""}</td><td class="n">${tul ? `${onn}/${tul}` : ""}</td><td class="n">${juoksut || ""}</td></tr>`;
  }).join("");
  return `<details class="yhteenveto" open><summary>${esc(otsikko)}</summary><div class="taulu-wrap"><table><thead><tr><th>${sarake}</th><th class="n">Lyöntejä</th><th>Yleisimmät</th><th>Suunta</th><th class="n" title="Onnistui tai juoksu / lyönnit, joiden lopputulos kirjattu">Onnistui</th><th class="n">Juoksuja</th></tr></thead><tbody>${rivit}</tbody></table></div>
    <p class="vihje">Pienellä määrällä kirjauksia jakaumat ovat suuntaa-antavia.</p></details>`;
}

// ======================= ULKOPELI =======================
const ULKO_TILANTEET = ["Yleinen", ...TILANTEET];
const ULKO_OHJE = {
  Yleinen: "Ulkopelin perusrunko: lukkarin tyyli, perusasetelma, kuka johtaa kenttää, missä he ovat vahvoja ja missä heikkoja.",
  "0-tilanne": "Miten he puolustavat 0-tilannetta? Esim. sieppari, 1V:n paikka, polttajien syvyys, painavatko kärkilyöjää vastaan.",
};

export function piirraUlkopeli(el, pelaajat) {
  const piirra = () => piirraUlkopeli(el, pelaajat);
  const joukkue = V.joukkue, t = ulkoTilanne;
  const huomiot = kontekstinHuomiot();
  const havainnot = (tt) => huomiot.filter((h) => h.vastustaja === joukkue && h.tyyppi === "muistiinpano" && h.tiedot?.osa === "ulkopeli" && (h.tiedot?.tilanne || "Yleinen") === tt);
  const kuviot = (tt) => V.kuviot.filter((k) => k.tilanne === tt);
  const ulko = (tt) => V.kirj.filter((h) => h.tyyppi === "ulkopeli" && (tt === "Yleinen" || h.tiedot?.tilanne === tt));
  const onSisaltoa = (tt) => V.tekstit.get(`ulkopeli:${tt}`)?.teksti || havainnot(tt).length || kuviot(tt).length || (tt !== "Yleinen" && ulko(tt).length);
  const R = nimiTaulu(ROOLIT), PA = nimiTaulu(PAINOT);
  const kirj = ulko(t);
  const pn = (h) => pelaajat.get(h.pelaaja_id);

  el.innerHTML = `
    <div class="chipit tilannevalinta" role="tablist" aria-label="Tilanne">${ULKO_TILANTEET.map((tt) => `<button type="button" class="chip" data-ut="${esc(tt)}" aria-pressed="${tt === t}">${esc(tt === "Yleinen" ? "Yleinen" : lyhyt(tt))}${onSisaltoa(tt) ? `<span class="sisalto-merkki" aria-label="sisältää tietoa"></span>` : ""}</button>`).join("")}</div>

    <div id="flappi"></div>

    ${tekstiLohko(`ulkopeli:${t}`, t === "Yleinen" ? "Ulkopelin yleiskuva" : `${t}: miten he pelaavat`, ULKO_OHJE[t] || `Miten ${V.nimi} pelaa ${t.toLowerCase()}? Asettelu, painot, ketkä liikkuvat ja mihin, mihin kannattaa lyödä.`)}

    <div class="ulko-ruudukko">
      <section>
        <h2>Havainnot</h2>
        <form id="uh-uusi" class="uusi-muistiinpano">
          <textarea name="teksti" rows="2" placeholder="Päivätty havainto ${esc(t === "Yleinen" ? "ulkopelistä" : `tilanteesta ${t}`)}. Esim. ottelu, mitä tapahtui, mitä kannattaa tehdä."></textarea>
          <div class="rivi"><button class="btn ensisij" type="submit">Tallenna havainto</button><span class="pieni vihje-nappain">Ctrl + Enter tallentaa</span></div>
        </form>
        <ol class="muistiinpanot" id="uh-lista">${havainnot(t).map((h) => kortti(h, { osio: false })).join("") || `<li class="tyhja">Ei vielä havaintoja tästä tilanteesta.</li>`}</ol>
      </section>
      <aside>
        <section class="paneeli">
          <h2>Pelaajien liikkeet <span class="pieni">${kirj.length}</span></h2>
          ${kirj.length ? `${kirj.some((h) => h.tiedot?.x != null) ? `<div class="kentta-kehys">${kenttaSvg({ id: "uk-kartta", pisteet: kirj.filter((h) => h.tiedot?.x != null).map((h) => ({ x: h.tiedot.x, y: h.tiedot.y, vari: "#F5A800", otsikko: `${pn(h)?.nimi || ""}: ${h.otsikko}`, id: h.id })) })}</div>` : ""}
            <div class="taulu-wrap"><table class="kirjaustaulu"><thead><tr><th>Pelaaja</th><th>Paikka</th>${t === "Yleinen" ? "<th>Tilanne</th>" : ""}<th>Paino</th></tr></thead><tbody>
            ${kirj.map((h) => { const d = h.tiedot || {}; return `<tr><td><a href="#/vp/${h.pelaaja_id}/ulkopeli">${esc(pn(h)?.nimi || "")}</a></td><td>${esc(R[d.rooli] || "")}</td>${t === "Yleinen" ? `<td>${esc(lyhyt(d.tilanne || ""))}</td>` : ""}<td>${esc(PA[d.paino] || "")}${h.teksti ? `<br><span class="pieni">${esc(h.teksti)}</span>` : ""}</td></tr>`; }).join("")}
            </tbody></table></div>`
            : `<p class="pieni">Yksittäisen pelaajan liikkeet kirjataan pelaajan sivulle, välilehdelle Ulkopeli. Ne kootaan tähän tilanteittain.</p>`}
        </section>
      </aside>
    </div>`;

  kytkeTekstit(el, piirra);
  kytkeKortit($("#uh-lista"));
  piirraFlappi($("#flappi", el), { joukkue, tilanne: t, kuviot: V.kuviot, pelaajat, piirraKaikki: piirra });
  $$("[data-ut]", el).forEach((b) => (b.onclick = () => {
    if (b.dataset.ut === ulkoTilanne) return;
    if (onLuonnosta() && !confirm("Fläppitaulun kuviossa on tallentamattomia muutoksia. Hylätäänkö ne?")) return;
    ulkoTilanne = b.dataset.ut; piirra();
  }));
  const f = $("#uh-uusi"), ta = f.teksti;
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!ta.value.trim()) return ta.focus();
    try {
      const teksti = ta.value.trim();
      const runko = teksti.includes("\n") ? teksti : `${t === "Yleinen" ? "Ulkopeli" : t}: ${teksti.length > 80 ? teksti.slice(0, 70).replace(/\s+\S*$/, "") + "…" : teksti}\n${teksti.length > 80 ? teksti : ""}`;
      const h = await tallennaMuistiinpano(runko, joukkue, { tiedot: { osa: "ulkopeli", tilanne: t } });
      const lista = kontekstinHuomiot(); if (!lista.some((x) => x.id === h.id)) lista.unshift(h);
      ilmoita("Havainto tallennettu"); piirra();
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); }
  };
}
