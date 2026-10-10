// Pelaajasivu: lyönnit tilanteittain kentälle, ulkopelin liikkeet ja muistiinpanot.
import { sb, tila } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { haePelaajat, lataaNimet, kommenttimaarat, kirjoittajanNimi, aikaSitten, omaEmail, tallennaMuistiinpano, osioNimi } from "../keskus.js";
import { kenttaSvg, kenttaPiste, TILANTEET, LYONTITYYPIT, TULOKSET, ROOLIT, PAINOT, tyyppiTieto } from "../kentta.js";
import { kortti, kytkeKortit, asetaKonteksti, kontekstinHuomiot } from "./muistio.js";
import { haeLiitteet, lataaTiedostot, tiedostoValitsin } from "../liitteet.js";

let kanava = null;
export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

// Lomakkeen valinnat säilyvät peräkkäisten kirjausten välillä
const ly = { tilanne: "", palot: "", lyonti: "", tyyppi: "", tulos: "", piste: null };
const ul = { rooli: "", tilanne: "", paino: "", piste: null };
let suodatin = "";

const chipit = (nimi, lista, arvo) => `<div class="chipit pieni-chipit" role="group" aria-label="${nimi}">${lista.map(([k, n, vari]) =>
  `<button type="button" class="chip" data-k="${esc(k)}" aria-pressed="${k === arvo}">${vari ? `<span class="pallura" style="background:${vari}"></span>` : ""}${esc(n)}</button>`).join("")}</div>`;
const T = TILANTEET.map((t) => [t, t.replace("-tilanne", "")]);
const PALOT = [["0", "0 paloa"], ["1", "1 palo"], ["2", "2 paloa"]];
const LYONNIT = [["1", "1. lyönti"], ["2", "2. lyönti"], ["3", "3. lyönti"]];

export async function nayta(main, id, valilehti = "lyonnit") {
  await lataaNimet();
  const pelaajat = await haePelaajat(true);
  const p = pelaajat.get(id);
  if (!p) { main.innerHTML = `<h1>Pelaajaa ei löydy</h1><p><a class="btn" href="#/muistio">Muistio</a></p>`; return; }
  const [{ data: kirjaukset }, maarat] = await Promise.all([sb.from("huomiot").select("*").eq("pelaaja_id", id).order("luotu", { ascending: false }), kommenttimaarat()]);
  const liitteet = await haeLiitteet(kirjaukset.map((h) => h.id));
  let lista = kirjaukset;
  asetaKonteksti({ huomiot: lista, maarat, pelaajat, liitteet, osio: null, auki: new Set(), uudelleenpiirra: () => { lista = kontekstinHuomiot(); piirraValilehti(); } });

  const lkm = (t) => lista.filter((h) => h.tyyppi === t).length;
  main.innerHTML = `
    <p class="murupolku"><a href="#/muistio/${esc(p.joukkue)}/pelaajat">${esc(osioNimi(p.joukkue))}: pelaajat</a></p>
    <div class="pelaaja-paa">
      <h1>${esc(p.nimi)}</h1>
      <div class="pelaaja-tiedot">
        <label class="pieni">Numero <input type="number" id="numero" min="0" max="99" value="${p.numero ?? ""}" style="width:72px"></label>
        <label class="pieni laaja">Kuvaus <input type="text" id="kuvaus" maxlength="300" placeholder="Esim. vasenkätinen kärkilyöjä, nopea etenijä, ulkona 3-koppari" value="${esc(p.kuvaus || "")}"></label>
        <label class="chip"><input type="checkbox" id="aktiivinen" ${p.aktiivinen ? "checked" : ""}>Kokoonpanossa</label>
      </div>
    </div>
    <div class="valilehdet" role="tablist">
      ${[["lyonnit", "Lyönnit", lkm("lyonti")], ["ulkopeli", "Ulkopeli", lkm("ulkopeli")], ["muistiinpanot", "Muistiinpanot", lkm("muistiinpano")]]
        .map(([k, n, l]) => `<a role="tab" class="valilehti" href="#/vp/${id}/${k}" aria-selected="${valilehti === k}">${n}${l ? ` <span class="lkm">${l}</span>` : ""}</a>`).join("")}
    </div>
    <div id="vp-sisalto"></div>`;

  const tallennaPelaaja = async (muutos) => {
    const { error } = await sb.from("vastustajapelaajat").update(muutos).eq("id", id);
    if (error) ilmoita(error.message, true); else { Object.assign(p, muutos); ilmoita("Tallennettu"); }
  };
  $("#numero").onchange = (e) => tallennaPelaaja({ numero: e.target.value === "" ? null : +e.target.value });
  $("#kuvaus").onchange = (e) => tallennaPelaaja({ kuvaus: e.target.value.trim() || null });
  $("#aktiivinen").onchange = (e) => tallennaPelaaja({ aktiivinen: e.target.checked });

  const piirraValilehti = () => {
    const el = $("#vp-sisalto"); if (!el) return;
    if (valilehti === "ulkopeli") return piirraUlkopeli(el, p, lista, lisaa, poista);
    if (valilehti === "muistiinpanot") return piirraMuistiinpanot(el, p, lista, lisaa);
    return piirraLyonnit(el, p, lista, lisaa, poista);
  };
  const lisaa = (h) => { if (!lista.some((x) => x.id === h.id)) lista.unshift(h); asetaKonteksti({ huomiot: lista }); piirraValilehti(); };
  const poista = async (hid) => {
    if (!confirm("Poistetaanko kirjaus?")) return;
    const { error } = await sb.from("huomiot").delete().eq("id", hid);
    if (error) return ilmoita(error.message, true);
    lista = lista.filter((x) => x.id !== hid); asetaKonteksti({ huomiot: lista }); ilmoita("Kirjaus poistettu"); piirraValilehti();
  };
  piirraValilehti();

  poistu();
  kanava = sb.channel("vp-" + id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "huomiot", filter: `pelaaja_id=eq.${id}` }, (m) => {
      if (lista.some((x) => x.id === m.new.id)) return;
      lista.unshift(m.new); asetaKonteksti({ huomiot: lista });
      if (document.activeElement?.tagName !== "TEXTAREA") piirraValilehti();
    }).subscribe();
}

function kytkeChipit(el, tilaObj, avain, jalkeen) {
  $$(`[data-ryhma="${avain}"] .chip`, el).forEach((b) => (b.onclick = () => {
    tilaObj[avain] = tilaObj[avain] === b.dataset.k ? "" : b.dataset.k;
    $$(`[data-ryhma="${avain}"] .chip`, el).forEach((x) => x.setAttribute("aria-pressed", x.dataset.k === tilaObj[avain]));
    jalkeen?.();
  }));
}

const voiPoistaa = (h) => h.kirjoittaja === omaEmail() || tila.admin;
const nimiTaulu = (lista) => Object.fromEntries(lista.map(([k, n]) => [k, n]));

// --- Lyönnit
function piirraLyonnit(el, p, lista, lisaa, poista) {
  const lyonnit = lista.filter((h) => h.tyyppi === "lyonti");
  const kaytetyt = TILANTEET.filter((t) => lyonnit.some((h) => h.tiedot?.tilanne === t));
  if (suodatin && !kaytetyt.includes(suodatin)) suodatin = "";
  const nakyvat = lyonnit.filter((h) => !suodatin || h.tiedot?.tilanne === suodatin);
  const TY = nimiTaulu(LYONTITYYPIT), TU = nimiTaulu(TULOKSET);
  el.innerHTML = `<div class="kirjaus-ruudukko">
    <form class="paneeli kirjauslomake" id="ly-lomake">
      <h2>Kirjaa lyönti</h2>
      <div class="lomakeosa"><span class="osa-nimi">Tilanne</span><div data-ryhma="tilanne">${chipit("Tilanne", T, ly.tilanne)}</div></div>
      <div class="lomakeosa kaksi"><div><span class="osa-nimi">Palot</span><div data-ryhma="palot">${chipit("Palot", PALOT, ly.palot)}</div></div>
        <div><span class="osa-nimi">Lyönti</span><div data-ryhma="lyonti">${chipit("Monesko lyönti", LYONNIT, ly.lyonti)}</div></div></div>
      <div class="lomakeosa"><span class="osa-nimi">Lyönti</span><div data-ryhma="tyyppi">${chipit("Lyöntityyppi", LYONTITYYPIT, ly.tyyppi)}</div></div>
      <div class="lomakeosa"><span class="osa-nimi">Lopputulos</span><div data-ryhma="tulos">${chipit("Lopputulos", TULOKSET, ly.tulos)}</div></div>
      <div class="lomakeosa"><span class="osa-nimi">Mihin pallo meni <span class="pieni">napauta kenttää</span></span><div id="ly-kentta" class="kentta-kehys"></div></div>
      <label class="kentta">Lisätieto <textarea name="teksti" rows="2" placeholder="Esim. ottelu tai video, syötön korkeus, etenijän lähtö"></textarea></label>
      <div class="rivi"><button class="btn ensisij" type="submit">Tallenna lyönti</button><span class="pieni">Valinnat jäävät voimaan seuraavaa kirjausta varten.</span></div>
    </form>
    <section>
      <h2>Lyöntikartta <span class="pieni">${nakyvat.length} / ${lyonnit.length}</span></h2>
      ${kaytetyt.length ? `<div class="chipit pieni-chipit" id="suodatin"><button class="chip" data-s="" aria-pressed="${!suodatin}">Kaikki</button>${kaytetyt.map((t) => `<button class="chip" data-s="${esc(t)}" aria-pressed="${t === suodatin}">${esc(t.replace("-tilanne", ""))}</button>`).join("")}</div>` : ""}
      <div class="kentta-kehys iso">${kenttaSvg({ id: "ly-kartta", pisteet: nakyvat.filter((h) => h.tiedot?.x != null).map((h) => ({ x: h.tiedot.x, y: h.tiedot.y, vari: tyyppiTieto(h.tiedot.tyyppi)?.[2] || "#E6EEF8", otsikko: h.otsikko, id: h.id })) })}</div>
      <p class="selite">${LYONTITYYPIT.filter(([k]) => nakyvat.some((h) => h.tiedot?.tyyppi === k)).map(([, n, v]) => `<span><span class="pallura" style="background:${v}"></span>${n}</span>`).join("")}</p>
      ${yhteenveto(nakyvat)}
      <div class="taulu-wrap"><table class="kirjaustaulu"><thead><tr><th>Tilanne</th><th>Palot</th><th>Lyönti</th><th>Tyyppi</th><th>Tulos</th><th>Lisätieto</th><th></th></tr></thead><tbody>
        ${nakyvat.map((h) => { const t = h.tiedot || {}; return `<tr><td>${esc((t.tilanne || "").replace("-tilanne", ""))}</td><td class="n">${t.palot ?? ""}</td><td class="n">${t.lyonti ? `${t.lyonti}.` : ""}</td>
          <td>${t.tyyppi ? `<span class="pallura" style="background:${tyyppiTieto(t.tyyppi)?.[2]}"></span>${esc(TY[t.tyyppi] || t.tyyppi)}` : ""}</td><td>${esc(TU[t.tulos] || "")}</td>
          <td class="pieni">${esc(h.teksti || "")}<br><span class="harmaa">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}</span></td>
          <td>${voiPoistaa(h) ? `<button class="linkkinappi" data-poista="${h.id}">Poista</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="tyhja">Ei vielä lyöntejä. Kirjaa ensimmäinen vasemmalla.</td></tr>`}
      </tbody></table></div>
    </section></div>`;

  const kentta = () => { $("#ly-kentta").innerHTML = kenttaSvg({ id: "ly-valinta", valittu: ly.piste, aktiivinen: true }); $("#ly-valinta").onclick = (e) => { ly.piste = kenttaPiste(e.currentTarget, e); kentta(); }; };
  kentta();
  ["tilanne", "palot", "lyonti", "tyyppi", "tulos"].forEach((k) => kytkeChipit(el, ly, k));
  $$("#suodatin .chip", el).forEach((b) => (b.onclick = () => { suodatin = b.dataset.s; piirraLyonnit(el, p, lista, lisaa, poista); }));
  $$("[data-poista]", el).forEach((b) => (b.onclick = () => poista(b.dataset.poista)));
  $("#ly-lomake").onsubmit = async (e) => {
    e.preventDefault();
    const teksti = e.target.teksti.value.trim();
    if (!ly.tilanne && !ly.tyyppi && !ly.piste && !teksti) return ilmoita("Valitse vähintään tilanne, lyönti tai kohta kentältä.", true);
    const osat = [ly.tilanne, ly.palot && `${ly.palot} ${ly.palot === "1" ? "palo" : "paloa"}`, ly.lyonti && `${ly.lyonti}. lyönti`].filter(Boolean).join(", ");
    const otsikko = `${osat || "Lyönti"}${ly.tyyppi ? `: ${TY[ly.tyyppi]}` : ""}${ly.tulos ? ` (${TU[ly.tulos].toLowerCase()})` : ""}`;
    const tiedot = { tilanne: ly.tilanne || null, palot: ly.palot === "" ? null : +ly.palot, lyonti: ly.lyonti === "" ? null : +ly.lyonti, tyyppi: ly.tyyppi || null, tulos: ly.tulos || null, ...(ly.piste || {}) };
    try {
      const h = await tallennaMuistiinpano(teksti ? `${otsikko}\n${teksti}` : otsikko, p.joukkue, { tyyppi: "lyonti", pelaaja_id: p.id, tiedot });
      ly.piste = null; ilmoita("Lyönti tallennettu"); lisaa(h);
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); }
  };
}

function yhteenveto(lyonnit) {
  if (lyonnit.length < 3) return "";
  const TY = nimiTaulu(LYONTITYYPIT);
  const ryhmat = new Map();
  lyonnit.forEach((h) => { const t = h.tiedot?.tilanne || "Tilanne ei kirjattu"; (ryhmat.get(t) || ryhmat.set(t, []).get(t)).push(h); });
  const rivit = [...ryhmat].sort((a, b) => b[1].length - a[1].length).map(([t, hs]) => {
    const lask = {}; hs.forEach((h) => { const k = h.tiedot?.tyyppi; if (k) lask[k] = (lask[k] || 0) + 1; });
    const ylin = Object.entries(lask).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${TY[k]} ${n}`).join(", ");
    const puoli = hs.filter((h) => h.tiedot?.x != null);
    const vasen = puoli.filter((h) => h.tiedot.x < -5).length, oikea = puoli.filter((h) => h.tiedot.x > 5).length;
    return `<tr><td>${esc(t.replace("-tilanne", ""))}</td><td class="n">${hs.length}</td><td>${esc(ylin || "–")}</td><td class="pieni">${puoli.length ? `3-raja ${vasen} · keski ${puoli.length - vasen - oikea} · 2-raja ${oikea}` : ""}</td></tr>`;
  }).join("");
  return `<details class="yhteenveto" open><summary>Tilanteittain</summary><div class="taulu-wrap"><table><thead><tr><th>Tilanne</th><th class="n">Lyöntejä</th><th>Yleisimmät</th><th>Suunta</th></tr></thead><tbody>${rivit}</tbody></table></div>
    <p class="vihje">Pienellä määrällä kirjauksia jakaumat ovat suuntaa-antavia.</p></details>`;
}

// --- Ulkopeli
function piirraUlkopeli(el, p, lista, lisaa, poista) {
  const kirj = lista.filter((h) => h.tyyppi === "ulkopeli");
  const R = nimiTaulu(ROOLIT), PA = nimiTaulu(PAINOT);
  el.innerHTML = `<div class="kirjaus-ruudukko">
    <form class="paneeli kirjauslomake" id="ul-lomake">
      <h2>Kirjaa ulkopelin liike</h2>
      <div class="lomakeosa"><span class="osa-nimi">Pelipaikka</span><div data-ryhma="rooli">${chipit("Pelipaikka", ROOLIT, ul.rooli)}</div></div>
      <div class="lomakeosa"><span class="osa-nimi">Tilanne</span><div data-ryhma="tilanne">${chipit("Tilanne", T, ul.tilanne)}</div></div>
      <div class="lomakeosa"><span class="osa-nimi">Mihin paino menee</span><div data-ryhma="paino">${chipit("Painon suunta", PAINOT, ul.paino)}</div></div>
      <div class="lomakeosa"><span class="osa-nimi">Missä seisoo <span class="pieni">valinnainen, napauta kenttää</span></span><div id="ul-kentta" class="kentta-kehys"></div></div>
      <label class="kentta">Lisätieto <textarea name="teksti" rows="2" placeholder="Esim. lähtee aikaisin syötön noustessa, avaa kolmosrajan"></textarea></label>
      <div class="rivi"><button class="btn ensisij" type="submit">Tallenna</button><span class="pieni">Valinnat jäävät voimaan seuraavaa kirjausta varten.</span></div>
    </form>
    <section>
      <h2>Ulkopelin kirjaukset <span class="pieni">${kirj.length}</span></h2>
      <div class="kentta-kehys iso">${kenttaSvg({ id: "ul-kartta", pisteet: kirj.filter((h) => h.tiedot?.x != null).map((h) => ({ x: h.tiedot.x, y: h.tiedot.y, vari: "#38D6FF", otsikko: h.otsikko, id: h.id })) })}</div>
      ${ulkoYhteenveto(kirj)}
      <div class="taulu-wrap"><table class="kirjaustaulu"><thead><tr><th>Paikka</th><th>Tilanne</th><th>Paino</th><th>Lisätieto</th><th></th></tr></thead><tbody>
        ${kirj.map((h) => { const t = h.tiedot || {}; return `<tr><td>${esc(R[t.rooli] || "")}</td><td>${esc((t.tilanne || "").replace("-tilanne", ""))}</td><td>${esc(PA[t.paino] || "")}</td>
          <td class="pieni">${esc(h.teksti || "")}<br><span class="harmaa">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}</span></td>
          <td>${voiPoistaa(h) ? `<button class="linkkinappi" data-poista="${h.id}">Poista</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="5" class="tyhja">Ei vielä kirjauksia.</td></tr>`}
      </tbody></table></div>
    </section></div>`;
  const kentta = () => { $("#ul-kentta").innerHTML = kenttaSvg({ id: "ul-valinta", valittu: ul.piste, aktiivinen: true }); $("#ul-valinta").onclick = (e) => { ul.piste = kenttaPiste(e.currentTarget, e); kentta(); }; };
  kentta();
  ["rooli", "tilanne", "paino"].forEach((k) => kytkeChipit(el, ul, k));
  $$("[data-poista]", el).forEach((b) => (b.onclick = () => poista(b.dataset.poista)));
  $("#ul-lomake").onsubmit = async (e) => {
    e.preventDefault();
    const teksti = e.target.teksti.value.trim();
    if (!ul.rooli && !ul.paino && !teksti) return ilmoita("Valitse vähintään pelipaikka tai painon suunta.", true);
    const otsikko = [R[ul.rooli], ul.tilanne].filter(Boolean).join(", ") + (ul.paino ? `${ul.rooli || ul.tilanne ? ": " : ""}paino ${PA[ul.paino].toLowerCase()}` : "") || "Ulkopeli";
    const tiedot = { rooli: ul.rooli || null, tilanne: ul.tilanne || null, paino: ul.paino || null, ...(ul.piste || {}) };
    try {
      const h = await tallennaMuistiinpano(teksti ? `${otsikko}\n${teksti}` : otsikko, p.joukkue, { tyyppi: "ulkopeli", pelaaja_id: p.id, tiedot });
      ul.piste = null; ilmoita("Kirjaus tallennettu"); lisaa(h);
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); }
  };
}

function ulkoYhteenveto(kirj) {
  const R = nimiTaulu(ROOLIT), PA = nimiTaulu(PAINOT);
  const r = new Map();
  kirj.filter((h) => h.tiedot?.paino).forEach((h) => { const k = `${R[h.tiedot.rooli] || "Paikka?"}|${h.tiedot.tilanne || ""}`; const o = r.get(k) || {}; o[h.tiedot.paino] = (o[h.tiedot.paino] || 0) + 1; r.set(k, o); });
  if (!r.size) return "";
  return `<details class="yhteenveto" open><summary>Painon suunta</summary><div class="taulu-wrap"><table><thead><tr><th>Paikka</th><th>Tilanne</th><th>Paino</th></tr></thead><tbody>
    ${[...r].map(([k, o]) => { const [rooli, til] = k.split("|"); return `<tr><td>${esc(rooli)}</td><td>${esc(til.replace("-tilanne", "") || "–")}</td><td>${Object.entries(o).sort((a, b) => b[1] - a[1]).map(([pa, n]) => `${esc(PA[pa])} ${n}`).join(", ")}</td></tr>`; }).join("")}
  </tbody></table></div></details>`;
}

// --- Muistiinpanot ja liitteet pelaajasta
function piirraMuistiinpanot(el, p, lista, lisaa) {
  const mp = lista.filter((h) => h.tyyppi === "muistiinpano");
  el.innerHTML = `<form id="vp-uusi" class="uusi-muistiinpano">
      <textarea name="teksti" rows="3" placeholder="Kirjoita muistiinpano pelaajasta ${esc(p.nimi)}. Ensimmäinen rivi on otsikko."></textarea>
      <div class="rivi"><span id="vp-tiedostot" class="tiedostot"></span><button class="btn ensisij" type="submit">Tallenna</button><span class="pieni vihje-nappain">Ctrl + Enter tallentaa</span></div>
    </form>
    <ol class="muistiinpanot" id="vp-lista">${mp.map((h) => kortti(h, { osio: false, pelaaja: false })).join("") || `<li class="tyhja">Ei muistiinpanoja tästä pelaajasta.</li>`}</ol>`;
  kytkeKortit($("#vp-lista"));
  const f = $("#vp-uusi"), ta = f.teksti, valitsin = tiedostoValitsin($("#vp-tiedostot"));
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const tied = valitsin.tiedostot();
    if (!ta.value.trim() && !tied.length) return ilmoita("Kirjoita teksti tai liitä tiedosto.", true);
    try {
      const h = await tallennaMuistiinpano(ta.value, p.joukkue, { pelaaja_id: p.id, ...(ta.value.trim() ? {} : { otsikko: tied[0].name }) });
      if (tied.length) {
        await lataaTiedostot(h.id, tied);
        asetaKonteksti({ liitteet: await haeLiitteet(lista.map((x) => x.id).concat(h.id)) });
      }
      ilmoita("Muistiinpano tallennettu"); lisaa(h);
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); }
  };
}
