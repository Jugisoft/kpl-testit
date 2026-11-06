import { sb, tila, nimi, lataaPerus } from "../db.js";
import { $, $$, esc, pvm, kausi, ilmoita } from "../util.js";
import { LUOKAT, LUOKKANIMI } from "./testit.js";

export const PAKETIT = [
  { nimi: "Nopeus 10 + 30 m", testit: ["10m", "30m"] },
  { nimi: "Tutkat", testit: ["heitto_paikalta", "heitto_vauhti", "lyonti"] },
  { nimi: "Nopeuskestävyys", testit: ["nok_30m"] },
  { nimi: "Cooper", testit: ["cooper"] },
  { nimi: "Näpytesti", testit: ["napy_1raja", "napy_keskipieni", "napy_2raja"] },
  { nimi: "Lyöntitesti", testit: ["lyonti_2rajakova", "lyonti_3rajakova", "lyonti_ilma", "lyonti_koppi", "lyonti_sauma", "lyonti_varsi"] },
  { nimi: "Voima", testit: ["rinnalleveto_kg", "tasatassut", "leuat_toistot", "leuat_lisapaino_kg"] },
  { nimi: "Kuntopallo", testit: ["kuntopallo_eteen_2kg", "kuntopallo_taakse_2kg"] },
];

export async function nayta(main) {
  const { data: os } = await sb.from("osallistujat").select("testikerta_id");
  const lkm = {};
  (os || []).forEach((o) => (lkm[o.testikerta_id] = (lkm[o.testikerta_id] || 0) + 1));
  const kaudet = [...new Set(tila.kerrat.map((k) => kausi(k.pvm)))];

  main.innerHTML = `
    <div class="rivi vali"><h1>Testikerrat</h1><button class="btn ensisij" id="uusi-nappi">Uusi testikerta</button></div>
    <div id="uusi"></div>
    ${kaudet.map((ka) => `
      <h2>Talvi ${ka}</h2>
      <div class="taulu-wrap"><table>
        <thead><tr><th>Päivä</th><th>Nimi</th><th>Testit</th><th class="n">Pelaajia</th><th></th></tr></thead>
        <tbody>${tila.kerrat.filter((k) => kausi(k.pvm) === ka).map((k) => `<tr>
          <td>${pvm(k.pvm)}${k.pvm_tarkka ? "" : ' <span class="merkki harmaa" title="Päivä ei tiedossa tarkasti">noin</span>'}</td>
          <td>${esc(k.nimi || "")}${k.piikit ? ' <span class="merkki harmaa">piikkiajat</span>' : ""}</td>
          <td class="pieni" style="white-space:normal;max-width:340px">${k.testit.filter((t) => tila.testi[t]).map((t) => esc(tila.testi[t].nimi)).join(", ")}</td>
          <td class="n">${lkm[k.id] || 0}</td>
          <td class="n"><a class="btn" href="#/syota/${k.id}">Syötä</a> <a class="btn" href="#/kerta/${k.id}">Tulokset</a>${voiPoistaa(k) ? ` <button class="btn vaara" data-poista="${k.id}">Poista</button>` : ""}</td></tr>`).join("")}</tbody>
      </table></div>`).join("") || `<p class="tyhja">Ei vielä testikertoja.</p>`}`;
  $("#uusi-nappi").onclick = () => uusiLomake($("#uusi"));
  $$("[data-poista]").forEach((b) => (b.onclick = () => poistaKerta(b, b.dataset.poista, () => nayta(main))));
}

export const voiPoistaa = (k) => tila.admin || (tila.istunto && k.luoja === tila.istunto.user.email.toLowerCase());

// Kaksivaiheinen poisto: ensimmäinen painallus kertoo mitä poistuu, toinen poistaa.
export async function poistaKerta(nappi, id, valmis) {
  if (nappi.dataset.vahvista !== "1") {
    const { count } = await sb.from("tulokset").select("id", { count: "exact", head: true }).eq("testikerta_id", id);
    nappi.dataset.vahvista = "1";
    nappi.textContent = count ? `Poista myös ${count} tulosta?` : "Vahvista poisto";
    setTimeout(() => { if (nappi.isConnected) { nappi.dataset.vahvista = ""; nappi.textContent = "Poista"; } }, 6000);
    return;
  }
  nappi.disabled = true;
  const { data, error } = await sb.from("testikerrat").delete().eq("id", id).select("id");
  if (error || !data?.length) { nappi.disabled = false; return ilmoita(error ? "Poisto epäonnistui: " + error.message : "Sinulla ei ole oikeutta poistaa tätä testikertaa.", true); }
  await lataaPerus();
  ilmoita("Testikerta poistettu");
  valmis();
}

function uusiLomake(el) {
  const tanaan = new Date().toISOString().slice(0, 10);
  const ryhmat = LUOKAT.map(([k, n]) => [k, n]).filter(([k]) => tila.testit.some((t) => t.luokka === k && !t.johdettu && t.aktiivinen));
  if (tila.testit.some((t) => !LUOKKANIMI[t.luokka] && !t.johdettu && t.aktiivinen)) ryhmat.push([null, "Muut"]);
  const aktiiviset = tila.pelaajat.filter((p) => p.aktiivinen);
  const muut = tila.pelaajat.filter((p) => !p.aktiivinen);
  const pelaajaRivi = (p, valittu) => `<label class="chip"><input type="checkbox" name="pelaaja" value="${p.id}" data-joukkue="${p.joukkue_id}" ${valittu ? "checked" : ""}>${esc(nimi(p))} <span class="pieni">${p.syntymavuosi || ""}</span></label>`;

  el.innerHTML = `
    <form class="paneeli" id="lomake" style="display:grid;gap:18px;margin:12px 0 8px">
      <div class="rivi">
        <label class="kentta">Päivä <input type="date" name="pvm" value="${tanaan}" required></label>
        <label class="kentta" style="flex:1;min-width:200px">Nimi <input type="text" name="nimi" placeholder="esim. Nopeustestit marraskuu"></label>
        <label class="kentta">Ryhmä <select name="joukkue">${tila.joukkueet.map((j) => `<option value="${j.id}">${esc(j.nimi)}</option>`).join("")}</select></label>
      </div>
      <div>
        <h3 style="margin-top:0">Testit</h3>
        <!-- 6.11.2026: testit pudotusvalikoissa luokittain (aiemmin kaikki painikkeina allekkain) -->
        <div class="tv-rivi">
          <label class="kentta tv-paketti">Valmis paketti<select id="paketti"><option value="">Lisää paketti…</option>${PAKETIT.map((p, i) => `<option value="${i}">${esc(p.nimi)}</option>`).join("")}</select></label>
          ${ryhmat.map(([r, rn]) => testiValikko(r, rn)).join("")}
        </div>
        <div class="tv-valitut"><span class="osa-nimi">Valitut testit</span><div class="chipit" id="valitut-testit"></div></div>
        <label class="tv-piikit"><input type="checkbox" name="piikit"> Piikkiajat (yksittäiset kärkiajat)</label>
      </div>
      <div>
        <div class="rivi vali"><h3 style="margin:0">Osallistujat</h3><span class="pieni" id="valittuja"></span></div>
        <p class="pieni">Syöttölistan järjestystä voi muuttaa myöhemmin.</p>
        <div class="chipit">${aktiiviset.map((p) => pelaajaRivi(p, false)).join("")}</div>
        <details style="margin-top:10px"><summary class="pieni">Muut pelaajat (${muut.length})</summary><div class="chipit" style="margin-top:8px">${muut.map((p) => pelaajaRivi(p, false)).join("")}</div></details>
      </div>
      <div class="rivi"><button class="btn ensisij" type="submit">Luo testikerta ja aloita syöttö</button><button class="btn" type="button" id="peru">Peru</button></div>
    </form>`;
  const f = $("#lomake");
  const laske = () => ($("#valittuja").textContent = `${$$('input[name=pelaaja]:checked', f).length} valittu`);
  const valitseJoukkue = () => { $$("input[name=pelaaja]", f).forEach((i) => (i.checked = i.closest("details") ? false : i.dataset.joukkue === f.joukkue.value)); laske(); };
  f.joukkue.onchange = valitseJoukkue; valitseJoukkue();
  f.addEventListener("change", laske);
  // testivalikot: laskurit, valitut-lista, paketit ja vain yksi valikko kerrallaan auki
  const paivitaTestit = () => {
    $$(".tv-valikko", f).forEach((d) => { const n = $$("input[name=testi]:checked", d).length; $(".tv-lkm", d).textContent = n ? n : ""; d.classList.toggle("on-valittu", n > 0); });
    const val = $$("input[name=testi]:checked", f);
    $("#valitut-testit").innerHTML = val.length ? val.map((i) => `<button type="button" class="chip tv-poista" data-pois="${i.value}" title="Poista">${esc(tila.testi[i.value]?.nimi || i.value)} <span aria-hidden="true">×</span></button>`).join("") : '<span class="pieni">Ei vielä valittuja – valitse paketti tai avaa luokka.</span>';
    $$("[data-pois]", f).forEach((b) => (b.onclick = () => { const i = f.querySelector(`input[name=testi][value="${b.dataset.pois}"]`); if (i) i.checked = false; paivitaTestit(); }));
  };
  $("#paketti").onchange = (e) => { if (e.target.value === "") return; PAKETIT[e.target.value].testit.forEach((t) => { const i = f.querySelector(`input[name=testi][value="${t}"]`); if (i) i.checked = true; }); e.target.value = ""; paivitaTestit(); };
  $$(".tv-valikko", f).forEach((d) => d.addEventListener("toggle", () => { if (d.open) $$(".tv-valikko", f).forEach((m) => m !== d && (m.open = false)); }));
  $$("[data-kaikki]", f).forEach((b) => (b.onclick = () => { const r = b.closest(".tv-ryhma"); const kaikki = $$("input[name=testi]", r).every((i) => i.checked); $$("input[name=testi]", r).forEach((i) => (i.checked = !kaikki)); paivitaTestit(); }));
  const sulje = (e) => { if (!f.isConnected) return document.removeEventListener("click", sulje); if (!e.target.closest(".tv-valikko")) $$(".tv-valikko[open]", f).forEach((d) => (d.open = false)); };
  document.addEventListener("click", sulje);
  f.addEventListener("change", (e) => { if (e.target.name === "testi") paivitaTestit(); });
  paivitaTestit();
  $("#peru").onclick = () => (el.innerHTML = "");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const testit = $$("input[name=testi]:checked", f).map((i) => i.value);
    const pelaajat = $$("input[name=pelaaja]:checked", f).map((i) => tila.pelaaja[i.value]);
    if (!testit.length) return ilmoita("Valitse vähintään yksi testi.", true);
    if (!pelaajat.length) return ilmoita("Valitse osallistujat.", true);
    pelaajat.sort((a, b) => (a.syntymavuosi || 0) - (b.syntymavuosi || 0) || nimi(a).localeCompare(nimi(b), "fi"));
    const { data: k, error } = await sb.from("testikerrat").insert({ pvm: f.pvm.value, nimi: f.nimi.value.trim() || null, joukkue_id: +f.joukkue.value, testit, piikit: f.piikit.checked }).select().single();
    if (error) return ilmoita("Testikerran luonti epäonnistui: " + error.message, true);
    const { error: e2 } = await sb.from("osallistujat").insert(pelaajat.map((p, i) => ({ testikerta_id: k.id, pelaaja_id: p.id, jarjestys: i + 1 })));
    if (e2) return ilmoita("Osallistujien tallennus epäonnistui: " + e2.message, true);
    await lataaPerus();
    location.hash = `#/syota/${k.id}`;
  };
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Yksi testiluokka pudotusvalikkona: sisällä alaluokat (lajitaidossa testisarjat, esim. Näpy, Kovat, Lyöntitesti).
function testiValikko(luokka, luokkaNimi) {
  const testit = tila.testit.filter((t) => (luokka ? t.luokka === luokka : !LUOKKANIMI[t.luokka]) && !t.johdettu && t.aktiivinen);
  const ryhma = (t) => { const m = t.nimi.match(/^([^:]{2,40}):\s*(.+)$/); return m ? [m[1].replace(/^Edustuksen lyöntitesti$/, "Lyöntitesti (edustus)"), m[2]] : [t.alaluokka || "Muut", t.nimi]; };
  const osat = new Map();
  for (const t of testit) { const [r, n] = ryhma(t); if (!osat.has(r)) osat.set(r, []); osat.get(r).push([t, n]); }
  return `<details class="tv-valikko"><summary><span>${esc(luokkaNimi)}</span><b class="tv-lkm"></b><span class="tv-nuoli" aria-hidden="true">▾</span></summary>
    <div class="tv-paneeli">${[...osat].map(([r, lista]) => `<div class="tv-ryhma">
      <div class="tv-ryhma-paa"><span class="osa-nimi">${esc(r)}</span>${lista.length > 2 ? '<button type="button" class="linkkinappi" data-kaikki>kaikki</button>' : ""}</div>
      ${lista.map(([t, n]) => `<label class="tv-rivi-valinta"><input type="checkbox" name="testi" value="${t.koodi}"><span>${esc(n)}</span>${t.yksikko ? `<small>${esc(t.yksikko)}</small>` : ""}</label>`).join("")}
    </div>`).join("")}</div></details>`;
}
