// Tulosten syöttö testikerralla: pelaajat riveinä, yritykset sarakkeina, tallennus heti.
import { sb, tila, nimi, lataaTulokset, lataaKerranTulokset } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, paras, parannus, kuva, ilmoita } from "../util.js";
import { PAKETIT } from "./kerrat.js";

const NOPEUS = new Set(["10m", "30m", "nok_30m", "30m_takaperin", "ketteryysrata"]);
const JONO_AVAIN = "kpl-testit-jono";
let k = null;          // testikerta
let osallistujat = []; // [{pelaaja, jarjestys}]
let rivit = new Map(); // avain -> tulosrivi
let historia = [];     // aiemmat tulokset (ennätyksiä varten)
let valilehdet = [];
let aktiivinen = 0;
let suunta = localStorage.getItem("kpl-suunta") || "alas";
let kanava = null, jonoAjastin = null;

const avain = (p, t, y) => `${p}|${t}|${y}`;
const tarkenne = (t) => (k.piikit && NOPEUS.has(t) ? "piikit" : "");

export function poistu() { kanava && sb.removeChannel(kanava); kanava = null; clearInterval(jonoAjastin); }

export async function nayta(main, id) {
  k = tila.kerta[id];
  if (!k) throw new Error("Testikertaa ei löytynyt.");
  const [tul, os, kaikki] = await Promise.all([
    lataaKerranTulokset(id),
    sb.from("osallistujat").select("*").eq("testikerta_id", id).order("jarjestys"),
    lataaTulokset(),
  ]);
  rivit = new Map(tul.filter((r) => r.tarkenne === tarkenne(r.testi)).map((r) => [avain(r.pelaaja_id, r.testi, r.yritys), r]));
  osallistujat = (os.data || []).filter((o) => tila.pelaaja[o.pelaaja_id]);
  historia = kaikki.filter((r) => r.testikerta_id !== id && tila.kerta[r.testikerta_id]?.pvm < k.pvm && r.hyvaksytty);
  rakennaValilehdet();

  main.innerHTML = `
    <div class="syotto-paa">
      <div>
        <h1>${esc(k.nimi || "Testikerta")}</h1>
        <div class="pieni">${pvm(k.pvm)}${k.piikit ? " · piikkiajat" : ""} · ${osallistujat.length} pelaajaa</div>
      </div>
      <div class="rivi">
        <span class="tila" id="tila"><span class="pallo"></span><span>Tallennus päällä</span></span>
        <label class="kentta" style="flex-direction:row">Enter siirtää
          <select id="suunta"><option value="alas">alas seuraavalle pelaajalle</option><option value="oikealle">oikealle seuraavaan sarakkeeseen</option></select></label>
        <a class="btn" href="#/kerta/${k.id}">Tulokset</a>
      </div>
    </div>
    <div class="testivalitsin" role="tablist">${valilehdet.map((v, i) => `<button class="chip" role="tab" data-i="${i}" aria-pressed="${i === aktiivinen}">${esc(v.nimi)}</button>`).join("")}</div>
    <div class="taulu-wrap"><table class="syotto" id="ruudukko"></table></div>
    <div class="rivi" style="margin-top:10px"><button class="btn" id="lisaa-yritys">+ yritys</button></div>
    <p class="vihje">Kirjoita tulos ja paina <kbd>Enter</kbd>. Desimaalin voi jättää pois: <b>412</b> tallentuu 4,12 sekunniksi. Lisää perään <b>h</b> (esim. <b>148h</b>), jos tulos on hylätty, esimerkiksi haamu tai lyönti alle. Tyhjennä solu poistaaksesi tuloksen. Tulokset tallentuvat heti; ilman verkkoa ne odottavat laitteella ja lähtevät, kun yhteys palaa.</p>
    <details class="paneeli" style="margin-top:20px"><summary><strong>Osallistujat ja järjestys</strong></summary><div id="osallistujat" style="margin-top:12px"></div></details>`;

  $("#suunta").value = suunta;
  $("#suunta").onchange = (e) => { suunta = e.target.value; localStorage.setItem("kpl-suunta", suunta); };
  $$(".testivalitsin .chip").forEach((b) => (b.onclick = () => { aktiivinen = +b.dataset.i; $$(".testivalitsin .chip").forEach((x) => x.setAttribute("aria-pressed", x === b)); piirraRuudukko(); }));
  $("#lisaa-yritys").onclick = () => { valilehdet[aktiivinen].yrityksia++; piirraRuudukko(); };
  piirraRuudukko();
  piirraOsallistujat();

  kanava = sb.channel("kerta-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "tulokset", filter: `testikerta_id=eq.${id}` }, (m) => {
      const r = m.eventType === "DELETE" ? m.old : m.new;
      if (!r || r.tarkenne !== tarkenne(r.testi)) return;
      const a = avain(r.pelaaja_id, r.testi, r.yritys);
      if (m.eventType === "DELETE") rivit.delete(a); else rivit.set(a, { ...r, arvo: Number(r.arvo) });
      const inp = document.querySelector(`input[data-a="${a}"]`);
      if (inp && document.activeElement !== inp) { asetaSolu(inp); paivitaRivi(r.pelaaja_id); }
    }).subscribe();
  jonoAjastin = setInterval(tyhjennaJono, 10000);
  window.addEventListener("online", tyhjennaJono);
  tyhjennaJono();
}

function rakennaValilehdet() {
  const t = new Set(k.testit);
  rivit.forEach((r) => t.add(r.testi));
  valilehdet = [];
  const maxY = (testit) => Math.max(0, ...[...rivit.values()].filter((r) => testit.includes(r.testi)).map((r) => r.yritys));
  if (t.has("10m") || t.has("30m")) {
    const testit = ["10m", "30m"].filter((x) => t.has(x));
    valilehdet.push({ nimi: "Nopeus 10 + 30 m", testit, yrityksia: Math.max(3, maxY(testit)), paras: "30m", lentava: testit.length === 2 });
    t.delete("10m"); t.delete("30m");
  }
  if (t.has("nok_30m")) { valilehdet.push({ nimi: "Nopeuskestävyys 9×30 m", testit: ["nok_30m"], yrityksia: Math.max(9, maxY(["nok_30m"])), paras: "nok_30m", ka: true }); t.delete("nok_30m"); }
  for (const p of PAKETIT) {
    const testit = p.testit.filter((x) => t.has(x));
    if (!testit.length) continue;
    const summa = /Näpy|Lyöntitesti/.test(p.nimi);
    valilehdet.push({ nimi: p.nimi, testit, yrityksia: Math.max(1, maxY(testit)), summa });
    testit.forEach((x) => t.delete(x));
  }
  for (const x of t) if (tila.testi[x] && !tila.testi[x].johdettu)
    valilehdet.push({ nimi: tila.testi[x].nimi, testit: [x], yrityksia: Math.max(tila.testi[x].yrityksia > 1 ? 3 : 1, maxY([x])), paras: x });
  if (aktiivinen >= valilehdet.length) aktiivinen = 0;
}

function sarakkeet(v) {
  const s = [];
  for (let y = 1; y <= v.yrityksia; y++) for (const t of v.testit) s.push({ testi: t, yritys: y });
  return s;
}

function piirraRuudukko() {
  const v = valilehdet[aktiivinen];
  const tbl = $("#ruudukko");
  if (!v) { tbl.innerHTML = `<tr><td class="tyhja">Testikertaan ei ole valittu testejä.</td></tr>`; return; }
  const sar = sarakkeet(v);
  const otsikko = (c) => v.testit.length > 1 && v.yrityksia > 1 ? `${c.yritys}. ${lyhyt(c.testi)}` : v.yrityksia > 1 ? `${c.yritys}.` : lyhyt(c.testi);
  tbl.innerHTML = `
    <thead><tr><th class="pelaaja">Pelaaja</th>${v.paras ? `<th class="n">Paras</th><th class="n mob-pois">Ennätys</th>` : ""}${v.lentava ? `<th class="n mob-pois">Lentävä 20</th>` : ""}${v.ka ? `<th class="n mob-pois">Ka</th>` : ""}${v.summa ? `<th class="n">Yht.</th>` : ""}
      ${sar.map((c) => `<th style="text-align:center">${esc(otsikko(c))}</th>`).join("")}</tr></thead>
    <tbody>${osallistujat.map((o, ri) => {
      const p = tila.pelaaja[o.pelaaja_id];
      return `<tr data-p="${p.id}"><td class="pelaaja"><div class="nimi">${kuva(p)}<div><div class="nm">${esc(nimi(p))}</div><div class="sv">${p.syntymavuosi || ""}</div></div></div></td>
        ${v.paras ? `<td class="yht" data-paras></td><td class="vrt mob-pois" data-pb></td>` : ""}${v.lentava ? `<td class="yht mob-pois" data-lentava></td>` : ""}${v.ka ? `<td class="yht mob-pois" data-ka></td>` : ""}${v.summa ? `<td class="yht" data-summa></td>` : ""}
        ${sar.map((c, ci) => `<td class="solu" data-testi="${c.testi}"><input inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="${esc(nimi(p))}, ${esc(tila.testi[c.testi].nimi)}, yritys ${c.yritys}" data-a="${avain(p.id, c.testi, c.yritys)}" data-r="${ri}" data-c="${ci}"></td>`).join("")}</tr>`;
    }).join("") || `<tr><td class="tyhja" colspan="5">Lisää osallistujat alta.</td></tr>`}</tbody>`;
  $$("input[data-a]", tbl).forEach((inp) => { asetaSolu(inp); inp.addEventListener("keydown", nappain); inp.addEventListener("change", () => tallenna(inp)); inp.addEventListener("focus", () => inp.select()); });
  osallistujat.forEach((o) => paivitaRivi(o.pelaaja_id));
}

const lyhyt = (t) => ({ "10m": "10 m", "30m": "30 m", nok_30m: "30 m", heitto_paikalta: "Heitto paik.", heitto_vauhti: "Heitto vauhti", lyonti: "Lyönti" }[t] || tila.testi[t].nimi.replace(/^.*?: /, ""));

function asetaSolu(inp) {
  const r = rivit.get(inp.dataset.a);
  const td = inp.parentElement;
  inp.value = r ? muotoile(r.arvo, r.testi) + (r.hyvaksytty ? "" : "h") : "";
  td.classList.toggle("hylatty", !!r && !r.hyvaksytty);
}

function paivitaRivi(pid) {
  const v = valilehdet[aktiivinen];
  const tr = document.querySelector(`tr[data-p="${pid}"]`);
  if (!v || !tr) return;
  const omat = [...rivit.values()].filter((r) => r.pelaaja_id === pid && r.hyvaksytty);
  if (v.paras) {
    const t = v.paras;
    const tanaan = paras(t, omat.filter((r) => r.testi === t).map((r) => r.arvo));
    const pb = paras(t, historia.filter((r) => r.pelaaja_id === pid && r.testi === t && r.tarkenne === tarkenne(t)).map((r) => r.arvo));
    const uusiPb = tanaan != null && (pb == null || parannus(t, tanaan, pb) > 0);
    tr.querySelector("[data-paras]").innerHTML = tanaan == null ? "" : `<span class="${uusiPb && pb != null ? "pb" : ""}">${muotoile(tanaan, t)}</span>`;
    tr.querySelector("[data-pb]").innerHTML = pb == null ? "–" : `${muotoile(pb, t)}${tanaan != null ? `<br><span class="${parannus(t, tanaan, pb) > 0 ? "pb" : ""}">${muotoileMuutos(tanaan - pb, t)}</span>` : ""}`;
    $$(`td.solu[data-testi="${t}"]`, tr).forEach((td) => { const r = rivit.get(td.firstElementChild.dataset.a); td.classList.toggle("ennatys", !!r && r.hyvaksytty && r.arvo === tanaan && uusiPb && pb != null); });
  }
  if (v.lentava) {
    const ajat = [];
    for (let y = 1; y <= v.yrityksia; y++) { const a = rivit.get(avain(pid, "10m", y)), b = rivit.get(avain(pid, "30m", y)); if (a?.hyvaksytty && b?.hyvaksytty) ajat.push(b.arvo - a.arvo); }
    tr.querySelector("[data-lentava]").textContent = ajat.length ? muotoile(Math.min(...ajat), "30m") : "";
  }
  if (v.ka) { const a = omat.filter((r) => r.testi === v.paras).map((r) => r.arvo); tr.querySelector("[data-ka]").textContent = a.length ? muotoile(a.reduce((s, x) => s + x, 0) / a.length, v.paras) : ""; }
  if (v.summa) { const a = omat.filter((r) => v.testit.includes(r.testi)); tr.querySelector("[data-summa]").textContent = a.length ? a.reduce((s, x) => s + x.arvo, 0) : ""; }
}

function nappain(e) {
  if (e.key !== "Enter" && !(e.key === "Tab" && false)) return;
  e.preventDefault();
  tallenna(e.target);
  const r = +e.target.dataset.r, c = +e.target.dataset.c;
  const rows = osallistujat.length, cols = sarakkeet(valilehdet[aktiivinen]).length;
  let nr = r, nc = c;
  if (suunta === "alas") { nr = r + 1; if (nr >= rows) { nr = 0; nc = c + 1; } }
  else { nc = c + 1; if (nc >= cols) { nc = 0; nr = r + 1; } }
  const seur = document.querySelector(`input[data-r="${nr}"][data-c="${nc}"]`);
  (seur || e.target).focus();
}

function tulkitse(teksti, testi) {
  let s = teksti.trim().toLowerCase().replace(/\s/g, "");
  if (!s) return { tyhja: true };
  let hyvaksytty = true;
  if (/[h*]$/.test(s)) { hyvaksytty = false; s = s.replace(/[h*]+$/, ""); }
  s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return { virhe: "Ei numero" };
  let arvo = parseFloat(s);
  const t = tila.testi[testi];
  if (!s.includes(".") && t.desimaalit > 0 && t.max_arvo != null && arvo > t.max_arvo) arvo = arvo / 10 ** t.desimaalit;
  const varoitus = (t.min_arvo != null && arvo < t.min_arvo) || (t.max_arvo != null && arvo > t.max_arvo);
  return { arvo: Math.round(arvo * 1000) / 1000, hyvaksytty, varoitus };
}

async function tallenna(inp) {
  const [pid, testi, yr] = inp.dataset.a.split("|");
  const yritys = +yr;
  const vanha = rivit.get(inp.dataset.a);
  const t = tulkitse(inp.value, testi);
  const td = inp.parentElement;
  td.classList.remove("virhe", "varoitus", "tallennettu");
  if (t.virhe) { td.classList.add("virhe"); ilmoita(`${t.virhe}: "${inp.value}"`, true); return; }
  if (t.tyhja) {
    if (!vanha) return;
    rivit.delete(inp.dataset.a);
    await laheta({ tyyppi: "poista", testikerta_id: k.id, pelaaja_id: pid, testi, yritys, tarkenne: tarkenne(testi) }, td);
  } else {
    if (vanha && vanha.arvo === t.arvo && vanha.hyvaksytty === t.hyvaksytty) { asetaSolu(inp); return; }
    const rivi = { testikerta_id: k.id, pelaaja_id: pid, testi, yritys, arvo: t.arvo, tarkenne: tarkenne(testi), hyvaksytty: t.hyvaksytty };
    rivit.set(inp.dataset.a, { ...vanha, ...rivi });
    asetaSolu(inp);
    if (t.varoitus) { td.classList.add("varoitus"); ilmoita(`Tarkista arvo ${muotoile(t.arvo, testi)} – poikkeaa tavallisesta.`); }
    await laheta({ tyyppi: "tallenna", ...rivi }, td);
  }
  paivitaRivi(pid);
}

async function laheta(op, td) {
  td?.classList.add("tallentaa");
  const ok = await suorita(op);
  td?.classList.remove("tallentaa");
  if (ok === true) { td?.classList.add("tallennettu"); setTimeout(() => td?.classList.remove("tallennettu"), 1200); }
  else if (ok === "verkko") { jono(op); td?.classList.add("jonossa"); paivitaTila(); }
  else { td?.classList.add("virhe"); ilmoita("Tallennus epäonnistui: " + ok, true); }
}

async function suorita(op) {
  try {
    let res;
    if (op.tyyppi === "poista") {
      res = await sb.from("tulokset").delete().match({ testikerta_id: op.testikerta_id, pelaaja_id: op.pelaaja_id, testi: op.testi, yritys: op.yritys, tarkenne: op.tarkenne });
    } else {
      const { tyyppi, ...rivi } = op;
      res = await sb.from("tulokset").upsert(rivi, { onConflict: "testikerta_id,pelaaja_id,testi,yritys,tarkenne" });
    }
    if (res.error) return /fetch|network|Failed/i.test(res.error.message) ? "verkko" : res.error.message;
    return true;
  } catch (e) { return "verkko"; }
}

function lueJono() { try { return JSON.parse(localStorage.getItem(JONO_AVAIN) || "[]"); } catch { return []; } }
function jono(op) { const j = lueJono().filter((x) => !(x.testikerta_id === op.testikerta_id && x.pelaaja_id === op.pelaaja_id && x.testi === op.testi && x.yritys === op.yritys)); j.push(op); try { localStorage.setItem(JONO_AVAIN, JSON.stringify(j)); } catch {} }
async function tyhjennaJono() {
  const j = lueJono();
  if (!j.length) return paivitaTila();
  const jaljelle = [];
  for (const op of j) { const ok = await suorita(op); if (ok === "verkko") jaljelle.push(op); }
  try { localStorage.setItem(JONO_AVAIN, JSON.stringify(jaljelle)); } catch {}
  if (!jaljelle.length) { $$(".solu.jonossa").forEach((td) => td.classList.remove("jonossa")); if (j.length) ilmoita(`${j.length} odottanutta tulosta tallennettu.`); }
  paivitaTila();
}
function paivitaTila() {
  const n = lueJono().length, el = $("#tila");
  if (!el) return;
  el.classList.toggle("offline", n > 0);
  el.lastElementChild.textContent = n ? `${n} tulosta odottaa yhteyttä` : "Kaikki tallennettu";
}

// Osallistujat
function piirraOsallistujat() {
  const el = $("#osallistujat");
  const mukana = new Set(osallistujat.map((o) => o.pelaaja_id));
  const muut = tila.pelaajat.filter((p) => !mukana.has(p.id)).sort((a, b) => (b.aktiivinen - a.aktiivinen) || nimi(a).localeCompare(nimi(b), "fi"));
  el.innerHTML = `
    <ol class="osallistujat">${osallistujat.map((o, i) => { const p = tila.pelaaja[o.pelaaja_id]; return `<li><span class="num" style="width:22px;text-align:right">${i + 1}.</span>${kuva(p)}<span style="flex:1">${esc(nimi(p))}</span>
      <button class="nappi" data-ylos="${i}" aria-label="Siirrä ylös" ${i === 0 ? "disabled" : ""}>↑</button><button class="nappi" data-alas="${i}" aria-label="Siirrä alas" ${i === osallistujat.length - 1 ? "disabled" : ""}>↓</button><button class="nappi" data-pois="${i}" aria-label="Poista listalta">✕</button></li>`; }).join("")}</ol>
    <div class="rivi" style="margin-top:12px"><select id="lisaa-pelaaja"><option value="">Lisää pelaaja…</option>${muut.map((p) => `<option value="${p.id}">${esc(nimi(p))}${p.aktiivinen ? "" : " (ei aktiivinen)"}</option>`).join("")}</select></div>`;
  $$("[data-ylos]", el).forEach((b) => (b.onclick = () => siirra(+b.dataset.ylos, -1)));
  $$("[data-alas]", el).forEach((b) => (b.onclick = () => siirra(+b.dataset.alas, 1)));
  $$("[data-pois]", el).forEach((b) => (b.onclick = async () => {
    const o = osallistujat[+b.dataset.pois];
    if ([...rivit.values()].some((r) => r.pelaaja_id === o.pelaaja_id)) return ilmoita("Pelaajalla on tuloksia tällä kerralla. Poista tulokset ensin.", true);
    osallistujat.splice(+b.dataset.pois, 1);
    await sb.from("osallistujat").delete().match({ testikerta_id: k.id, pelaaja_id: o.pelaaja_id });
    tallennaJarjestys();
  }));
  $("#lisaa-pelaaja").onchange = async (e) => {
    if (!e.target.value) return;
    osallistujat.push({ testikerta_id: k.id, pelaaja_id: e.target.value, jarjestys: osallistujat.length + 1 });
    const { error } = await sb.from("osallistujat").upsert({ testikerta_id: k.id, pelaaja_id: e.target.value, jarjestys: osallistujat.length });
    if (error) ilmoita(error.message, true);
    piirraOsallistujat(); piirraRuudukko();
  };
}
function siirra(i, d) { const [o] = osallistujat.splice(i, 1); osallistujat.splice(i + d, 0, o); tallennaJarjestys(); }
async function tallennaJarjestys() {
  osallistujat.forEach((o, i) => (o.jarjestys = i + 1));
  piirraOsallistujat(); piirraRuudukko();
  const { error } = await sb.from("osallistujat").upsert(osallistujat.map((o) => ({ testikerta_id: k.id, pelaaja_id: o.pelaaja_id, jarjestys: o.jarjestys })));
  if (error) ilmoita("Järjestyksen tallennus epäonnistui: " + error.message, true);
}
