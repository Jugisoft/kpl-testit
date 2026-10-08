import { sb, tila, nimi, lataaPerus } from "../db.js";
import { $, $$, esc, pvm, kausi, ilmoita } from "../util.js";

export const PAKETIT = [
  { nimi: "Nopeus 10 + 30 m", testit: ["10m", "30m"] },
  { nimi: "Tutkat", testit: ["heitto_paikalta", "heitto_vauhti", "lyonti"] },
  { nimi: "Nopeuskestävyys", testit: ["nok_30m"] },
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
          <td>${esc(k.nimi || "")}${k.piikit ? ' <span class="merkki harmaa">piikit</span>' : ""}</td>
          <td class="pieni" style="white-space:normal;max-width:340px">${k.testit.filter((t) => tila.testi[t]).map((t) => esc(tila.testi[t].nimi)).join(", ")}</td>
          <td class="n">${lkm[k.id] || 0}</td>
          <td class="n"><a class="btn" href="#/syota/${k.id}">Syötä</a> <a class="btn" href="#/kerta/${k.id}">Tulokset</a></td></tr>`).join("")}</tbody>
      </table></div>`).join("") || `<p class="tyhja">Ei vielä testikertoja.</p>`}`;
  $("#uusi-nappi").onclick = () => uusiLomake($("#uusi"));
}

function uusiLomake(el) {
  const tanaan = new Date().toISOString().slice(0, 10);
  const ryhmat = [...new Set(tila.testit.filter((t) => !t.johdettu && t.aktiivinen).map((t) => t.ryhma))];
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
        <div class="chipit" style="margin-bottom:10px">${PAKETIT.map((p, i) => `<button type="button" class="chip" data-paketti="${i}">+ ${esc(p.nimi)}</button>`).join("")}</div>
        ${ryhmat.map((r) => `<div class="chipit" style="margin-bottom:6px">${tila.testit.filter((t) => t.ryhma === r && !t.johdettu && t.aktiivinen).map((t) => `<label class="chip"><input type="checkbox" name="testi" value="${t.koodi}">${esc(t.nimi)}</label>`).join("")}</div>`).join("")}
        <label class="chip" style="margin-top:8px"><input type="checkbox" name="piikit">Juostaan piikkareilla</label>
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
  $$("[data-paketti]", f).forEach((b) => (b.onclick = () => PAKETIT[b.dataset.paketti].testit.forEach((t) => { const i = f.querySelector(`input[name=testi][value="${t}"]`); if (i) i.checked = true; })));
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
