// Treeniohjelmat (6.11.2026, Jugin toive): Anssin ohjelmat (Voimat, Juoksut, Lisäosat) muistilappuna salille.
// #/ohjelmat = lista, #/ohjelmat/:koodi = ohjelma luettavassa muodossa puhelimelle (liike per rivi, sarjat korostettu).
// Pelkkä muistilappu: treeni kirjataan erikseen Treenipäiväkirjaan (6.11.2026 Jugi: ei rukseja).
// Data: taulu treeniohjelmat (sama kuin Treenipäiväkirjan napit), sarake kuvaus = rivit.
import { $, $$, esc } from "../util.js";
import { haeOhjelmat } from "../kuorma.js";
import { T, minStr } from "../kuormaydin.js";

const RYHMAJARJ = ["Voimat", "Juoksut", "Lisäosat"];
const lyhyt = (n) => n.replace(/\s*\((.*)\)$/, "");
const tarkenne = (n) => n.match(/\((.*)\)$/)?.[1] || "";
const onTai = (l) => /^tai\b/i.test(l.trim());
// sarjat ja toistot korostetaan: "2-3 x 4", "4 x 70%", "3-4 x 5+5"
const korosta = (l) => esc(l)
  .replace(/(https?:\/\/[^\s]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">video ↗</a>`)
  .replace(/(\d+(?:[-–]\d+)?\s*x\s*[\d][\d,+\-–%]*(?:\s*(?:sek|s|min|m|kg|%))?)/g, '<b class="tro-sarja">$1</b>');


export async function nayta(main, koodi) {
  main.innerHTML = `<p class="lataa">Ladataan ohjelmia…</p>`;
  const ohjelmat = await haeOhjelmat();
  const lista = Object.values(ohjelmat).filter((o) => o.kuvaus && o.kuvaus.trim());
  if (koodi && ohjelmat[koodi]?.kuvaus) return yksi(main, ohjelmat[koodi]);
  const ryhmat = [...new Set(lista.map((o) => o.ryhma))].sort((a, b) => (RYHMAJARJ.indexOf(a) + 1 || 99) - (RYHMAJARJ.indexOf(b) + 1 || 99));
  main.innerHTML = `
    <div class="tro-paa"><p class="oma-yla">Harjoittelu</p><h1>Treeniohjelmat</h1>
      <p class="ingressi">Valmennuksen ohjelmat mukaan salille. Avaa ohjelma, niin näet mitä se sisältää. Tehty treeni kirjataan Treenipäiväkirjaan.</p></div>
    ${ryhmat.map((r) => `<section class="tro-ryhma"><h2>${esc(r)}</h2><div class="tro-kortit">${lista.filter((o) => o.ryhma === r).map((o) => {
      const rivit = o.kuvaus.split("\n").filter((l) => l.trim() && !onTai(l)).length;
      return `<a class="tro-kortti" href="#/ohjelmat/${o.koodi}" style="--v:${T[o.tyyppi]?.vari || "#888"}">
        <span class="tro-k-nimi">${esc(lyhyt(o.nimi))}</span>${tarkenne(o.nimi) ? `<span class="tro-k-tark">${esc(tarkenne(o.nimi))}</span>` : ""}
        <span class="tro-k-ala"><i></i>${esc(T[o.tyyppi]?.nimi || "")}${o.kesto_min ? ` · noin ${minStr(o.kesto_min)}` : ""} · ${rivit} kohtaa</span></a>`;
    }).join("")}</div></section>`).join("") || `<p class="tyhja">Ohjelmia ei ole vielä lisätty.</p>`}`;
}

function yksi(main, o) {
  const rivit = o.kuvaus.split("\n").map((l) => l.trim()).filter(Boolean);
  main.innerHTML = `
    <a class="tro-takaisin" href="#/ohjelmat">‹ Kaikki ohjelmat</a>
    <div class="tro-yksi" style="--v:${T[o.tyyppi]?.vari || "#888"}">
      <div class="tro-y-paa"><p class="oma-yla">${esc(o.ryhma || "Ohjelma")}</p><h1>${esc(lyhyt(o.nimi))}</h1>
        <p class="tro-y-tiedot"><span><i></i>${esc(T[o.tyyppi]?.nimi || "")}</span>${tarkenne(o.nimi) ? `<span>${esc(tarkenne(o.nimi))}</span>` : ""}${o.kesto_min ? `<span>noin ${minStr(o.kesto_min)}</span>` : ""}${o.rpe ? `<span>rasitus ${o.rpe}/10</span>` : ""}</p></div>
      <ol class="tro-rivit">${rivit.map((l) => onTai(l)
        ? `<li class="tro-tai"><span>${korosta(l.replace(/^tai\b:?\s*/i, "")) || "tai"}</span><em>tai</em></li>`
        : `<li><span>${korosta(l)}</span></li>`).join("")}</ol>
      <p class="pieni tro-lahde">${o.lahde ? `Lähde: ${esc(o.lahde)} · ` : ""}<a href="#/treenit">Kirjaa treeni Treenipäiväkirjaan →</a></p>
    </div>`;
}
