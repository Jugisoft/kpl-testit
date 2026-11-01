// Viikkoni: nuoren urheilijan arki ja kuormitus (1.11.2026).
// Lähteet: ryhmän Nimenhuuto-tapahtumat (taulu tapahtumat, valmentaja voi korjata luokittelun), pelaajan omat
// treenit (omat_treenit) ja testipäivät (tulokset). Rasitus on ARVIO treenityypistä: kuorma = arvioitu RPE × minuutit
// (sRPE-menetelmän periaate, Foster 2001). Akuutti:krooninen-suhde = viim. 7 pv / edellisten 4 viikon keskiarvo;
// > 1,5 liittyy tutkimuksissa kohonneeseen vammariskiin (Hulin ym. 2016, ks. Arazi ym. 2020 Front Physiol).
import { sb, tila } from "./db.js";
import { $, $$, esc, ilmoita } from "./util.js";

export const TYYPIT = [ // pinoamisjärjestys = värijärjestys (validoitu tummalle pinnalle: CVD ΔE ≥ 9,4)
  { k: "laji", nimi: "Laji", rpe: 5, vari: "#c98500" },
  { k: "fysiikka", nimi: "Fysiikka", rpe: 6, vari: "#3987e5" },
  { k: "peli", nimi: "Peli", rpe: 7, vari: "#d95926" },
  { k: "aerobinen", nimi: "Aerobinen", rpe: 4, vari: "#199e70" },
  { k: "testi", nimi: "Testi", rpe: 6, vari: "#9085e9" },
  { k: "palauttava", nimi: "Palauttava", rpe: 2, vari: "#d55181" },
];
const T = Object.fromEntries(TYYPIT.map((t) => [t.k, t]));
const RASKAS = 450; // AU, esim. 90 min lajia (5) tai 75 min fysiikkaa (6)

const PAIVA = 864e5;
const lisaaPv = (s, n) => new Date(new Date(s + "T12:00:00Z").getTime() + n * PAIVA).toISOString().slice(0, 10);
const tanaan = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
const VKP = ["ma", "ti", "ke", "to", "pe", "la", "su"];
const minStr = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
const pvLyh = (s) => `${+s.slice(8, 10)}.${+s.slice(5, 7)}.`;

// --- luokittelu ---
const SANAT = [
  ["peli", /ottelu|\bpeli|\bvs\.?\b|turnau|harjoitusottelu|cup\b/i],
  ["testi", /testi/i],
  ["palauttava", /palaut|liikkuvuu|huolto|jooga|venyt|kehonhuolto/i],
  ["fysiikka", /\bsali|voima|fysiik|kunto(?!lenk)|nopeu|loikk|plyo|ketteryy|hyppy/i],
  ["aerobinen", /lenk|juoks|aerob|kestävyy|pyörä|hiihto|uinti|cooper|pk-/i],
];
export function arvaaTyyppi(otsikko) {
  for (const [k, re] of SANAT) if (re.test(otsikko || "")) return k;
  return "laji";
}
export function kestoMin(e) {
  if (e.alku && e.loppu) {
    const [ah, am] = e.alku.split(":").map(Number), [lh, lm] = e.loppu.split(":").map(Number);
    const m = lh * 60 + lm - (ah * 60 + am);
    if (m >= 10 && m <= 600) return m;
  }
  return 90;
}
// Tapahtuman osat: valmentajan korjaus tai automaattinen arvio
export function osat(e) {
  if (Array.isArray(e.osat) && e.osat.length) return { osat: e.osat.filter((o) => T[o.tyyppi] && o.min > 0), korjattu: true };
  return { osat: [{ tyyppi: arvaaTyyppi(e.otsikko), min: kestoMin(e) }], korjattu: false };
}

// --- tapahtumat yhdeksi listaksi ---
function kokoa(nh, omat, testipaivat) {
  const rivit = [];
  for (const e of nh) {
    if (e.peruttu) continue;
    for (const o of osat(e).osat) rivit.push({ pvm: e.pvm, tyyppi: o.tyyppi, min: o.min, otsikko: e.otsikko, lahde: "nh" });
  }
  for (const o of omat) rivit.push({ pvm: o.pvm, tyyppi: o.tyyppi, min: o.kesto_min, otsikko: o.huomio || `Oma ${T[o.tyyppi].nimi.toLowerCase()}`, lahde: "oma", id: o.id });
  const testiPv = new Set(rivit.filter((r) => r.tyyppi === "testi").map((r) => r.pvm));
  for (const d of testipaivat) if (!testiPv.has(d)) rivit.push({ pvm: d, tyyppi: "testi", min: 60, otsikko: "Testipäivä (tulokset)", lahde: "testi" });
  for (const r of rivit) r.au = r.min * T[r.tyyppi].rpe;
  return rivit;
}
const summa = (rivit, f = () => true) => rivit.filter(f).reduce((s, r) => s + r.au, 0);

// --- analyysi ---
export function analysoi(rivit, viikko) {
  const nyt = tanaan();
  const loppu = lisaaPv(viikko, 6);
  const paivat = VKP.map((v, i) => {
    const d = lisaaPv(viikko, i), r = rivit.filter((x) => x.pvm === d);
    return { pvm: d, vkp: v, rivit: r, min: r.reduce((s, x) => s + x.min, 0), au: summa(r), tuleva: d > nyt, tanaan: d === nyt };
  });
  const tyypit = TYYPIT.map((t) => ({ ...t, min: paivat.reduce((s, p) => s + p.rivit.filter((r) => r.tyyppi === t.k).reduce((a, r) => a + r.min, 0), 0) })).filter((t) => t.min);
  const yht = tyypit.reduce((s, t) => s + t.min, 0);
  const lepo = paivat.filter((p) => !p.min && !p.tuleva).length;
  const lepoSuunn = paivat.filter((p) => !p.min && p.tuleva).length;

  // 6 viikon trendi (valittu viikko viimeisenä)
  const trendi = [5, 4, 3, 2, 1, 0].map((n) => {
    const a = lisaaPv(viikko, -7 * n), b = lisaaPv(a, 6), r = rivit.filter((x) => x.pvm >= a && x.pvm <= b);
    return { alku: a, au: summa(r), min: r.reduce((s, x) => s + x.min, 0), tyypit: TYYPIT.map((t) => ({ k: t.k, min: r.filter((x) => x.tyyppi === t.k).reduce((s, x) => s + x.min, 0) })) };
  });

  // akuutti:krooninen viitepäivään (tänään tai valitun viikon loppu, kumpi aiempi)
  const viite = loppu < nyt ? loppu : nyt;
  const akuutti = summa(rivit, (r) => r.pvm > lisaaPv(viite, -7) && r.pvm <= viite);
  const krooninen = summa(rivit, (r) => r.pvm > lisaaPv(viite, -35) && r.pvm <= lisaaPv(viite, -7)) / 4;
  const ekaPv = rivit.map((r) => r.pvm).sort()[0];
  const historiaa = ekaPv && ekaPv <= lisaaPv(viite, -21);
  const acwr = historiaa && krooninen > 0 ? akuutti / krooninen : null;

  const huomiot = [];
  if (acwr != null && acwr > 1.5) huomiot.push({ taso: "varoitus", teksti: `Viimeisen 7 päivän kuorma on ${acwr.toFixed(1).replace(".", ",")} × edellisten neljän viikon keskitaso. Yli 1,5-kertainen äkillinen nousu on tutkimuksissa liitetty kohonneeseen vammariskiin – puhu valmentajan kanssa, voisiko jotain keventää.` });
  else if (acwr != null && acwr < 0.6) huomiot.push({ taso: "info", teksti: `Viimeinen viikko on selvästi kevyempi kuin edellisten viikkojen keskitaso (${Math.round(acwr * 100)} %). Jos tauko on tarkoituksellinen, hyvä – palaa tasoon vähitellen.` });
  // lepopäivät viim. 7 pv
  const viim7 = [...Array(7)].map((_, i) => lisaaPv(viite, -i));
  const lepoViim7 = viim7.filter((d) => !rivit.some((r) => r.pvm === d && r.tyyppi !== "palauttava")).length;
  if (historiaa || rivit.some((r) => r.pvm <= lisaaPv(viite, -6))) {
    if (lepoViim7 === 0) huomiot.push({ taso: "varoitus", teksti: "Viimeisen 7 päivän aikana ei ole ollut yhtään lepopäivää (palauttavaa harjoittelua lukuun ottamatta). Mieti, mihin väliin mahtuisi vapaa päivä." });
  }
  // raskaiden päivien putki
  let putki = 0, pisin = 0, putkiLoppu = null;
  for (let i = 13; i >= 0; i--) {
    const d = lisaaPv(viite, -i), au = summa(rivit, (r) => r.pvm === d);
    putki = au >= RASKAS ? putki + 1 : 0;
    if (putki > pisin) { pisin = putki; putkiLoppu = d; }
  }
  if (pisin >= 3) huomiot.push({ taso: "info", teksti: `${pisin} raskasta päivää peräkkäin (päättyi ${pvLyh(putkiLoppu)}). Raskaiden päivien väliin kannattaa yleensä sijoittaa kevyempi tai vapaa päivä.` });
  // tulevat pelit ja testit
  for (const r of rivit.filter((x) => (x.tyyppi === "peli" || x.tyyppi === "testi") && x.pvm > nyt && x.pvm <= lisaaPv(nyt, 2))) {
    const ero = Math.round((new Date(r.pvm) - new Date(nyt)) / PAIVA);
    huomiot.push({ taso: "tuleva", teksti: `${r.tyyppi === "peli" ? "Peli" : "Testit"} ${ero === 1 ? "huomenna" : "ylihuomenna"}: ${r.otsikko}. Edeltävä päivä kannattaa pitää kevyempänä, ja nuku hyvin.` });
  }
  if (!historiaa) huomiot.push({ taso: "info", teksti: "Kuormahistoria kertyy: vertailu omaan tasoon (akuutti vs. pitkän ajan kuorma) näkyy, kun dataa on kertynyt vähintään 3 viikolta." });
  return { paivat, tyypit, yht, lepo, lepoSuunn, trendi, acwr, akuutti, krooninen, huomiot, harj: paivat.reduce((s, p) => s + p.rivit.length, 0) };
}

// --- piirto ---
// el = säiliö, p = pelaaja, opt = { viikko, nh: [tapahtumat], testipaivat: [pvm], oma: bool, paivita: fn }
export async function piirraKuorma(el, p, opt) {
  const alku = lisaaPv(opt.viikko, -35), loppu = lisaaPv(opt.viikko, 13);
  const { data: omat = [], error } = await sb.from("omat_treenit").select("*").eq("pelaaja_id", p.id).gte("pvm", alku).lte("pvm", loppu).order("pvm");
  if (error) { el.innerHTML = `<p class="pieni">Omia treenejä ei saatu haettua: ${esc(error.message)}</p>`; return; }
  const rivit = kokoa(opt.nh || [], omat || [], opt.testipaivat || []);
  const a = analysoi(rivit, opt.viikko);
  const omatVk = (omat || []).filter((o) => o.pvm >= opt.viikko && o.pvm <= lisaaPv(opt.viikko, 6));
  const maxPv = Math.max(120, ...a.paivat.map((d) => d.min));
  const maxVk = Math.max(1, ...a.trendi.map((w) => w.min));
  const tila_ = a.acwr == null ? null : a.acwr > 1.5 ? ["varoitus", "Kuorma nousee jyrkästi"] : a.acwr < 0.6 ? ["info", "Kevyempi jakso"] : ["hyva", "Kuorma tasainen"];

  el.innerHTML = `
    <div class="oma-osa-paa">
      <div><h2 id="ku-otsikko">Viikkoni</h2><p class="pieni">Arki ja kuormitus · arvio treenityypeistä</p></div>
      ${tila_ ? `<span class="ku-tila ${tila_[0]}"><span aria-hidden="true">${tila_[0] === "varoitus" ? "▲" : tila_[0] === "hyva" ? "●" : "▽"}</span>${tila_[1]}</span>` : ""}
    </div>
    <div class="ku-luvut">
      <div><b class="num">${a.yht ? minStr(a.yht) : "–"}</b><span>harjoittelua</span></div>
      <div><b class="num">${a.harj}</b><span>harjoitusta</span></div>
      <div><b class="num">${a.lepo}${a.lepoSuunn ? `<small> + ${a.lepoSuunn}</small>` : ""}</b><span>lepopäivää${a.lepoSuunn ? " (+ tulevat vapaat)" : ""}</span></div>
      <div><b class="num">${a.acwr != null ? a.acwr.toFixed(2).replace(".", ",") : "–"}</b><span>kuorma vs. oma taso</span></div>
    </div>

    ${a.yht ? `<div class="ku-jakauma" role="img" aria-label="Viikon minuutit tyypeittäin: ${a.tyypit.map((t) => `${t.nimi} ${t.min} min`).join(", ")}">
      ${a.tyypit.map((t) => `<i style="flex:${t.min};background:${t.vari}" data-tip="${t.nimi}: ${minStr(t.min)} (${Math.round((100 * t.min) / a.yht)} %)"></i>`).join("")}
    </div>
    <ul class="ku-selite">${a.tyypit.map((t) => `<li><i style="background:${t.vari}"></i>${t.nimi}<b class="num">${minStr(t.min)}</b><span>${Math.round((100 * t.min) / a.yht)} %</span></li>`).join("")}</ul>` : `<p class="tyhja">Tälle viikolle ei ole merkitty harjoituksia.</p>`}

    <div class="ku-paivat" role="list" aria-label="Viikon päivät">
      ${a.paivat.map((d) => `<div class="ku-pv${d.tanaan ? " tanaan" : ""}${d.tuleva ? " tuleva" : ""}" role="listitem">
        <div class="ku-pylvas" aria-hidden="true">${d.min ? `<div class="ku-pino" style="height:${Math.max(8, (100 * d.min) / maxPv)}%">${TYYPIT.map((t) => { const m = d.rivit.filter((r) => r.tyyppi === t.k).reduce((s, r) => s + r.min, 0); return m ? `<i style="flex:${m};background:${t.vari}"></i>` : ""; }).join("")}</div>` : `<span class="ku-lepo">${d.tuleva ? "vapaa" : "lepo"}</span>`}</div>
        <div class="ku-pv-nimi"><b>${d.vkp}</b> ${pvLyh(d.pvm)}</div>
        <div class="ku-pv-min num">${d.min ? minStr(d.min) : ""}</div>
        <ul class="ku-pv-lista">${ryhmita(d.rivit).map((g) => `<li data-tip="${esc(g[0].otsikko)} · ${g.map((r) => `${T[r.tyyppi].nimi} ${r.min} min`).join(" + ")}${g[0].lahde === "oma" ? " · oma treeni" : g[0].lahde === "testi" ? " · testitulokset" : ""}">${g.map((r) => `<i style="background:${T[r.tyyppi].vari}"></i>`).join("")}${esc(g[0].otsikko)}</li>`).join("")}</ul>
      </div>`).join("")}
    </div>
    <p class="pieni ku-pieni">Tulevat päivät ovat suunniteltuja (katkoviiva). Lepo = päivä ilman merkittyä harjoitusta.</p>

    ${a.huomiot.length ? `<ul class="ku-huomiot">${a.huomiot.map((h) => `<li class="${h.taso}"><span aria-hidden="true">${h.taso === "varoitus" ? "▲" : h.taso === "tuleva" ? "◆" : "i"}</span><span>${h.teksti}</span></li>`).join("")}</ul>` : ""}

    <h3>Kuusi viikkoa</h3>
    <div class="ku-trendi" role="img" aria-label="Harjoitusminuutit viikoittain: ${a.trendi.map((w) => `${pvLyh(w.alku)} ${w.min} min`).join(", ")}">
      ${a.trendi.map((w, i) => `<div class="ku-vk${i === 5 ? " valittu" : ""}" data-tip="Viikko ${pvLyh(w.alku)}: ${minStr(w.min)} · kuorma-arvio ${w.au} AU">
        <span class="ku-vk-arvo num">${w.min ? minStr(w.min).replace(" min", "") : ""}</span>
        <div class="ku-vk-pylvas">${w.min ? `<div class="ku-pino" style="height:${Math.max(4, (100 * w.min) / maxVk)}%">${w.tyypit.filter((t) => t.min).map((t) => `<i style="flex:${t.min};background:${T[t.k].vari}"></i>`).join("")}</div>` : ""}</div>
        <span class="ku-vk-nimi">${pvLyh(w.alku)}</span>
      </div>`).join("")}
    </div>
    <ul class="ku-selite pieni-selite">${TYYPIT.map((t) => `<li><i style="background:${t.vari}"></i>${t.nimi}</li>`).join("")}</ul>

    ${opt.oma ? `<form id="ku-uusi" class="oma-lomake">
      <h3>Lisää oma treeni</h3>
      <div class="ku-chipit" role="radiogroup" aria-label="Treenin tyyppi">${TYYPIT.filter((t) => t.k !== "peli").map((t, i) => `<label class="chip"><input type="radio" name="tyyppi" value="${t.k}"${i === 0 ? " checked" : ""}><i class="ku-pallo" style="background:${t.vari}"></i>${t.nimi}</label>`).join("")}</div>
      <div class="ku-chipit" role="radiogroup" aria-label="Kesto">${[30, 45, 60, 90].map((m) => `<label class="chip"><input type="radio" name="pika" value="${m}"${m === 45 ? " checked" : ""}>${m} min</label>`).join("")}
        <label class="kentta ku-kesto">tai min<input type="number" name="kesto" min="5" max="600" inputmode="numeric" placeholder="–"></label></div>
      <div class="oma-kentat">
        <label class="kentta">Päivä<input type="date" name="pvm" value="${tanaan()}" max="${lisaaPv(tanaan(), 7)}" required></label>
        <label class="kentta">Huomio<input type="text" name="huomio" maxlength="120" placeholder="esim. salitreeni koulun jälkeen"></label>
      </div>
      <div class="rivi"><button class="btn ensisij">Lisää</button></div>
    </form>` : ""}
    ${omatVk.length ? `<h3>Omat treenit tällä viikolla</h3><ul class="ku-omat">${omatVk.map((o) => `<li><i style="background:${T[o.tyyppi].vari}"></i><span><b>${pvLyh(o.pvm)}</b> ${T[o.tyyppi].nimi} ${o.kesto_min} min${o.huomio ? ` · ${esc(o.huomio)}` : ""}</span>${opt.oma ? `<button class="linkkinappi" data-poista-oma="${o.id}">Poista</button>` : ""}</li>`).join("")}</ul>` : ""}
    <details class="ku-miten"><summary>Miten tämä lasketaan?</summary>
      <p class="pieni">Jokaiselle harjoitukselle arvioidaan rasitus tyypin perusteella (laji 5, fysiikka 6, peli 7, aerobinen 4, testi 6, palauttava 2 asteikolla 0–10) ja kerrotaan minuuteilla. Näin saadaan kuorma-arvio (AU). Luku <b>kuorma vs. oma taso</b> on viimeisen 7 päivän kuorma jaettuna edellisten neljän viikon viikkokeskiarvolla: noin 0,8–1,3 on tasaista, yli 1,5 äkillinen nousu. Nimenhuudon tapahtumat luokitellaan otsikon perusteella, ja valmentaja voi korjata luokittelun. Testipäivät tulevat testituloksista.</p>
    </details>`;

  tooltip(el);
  const f = $("#ku-uusi", el);
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const x = f.elements, kesto = +x.kesto.value || +x.pika.value;
    if (!(kesto >= 5 && kesto <= 600)) { ilmoita("Kesto 5–600 minuuttia", true); return; }
    const { error } = await sb.from("omat_treenit").insert({ pelaaja_id: p.id, pvm: x.pvm.value, tyyppi: x.tyyppi.value, kesto_min: kesto, huomio: x.huomio.value.trim() || null });
    if (error) { ilmoita("Tallennus ei onnistunut: " + error.message, true); return; }
    ilmoita("Treeni lisätty"); opt.paivita();
  };
  $$("[data-poista-oma]", el).forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from("omat_treenit").delete().eq("id", b.dataset.poistaOma);
    if (error) ilmoita("Poisto ei onnistunut: " + error.message, true); else opt.paivita();
  }));
}

// saman tapahtuman osat yhdeksi riviksi päivälistassa
function ryhmita(rivit) {
  const m = new Map();
  for (const r of rivit) { const k = r.lahde + "|" + (r.id || r.otsikko); (m.get(k) || m.set(k, []).get(k)).push(r); }
  return [...m.values()];
}

function tooltip(el) {
  let tip = document.getElementById("ku-tip");
  if (!tip) { tip = document.createElement("div"); tip.id = "ku-tip"; tip.className = "ku-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
  const nayta = (t, x, y) => { tip.textContent = t; tip.style.left = Math.min(x + 12, innerWidth - tip.offsetWidth - 8) + "px"; tip.style.top = y + 14 + "px"; tip.classList.add("nakyy"); };
  $$("[data-tip]", el).forEach((m) => {
    m.onmousemove = (e) => nayta(m.dataset.tip, e.clientX, e.clientY);
    m.onmouseleave = () => tip.classList.remove("nakyy");
  });
}

// --- valmentajan luokittelueditori Nimenhuudon tapahtumille ---
export function luokitteluTagi(e, ohjaaja) {
  if (e.peruttu) return "";
  const { osat: o, korjattu } = osat(e);
  return `<span class="ku-luokka${korjattu ? " korjattu" : ""}">${o.map((x) => `<span><i style="background:${T[x.tyyppi].vari}"></i>${T[x.tyyppi].nimi} ${x.min}</span>`).join("")}${korjattu ? "" : '<em title="automaattinen arvio otsikosta">auto</em>'}</span>
    ${ohjaaja ? `<button class="linkkinappi" data-luokittele="${esc(e.uid)}">Luokittele</button>` : ""}`;
}
export function kytkeLuokittelu(el, joukkue, tapahtumat, paivita) {
  $$("[data-luokittele]", el).forEach((b) => (b.onclick = () => {
    const e = tapahtumat.find((t) => t.uid === b.dataset.luokittele);
    const li = b.closest("li");
    if (li.querySelector(".ku-editori")) return;
    const nyk = osat(e).osat;
    const rivit = [...nyk, ...Array(Math.max(0, 3 - nyk.length)).fill({ tyyppi: "", min: "" })].slice(0, 3);
    const lomake = document.createElement("form");
    lomake.className = "ku-editori";
    lomake.innerHTML = `<p class="pieni">Jaa harjoitus osiin (yhteensä ${kestoMin(e)} min kalenterissa).</p>
      ${rivit.map((r, i) => `<div class="rivi"><select name="t${i}" aria-label="Osa ${i + 1} tyyppi"><option value="">–</option>${TYYPIT.map((t) => `<option value="${t.k}"${r.tyyppi === t.k ? " selected" : ""}>${t.nimi}</option>`).join("")}</select>
        <input type="number" name="m${i}" min="5" max="600" value="${r.min || ""}" aria-label="Osa ${i + 1} minuutit" placeholder="min"></div>`).join("")}
      <div class="rivi"><button class="btn ensisij">Tallenna</button><button type="button" class="btn" data-auto>Palauta automaattinen</button><button type="button" class="linkkinappi" data-peru>Peru</button></div>`;
    li.appendChild(lomake);
    const tallenna = async (arvo) => {
      const { error } = await sb.from("tapahtumat").update({ osat: arvo, korjannut: (tila.istunto?.user?.email || "").toLowerCase() }).eq("joukkue_id", joukkue).eq("uid", e.uid);
      if (error) { ilmoita("Tallennus ei onnistunut: " + error.message, true); return; }
      ilmoita(arvo ? "Luokittelu tallennettu" : "Palautettu automaattiseen"); paivita();
    };
    lomake.onsubmit = (ev) => {
      ev.preventDefault();
      const x = lomake.elements, o = [0, 1, 2].map((i) => ({ tyyppi: x["t" + i].value, min: +x["m" + i].value })).filter((r) => r.tyyppi && r.min >= 5);
      if (!o.length) { ilmoita("Valitse vähintään yksi tyyppi ja minuutit", true); return; }
      tallenna(o);
    };
    lomake.querySelector("[data-auto]").onclick = () => tallenna(null);
    lomake.querySelector("[data-peru]").onclick = () => lomake.remove();
  }));
}
