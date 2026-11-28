// Valmentajien huone (28.11.2026, Jugi): vain valmennukselle. Muistiinpanot, palaverimuistiot ja tehtävät
// alueittain (MSU = sp, PSU = psu, yhteinen). Rajaus on tietokannassa (RLS: on_valmennusalue); tämä näkymä
// suodattaa lisäksi Katso käyttäjänä -tilassa katsotun käyttäjän mukaan. Pelaaja- ja pelianalyysi tulevat vaiheissa 2–3.
import { sb, tila, nimi } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { md, aikaSitten, pvmFi } from "../keskus.js";
import { alueNimi, omatAlueet, nakyyko, tehtavanTila, jarjestaTehtavat, lueTehtavarivi, etsiJasen } from "../huoneydin.js";

const VALILEHDET = [["yleiskuva", "Yleiskuva"], ["muistiot", "Muistiinpanot"], ["palaverit", "Palaverit"], ["tehtavat", "Tehtävät"], ["analyysi", "Analyysi"]];
const ALUE_AVAIN = "kpl-huone-alue";
const TILA_NIMI = { myohassa: "myöhässä", tanaan: "tänään", pian: "pian", myohemmin: "", avoin: "", tehty: "tehty" };
let D = null;   // { jasenet, mina, muistiot, tehtavat }
let st = { alue: "kaikki", tehtSuodatin: "minun" };

const tanaan = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
const omaEmail = () => (tila.istunto?.user?.email || "").toLowerCase();
const jasenNimi = (email) => D.jasenet.find((j) => j.email === email)?.nimi || (email ? email.split("@")[0] : "");
const etunimi = (email) => jasenNimi(email).split(" ")[0];
const alueMerkki = (a) => `<span class="vh-alue vh-alue-${a}">${esc(alueNimi(a))}</span>`;
const pelaajaNimi = (id) => (tila.pelaaja[id] ? nimi(tila.pelaaja[id]) : "");
const alueenPelaajat = (alue) => tila.pelaajat.filter((p) => p.aktiivinen !== false && (alue === "sp" ? p.joukkue_id === 3 : alue === "psu" ? p.joukkue_id !== 3 : true));

export const kayttaaHuonetta = () => tila.ohjaaja;

async function lataa() {
  const [j, m, t] = await Promise.all([
    sb.rpc("valmennuksen_jasenet"),
    sb.from("valmennus_muistiot").select("*").order("pvm", { ascending: false }).order("luotu", { ascending: false }).limit(500),
    sb.from("valmennus_tehtavat").select("*").order("luotu", { ascending: false }).limit(1000),
  ]);
  for (const r of [j, m, t]) if (r.error) throw r.error;
  const jasenet = j.data || [];
  const mina = jasenet.find((x) => x.email === omaEmail()) || { email: omaEmail(), rooli: tila.rooli, valmennusalue: [] };
  D = { jasenet, mina, muistiot: m.data.filter((x) => nakyyko(x, mina)), tehtavat: t.data.filter((x) => omatAlueet(mina).includes(x.alue)) };
  const tallessa = sessionStorage.getItem(ALUE_AVAIN);
  st.alue = tallessa && (tallessa === "kaikki" || omatAlueet(mina).includes(tallessa)) ? tallessa : "kaikki";
}

const alueella = (x) => st.alue === "kaikki" || x.alue === st.alue || (x.alue === "yhteinen" && st.alue !== "yhteinen");

export async function nayta(main, vl = "yleiskuva", id) {
  if (!tila.ohjaaja) { location.replace("#/"); return; }
  await lataa();
  const alueet = omatAlueet(D.mina);
  if (!alueet.length) {
    main.innerHTML = `<h1>Valmentajien huone</h1><p class="ingressi">Tunnuksellesi ei ole vielä annettu valmennusaluetta (MSU tai PSU). Pyydä ylläpitäjää lisäämään se.</p>`;
    return;
  }
  if (vl === "m" && id) return naytaMuistio(main, id);
  if (!VALILEHDET.some(([k]) => k === vl)) vl = "yleiskuva";
  const valinnat = alueet.filter((a) => a !== "yhteinen").length > 1 ? ["kaikki", ...alueet] : [];
  main.innerHTML = `
    <header class="vh-paa">
      <div><h1>Valmentajien huone</h1>
      <p class="ingressi">Vain valmennukselle. Pelaajat eivät näe tätä osiota. ${alueet.filter((a) => a !== "yhteinen").map(alueMerkki).join(" ")}</p></div>
      ${valinnat.length ? `<div class="vh-aluevalinta pieni-chipit" role="group" aria-label="Alue">${valinnat.map((a) => `<button type="button" class="chip" data-alue="${a}" aria-pressed="${st.alue === a}">${a === "kaikki" ? "Kaikki" : esc(alueNimi(a))}</button>`).join("")}</div>` : ""}
    </header>
    <nav class="tk-valilehdet vh-valilehdet" aria-label="Valmentajien huone">${VALILEHDET.map(([k, t]) => `<a class="chip" href="#/huone/${k}" aria-pressed="${vl === k}">${t}${k === "tehtavat" && omatAvoimet().length ? ` <b class="vh-luku">${omatAvoimet().length}</b>` : ""}</a>`).join("")}</nav>
    <div id="vh-sisalto"></div>`;
  $$("[data-alue]", main).forEach((b) => (b.onclick = () => { st.alue = b.dataset.alue; sessionStorage.setItem(ALUE_AVAIN, st.alue); nayta(main, vl); }));
  const s = $("#vh-sisalto", main);
  ({ yleiskuva, muistiot: () => lista(s, "muistiinpano"), palaverit: () => lista(s, "palaveri"), tehtavat, analyysi })[vl](s, main);
}

const omatAvoimet = () => D.tehtavat.filter((t) => !t.tehty && t.vastuu === D.mina.email);

// ---------- Yleiskuva ----------
function yleiskuva(s) {
  const omat = jarjestaTehtavat(omatAvoimet().filter(alueella), tanaan());
  const uusimmat = D.muistiot.filter(alueella).slice(0, 6);
  const alue = st.alue === "kaikki" ? null : st.alue;
  const omat2 = omatAlueet(D.mina);
  const sp = omat2.includes("sp") && (!alue || alue === "sp"), psu = omat2.includes("psu") && (!alue || alue === "psu");
  const tyokalut = [
    ["Pelaajien Keskus", "#/oma", "pelaajien omat sivut, viestit ja huomioinnit"],
    ["Viikkokooste", "#/kooste", "viikon treenit, kuorma ja omatoimiset"],
    ["Tavoiteseuranta", "#/seuranta", "pelaajien tavoitteet ja niiden tila"],
    ["Lyöntiseuranta", "#/lyonnit/seuranta", "lyöntipäiväkirjat ja missiot"],
    ...(tila.valmennus && sp ? [["Treenikeskus", "#/treenikeskus", "MSU:n ja haastajien omat ohjelmat"]] : []),
    ["Kehittyneet", "#/kehittyneet", "testeissä eniten parantaneet"],
    ...(tila.valmennus && sp ? [["Analyysi", "#/analyysi", "joukkueen pelillinen analyysi"]] : []),
    ...(psu ? [["Junioreiden testit", "#/testit/juniorit", "tulokset ja vertailu"]] : []),
  ];
  s.innerHTML = `
    <div class="vh-ruudukko">
      <section class="paneeli">
        <div class="osio-paa"><h2>Minun tehtäväni</h2><a href="#/huone/tehtavat">Kaikki tehtävät</a></div>
        ${omat.length ? `<ul class="vh-tehtavat">${omat.slice(0, 8).map(tehtavaRivi).join("")}</ul>` : `<p class="pieni">Ei avoimia tehtäviä sinulle. Tehtävät syntyvät palavereista tai lisätään Tehtävät-välilehdellä.</p>`}
      </section>
      <section class="paneeli">
        <div class="osio-paa"><h2>Uusimmat</h2><span><button class="btn pieni-nappi" data-uusi="muistiinpano">+ Muistiinpano</button> <button class="btn pieni-nappi" data-uusi="palaveri">+ Palaveri</button></span></div>
        ${uusimmat.length ? `<ul class="vh-lista">${uusimmat.map(muistioRivi).join("")}</ul>` : `<p class="pieni">Ei vielä muistiinpanoja. Kirjoita ensimmäinen tai liitä palaverin muistiinpanot Jarvisille, niin hän tekee niistä muistion.</p>`}
      </section>
    </div>
    <h2 class="vh-vali">Työkalut</h2>
    <nav class="pikalinkit vh-tyokalut" aria-label="Valmennuksen työkalut">${tyokalut.map(([t, h, a]) => `<a href="${h}"><span class="pl-nimi">${esc(t)}</span><span class="pl-ala">${esc(a)}</span></a>`).join("")}</nav>`;
  kytkeUusi(s);
  kytkeTehtavat(s, () => yleiskuva(s));
}

// ---------- Muistiinpanot ja palaverit ----------
function muistioRivi(m) {
  const teht = D.tehtavat.filter((t) => t.muistio_id === m.id), auki = teht.filter((t) => !t.tehty).length;
  const otteet = (m.teksti || m.paatokset || "").replace(/[#*_>`-]/g, "").trim().slice(0, 140);
  return `<li><a class="vh-muistio" href="#/huone/m/${m.id}">
    <span class="vh-meta">${alueMerkki(m.alue)} ${m.tyyppi === "palaveri" ? "<b>Palaveri</b> · " : ""}${pvmFi(m.pvm)} · ${esc(etunimi(m.kirjoittaja))}${m.lahde === "jarvis" ? " · Jarvis" : ""}${m.yksityinen ? " · 🔒 vain sinulle" : ""}</span>
    <strong>${esc(m.otsikko)}</strong>
    ${otteet ? `<span class="pieni">${esc(otteet)}${otteet.length >= 140 ? "…" : ""}</span>` : ""}
    ${teht.length || m.pelaaja_ids?.length ? `<span class="vh-merkit">${teht.length ? `<span>${auki ? `${auki} avointa tehtävää` : "tehtävät tehty ✓"}</span>` : ""}${(m.pelaaja_ids || []).slice(0, 4).map((p) => `<span>${esc(pelaajaNimi(p))}</span>`).join("")}</span>` : ""}
  </a></li>`;
}

function lista(s, tyyppi) {
  const kaikki = D.muistiot.filter((m) => m.tyyppi === tyyppi && alueella(m));
  s.innerHTML = `
    <div class="vh-tyokalurivi">
      <button class="btn ensisij" data-uusi="${tyyppi}">${tyyppi === "palaveri" ? "+ Uusi palaverimuistio" : "+ Uusi muistiinpano"}</button>
      <input type="search" class="vh-haku" placeholder="Hae otsikosta, tekstistä, pelaajasta…" aria-label="Hae">
    </div>
    ${tyyppi === "palaveri" ? `<p class="pieni">Vinkki: liitä palaverin raakamuistiinpanot Jarvisille (Hei Jarvis, tee palaverimuistio…), niin hän jäsentää agendan, päätökset ja tehtävät tänne.</p>` : ""}
    <ul class="vh-lista" id="vh-lista"></ul>`;
  const piirra = (q = "") => {
    const n = q.toLocaleLowerCase("fi");
    const l = n ? kaikki.filter((m) => [m.otsikko, m.teksti, m.agenda, m.paatokset, ...(m.tagit || []), ...(m.pelaaja_ids || []).map(pelaajaNimi)].join(" ").toLocaleLowerCase("fi").includes(n)) : kaikki;
    $("#vh-lista", s).innerHTML = l.map(muistioRivi).join("") || `<li class="tyhja pieni">${n ? "Ei osumia." : tyyppi === "palaveri" ? "Ei vielä palaverimuistioita." : "Ei vielä muistiinpanoja."}</li>`;
  };
  piirra();
  $(".vh-haku", s).oninput = (e) => piirra(e.target.value.trim());
  kytkeUusi(s);
}

function kytkeUusi(el) {
  $$("[data-uusi]", el).forEach((b) => (b.onclick = () => muistioLomake({ tyyppi: b.dataset.uusi })));
}

// Lomake uudelle tai muokattavalle muistiolle (dialogi)
function muistioLomake(m) {
  const uusi = !m.id, palaveri = m.tyyppi === "palaveri";
  const alueet = omatAlueet(D.mina);
  const oletusAlue = m.alue || (st.alue !== "kaikki" ? st.alue : alueet[0]);
  let pelaajat = [...(m.pelaaja_ids || [])];
  const d = document.createElement("dialog"); d.className = "tk-dialogi vh-dialogi"; document.body.append(d);
  const osallistujat = new Set(m.osallistujat || (uusi ? [D.mina.email] : []));
  d.innerHTML = `<form method="dialog" class="tk-lomake">
    <header><h2>${uusi ? (palaveri ? "Uusi palaverimuistio" : "Uusi muistiinpano") : "Muokkaa"}</h2><button class="tr-sulje" value="peru" aria-label="Sulje">✕</button></header>
    <div class="tk-kentta-rivi">
      <label class="tk-kentta"><span>Alue</span><select name="alue">${alueet.map((a) => `<option value="${a}"${a === oletusAlue ? " selected" : ""}>${esc(alueNimi(a))}${a === "yhteinen" ? " (koko valmennus)" : ""}</option>`).join("")}</select></label>
      <label class="tk-kentta"><span>Päivä</span><input type="date" name="pvm" value="${esc(m.pvm || tanaan())}" required></label>
    </div>
    <label class="tk-kentta"><span>Otsikko</span><input name="otsikko" required maxlength="200" value="${esc(m.otsikko || "")}" placeholder="${palaveri ? "esim. Valmennuspalaveri – talven testit" : "esim. Ajatus lyöntijärjestyksestä"}"></label>
    ${palaveri ? `<fieldset class="vh-osallistujat"><legend>Osallistujat</legend>${D.jasenet.map((j) => `<label class="chip"><input type="checkbox" name="osallistuja" value="${esc(j.email)}"${osallistujat.has(j.email) ? " checked" : ""}>${esc(j.nimi || j.email)}</label>`).join("")}</fieldset>
    <label class="tk-kentta"><span>Agenda</span><textarea name="agenda" rows="3" placeholder="Yksi asia per rivi">${esc(m.agenda || "")}</textarea></label>` : ""}
    <label class="tk-kentta"><span>${palaveri ? "Keskustelu ja muistiinpanot" : "Teksti"}</span><textarea name="teksti" rows="${palaveri ? 5 : 7}">${esc(m.teksti || "")}</textarea></label>
    ${palaveri ? `<label class="tk-kentta"><span>Päätökset</span><textarea name="paatokset" rows="3" placeholder="Yksi päätös per rivi">${esc(m.paatokset || "")}</textarea></label>` : ""}
    ${palaveri && uusi ? `<label class="tk-kentta"><span>Tehtävät <small>yksi per rivi, esim. "- Varaa halli @Juuso 5.12."</small></span><textarea name="tehtavat" rows="3"></textarea></label>` : ""}
    <div class="tk-kentta"><span>Pelaajat, joita muistio koskee</span>
      <div class="vh-valitut" id="vh-valitut"></div>
      <select name="pelaaja" aria-label="Lisää pelaaja"><option value="">+ Lisää pelaaja…</option></select></div>
    <label class="tk-kentta"><span>Tunnisteet <small>pilkulla erotettuna</small></span><input name="tagit" value="${esc((m.tagit || []).join(", "))}" placeholder="esim. testit, lyöntijärjestys"></label>
    ${!palaveri ? `<label class="vh-yks"><input type="checkbox" name="yksityinen"${m.yksityinen ? " checked" : ""}> 🔒 Vain minulle <small>(ylläpito näkee myös)</small></label>` : ""}
    <div class="tk-napit"><button class="btn ensisij" value="ok">Tallenna</button></div>
  </form>`;
  const f = $("form", d);
  const piirraPelaajat = () => {
    $("#vh-valitut", d).innerHTML = pelaajat.map((p) => `<span class="vh-pelaaja">${esc(pelaajaNimi(p))}<button type="button" data-pois="${p}" aria-label="Poista ${esc(pelaajaNimi(p))}">✕</button></span>`).join("");
    $$("[data-pois]", d).forEach((b) => (b.onclick = () => { pelaajat = pelaajat.filter((x) => x !== b.dataset.pois); piirraPelaajat(); }));
    const valinta = alueenPelaajat(f.elements.alue.value).filter((p) => !pelaajat.includes(p.id));
    f.elements.pelaaja.innerHTML = `<option value="">+ Lisää pelaaja…</option>` + tila.joukkueet.map((j) => [j, valinta.filter((p) => p.joukkue_id === j.id)]).filter(([, l]) => l.length)
      .map(([j, l]) => `<optgroup label="${esc(j.nimi)}">${l.map((p) => `<option value="${p.id}">${esc(nimi(p))}</option>`).join("")}</optgroup>`).join("");
  };
  piirraPelaajat();
  f.elements.alue.onchange = piirraPelaajat;
  f.elements.pelaaja.onchange = (e) => { if (e.target.value) { pelaajat.push(e.target.value); piirraPelaajat(); } };
  d.addEventListener("close", () => d.remove());
  f.onsubmit = async (e) => {
    if (e.submitter?.value === "peru") return;
    e.preventDefault();
    const el = f.elements, nappi = e.submitter; if (nappi) nappi.disabled = true;
    const rivi = {
      tyyppi: m.tyyppi, alue: el.alue.value, pvm: el.pvm.value, otsikko: el.otsikko.value.trim(), teksti: el.teksti.value.trim(),
      agenda: palaveri ? el.agenda.value.trim() || null : null, paatokset: palaveri ? el.paatokset.value.trim() || null : null,
      osallistujat: palaveri ? $$("[name=osallistuja]:checked", d).map((x) => x.value) : [],
      pelaaja_ids: pelaajat, tagit: el.tagit.value.split(",").map((x) => x.trim()).filter(Boolean), yksityinen: !palaveri && !!el.yksityinen?.checked,
    };
    try {
      const q = uusi ? sb.from("valmennus_muistiot").insert(rivi).select().single() : sb.from("valmennus_muistiot").update(rivi).eq("id", m.id).select().single();
      const { data, error } = await q;
      if (error) throw error;
      if (uusi && palaveri) {
        const teht = el.tehtavat.value.split("\n").map((r) => lueTehtavarivi(r, tanaan())).filter(Boolean)
          .map((t) => ({ muistio_id: data.id, alue: data.alue, teksti: t.teksti, vastuu: etsiJasen(t.vastuuNimi, D.jasenet)?.email || null, maarapaiva: t.maarapaiva }));
        if (teht.length) { const r = await sb.from("valmennus_tehtavat").insert(teht); if (r.error) throw r.error; }
      }
      d.close();
      ilmoita(uusi ? "Tallennettu" : "Muutokset tallennettu");
      location.hash = `#/huone/m/${data.id}`;
      if (!uusi) window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); if (nappi) nappi.disabled = false; }
  };
  d.showModal();
  f.elements.otsikko.focus();
}

// ---------- Yksi muistio ----------
async function naytaMuistio(main, id) {
  const m = D.muistiot.find((x) => x.id === id);
  if (!m) { main.innerHTML = `<p><a href="#/huone">← Valmentajien huone</a></p><h1>Muistiota ei löydy</h1><p class="ingressi">Se on poistettu tai se ei kuulu alueellesi.</p>`; return; }
  const { data: kommentit } = await sb.from("valmennus_kommentit").select("*").eq("muistio_id", id).order("luotu");
  const teht = jarjestaTehtavat(D.tehtavat.filter((t) => t.muistio_id === id), tanaan());
  const voiPoistaa = m.kirjoittaja === D.mina.email || tila.admin;
  const listaksi = (t) => (t ? t.split("\n").map((r) => r.trim()).filter(Boolean).map((r) => (/^([-*•]|\d+[.)])\s/.test(r) ? r : `- ${r}`)).join("\n") : t);
  const lohko = (otsikko, teksti) => (teksti ? `<section class="vh-lohko"><h2>${otsikko}</h2><div class="md">${md(teksti)}</div></section>` : "");
  main.innerHTML = `
    <p><a href="#/huone/${m.tyyppi === "palaveri" ? "palaverit" : "muistiot"}">← ${m.tyyppi === "palaveri" ? "Palaverit" : "Muistiinpanot"}</a></p>
    <article class="vh-artikkeli">
      <header>
        <p class="vh-meta">${alueMerkki(m.alue)} ${m.tyyppi === "palaveri" ? "<b>Palaverimuistio</b> · " : ""}${pvmFi(m.pvm)} · ${esc(jasenNimi(m.kirjoittaja))}${m.lahde === "jarvis" ? " (Jarvis)" : ""}${m.yksityinen ? " · 🔒 vain kirjoittajalle ja ylläpidolle" : ""}</p>
        <h1>${esc(m.otsikko)}</h1>
        ${m.osallistujat?.length ? `<p class="pieni">Osallistujat: ${m.osallistujat.map((e) => esc(jasenNimi(e))).join(", ")}</p>` : ""}
        ${m.pelaaja_ids?.length || m.tagit?.length ? `<p class="vh-merkit">${(m.pelaaja_ids || []).map((p) => `<a href="#/oma/${p}">${esc(pelaajaNimi(p))}</a>`).join("")}${(m.tagit || []).map((t) => `<span>#${esc(t)}</span>`).join("")}</p>` : ""}
      </header>
      ${lohko("Agenda", listaksi(m.agenda))}
      ${lohko(m.tyyppi === "palaveri" ? "Keskustelu" : "", m.teksti).replace("<h2></h2>", "")}
      ${lohko("Päätökset", listaksi(m.paatokset))}
      ${m.tyyppi === "palaveri" || teht.length ? `<section class="vh-lohko"><h2>Tehtävät</h2>
        <ul class="vh-tehtavat">${teht.map(tehtavaRivi).join("") || `<li class="pieni">Ei tehtäviä.</li>`}</ul>
        ${tehtavaLisays(m)}</section>` : ""}
      <div class="vh-napit">
        <button class="btn" data-muokkaa>Muokkaa</button>
        ${m.tyyppi !== "palaveri" && !teht.length ? `<button class="btn" data-tehtava-auki>+ Tehtävä</button>` : ""}
        ${voiPoistaa ? `<button class="btn vaara" data-poista>Poista</button>` : ""}
      </div>
      <div id="vh-tehtava-lisa" hidden>${m.tyyppi !== "palaveri" && !teht.length ? tehtavaLisays(m) : ""}</div>
    </article>
    <section class="vh-kommentit">
      <h2>Kommentit</h2>
      <ul>${(kommentit || []).map((k) => `<li><span class="vh-meta">${esc(jasenNimi(k.kirjoittaja))} · ${aikaSitten(k.luotu)}</span><div class="md">${md(k.teksti)}</div>${k.kirjoittaja === D.mina.email || tila.admin ? `<button class="linkki pieni" data-poista-k="${k.id}">Poista</button>` : ""}</li>`).join("") || `<li class="pieni">Ei kommentteja.</li>`}</ul>
      <form class="vh-kommentti"><textarea name="teksti" rows="2" required placeholder="Kommentoi…"></textarea><button class="btn ensisij">Lähetä</button></form>
    </section>`;
  const uudelleen = async () => { await lataa(); naytaMuistio(main, id); };
  $("[data-muokkaa]", main).onclick = () => muistioLomake(m);
  $("[data-tehtava-auki]", main)?.addEventListener("click", (e) => { $("#vh-tehtava-lisa", main).hidden = false; e.target.remove(); });
  const poista = $("[data-poista]", main);
  if (poista) poista.onclick = async () => {
    if (!poista.dataset.vahvista) { poista.dataset.vahvista = "1"; poista.textContent = "Vahvista poisto (myös tehtävät ja kommentit)"; return; }
    const { error } = await sb.from("valmennus_muistiot").delete().eq("id", id);
    if (error) return ilmoita("Poisto epäonnistui: " + error.message, true);
    ilmoita("Poistettu"); location.hash = `#/huone/${m.tyyppi === "palaveri" ? "palaverit" : "muistiot"}`;
  };
  $(".vh-kommentti", main).onsubmit = async (e) => {
    e.preventDefault();
    const teksti = e.target.elements.teksti.value.trim(); if (!teksti) return;
    const { error } = await sb.from("valmennus_kommentit").insert({ muistio_id: id, teksti });
    if (error) return ilmoita("Kommentti epäonnistui: " + error.message, true);
    uudelleen();
  };
  $$("[data-poista-k]", main).forEach((b) => (b.onclick = async () => { const { error } = await sb.from("valmennus_kommentit").delete().eq("id", b.dataset.poistaK); if (error) ilmoita(error.message, true); else uudelleen(); }));
  kytkeTehtavat(main, uudelleen, m);
}

// ---------- Tehtävät ----------
function tehtavaRivi(t) {
  const tl = tehtavanTila(t, tanaan());
  const muistio = t.muistio_id && D.muistiot.find((m) => m.id === t.muistio_id);
  return `<li class="vh-tehtava vh-t-${tl}">
    <label><input type="checkbox" data-kuittaa="${t.id}"${t.tehty ? " checked" : ""} aria-label="Merkitse tehdyksi"><span>${esc(t.teksti)}</span></label>
    <span class="vh-meta">${t.vastuu ? esc(jasenNimi(t.vastuu)) : "ei vastuuhenkilöä"}${t.maarapaiva ? ` · ${pvmFi(t.maarapaiva)}` : ""}${TILA_NIMI[tl] && tl !== "tehty" ? ` · <b>${TILA_NIMI[tl]}</b>` : ""}${muistio && !location.hash.includes(t.muistio_id) ? ` · <a href="#/huone/m/${muistio.id}">${esc(muistio.otsikko)}</a>` : ""} ${alueMerkki(t.alue)}</span>
    ${t.kirjoittaja === D.mina.email || tila.admin ? `<button class="linkki pieni" data-poista-t="${t.id}" aria-label="Poista tehtävä">✕</button>` : ""}
  </li>`;
}

function tehtavaLisays(m) {
  const alueet = omatAlueet(D.mina);
  return `<form class="vh-tehtava-lomake">
    <input name="teksti" required placeholder="Uusi tehtävä" aria-label="Tehtävä">
    <select name="vastuu" aria-label="Vastuuhenkilö"><option value="">Vastuu…</option>${D.jasenet.filter((j) => !m || omatAlueet(j).includes(m.alue)).map((j) => `<option value="${esc(j.email)}"${j.email === D.mina.email ? " selected" : ""}>${esc(j.nimi || j.email)}</option>`).join("")}</select>
    <input type="date" name="maarapaiva" aria-label="Määräpäivä">
    ${m ? "" : `<select name="alue" aria-label="Alue">${alueet.map((a) => `<option value="${a}"${a === st.alue ? " selected" : ""}>${esc(alueNimi(a))}</option>`).join("")}</select>`}
    <button class="btn">Lisää</button></form>`;
}

function kytkeTehtavat(el, uudelleen, m) {
  $$("[data-kuittaa]", el).forEach((c) => (c.onchange = async () => {
    const { error } = await sb.from("valmennus_tehtavat").update({ tehty: c.checked, tehty_aika: c.checked ? new Date().toISOString() : null }).eq("id", c.dataset.kuittaa);
    if (error) { c.checked = !c.checked; return ilmoita("Tallennus epäonnistui: " + error.message, true); }
    const t = D.tehtavat.find((x) => x.id === c.dataset.kuittaa); if (t) { t.tehty = c.checked; t.tehty_aika = c.checked ? new Date().toISOString() : null; }
    ilmoita(c.checked ? "Merkitty tehdyksi ✓" : "Palautettu avoimeksi");
    uudelleen();
  }));
  $$("[data-poista-t]", el).forEach((b) => (b.onclick = async () => {
    if (!b.dataset.vahvista) { b.dataset.vahvista = "1"; b.textContent = "Poista?"; return; }
    const { error } = await sb.from("valmennus_tehtavat").delete().eq("id", b.dataset.poistaT);
    if (error) return ilmoita(error.message, true);
    D.tehtavat = D.tehtavat.filter((x) => x.id !== b.dataset.poistaT); uudelleen();
  }));
  $$(".vh-tehtava-lomake", el).forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const x = f.elements;
    const rivi = { teksti: x.teksti.value.trim(), vastuu: x.vastuu.value || null, maarapaiva: x.maarapaiva.value || null, alue: m ? m.alue : x.alue.value, muistio_id: m?.id || null };
    if (!rivi.teksti) return;
    const { data, error } = await sb.from("valmennus_tehtavat").insert(rivi).select().single();
    if (error) return ilmoita("Tallennus epäonnistui: " + error.message, true);
    D.tehtavat.unshift(data); ilmoita("Tehtävä lisätty"); uudelleen();
  }));
}

function tehtavat(s) {
  const kaikki = D.tehtavat.filter(alueella);
  const suod = { minun: (t) => !t.tehty && t.vastuu === D.mina.email, avoimet: (t) => !t.tehty, tehdyt: (t) => t.tehty };
  const nimet = { minun: "Minun", avoimet: "Kaikki avoimet", tehdyt: "Tehdyt" };
  const l = jarjestaTehtavat(kaikki.filter(suod[st.tehtSuodatin]), tanaan());
  s.innerHTML = `
    <div class="vh-tyokalurivi pieni-chipit" role="group" aria-label="Näytä">${Object.keys(suod).map((k) => `<button type="button" class="chip" data-ts="${k}" aria-pressed="${st.tehtSuodatin === k}">${nimet[k]} <span class="num">${kaikki.filter(suod[k]).length}</span></button>`).join("")}</div>
    <section class="paneeli">${tehtavaLisays(null)}
      <ul class="vh-tehtavat">${l.map(tehtavaRivi).join("") || `<li class="pieni">Ei tehtäviä tällä valinnalla.</li>`}</ul></section>`;
  $$("[data-ts]", s).forEach((b) => (b.onclick = () => { st.tehtSuodatin = b.dataset.ts; tehtavat(s); }));
  kytkeTehtavat(s, () => tehtavat(s));
}

// ---------- Analyysi (vaiheet 2–3) ----------
function analyysi(s) {
  s.innerHTML = `
    <div class="vh-ruudukko">
      <section class="paneeli"><h2>Pelaaja-analyysi <span class="vh-tulossa">tulossa</span></h2>
        <p>Joukkueen yleiskuva "Kuka tarvitsee huomiota": läsnäolo, kuorma, kirjausten aktiivisuus, tavoitteiden ja lyöntimissioiden aikataulu sekä testikehitys liikennevaloina. Pelaajan syväsukellus kehityskäyrineen ja vertailuineen.</p>
        <p class="pieni">Siihen asti: <a href="#/kooste">Viikkokooste</a> · <a href="#/seuranta">Tavoiteseuranta</a> · <a href="#/lyonnit/seuranta">Lyöntiseuranta</a> · <a href="#/kehittyneet">Kehittyneet</a></p></section>
      <section class="paneeli"><h2>Pelillinen analyysi <span class="vh-tulossa">tulossa</span></h2>
        <p>MSU:n pelillinen analyysi yhteen paikkaan: joukkue, pelaajat ja vertailu, vastustajat, ottelut (Superpesis ja Talvisuper erikseen) ja Pelikirja.</p>
        <p class="pieni">Siihen asti: <a href="#/analyysi">Analyysi</a> · <a href="#/juoksuodotus">Juoksuodotus</a> · <a href="#/vertailu">Vertailu</a> · <a href="#/muistio/vastustajat">Vastustajat</a></p></section>
    </div>`;
}

// Keskuksen etusivulle (28.11.2026): valmentajan avoimet tehtävät ja uusin muistio
export async function piirraHuonekortti(el) {
  const [t, m] = await Promise.all([
    sb.from("valmennus_tehtavat").select("*").eq("vastuu", omaEmail()).eq("tehty", false).limit(50),
    sb.from("valmennus_muistiot").select("id,otsikko,tyyppi,pvm,alue").order("pvm", { ascending: false }).order("luotu", { ascending: false }).limit(1),
  ]);
  if (t.error) throw t.error;
  const l = jarjestaTehtavat(t.data || [], tanaan());
  const uusin = m.data?.[0];
  el.innerHTML = `<div class="osio-paa"><h2>Valmentajien huone</h2><a href="#/huone">Avaa</a></div>
    ${l.length ? `<p class="pieni">Sinulla on ${l.length} ${l.length === 1 ? "avoin tehtävä" : "avointa tehtävää"}:</p>
      <ul class="vh-mini">${l.slice(0, 3).map((x) => { const tl = tehtavanTila(x, tanaan()); return `<li class="vh-t-${tl}"><a href="#/huone/tehtavat">${esc(x.teksti)}</a>${x.maarapaiva ? ` <span class="vh-meta">${pvmFi(x.maarapaiva)}${tl === "myohassa" ? " · myöhässä" : tl === "tanaan" ? " · tänään" : ""}</span>` : ""}</li>`; }).join("")}</ul>`
      : `<p class="pieni">Ei avoimia tehtäviä sinulle.</p>`}
    ${uusin ? `<p class="pieni">Uusin: <a href="#/huone/m/${uusin.id}">${esc(uusin.otsikko)}</a> (${pvmFi(uusin.pvm)})</p>` : ""}`;
}
