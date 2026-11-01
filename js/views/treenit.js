// Treenipäiväkirja (1.11.2026, Jugin toive): omatoimisen treenin nopea kirjaus omasta valikosta, lyöntipäiväkirjan tapaan.
// Isot painikkeet valmennuksen ohjelmista (Anssin ohjelmat: Juoksut, Voimat, Lisäosat) ja omatoimisista lajeista,
// viimeksi käytetyt ylimpänä. Valinnan jälkeen kesto, määrät (tai km) ja päivä → Tallenna. Taulu omat_treenit,
// sama data kuin oman Keskuksen Viikkonissa (kuorma-arvio laskee mukaan automaattisesti).
import { sb, tila, nimi } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { haeOhjelmat } from "../kuorma.js";
import { T, lisaaPv, maanantai, tanaanHki as tanaan, minStr, pvLyh, maaratTeksti } from "../kuormaydin.js";

const VKP = ["su", "ma", "ti", "ke", "to", "pe", "la"];
const RYHMAJARJ = ["Voimat", "Juoksut", "Lisäosat", "Omatoiminen laji", "Omatoiminen kunto"];
const linkit = (l) => esc(l).replace(/(https?:\/\/[^\s]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">video ↗</a>`);
const lyhyt = (n) => n.replace(/\s*\((.*)\)$/, "");
const tarkenne = (n) => n.match(/\((.*)\)$/)?.[1] || "";
let valittu = null;

export async function nayta(main) {
  const pid = tila.omaPelaaja;
  if (!pid || !tila.pelaaja[pid]) {
    main.innerHTML = `<h1>Treenipäiväkirja</h1><p class="ingressi">Treenipäiväkirja on pelaajille: tunnukseesi ei ole liitetty pelaajaa.${tila.ohjaaja ? ` Pelaajien kirjaukset näet <a href="#/kooste">viikkokoosteesta</a> ja pelaajien omista Keskuksista.` : " Pyydä ylläpitäjää liittämään tunnuksesi pelaajaan."}</p>`;
    return;
  }
  await piirra(main, pid);
}

async function piirra(main, pid) {
  const t = tanaan(), vk = maanantai(t);
  const [ohjelmat, omatRes] = await Promise.all([
    haeOhjelmat(),
    sb.from("omat_treenit").select("*").eq("pelaaja_id", pid).gte("pvm", lisaaPv(t, -60)).order("pvm", { ascending: false }).order("luotu", { ascending: false }),
  ]);
  if (omatRes.error) { main.innerHTML = `<h1>Treenipäiväkirja</h1><p class="ingressi">Kirjauksia ei saatu haettua: ${esc(omatRes.error.message)}</p>`; return; }
  const omat = omatRes.data || [];
  const lista = Object.values(ohjelmat);
  const viimeksi = [...new Set(omat.map((o) => o.ohjelma).filter((k) => ohjelmat[k]))].slice(0, 4);
  const ryhmat = [...new Set(lista.map((o) => o.ryhma))].sort((a, b) => (RYHMAJARJ.indexOf(a) + 1 || 99) - (RYHMAJARJ.indexOf(b) + 1 || 99));
  const tamaVk = omat.filter((o) => o.pvm >= vk);
  const vkMin = tamaVk.reduce((s, o) => s + (o.kesto_min || 0), 0);
  const kerrat4 = omat.filter((o) => o.pvm > lisaaPv(t, -28)).length;
  if (valittu && !ohjelmat[valittu]) valittu = null;

  const nappi = (o) => `<button type="button" class="tr-nappi" data-oh="${o.koodi}" aria-pressed="${valittu === o.koodi}" style="--v:${T[o.tyyppi]?.vari || "#888"}">
      <span class="tr-n-nimi">${esc(lyhyt(o.nimi))}</span>${tarkenne(o.nimi) ? `<span class="tr-n-ala">${esc(tarkenne(o.nimi))}</span>` : ""}<span class="tr-n-min num">${o.kesto_min} min</span></button>`;

  main.innerHTML = `
    <div class="tr-paa">
      <div><span class="jtt-yla">Oma harjoittelu</span><h1>Treenipäiväkirja</h1>
        <p class="ingressi">Valitse treeni, tarkista kesto ja tallenna. Lyönnit kirjataan <a href="#/lyonnit">lyöntipäiväkirjaan</a>.</p></div>
      <div class="tr-yht"><div><span class="num">${tamaVk.length}</span><small>treeniä tällä viikolla</small></div><div><span class="num">${vkMin ? minStr(vkMin) : "–"}</span><small>omatoimista</small></div><div><span class="num">${kerrat4}</span><small>treeniä 4 viikossa</small></div></div>
    </div>

    ${viimeksi.length ? `<section class="tr-ryhma"><h2>Viimeksi tehdyt</h2><div class="tr-napit">${viimeksi.map((k) => nappi(ohjelmat[k])).join("")}</div></section>` : ""}
    ${ryhmat.map((r) => `<section class="tr-ryhma"><h2>${esc(r)}</h2><div class="tr-napit">${lista.filter((o) => o.ryhma === r).map(nappi).join("")}</div></section>`).join("")}

    <form id="tr-lomake" class="tr-lomake" ${valittu ? "" : "hidden"}></form>

    <section class="tr-ryhma"><h2>Viimeisimmät kirjaukset</h2>
      ${omat.length ? `<ul class="tr-hist">${omat.slice(0, 20).map((o) => { const oh = ohjelmat[o.ohjelma], ty = T[o.tyyppi] || T.laji, lisa = maaratTeksti(o), d = new Date(o.pvm + "T12:00:00Z");
        return `<li style="--v:${ty.vari}"><span class="tr-h-pvm"><b>${VKP[d.getUTCDay()]}</b>${pvLyh(o.pvm)}</span><span class="tr-h-nimi">${esc(oh?.nimi || ty.nimi)}<small>${o.kesto_min} min${lisa ? ` · ${esc(lisa)}` : ""}</small></span>
          ${o.pvm >= lisaaPv(t, -14) ? `<button class="linkkinappi" data-poista="${o.id}" aria-label="Poista ${esc(oh?.nimi || "")} ${pvLyh(o.pvm)}">Poista</button>` : ""}</li>`; }).join("")}</ul>`
        : `<p class="tyhja">Ei vielä kirjauksia. Valitse yltä tehty treeni.</p>`}
    </section>
    <div class="tr-loppu" aria-hidden="true"></div>`;

  const lomake = $("#tr-lomake", main);
  const avaa = (koodi, vierita) => {
    valittu = koodi;
    $$("[data-oh]", main).forEach((b) => b.setAttribute("aria-pressed", b.dataset.oh === koodi));
    const o = ohjelmat[koodi], km = !!o.km && !o.maarat?.length;
    const askel = (nimi, arvo, d, ala = 0, yla = 5000, desim = false, label = nimi) => `<div class="tr-kentta"><span class="ku-ryhma-nimi">${esc(label)}</span>
      <div class="ly-maara"><button type="button" class="btn ly-pm" data-d="${-d}" data-k="${esc(nimi)}" aria-label="Vähennä">−</button>
        <input type="number" name="${esc(nimi)}" inputmode="${desim ? "decimal" : "numeric"}" step="${desim ? "0.1" : "1"}" min="${ala}" max="${yla}" value="${arvo ?? ""}" placeholder="0">
        <button type="button" class="btn ly-pm" data-d="${d}" data-k="${esc(nimi)}">+${String(d).replace(".", ",")}</button></div></div>`;
    const pv = [0, 1, 2].map((n) => lisaaPv(tanaan(), -n));
    lomake.hidden = false;
    lomake.style.setProperty("--v", T[o.tyyppi]?.vari || "#888");
    lomake.innerHTML = `
      <div class="tr-l-paa"><i class="ku-pallo" style="background:${T[o.tyyppi]?.vari}"></i><div><h2>${esc(o.nimi)}</h2><span class="pieni">${esc(T[o.tyyppi]?.nimi || "")}${o.rpe ? ` · rasitusarvio ${o.rpe}/10` : ""}</span></div>
        <button type="button" class="tr-sulje" aria-label="Sulje">✕</button></div>
      <div class="tr-kentat">
        ${askel("kesto", o.kesto_min, 15, 5, 600, false, "Kesto, min")}
        ${km ? askel("km", "", 1, 0, 300, true, "Matka, km") : (o.maarat || []).map((m) => askel("m:" + m, "", 10, 0, 5000, false, m)).join("")}
      </div>
      <div class="tr-paivat" role="radiogroup" aria-label="Päivä">${pv.map((d, i) => `<label class="chip"><input type="radio" name="pvm" value="${d}"${i === 0 ? " checked" : ""}>${["Tänään", "Eilen", "Toissapäivänä"][i]}</label>`).join("")}
        <label class="chip tr-muu-pv">Muu päivä <input type="date" name="muupvm" min="${lisaaPv(tanaan(), -14)}" max="${tanaan()}"></label></div>
      ${o.kuvaus ? `<details class="tr-ohjelma"><summary>Näytä ohjelma</summary><ul>${o.kuvaus.split("\n").filter((l) => l.trim()).map((l) => `<li>${linkit(l)}</li>`).join("")}</ul>${o.lahde ? `<p class="pieni">Lähde: ${esc(o.lahde)}</p>` : ""}</details>` : ""}
      <button class="btn ensisij tr-tallenna">Tallenna treeni</button>`;
    $(".tr-sulje", lomake).onclick = () => { valittu = null; lomake.hidden = true; $$("[data-oh]", main).forEach((b) => b.setAttribute("aria-pressed", false)); };
    $$("[data-d]", lomake).forEach((b) => (b.onclick = () => { const i = lomake.elements[b.dataset.k], v = Math.round(((+i.value || 0) + +b.dataset.d) * 10) / 10; i.value = Math.min(+i.max, Math.max(+i.min, v)) || ""; }));
    const muu = lomake.elements.muupvm;
    muu.onchange = () => { if (muu.value) [...lomake.elements.pvm].forEach((r) => (r.checked = false)); };
    [...lomake.elements.pvm].forEach((r) => (r.onchange = () => (muu.value = "")));
    lomake.onsubmit = async (e) => {
      e.preventDefault();
      const x = lomake.elements, kesto = +x.kesto.value;
      const pvm = muu.value || [...x.pvm].find((r) => r.checked)?.value;
      if (!(kesto >= 5 && kesto <= 600)) return ilmoita("Kesto 5–600 minuuttia", true);
      if (!pvm) return ilmoita("Valitse päivä", true);
      const maarat = {};
      (o.maarat || []).forEach((m) => { const v = Math.round(+x["m:" + m]?.value || 0); if (v > 0) maarat[m] = v; });
      const kmv = km ? Math.round((+x.km.value || 0) * 10) / 10 : 0;
      const b = $(".tr-tallenna", lomake); b.disabled = true;
      const { error } = await sb.from("omat_treenit").insert({ pelaaja_id: pid, pvm, tyyppi: o.tyyppi, ohjelma: o.koodi, kesto_min: kesto,
        maarat: Object.keys(maarat).length ? maarat : null, km: kmv > 0 ? kmv : null, huomio: null });
      b.disabled = false;
      if (error) return ilmoita("Tallennus ei onnistunut: " + error.message, true);
      try { localStorage.setItem("ku-laji", o.koodi); } catch (_) {}
      ilmoita(`Tallennettu: ${lyhyt(o.nimi)} ${kesto} min`);
      valittu = null; window.scrollTo({ top: 0, behavior: "smooth" });
      piirra(main, pid);
    };
    if (vierita) lomake.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  $$("[data-oh]", main).forEach((b) => (b.onclick = () => avaa(b.dataset.oh, true)));
  if (valittu) avaa(valittu, false);
  $$("[data-poista]", main).forEach((b) => (b.onclick = async () => {
    if (!confirm("Poistetaanko kirjaus?")) return;
    const { error } = await sb.from("omat_treenit").delete().eq("id", b.dataset.poista);
    if (error) ilmoita("Poisto ei onnistunut: " + error.message, true); else piirra(main, pid);
  }));
}
