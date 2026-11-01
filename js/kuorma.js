// Viikkoni: nuoren urheilijan arki ja kuormitus (1.11.2026). Laskenta: js/kuormaydin.js.
// Lähteet: ryhmän Nimenhuuto-tapahtumat (taulu tapahtumat; valmentaja korjaa luokittelun, pelaaja merkitsee poissaolon),
// omatoimiset kirjaukset ohjelmakirjastosta (omat_treenit + treeniohjelmat), lyöntipäiväkirja (rpc kuorma_lyonnit) ja testipäivät.
import { sb, tila, SUPABASE_URL } from "./db.js";
import { $, $$, esc, ilmoita } from "./util.js";
import { TYYPIT, T, lisaaPv, tanaanHki as tanaan, minStr, pvLyh, kokoa, analysoi, osat, kestoMin, maaratTeksti } from "./kuormaydin.js";
export { TYYPIT };

// Nimenhuudon tapahtumat palvelinfunktion kautta (ics-linkki ei tule selaimeen)
export async function haeKalenteri(joukkue, alku, loppu) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/kalenteri?joukkue=${joukkue}&alku=${alku}&loppu=${loppu}`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    return r.ok ? await r.json() : { virhe: (await r.json().catch(() => ({}))).virhe || `HTTP ${r.status}` };
  } catch (e) { return { virhe: String(e.message || e) }; }
}

let ohjelmaVarasto = null;
export async function haeOhjelmat() {
  if (!ohjelmaVarasto) {
    const { data, error } = await sb.from("treeniohjelmat").select("*").eq("aktiivinen", true).order("jarjestys");
    if (error) return {};
    ohjelmaVarasto = Object.fromEntries((data || []).map((o) => [o.koodi, o]));
  }
  return ohjelmaVarasto;
}

// Pelaajien kuormadata yhdellä kertaa (pelaajan sivu ja valmentajan kooste)
export async function haeKuormaRivit(pelaajat, nh, alku, loppu, testipaivat = {}) {
  const ids = pelaajat.map((p) => p.id);
  const [ohjelmat, omat, poissa, ly] = await Promise.all([
    haeOhjelmat(),
    sb.from("omat_treenit").select("*").in("pelaaja_id", ids).gte("pvm", alku).lte("pvm", loppu).order("pvm"),
    sb.from("poissaolot").select("pelaaja_id,uid").in("pelaaja_id", ids),
    sb.rpc("kuorma_lyonnit", { p_alku: alku, p_loppu: loppu }),
  ]);
  const virhe = omat.error || poissa.error;
  return { virhe, ohjelmat, omat: omat.data || [], poissa: poissa.data || [], tulos: Object.fromEntries(pelaajat.map((p) => [p.id, kokoa({
    nh, ohjelmat,
    poissa: new Set((poissa.data || []).filter((x) => x.pelaaja_id === p.id).map((x) => x.uid)),
    omat: (omat.data || []).filter((o) => o.pelaaja_id === p.id),
    lyonnit: (ly.data || []).filter((l) => l.pelaaja_id === p.id),
    testipaivat: testipaivat[p.id] || [],
  })])) };
}

// --- piirto ---
// el = säiliö, p = pelaaja, opt = { viikko, nh: [tapahtumat], testipaivat: [pvm], oma: bool, paivita: fn }
export async function piirraKuorma(el, p, opt) {
  const alku = lisaaPv(opt.viikko, -35), loppu = lisaaPv(opt.viikko, 13);
  const data = await haeKuormaRivit([p], opt.nh || [], alku, loppu, { [p.id]: opt.testipaivat || [] });
  if (data.virhe) { el.innerHTML = `<p class="pieni">Kuormatietoja ei saatu haettua: ${esc(data.virhe.message)}</p>`; return; }
  const rivit = data.tulos[p.id], ohjelmat = data.ohjelmat;
  const a = analysoi(rivit, opt.viikko);
  const omatVk = data.omat.filter((o) => o.pvm >= opt.viikko && o.pvm <= lisaaPv(opt.viikko, 6));
  const poissaVk = new Set(data.poissa.map((x) => x.uid));
  const maxPv = Math.max(120, ...a.paivat.map((d) => d.min));
  const maxVk = Math.max(1, ...a.trendi.map((w) => w.min));
  const tila_ = a.acwr == null ? null : a.acwr > 1.5 ? ["varoitus", "Kuorma nousee jyrkästi"] : a.acwr < 0.6 ? ["info", "Kevyempi jakso"] : ["hyva", "Kuorma tasainen"];
  const ryhmat = [...new Set(Object.values(ohjelmat).map((o) => o.ryhma))];

  el.innerHTML = `
    <div class="oma-osa-paa">
      <div><h2 id="ku-otsikko">Viikkoni</h2><p class="pieni">Arki ja kuormitus</p></div>
      ${tila_ ? `<span class="ku-tila ${tila_[0]}"><span aria-hidden="true">${tila_[0] === "varoitus" ? "▲" : tila_[0] === "hyva" ? "●" : "▽"}</span>${tila_[1]}</span>` : ""}
    </div>
    <div class="ku-perusta" aria-label="Mihin arvio perustuu">
      <b>Mihin arvio perustuu</b>
      <ul>
        <li><span>1</span><span>Ryhmän treenit Nimenhuudosta – oletus on, että olit mukana. Merkitse poissaolo viikon ohjelmassa.</span></li>
        <li><span>2</span><span>Omat kirjauksesi (alla) ja lyöntipäiväkirja (100 lyöntiä ≈ 30 min lajia).</span></li>
        <li><span>3</span><span>Testipäivät testituloksista.</span></li>
        <li><span>4</span><span>Rasitus on <b>arvio</b>: treenityypin tai ohjelman tyypillinen rasitus × minuutit. Ei sykettä eikä omaa tuntemusta.</span></li>
      </ul>
    </div>
    <div class="ku-luvut">
      <div><b class="num">${a.yht ? minStr(a.yht) : "–"}</b><span>harjoittelua</span></div>
      <div><b class="num">${a.omaMin ? minStr(a.omaMin) : "–"}</b><span>siitä omatoimista</span></div>
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
        <ul class="ku-pv-lista">${ryhmita(d.rivit).map((g) => `<li class="${g[0].lahde === "nh" ? "" : "oma"}" data-tip="${esc(g[0].otsikko)} · ${g.map((r) => `${T[r.tyyppi].nimi} ${r.min} min`).join(" + ")}${g[0].lisa ? ` · ${esc(g[0].lisa)}` : ""}${LAHDE[g[0].lahde]}">${g.map((r) => `<i style="background:${T[r.tyyppi].vari}"></i>`).join("")}${esc(g[0].otsikko)}</li>`).join("")}</ul>
      </div>`).join("")}
    </div>
    <p class="pieni ku-pieni">Tulevat päivät ovat suunniteltuja (katkoviiva). Lepo = päivä ilman merkittyä harjoitusta. Omatoimiset kursiivilla.</p>

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

    ${opt.oma ? `<form id="ku-uusi" class="oma-lomake ku-kirjaus">
      <h3>Kirjaa omatoiminen treeni</h3>
      <p class="pieni">Valitse ohjelma tai laji, kesto ja päivä. Lyönnit kirjataan <a href="#/lyonnit">lyöntipäiväkirjaan</a> – ne lasketaan mukaan automaattisesti.</p>
      ${ryhmat.map((r) => `<div class="ku-ryhma"><span class="ku-ryhma-nimi">${esc(r)}</span><div class="ku-chipit" role="radiogroup" aria-label="${esc(r)}">${Object.values(ohjelmat).filter((o) => o.ryhma === r).map((o) => `<label class="chip"><input type="radio" name="ohjelma" value="${o.koodi}" required><i class="ku-pallo" style="background:${T[o.tyyppi].vari}"></i>${esc(o.nimi)}</label>`).join("")}</div></div>`).join("")}
      <div id="ku-valinta" class="ku-valinta" hidden></div>
      <div class="ku-chipit" role="radiogroup" aria-label="Kesto"><span class="ku-ryhma-nimi">Kesto</span>${[20, 30, 45, 60, 75, 90].map((m) => `<label class="chip"><input type="radio" name="pika" value="${m}"${m === 45 ? " checked" : ""}>${m} min</label>`).join("")}
        <label class="kentta ku-kesto">tai min<input type="number" name="kesto" min="5" max="600" inputmode="numeric" placeholder="–"></label></div>
      <div class="oma-kentat">
        <label class="kentta">Päivä<input type="date" name="pvm" value="${tanaan()}" min="${lisaaPv(tanaan(), -14)}" max="${tanaan()}" required></label>
        <label class="kentta">Huomio<input type="text" name="huomio" maxlength="120" placeholder="valinnainen, esim. tuntui raskaalta"></label>
      </div>
      <div class="rivi"><button class="btn ensisij">Kirjaa treeni</button></div>
    </form>` : ""}
    ${omatVk.length ? `<h3>Omatoimiset tällä viikolla</h3><ul class="ku-omat">${omatVk.map((o) => { const ohj = ohjelmat[o.ohjelma]; const ty = T[o.tyyppi] || T.laji; const lisa = maaratTeksti(o); return `<li><i style="background:${ty.vari}"></i><span><b>${pvLyh(o.pvm)}</b> ${esc(ohj?.nimi || ty.nimi)} · ${o.kesto_min} min${lisa ? ` · ${esc(lisa)}` : ""}${o.huomio ? ` <small>· ${esc(o.huomio)}</small>` : ""}</span>${opt.oma ? `<button class="linkkinappi" data-poista-oma="${o.id}">Poista</button>` : ""}</li>`; }).join("")}</ul>` : ""}
    <details class="ku-miten"><summary>Tarkemmin laskennasta</summary>
      <p class="pieni">Jokaiselle harjoitukselle käytetään tyypillistä rasitusta asteikolla 0–10 (laji 5, fysiikka 6, peli 7, aerobinen 4, testi 6, palauttava 2; valmentajan ohjelmilla oma arvio, esim. Voima 1–3 = 7, Liikkuvuus = 2) ja se kerrotaan minuuteilla. Tulos on kuorma-arvio (AU). <b>Kuorma vs. oma taso</b> = viimeisen 7 päivän kuorma jaettuna edellisten neljän viikon viikkokeskiarvolla: noin 0,8–1,3 on tasaista, yli 1,5 äkillinen nousu, joka on tutkimuksissa liitetty kohonneeseen vammariskiin (Hulin ym. 2016). Raskas päivä = vähintään 450 AU (esim. 90 min lajia). Nimenhuudon tapahtumat luokitellaan otsikosta; valmentaja voi korjata. Arvio ei tiedä, miltä treeni tuntui – jos olo on väsynyt, kerro valmentajalle.</p>
    </details>`;

  tooltip(el);
  const f = $("#ku-uusi", el);
  if (f) {
    const valinta = $("#ku-valinta", f);
    f.querySelectorAll("[name=ohjelma]").forEach((r) => (r.onchange = () => {
      const o = ohjelmat[r.value];
      const pika = [...f.elements.pika].find((x) => +x.value === o.kesto_min);
      if (pika) { pika.checked = true; f.elements.kesto.value = ""; } else f.elements.kesto.value = o.kesto_min;
      valinta.hidden = false;
      valinta.innerHTML = `<div class="ku-valinta-paa"><i class="ku-pallo" style="background:${T[o.tyyppi].vari}"></i><b>${esc(o.nimi)}</b><span class="pieni">${T[o.tyyppi].nimi} · rasitusarvio ${o.rpe}/10</span></div>
        ${o.maarat.length || o.km ? `<div class="oma-kentat ku-maarat">${o.maarat.map((m, i) => `<label class="kentta">${esc(m)}<input type="number" name="maara${i}" data-maara="${esc(m)}" min="0" max="5000" inputmode="numeric" placeholder="kpl"></label>`).join("")}${o.km ? `<label class="kentta">Matka (km)<input type="number" name="km" min="0" max="300" step="0.1" inputmode="decimal" placeholder="km"></label>` : ""}</div>` : ""}
        ${o.kuvaus ? `<details class="ku-ohjelma"><summary>Näytä ohjelma</summary><ul>${o.kuvaus.split("\n").map((l) => `<li>${linkit(l)}</li>`).join("")}</ul>${o.lahde ? `<p class="pieni">Lähde: ${esc(o.lahde)}</p>` : ""}</details>` : ""}`;
    }));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const x = f.elements, o = ohjelmat[x.ohjelma.value], kesto = +x.kesto.value || +x.pika.value;
      if (!o) { ilmoita("Valitse ohjelma tai laji", true); return; }
      if (!(kesto >= 5 && kesto <= 600)) { ilmoita("Kesto 5–600 minuuttia", true); return; }
      const maarat = {};
      f.querySelectorAll("[data-maara]").forEach((i) => { if (+i.value > 0) maarat[i.dataset.maara] = Math.round(+i.value); });
      const km = x.km && x.km.value ? +x.km.value : null;
      const { error } = await sb.from("omat_treenit").insert({ pelaaja_id: p.id, pvm: x.pvm.value, tyyppi: o.tyyppi, ohjelma: o.koodi, kesto_min: kesto,
        maarat: Object.keys(maarat).length ? maarat : null, km, huomio: x.huomio.value.trim() || null });
      if (error) { ilmoita("Tallennus ei onnistunut: " + error.message, true); return; }
      ilmoita("Treeni kirjattu"); opt.paivita();
    };
  }
  $$("[data-poista-oma]", el).forEach((b) => (b.onclick = async () => {
    const { error } = await sb.from("omat_treenit").delete().eq("id", b.dataset.poistaOma);
    if (error) ilmoita("Poisto ei onnistunut: " + error.message, true); else opt.paivita();
  }));
  return { poissa: poissaVk };
}
const LAHDE = { nh: " · ryhmän treeni", oma: " · omatoiminen", lyonti: " · lyöntipäiväkirja", testi: " · testitulokset" };
const linkit = (l) => esc(l).replace(/(https?:\/\/[^\s]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">video ↗</a>`);

// saman tapahtuman osat yhdeksi riviksi päivälistassa
function ryhmita(rivit) {
  const m = new Map();
  for (const r of rivit) { const k = r.lahde + "|" + (r.id || r.otsikko); (m.get(k) || m.set(k, []).get(k)).push(r); }
  return [...m.values()];
}

export function tooltip(el) {
  let tip = document.getElementById("ku-tip");
  if (!tip) { tip = document.createElement("div"); tip.id = "ku-tip"; tip.className = "ku-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
  const nayta = (t, x, y) => { tip.textContent = t; tip.style.left = Math.min(x + 12, innerWidth - tip.offsetWidth - 8) + "px"; tip.style.top = y + 14 + "px"; tip.classList.add("nakyy"); };
  $$("[data-tip]", el).forEach((m) => {
    m.onmousemove = (e) => nayta(m.dataset.tip, e.clientX, e.clientY);
    m.onmouseleave = () => tip.classList.remove("nakyy");
  });
}

// --- valmentajan luokittelueditori Nimenhuudon tapahtumille ---
export function poissaNappi(e, poissa, voi) {
  if (e.peruttu || !voi) return "";
  const on = poissa.has(e.uid);
  return `<button class="linkkinappi ku-poissa${on ? " on" : ""}" data-poissa="${esc(e.uid)}" aria-pressed="${on}">${on ? "Poissa ✓" : "Olin poissa"}</button>`;
}
export function kytkePoissaolot(el, p, poissa, paivita) {
  $$("[data-poissa]", el).forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const uid = b.dataset.poissa;
    const { error } = poissa.has(uid)
      ? await sb.from("poissaolot").delete().eq("pelaaja_id", p.id).eq("joukkue_id", p.joukkue_id).eq("uid", uid)
      : await sb.from("poissaolot").insert({ pelaaja_id: p.id, joukkue_id: p.joukkue_id, uid });
    if (error) { ilmoita("Tallennus ei onnistunut: " + error.message, true); b.disabled = false; return; }
    paivita();
  }));
}
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
