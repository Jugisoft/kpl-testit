// Fläppitaulu: vastustajan ulkopelikuviot tilanteittain, Pelikirjasta erillään mutta samalla mekaniikalla.
// Asetelma (a) ja syötöstä (b), raahattavat pelaajat, muunnoskuviot (perus_id) ja pelaajien paikanvaihdot.
import { sb, tila } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { kirjoittajanNimi, aikaSitten, omaEmail, sukunimiJarjestys } from "../keskus.js";
import { kenttaSvg, ROOLIT, FIELD } from "../kentta.js";

const P = (x, y) => ({ x, y });
// Perusasetelma (sama kuin Pelikirjassa)
export const perusPaikat = () => ({
  L: P(0, 1.3), S: P(14, 43), "1V": P(-9.3, 15.2), "2V": P(18.8, 37.2), "3V": P(-18.8, 37.2),
  "2P": P(8, 30), "3P": P(-9, 34), "3K": P(-11, 70), "2K": P(11, 72),
});
const kopio = (o) => JSON.parse(JSON.stringify(o));
const Y = (y) => 100 - y;
const etaisyys = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Etenijät tilanteen mukaan
function etenijat(tilanne) {
  const t = tilanne || "";
  const p = new Set();
  if (/Ajolähtö/.test(t)) [1, 2, 3].forEach((n) => p.add(n));
  else if (/Kotiutus/.test(t)) p.add(3);
  else { const m = t.match(/^([0-3](?:–[0-3])?)-tilanne/); if (m) m[1].split("–").map(Number).filter(Boolean).forEach((n) => p.add(n)); }
  const siirto = { 1: [-2, 1.5], 2: [1.5, -2.5], 3: [-1.5, -2.5] };
  return [...p].map((n) => { const [x, y] = FIELD.bases[n]; return { n, x: x + siirto[n][0], y: y + siirto[n][1] }; });
}

const F = { valittu: null, luonnos: null, alkup: null, vaihe: "a", nuolet: true, likainen: false, tilanne: null, joukkue: null, valittuRooli: null };
export const onLuonnosta = () => F.likainen;

function uusiLuonnos(joukkue, tilanne, pohja = null) {
  return {
    id: null, joukkue, tilanne, nimi: pohja ? `${pohja.nimi || "Kuvio"}: muunnos` : "Perusasetelma", milloin: "", kuvaus: "",
    perus_id: pohja ? pohja.perus_id || pohja.id : null,
    data: pohja ? kopio(pohja.data) : { a: perusPaikat(), b: perusPaikat(), pelaajat: {} },
    tekija: omaEmail(),
  };
}

// kuviot: tämän joukkueen kaikki fläppitaulun kuviot (muokataan paikan päällä tallennuksen jälkeen)
export function piirraFlappi(el, opt) {
  const { joukkue, tilanne, kuviot, pelaajat, piirraKaikki } = opt;
  if (F.joukkue !== joukkue || F.tilanne !== tilanne) {
    Object.assign(F, { joukkue, tilanne, valittu: null, luonnos: null, alkup: null, likainen: false, vaihe: "a", valittuRooli: null });
  }
  const tassa = kuviot.filter((k) => k.tilanne === tilanne);
  // Järjestys: peruskuvio ja sen muunnokset perään
  const perukset = tassa.filter((k) => !k.perus_id || !tassa.some((x) => x.id === k.perus_id)).sort((a, b) => a.luotu.localeCompare(b.luotu));
  const jarj = perukset.flatMap((p) => [p, ...tassa.filter((k) => k.perus_id === p.id).sort((a, b) => a.luotu.localeCompare(b.luotu))]);

  if (!F.luonnos) {
    const k = tassa.find((x) => x.id === F.valittu) || jarj[0];
    if (k) { F.valittu = k.id; F.luonnos = kopio(k); F.alkup = k; }
    else { F.valittu = null; F.luonnos = uusiLuonnos(joukkue, tilanne); F.alkup = null; }
    F.likainen = false;
  }
  const L = F.luonnos;
  const perus = L.perus_id ? kuviot.find((k) => k.id === L.perus_id) : null;
  const omat = [...pelaajat.values()].filter((p) => p.joukkue === joukkue && p.aktiivinen).sort(sukunimiJarjestys);
  const pnimi = (id) => pelaajat.get(id)?.nimi || "";
  const sukunimi = (id) => pnimi(id).split(" ").at(-1);
  const vaihto = (r) => perus && L.data.pelaajat?.[r] && (perus.data.pelaajat?.[r] || "") !== L.data.pelaajat[r];
  const R = Object.fromEntries(ROOLIT);
  const omaKuvio = !L.id || L.tekija === omaEmail();

  el.innerHTML = `
    <section class="flappi">
      <div class="fl-paa"><h2>Fläppitaulu</h2><span class="pieni">${esc(tilanne === "Yleinen" ? "Yleinen perusasetelma" : tilanne)}</span></div>
      <div class="fl-ruudukko">
        <div class="fl-taulu">
          <div class="fl-vaiheet" role="group" aria-label="Vaihe">
            <button type="button" class="chip" data-vaihe="a" aria-pressed="${F.vaihe === "a"}">Asetelma</button>
            <button type="button" class="chip" data-vaihe="b" aria-pressed="${F.vaihe === "b"}">Syötöstä</button>
            <label class="chip"><input type="checkbox" id="fl-nuolet" ${F.nuolet ? "checked" : ""}>Nuolet</label>
          </div>
          <div class="fl-kentta">${kenttaSvg({ id: "fl-svg" }).replace("</svg>", `<g id="fl-dyn"></g></svg>`)}</div>
          <p class="pieni fl-ohje">Raahaa pelaajia. ${F.vaihe === "a" ? "Asetelmassa siirto vie syötöstä-paikan mukana, ellei sitä ole erikseen muutettu." : "Syötöstä: mihin pelaajat liikkuvat syötön lähtiessä. Nuoli näyttää liikkeen."}</p>
        </div>
        <div class="fl-sivu">
          <ul class="fl-lista">${jarj.map((k) => `<li><button type="button" class="fl-kuvio${k.id === F.valittu ? " valittu" : ""}${k.perus_id ? " muunnos" : ""}" data-kuvio="${k.id}">
              <b>${esc(k.nimi || "Nimetön")}</b>${k.milloin ? `<span class="fl-milloin">${esc(k.milloin)}</span>` : ""}<span class="pieni">${esc(kirjoittajanNimi(k.muokkaaja || k.tekija))}, ${aikaSitten(k.muokattu)}</span></button></li>`).join("")}
            ${!L.id ? `<li><span class="fl-kuvio valittu uusi"><b>${esc(L.nimi || "Uusi kuvio")}</b><span class="pieni">Uusi, ei vielä tallennettu</span></span></li>` : ""}
          </ul>
          <div class="rivi fl-napit">
            <button type="button" class="btn pieni-nappi" id="fl-uusi">Uusi kuvio</button>
            ${L.id ? `<button type="button" class="btn pieni-nappi" id="fl-muunnos" title="Kopioi tämä kuvio pohjaksi, esim. kun pelaajat vaihtavat paikkaa tietylle lyöjälle">Tee muunnos</button>` : ""}
          </div>
          <form class="fl-lomake paneeli" id="fl-lomake">
            ${perus ? `<p class="pieni fl-perus">Muunnos kuviosta <b>${esc(perus.nimi)}</b>. Paikkaa vaihtaneet pelaajat on korostettu.</p>` : ""}
            <label class="kentta">Nimi <input type="text" name="nimi" maxlength="80" value="${esc(L.nimi)}" placeholder="Esim. Perus, Kolmoskulma kova"></label>
            <label class="kentta">Milloin <input type="text" name="milloin" maxlength="160" value="${esc(L.milloin)}" placeholder="Esim. kun lyöjä lyö korkeaa pomppua, vasenkätinen lyöjä"></label>
            <div class="fl-roolit">
              <span class="osa-nimi">Kuka pelaa missä <span class="pieni">valinnainen</span></span>
              ${ROOLIT.map(([r, n]) => `<label class="fl-rooli${vaihto(r) ? " vaihto" : ""}${F.valittuRooli === r ? " valittu" : ""}"><span class="fl-r">${r}</span><span class="fl-rn">${n}</span>
                <select name="p-${r}"><option value="">–</option>${omat.map((p) => `<option value="${p.id}"${L.data.pelaajat?.[r] === p.id ? " selected" : ""}>${esc(p.nimi)}</option>`).join("")}</select></label>`).join("")}
            </div>
            <label class="kentta">Kuvaus <textarea name="kuvaus" rows="3" placeholder="Mitä kuviossa tapahtuu ja miksi. Esim. 3-kulmaan kovakätinen, jotta etenijä poltetaan kakkoselle.">${esc(L.kuvaus)}</textarea></label>
            <div class="rivi">
              <button class="btn ensisij" type="submit"${F.likainen || !L.id ? "" : " disabled"}>Tallenna</button>
              ${F.likainen && L.id ? `<button type="button" class="btn" id="fl-peru">Peru muutokset</button>` : ""}
              ${L.id && (omaKuvio || tila.admin) ? `<button type="button" class="linkkinappi" id="fl-poista">Poista kuvio</button>` : ""}
              <span class="pieni" id="fl-tila">${F.likainen ? "Tallentamattomia muutoksia" : L.id ? `Tekijä ${esc(kirjoittajanNimi(L.tekija))}` : "Muutokset tulevat voimaan vasta tallennettaessa"}</span>
            </div>
          </form>
        </div>
      </div>
    </section>`;

  const svg = $("#fl-svg", el);
  const piirraDyn = () => {
    const d = L.data, nyt = F.vaihe;
    const k = innerWidth < 600 ? 1.3 : 1; // isommat napit kosketusnäytöllä
    let h = "";
    etenijat(tilanne).forEach((e) => { h += `<g class="fl-etenija"><circle cx="${e.x}" cy="${Y(e.y)}" r="1.5"/><text x="${e.x}" y="${Y(e.y) + .55}" text-anchor="middle">E${e.n}</text></g>`; });
    if (tilanne !== "Yleinen") h += `<g class="fl-etenija lyoja"><circle cx="1.5" cy="${Y(-1.8)}" r="1.5"/><text x="1.5" y="${Y(-1.8) + .55}" text-anchor="middle">Ly</text></g>`;
    ROOLIT.forEach(([r]) => {
      const a = d.a[r], b = d.b[r];
      if (!a || !b) return;
      if ((F.nuolet || nyt === "b") && etaisyys(a, b) > .8) {
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy), q = Math.max(0, l - 2.1 * k) / l;
        h += `<line class="fl-nuoli${nyt === "a" ? " haalea" : ""}" x1="${a.x}" y1="${Y(a.y)}" x2="${a.x + dx * q}" y2="${Y(a.y + dy * q)}" marker-end="url(#fl-karki)"/>`;
        if (nyt === "b") h += `<circle class="fl-haamu" cx="${a.x}" cy="${Y(a.y)}" r="${1.9 * k}"/>`;
      }
    });
    ROOLIT.forEach(([r]) => {
      const p = d[nyt][r]; if (!p) return;
      const pid = d.pelaajat?.[r];
      h += `<g class="fl-pelaaja${vaihto(r) ? " vaihto" : ""}${F.valittuRooli === r ? " valittu" : ""}" data-r="${r}" tabindex="0" role="button" aria-label="${esc(R[r])}${pid ? ` ${esc(pnimi(pid))}` : ""}">
        <circle cx="${p.x}" cy="${Y(p.y)}" r="${2.1 * k}"/><text x="${p.x}" y="${Y(p.y) + .62 * k}" text-anchor="middle" style="font-size:${1.75 * k}px">${r}</text>
        ${pid ? `<text class="fl-nimi" x="${p.x}" y="${Y(p.y) + 4.1 * k}" text-anchor="middle" style="font-size:${1.65 * k}px">${esc(sukunimi(pid))}</text>` : ""}</g>`;
    });
    $("#fl-dyn", el).innerHTML = `<defs><marker id="fl-karki" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="fl-karki"/></marker></defs>${h}`;
  };
  piirraDyn();

  const merkitse = () => {
    if (!F.likainen) {
      F.likainen = true;
      const nappi = $("#fl-lomake [type=submit]", el); if (nappi) nappi.disabled = false;
      const t = $("#fl-tila", el); if (t) t.textContent = "Tallentamattomia muutoksia";
    }
  };

  // Raahaus
  let drag = null;
  const piste = (e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: 100 - p.y }; };
  svg.addEventListener("pointerdown", (e) => {
    const g = e.target.closest("[data-r]"); if (!g) return;
    const r = g.dataset.r, cp = L.data[F.vaihe][r], w = piste(e);
    drag = { r, dx: cp.x - w.x, dy: cp.y - w.y, liikkui: false };
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const w = piste(e);
    const uusi = { x: +Math.max(-30, Math.min(30, w.x + drag.dx)).toFixed(1), y: +Math.max(-3, Math.min(100, w.y + drag.dy)).toFixed(1) };
    const d = L.data, r = drag.r;
    if (F.vaihe === "a") { const liikkunut = etaisyys(d.a[r], d.b[r]) > .8; d.a[r] = uusi; if (!liikkunut) d.b[r] = { ...uusi }; }
    else d.b[r] = uusi;
    drag.liikkui = true; piirraDyn();
  });
  const lopeta = () => {
    if (!drag) return;
    const r = drag.r, liikkui = drag.liikkui; drag = null;
    if (liikkui) merkitse();
    else { F.valittuRooli = F.valittuRooli === r ? null : r; piirraDyn(); $$(".fl-rooli", el).forEach((x) => x.classList.toggle("valittu", x.querySelector(".fl-r").textContent === F.valittuRooli)); $(`[name="p-${r}"]`, el)?.focus({ preventScroll: true }); }
  };
  svg.addEventListener("pointerup", lopeta);
  svg.addEventListener("pointercancel", () => { drag = null; });

  $$("[data-vaihe]", el).forEach((b) => (b.onclick = () => { F.vaihe = b.dataset.vaihe; piirraFlappi(el, opt); }));
  $("#fl-nuolet", el).onchange = (e) => { F.nuolet = e.target.checked; piirraDyn(); };

  const vaihda = (toiminto) => { if (F.likainen && !confirm("Kuviossa on tallentamattomia muutoksia. Hylätäänkö ne?")) return; F.likainen = false; toiminto(); piirraFlappi(el, opt); };
  $$("[data-kuvio]", el).forEach((b) => (b.onclick = () => { if (b.dataset.kuvio === F.valittu && !F.likainen) return; vaihda(() => { F.valittu = b.dataset.kuvio; F.luonnos = null; }); }));
  $("#fl-uusi", el).onclick = () => vaihda(() => { F.valittu = null; F.luonnos = uusiLuonnos(joukkue, tilanne, null); F.luonnos.nimi = jarj.length ? "" : "Perusasetelma"; F.alkup = null; F.vaihe = "a"; });
  const muunnos = $("#fl-muunnos", el);
  if (muunnos) muunnos.onclick = () => { const pohja = F.alkup; vaihda(() => { F.valittu = null; F.luonnos = uusiLuonnos(joukkue, tilanne, pohja); F.alkup = null; }); };

  const f = $("#fl-lomake", el);
  ["nimi", "milloin", "kuvaus"].forEach((n) => (f[n].oninput = (e) => { L[n] = e.target.value; merkitse(); }));
  ROOLIT.forEach(([r]) => (f[`p-${r}`].onchange = (e) => {
    L.data.pelaajat = L.data.pelaajat || {};
    const id = e.target.value;
    // Sama pelaaja ei voi olla kahdessa paikassa: vaihdetaan paikat
    const vanha = Object.entries(L.data.pelaajat).find(([rr, pid]) => rr !== r && pid === id && id);
    if (vanha) { L.data.pelaajat[vanha[0]] = L.data.pelaajat[r] || ""; ilmoita(`${pnimi(id)} siirretty paikalle ${r}, paikka ${vanha[0]} vaihdettu`); }
    L.data.pelaajat[r] = id;
    merkitse(); F.valittuRooli = r; piirraFlappi(el, opt);
  }));
  const peru = $("#fl-peru", el);
  if (peru) peru.onclick = () => { F.likainen = false; F.luonnos = null; piirraFlappi(el, opt); };
  const poista = $("#fl-poista", el);
  if (poista) poista.onclick = async () => {
    const muunnoksia = kuviot.filter((k) => k.perus_id === L.id).length;
    if (!confirm(`Poistetaanko kuvio ${L.nimi || ""}?${muunnoksia ? ` Sen ${muunnoksia} muunnosta jäävät omiksi kuvioikseen.` : ""}`)) return;
    const { error } = await sb.from("vastustaja_kuviot").delete().eq("id", L.id);
    if (error) return ilmoita(error.message, true);
    const i = kuviot.findIndex((k) => k.id === L.id); if (i >= 0) kuviot.splice(i, 1);
    kuviot.forEach((k) => { if (k.perus_id === L.id) k.perus_id = null; });
    Object.assign(F, { valittu: null, luonnos: null, likainen: false });
    ilmoita("Kuvio poistettu"); piirraKaikki();
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!L.nimi.trim()) { f.nimi.focus(); return ilmoita("Anna kuviolle nimi.", true); }
    if (L.id) {
      if (L.tekija !== omaEmail() && !confirm(`Kuvion on tehnyt ${kirjoittajanNimi(L.tekija)}. Oletko varma, että tallennetaan muutokset hänen kuvioonsa?`)) return;
      const { data: nyt } = await sb.from("vastustaja_kuviot").select("muokattu,muokkaaja").eq("id", L.id).maybeSingle();
      if (nyt && F.alkup && nyt.muokattu !== F.alkup.muokattu && nyt.muokkaaja !== omaEmail() &&
        !confirm(`${kirjoittajanNimi(nyt.muokkaaja)} muokkasi kuviota sillä aikaa (${aikaSitten(nyt.muokattu)}). Korvataanko hänen muutoksensa?`)) return;
    }
    const rivi = { joukkue, tilanne, nimi: L.nimi.trim(), milloin: L.milloin.trim(), kuvaus: L.kuvaus.trim(), perus_id: L.perus_id, data: L.data };
    const kysely = L.id ? sb.from("vastustaja_kuviot").update(rivi).eq("id", L.id) : sb.from("vastustaja_kuviot").insert(rivi);
    const { data, error } = await kysely.select().single();
    if (error) return ilmoita("Tallennus epäonnistui: " + error.message, true);
    const i = kuviot.findIndex((k) => k.id === data.id);
    if (i >= 0) kuviot[i] = data; else kuviot.push(data);
    Object.assign(F, { valittu: data.id, luonnos: null, likainen: false });
    ilmoita("Kuvio tallennettu"); piirraKaikki();
  };
}
