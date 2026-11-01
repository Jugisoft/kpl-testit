// Ylläpito: valmentajat, pelaajat, testikerrat ja testit.
import { sb, tila, nimi, lataaPelaajat, lataaPerus, SUPABASE_URL } from "../db.js";
import { LUOKAT } from "./testit.js";
import { $, $$, esc, pvm, ilmoita } from "../util.js";

const ROOLIT = { admin: "Master (ylläpitäjä)", valmentaja: "Master-valmennus", pelaaja: "Miesten SP -pelaaja", psu: "PSU-valmennus", juniori: "Juniori-pelaaja" };
// Pelaajaliitos (1.11.2026): tunnus ↔ pelaaja, pelaajan oma Keskus
const pelaajaSel = (v) => `<select data-pelaaja-v="${esc(v.email)}" aria-label="Pelaaja: ${esc(v.email)}"><option value="">– ei pelaajaa –</option>${tila.joukkueet.map((j) => `<optgroup label="${esc(j.nimi)}">${tila.pelaajat.filter((x) => x.joukkue_id === j.id).map((x) => `<option value="${x.id}"${x.id === v.pelaaja_id ? " selected" : ""}>${esc(nimi(x))}</option>`).join("")}</optgroup>`).join("")}</select>`;

export async function nayta(main) {
  const { data: valmentajat } = await sb.from("valmentajat").select("*").order("email");
  const { data: kalenterit } = await sb.from("kalenterit").select("joukkue_id,ics_url,haettu");
  const kal = Object.fromEntries((kalenterit || []).map((k) => [k.joukkue_id, k]));
  const jSel = (v) => `<select data-k="joukkue_id">${tila.joukkueet.map((j) => `<option value="${j.id}" ${j.id === v ? "selected" : ""}>${esc(j.nimi)}</option>`).join("")}</select>`;
  main.innerHTML = `
    <h1>Hallinta</h1>

    <h2>Käyttäjät</h2>
    <p class="pieni">Vain listalla olevat sähköpostiosoitteet pääsevät Keskukseen. Rajaus tehdään tietokannassa, joten tunnus ei näe muuta kuin oman alueensa dataa.</p>
    <ul class="pieni" style="margin:4px 0 12px;padding-left:18px">
      <li><b>Master (ylläpitäjä)</b>: kaikki sekä Hallinta.</li>
      <li><b>Master-valmennus</b>: kaikki: miesten ja junioreiden testit, Muistio Valmennus-osioineen, vastustajat, Pelikirja, analyysit.</li>
      <li><b>Miesten SP -pelaaja</b>: miesten asiat (testit, Muistio, vastustajat, Pelikirja, analyysit), mutta ei junioreiden testituloksia eikä Muistion Valmennus-osiota.</li>
      <li><b>Juniori-pelaaja</b>: oma Keskus (viikko-ohjelma, tavoitteet, omat testit), junioreiden testitulokset luettavissa ja lyöntipäiväkirja. Ei syötä tuloksia. Liitä tunnus pelaajaan sarakkeessa <b>Pelaaja</b>.</li>
      <li><b>PSU-valmennus</b> (Poikien Superpesis ja Poikien Ykköspesis): vain junioreiden testit, pelaajat ja reaktioajat. Ei miesten testituloksia, muistiinpanoja, vastustajia, Pelikirjaa eikä siirtomarkkinoita.</li>
    </ul>
    <p class="pieni">Pelaajaryhmän alue: <b>Miehet Superpesis</b> kuuluu miesten alueeseen, <b>Juniorit</b> ja <b>Vanhat</b> PSU:n alueeseen.</p>
    <div class="taulu-wrap"><table><thead><tr><th>Sähköposti</th><th>Nimi</th><th>Oikeusryhmä</th><th>Pelaaja (oma Keskus)</th><th></th></tr></thead>
      <tbody>${valmentajat.map((v) => `<tr><td>${esc(v.email)}</td><td>${esc(v.nimi || "")}</td><td>${v.email === tila.istunto.user.email.toLowerCase() ? `${ROOLIT[v.rooli] || v.rooli} <span class="pieni">(oma tunnus)</span>` : `<select data-rooli-v="${esc(v.email)}" aria-label="Oikeusryhmä: ${esc(v.email)}">${Object.entries(ROOLIT).map(([k, n]) => `<option value="${k}"${k === v.rooli ? " selected" : ""}>${n}</option>`).join("")}</select>`}</td><td>${pelaajaSel(v)}</td><td class="n">${v.email === tila.istunto.user.email.toLowerCase() ? "" : `<button class="btn vaara" data-poista-v="${esc(v.email)}">Poista</button>`}</td></tr>`).join("")}</tbody></table></div>
    <form id="uusi-v" class="rivi" style="margin-top:10px">
      <input type="email" name="email" placeholder="sähköposti" required style="width:240px"><input type="text" name="nimi" placeholder="nimi">
      <select name="rooli">${Object.entries(ROOLIT).map(([k, n]) => `<option value="${k}"${k === "valmentaja" ? " selected" : ""}>${n}</option>`).join("")}</select>
      <button class="btn ensisij">Lisää käyttäjä</button></form>

    <h2>Nimenhuudon kalenterit</h2>
    <p class="pieni">Ryhmän tapahtumat näkyvät pelaajien omassa Keskuksessa viikon ohjelmassa. Linkki löytyy Nimenhuudosta: <b>Tapahtumat → Tulevat tapahtumat</b>, sivun alalaidan kalenterilinkki (ics-muoto). Linkki näkyy vain valmentajille, pelaajat näkevät pelkät tapahtumat. Päivittyy 15 minuutin välein.</p>
    <div class="taulu-wrap"><table><thead><tr><th>Ryhmä</th><th>Kalenterilinkki (ics)</th><th></th></tr></thead><tbody>
      ${tila.joukkueet.map((j) => `<tr><td>${esc(j.nimi)}</td><td><input type="url" data-kal="${j.id}" value="${esc(kal[j.id]?.ics_url || "")}" placeholder="https://….nimenhuuto.com/…ics" style="width:100%;min-width:260px"><div class="pieni" data-kal-tila="${j.id}">${kal[j.id]?.haettu ? `Haettu viimeksi ${new Date(kal[j.id].haettu).toLocaleString("fi-FI")}` : kal[j.id] ? "Ei vielä haettu" : ""}</div></td><td class="n"><button class="btn" data-kal-tallenna="${j.id}">Tallenna</button></td></tr>`).join("")}
    </tbody></table></div>

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
    <div class="taulu-wrap"><table><thead><tr><th>Päivä</th><th>Nimi</th><th>Piikkiajat</th></tr></thead>
      <tbody>${tila.kerrat.map((k) => `<tr data-kerta="${k.id}"><td><input type="date" data-k="pvm" value="${k.pvm}"></td><td><input type="text" data-k="nimi" value="${esc(k.nimi || "")}" style="width:320px"></td><td><input type="checkbox" data-k="piikit" ${k.piikit ? "checked" : ""}></td></tr>`).join("")}</tbody></table></div>

    <h2>Testit</h2>
    <div class="taulu-wrap"><table><thead><tr><th>Koodi</th><th>Nimi</th><th>Luokka</th><th>Alaluokka</th><th>Yksikkö</th><th>Pienempi parempi</th><th>Yrityksiä</th><th>Min</th><th>Max</th><th>Käytössä</th></tr></thead>
      <tbody>${tila.testit.filter((t) => !t.johdettu).map((t) => `<tr data-testi="${t.koodi}"><td class="pieni">${t.koodi}</td>
        <td><input type="text" data-k="nimi" value="${esc(t.nimi)}" style="width:220px"></td>
        <td><select data-k="luokka">${LUOKAT.map(([k, n]) => `<option value="${k}"${t.luokka === k ? " selected" : ""}>${n}</option>`).join("")}</select></td>
        <td><input type="text" data-k="alaluokka" list="alaluokat" value="${esc(t.alaluokka || "")}" style="width:150px"></td><td><input type="text" data-k="yksikko" value="${esc(t.yksikko)}" style="width:80px"></td>
        <td><input type="checkbox" data-k="pienempi_parempi" ${t.pienempi_parempi ? "checked" : ""}></td><td><input type="number" data-k="yrityksia" value="${t.yrityksia}" style="width:60px"></td>
        <td><input type="number" step="any" data-k="min_arvo" value="${t.min_arvo ?? ""}" style="width:70px"></td><td><input type="number" step="any" data-k="max_arvo" value="${t.max_arvo ?? ""}" style="width:70px"></td>
        <td><input type="checkbox" data-k="aktiivinen" ${t.aktiivinen ? "checked" : ""}></td></tr>`).join("")}</tbody></table></div>
    <form id="uusi-t" class="rivi" style="margin-top:10px">
      <input type="text" name="koodi" placeholder="koodi (esim. pituus_vauhti)" required pattern="[a-z0-9_]+"><input type="text" name="nimi" placeholder="nimi" required>
      <input type="text" name="yksikko" placeholder="yksikkö" required style="width:90px">
      <select name="luokka" aria-label="Luokka">${LUOKAT.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
      <input type="text" name="alaluokka" list="alaluokat" placeholder="alaluokka" style="width:150px">
      <datalist id="alaluokat">${[...new Set(tila.testit.map((t) => t.alaluokka).filter(Boolean))].map((a) => `<option value="${esc(a)}">`).join("")}</datalist>
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
  $$("[data-rooli-v]").forEach((s) => {
    const alku = s.value;
    s.onchange = async () => {
      const email = s.dataset.rooliV, uusi = s.value;
      if (!confirm(`Muutetaanko käyttäjän ${email} oikeusryhmäksi ${ROOLIT[uusi]}?${uusi === "pelaaja" ? " Valmennus-osio ei enää näy hänelle." : ""}`)) { s.value = alku; return; }
      const { error } = await sb.from("valmentajat").update({ rooli: uusi }).eq("email", email);
      if (error) { s.value = alku; return ilmoita(error.message, true); }
      ilmoita(`${email}: ${ROOLIT[uusi]}`); nayta(main);
    };
  });
  $$("[data-kal-tallenna]").forEach((b) => (b.onclick = async () => {
    const j = +b.dataset.kalTallenna, url = $(`[data-kal="${j}"]`).value.trim().replace(/^webcal:\/\//, "https://");
    const tilaEl = $(`[data-kal-tila="${j}"]`);
    if (!url) { const { error } = await sb.from("kalenterit").delete().eq("joukkue_id", j); if (error) return ilmoita(error.message, true); tilaEl.textContent = ""; return ilmoita("Kalenteri poistettu"); }
    if (!/^https:\/\/[a-z0-9.-]*nimenhuuto\.com\//.test(url)) return ilmoita("Linkin pitää olla Nimenhuudon osoite (https://…nimenhuuto.com/…)", true);
    const { error } = await sb.from("kalenterit").upsert({ joukkue_id: j, ics_url: url, valimuisti: null, haettu: null, muokattu: new Date().toISOString() });
    if (error) return ilmoita(error.message, true);
    // kokeilu: haetaan seuraavat 30 päivää
    tilaEl.textContent = "Kokeillaan hakua…";
    const { data: { session } } = await sb.auth.getSession();
    const alku = new Date().toISOString().slice(0, 10), loppu = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/kalenteri?joukkue=${j}&alku=${alku}&loppu=${loppu}`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const d = await r.json();
      tilaEl.textContent = r.ok ? `Toimii: ${d.tapahtumat.length} tapahtumaa seuraavan 30 päivän aikana` : `Haku ei onnistunut: ${d.virhe || r.status}`;
    } catch (e) { tilaEl.textContent = "Haku ei onnistunut: " + e.message; }
  }));
  $$("[data-pelaaja-v]").forEach((s) => {
    const alku = s.value;
    s.onchange = async () => {
      const { error } = await sb.from("valmentajat").update({ pelaaja_id: s.value || null }).eq("email", s.dataset.pelaajaV);
      if (error) { s.value = alku; return ilmoita(error.message.includes("valmentajat_pelaaja_uniq") ? "Pelaaja on jo liitetty toiseen tunnukseen." : error.message, true); }
      ilmoita(s.value ? "Tunnus liitetty pelaajaan" : "Liitos poistettu");
    };
  });
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
    const { error } = await sb.from("testit").insert({ koodi: f.koodi.value, nimi: f.nimi.value, yksikko: f.yksikko.value, ryhma: { fysiikka: "voima", voima: "tutka", nopeus: "nopeus", lajitaito: "taito" }[f.luokka.value], luokka: f.luokka.value, alaluokka: f.alaluokka.value.trim() || null, pienempi_parempi: f.pienempi_parempi.checked, jarjestys: 90 });
    if (error) return ilmoita(error.message, true);
    await lataaPerus(); nayta(main);
  };
}
