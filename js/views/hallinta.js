// Ylläpito: valmentajat, pelaajat, testikerrat ja testit.
import { sb, tila, nimi, lataaPelaajat, lataaPerus } from "../db.js";
import { $, $$, esc, pvm, ilmoita } from "../util.js";

export async function nayta(main) {
  const { data: valmentajat } = await sb.from("valmentajat").select("*").order("email");
  const jSel = (v) => `<select data-k="joukkue_id">${tila.joukkueet.map((j) => `<option value="${j.id}" ${j.id === v ? "selected" : ""}>${esc(j.nimi)}</option>`).join("")}</select>`;
  main.innerHTML = `
    <h1>Hallinta</h1>

    <h2>Valmentajat</h2>
    <p class="pieni">Vain listalla olevat sähköpostiosoitteet näkevät nimet ja voivat syöttää tuloksia. Google-kirjautumisessa käytetään Google-tilin osoitetta.</p>
    <div class="taulu-wrap"><table><thead><tr><th>Sähköposti</th><th>Nimi</th><th>Rooli</th><th></th></tr></thead>
      <tbody>${valmentajat.map((v) => `<tr><td>${esc(v.email)}</td><td>${esc(v.nimi || "")}</td><td>${v.rooli === "admin" ? "Ylläpitäjä" : "Valmentaja"}</td><td class="n">${v.email === tila.istunto.user.email.toLowerCase() ? "" : `<button class="btn vaara" data-poista-v="${esc(v.email)}">Poista</button>`}</td></tr>`).join("")}</tbody></table></div>
    <form id="uusi-v" class="rivi" style="margin-top:10px">
      <input type="email" name="email" placeholder="sähköposti" required style="width:240px"><input type="text" name="nimi" placeholder="nimi">
      <select name="rooli"><option value="valmentaja">Valmentaja</option><option value="admin">Ylläpitäjä</option></select>
      <button class="btn ensisij">Lisää valmentaja</button></form>

    <h2>Pelaajat</h2>
    <p class="pieni">Muutokset tallentuvat, kun poistut kentästä. Ei-aktiiviset pelaajat eivät näy osallistujalistoissa, mutta heidän tuloksensa säilyvät.</p>
    <div class="taulu-wrap"><table><thead><tr><th>Etunimi</th><th>Sukunimi</th><th>Synt.</th><th>Ryhmä</th><th>Aktiivinen</th><th>Kuvan osoite</th><th></th></tr></thead>
      <tbody>${tila.pelaajat.map((p) => `<tr data-p="${p.id}">
        <td><input type="text" data-k="etunimi" value="${esc(p.etunimi)}" style="width:110px"></td>
        <td><input type="text" data-k="sukunimi" value="${esc(p.sukunimi || "")}" style="width:130px"></td>
        <td><input type="number" data-k="syntymavuosi" value="${p.syntymavuosi || ""}" style="width:84px"></td>
        <td>${jSel(p.joukkue_id)}</td>
        <td><input type="checkbox" data-k="aktiivinen" ${p.aktiivinen ? "checked" : ""}></td>
        <td><input type="text" data-k="kuva_url" value="${esc(p.kuva_url || "")}" placeholder="https://…" style="width:200px"></td>
        <td><button class="btn vaara" data-piilota="${p.id}">Poista</button></td></tr>`).join("")}</tbody></table></div>
    <form id="uusi-p" class="rivi" style="margin-top:10px">
      <input type="text" name="etunimi" placeholder="etunimi" required><input type="text" name="sukunimi" placeholder="sukunimi">
      <input type="number" name="syntymavuosi" placeholder="synt." style="width:90px">
      <select name="joukkue_id">${tila.joukkueet.map((j) => `<option value="${j.id}">${esc(j.nimi)}</option>`).join("")}</select>
      <button class="btn ensisij">Lisää pelaaja</button></form>

    <h2>Testikerrat</h2>
    <div class="taulu-wrap"><table><thead><tr><th>Päivä</th><th>Nimi</th><th>Piikit</th></tr></thead>
      <tbody>${tila.kerrat.map((k) => `<tr data-kerta="${k.id}"><td><input type="date" data-k="pvm" value="${k.pvm}"></td><td><input type="text" data-k="nimi" value="${esc(k.nimi || "")}" style="width:320px"></td><td><input type="checkbox" data-k="piikit" ${k.piikit ? "checked" : ""}></td></tr>`).join("")}</tbody></table></div>

    <h2>Testit</h2>
    <div class="taulu-wrap"><table><thead><tr><th>Koodi</th><th>Nimi</th><th>Yksikkö</th><th>Pienempi parempi</th><th>Yrityksiä</th><th>Min</th><th>Max</th><th>Käytössä</th></tr></thead>
      <tbody>${tila.testit.filter((t) => !t.johdettu).map((t) => `<tr data-testi="${t.koodi}"><td class="pieni">${t.koodi}</td>
        <td><input type="text" data-k="nimi" value="${esc(t.nimi)}" style="width:220px"></td><td><input type="text" data-k="yksikko" value="${esc(t.yksikko)}" style="width:80px"></td>
        <td><input type="checkbox" data-k="pienempi_parempi" ${t.pienempi_parempi ? "checked" : ""}></td><td><input type="number" data-k="yrityksia" value="${t.yrityksia}" style="width:60px"></td>
        <td><input type="number" step="any" data-k="min_arvo" value="${t.min_arvo ?? ""}" style="width:70px"></td><td><input type="number" step="any" data-k="max_arvo" value="${t.max_arvo ?? ""}" style="width:70px"></td>
        <td><input type="checkbox" data-k="aktiivinen" ${t.aktiivinen ? "checked" : ""}></td></tr>`).join("")}</tbody></table></div>
    <form id="uusi-t" class="rivi" style="margin-top:10px">
      <input type="text" name="koodi" placeholder="koodi (esim. pituus_vauhti)" required pattern="[a-z0-9_]+"><input type="text" name="nimi" placeholder="nimi" required>
      <input type="text" name="yksikko" placeholder="yksikkö" required style="width:90px">
      <select name="ryhma"><option>nopeus</option><option>tutka</option><option>taito</option><option>voima</option></select>
      <label class="chip"><input type="checkbox" name="pienempi_parempi">Pienempi parempi</label>
      <button class="btn ensisij">Lisää testi</button></form>`;

  const arvo = (el) => el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? null : +el.value) : el.tagName === "SELECT" && el.dataset.k === "joukkue_id" ? +el.value : (el.value.trim() || null);
  const tallenna = async (taulu, avainKentta, id, el) => {
    const { error } = await sb.from(taulu).update({ [el.dataset.k]: arvo(el) }).eq(avainKentta, id);
    if (error) ilmoita("Tallennus epäonnistui: " + error.message, true); else ilmoita("Tallennettu");
  };
  $$("tr[data-p] [data-k]").forEach((el) => (el.onchange = async () => { await tallenna("pelaajat", "id", el.closest("tr").dataset.p, el); await lataaPelaajat(); }));
  $$("tr[data-kerta] [data-k]").forEach((el) => (el.onchange = async () => { await tallenna("testikerrat", "id", el.closest("tr").dataset.kerta, el); await lataaPerus(); }));
  $$("tr[data-testi] [data-k]").forEach((el) => (el.onchange = async () => { await tallenna("testit", "koodi", el.closest("tr").dataset.testi, el); await lataaPerus(); }));
  $$("[data-piilota]").forEach((b) => (b.onclick = async () => {
    const p = tila.pelaaja[b.dataset.piilota];
    if (b.dataset.vahvista !== "1") { b.dataset.vahvista = "1"; b.textContent = "Vahvista poisto"; return; }
    const { error } = await sb.from("pelaajat").update({ poistettu: true, aktiivinen: false }).eq("id", p.id);
    if (error) return ilmoita(error.message, true);
    ilmoita(`${nimi(p)} poistettu`); await lataaPelaajat(); nayta(main);
  }));
  $$("[data-poista-v]").forEach((b) => (b.onclick = async () => {
    if (b.dataset.vahvista !== "1") { b.dataset.vahvista = "1"; b.textContent = "Vahvista poisto"; return; }
    const { error } = await sb.from("valmentajat").delete().eq("email", b.dataset.poistaV);
    if (error) return ilmoita(error.message, true);
    nayta(main);
  }));
  $("#uusi-v").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.from("valmentajat").insert({ email: f.email.value.trim().toLowerCase(), nimi: f.nimi.value.trim() || null, rooli: f.rooli.value });
    if (error) return ilmoita(error.message, true);
    nayta(main);
  };
  $("#uusi-p").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.from("pelaajat").insert({ etunimi: f.etunimi.value.trim(), sukunimi: f.sukunimi.value.trim() || null, syntymavuosi: f.syntymavuosi.value ? +f.syntymavuosi.value : null, joukkue_id: +f.joukkue_id.value });
    if (error) return ilmoita(error.message, true);
    await lataaPelaajat(); nayta(main);
  };
  $("#uusi-t").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const { error } = await sb.from("testit").insert({ koodi: f.koodi.value, nimi: f.nimi.value, yksikko: f.yksikko.value, ryhma: f.ryhma.value, pienempi_parempi: f.pienempi_parempi.checked, jarjestys: 90 });
    if (error) return ilmoita(error.message, true);
    await lataaPerus(); nayta(main);
  };
}
