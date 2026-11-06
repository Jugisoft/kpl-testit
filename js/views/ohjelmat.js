// Treeniohjelmat (6.11.2026, Jugin toive): Anssin ohjelmat (Voimat, Juoksut, Lisäosat) muistilappuna salille.
// #/ohjelmat = lista, #/ohjelmat/:koodi = ohjelma puhelimen kokoisena: liikkeet riveittäin, ruksi kun tehty
// (ruksit vain tässä selaimessa tämän päivän ajan), lopuksi "Kirjaa tehdyksi" vie Treenipäiväkirjaan ohjelma valmiiksi valittuna.
// Data: taulu treeniohjelmat (sama kuin Treenipäiväkirjan napit), sarake kuvaus = rivit.
import { $, $$, esc } from "../util.js";
import { haeOhjelmat } from "../kuorma.js";
import { T, tanaanHki as tanaan, minStr } from "../kuormaydin.js";

const RYHMAJARJ = ["Voimat", "Juoksut", "Lisäosat"];
const lyhyt = (n) => n.replace(/\s*\((.*)\)$/, "");
const tarkenne = (n) => n.match(/\((.*)\)$/)?.[1] || "";
const onTai = (l) => /^tai\b/i.test(l.trim());
// sarjat ja toistot korostetaan: "2-3 x 4", "4 x 70%", "3-4 x 5+5"
const korosta = (l) => esc(l)
  .replace(/(https?:\/\/[^\s]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">video ↗</a>`)
  .replace(/(\d+(?:[-–]\d+)?\s*x\s*[\d][\d,+\-–%]*(?:\s*(?:sek|s|min|m|kg|%))?)/g, '<b class="oh-sarja">$1</b>');

const avain = (koodi) => `kpl-ohjelma-${koodi}-${tanaan()}`;
const lueRuksit = (koodi) => { try { return new Set(JSON.parse(localStorage.getItem(avain(koodi)) || "[]")); } catch { return new Set(); } };
const tallennaRuksit = (koodi, s) => { try { localStorage.setItem(avain(koodi), JSON.stringify([...s])); } catch { /* selain ei salli: ruksit vain näkymässä */ } };

export async function nayta(main, koodi) {
  main.innerHTML = `<p class="lataa">Ladataan ohjelmia…</p>`;
  const ohjelmat = await haeOhjelmat();
  const lista = Object.values(ohjelmat).filter((o) => o.kuvaus && o.kuvaus.trim());
  if (koodi && ohjelmat[koodi]?.kuvaus) return yksi(main, ohjelmat[koodi]);
  const ryhmat = [...new Set(lista.map((o) => o.ryhma))].sort((a, b) => (RYHMAJARJ.indexOf(a) + 1 || 99) - (RYHMAJARJ.indexOf(b) + 1 || 99));
  main.innerHTML = `
    <div class="oh-paa"><p class="oma-yla">Harjoittelu</p><h1>Treeniohjelmat</h1>
      <p class="ingressi">Valmennuksen ohjelmat mukaan salille. Avaa ohjelma, ruksaa liikkeet tehdyksi ja kirjaa lopuksi Treenipäiväkirjaan.</p></div>
    ${ryhmat.map((r) => `<section class="oh-ryhma"><h2>${esc(r)}</h2><div class="oh-kortit">${lista.filter((o) => o.ryhma === r).map((o) => {
      const rivit = o.kuvaus.split("\n").filter((l) => l.trim() && !onTai(l)).length, tehty = lueRuksit(o.koodi).size;
      return `<a class="oh-kortti" href="#/ohjelmat/${o.koodi}" style="--v:${T[o.tyyppi]?.vari || "#888"}">
        <span class="oh-k-nimi">${esc(lyhyt(o.nimi))}</span>${tarkenne(o.nimi) ? `<span class="oh-k-tark">${esc(tarkenne(o.nimi))}</span>` : ""}
        <span class="oh-k-ala"><i></i>${esc(T[o.tyyppi]?.nimi || "")}${o.kesto_min ? ` · noin ${minStr(o.kesto_min)}` : ""} · ${rivit} kohtaa${tehty ? ` · <b>${tehty} tehty tänään</b>` : ""}</span></a>`;
    }).join("")}</div></section>`).join("") || `<p class="tyhja">Ohjelmia ei ole vielä lisätty.</p>`}`;
}

function yksi(main, o) {
  const ruksit = lueRuksit(o.koodi);
  const rivit = o.kuvaus.split("\n").map((l) => l.trim()).filter(Boolean);
  const kohdat = rivit.filter((l) => !onTai(l)).length;
  main.innerHTML = `
    <a class="oh-takaisin" href="#/ohjelmat">‹ Kaikki ohjelmat</a>
    <div class="oh-yksi" style="--v:${T[o.tyyppi]?.vari || "#888"}">
      <div class="oh-y-paa"><p class="oma-yla">${esc(o.ryhma || "Ohjelma")}</p><h1>${esc(lyhyt(o.nimi))}</h1>
        <p class="oh-y-tiedot"><span><i></i>${esc(T[o.tyyppi]?.nimi || "")}</span>${tarkenne(o.nimi) ? `<span>${esc(tarkenne(o.nimi))}</span>` : ""}${o.kesto_min ? `<span>noin ${minStr(o.kesto_min)}</span>` : ""}${o.rpe ? `<span>rasitus ${o.rpe}/10</span>` : ""}</p></div>
      <div class="oh-edistys" aria-live="polite"><div class="oh-palkki"><span style="width:0%"></span></div><b></b></div>
      <ol class="oh-rivit">${rivit.map((l, i) => onTai(l)
        ? `<li class="oh-tai"><span>${korosta(l.replace(/^tai\b:?\s*/i, "")) || "tai"}</span><em>tai</em></li>`
        : `<li><label><input type="checkbox" data-i="${i}"${ruksit.has(i) ? " checked" : ""}><span>${korosta(l)}</span></label></li>`).join("")}</ol>
      ${o.lahde ? `<p class="pieni oh-lahde">Lähde: ${esc(o.lahde)}. Ruksit tallentuvat vain tähän laitteeseen tämän päivän ajaksi.</p>` : ""}
      <div class="oh-toiminnot"><button class="btn ensisij" id="oh-kirjaa">Kirjaa tehdyksi →</button><button class="btn" id="oh-tyhjenna">Tyhjennä ruksit</button></div>
    </div>`;
  const paivita = () => {
    const n = $$(".oh-rivit input:checked", main).length;
    $(".oh-palkki span", main).style.width = `${kohdat ? (100 * n) / kohdat : 0}%`;
    $(".oh-edistys b", main).textContent = `${n}/${kohdat} tehty`;
  };
  $$(".oh-rivit input", main).forEach((c) => (c.onchange = () => { c.checked ? ruksit.add(+c.dataset.i) : ruksit.delete(+c.dataset.i); tallennaRuksit(o.koodi, ruksit); paivita(); }));
  $("#oh-tyhjenna", main).onclick = () => { ruksit.clear(); tallennaRuksit(o.koodi, ruksit); $$(".oh-rivit input", main).forEach((c) => (c.checked = false)); paivita(); };
  $("#oh-kirjaa", main).onclick = () => { try { sessionStorage.setItem("kpl-treeni-valitse", o.koodi); } catch { /* ohitetaan */ } location.hash = "#/treenit"; };
  paivita();
}
