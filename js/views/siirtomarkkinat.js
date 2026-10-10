// Siirtomarkkinat 2027: Jarvisin kooste (Siirrot, Pelinjohtajat, Kokoonpanot, vaikutus).
import { $, $$, esc } from "../util.js";
import { haeSiirtomarkkinat, md, aikaSitten } from "../keskus.js";

let valilehti = "tilanne";
let joukkue = "KPL";
let siirtoSuodatin = "";

const pct = (x) => (x == null || x === "" ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x * 100).toFixed(0)} %`);
const varmuusLuokka = (v) => (/huhu/i.test(v) ? "huhu" : /yksi lähde/i.test(v) ? "yksi" : /koonti/i.test(v) ? "koonti" : "vahva");
const lahde = (l) => (l?.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.teksti || "lähde")}</a>` : esc(l?.teksti || ""));

export async function nayta(main) {
  const d = await haeSiirtomarkkinat(true);
  if (!d) {
    main.innerHTML = `<h1>Siirtomarkkinat</h1><div class="paneeli tyhja-iso"><p>Siirtomarkkinatietoja ei ole vielä viety portaaliin. Jarvis vie ne iltaisin, kun uusia siirtoja löytyy.</p></div>`;
    return;
  }
  main.innerHTML = `
    <div class="sivu-paa">
      <div>
        <h1>Siirtomarkkinat 2027</h1>
        <p class="ingressi">Miesten Superpesiksen sopimukset, siirrot ja pelinjohtajat. Lähteinä seurojen tiedotteet ja Supervuoron koonti, vaikutusluvut runkosarjasta 2026.</p>
      </div>
      <p class="pieni paivitys">Päivitetty ${esc(d.tilannekatsaus_paivitetty || aikaSitten(d.paivitetty))}</p>
    </div>
    <div class="valilehdet" role="tablist">
      ${[["tilanne", "Tilanne"], ["vaikutus", "Vaikutus joukkueisiin"], ["siirrot", `Siirrot <span class="lkm">${d.siirrot.length}</span>`], ["joukkueet", "Kokoonpanot"], ["pj", "Pelinjohtajat"]]
        .map(([k, v]) => `<button role="tab" class="valilehti" data-v="${k}" aria-selected="${valilehti === k}">${v}</button>`).join("")}
    </div>
    <div id="sm"></div>`;
  $$(".valilehti", main).forEach((b) => (b.onclick = () => { valilehti = b.dataset.v; $$(".valilehti", main).forEach((x) => x.setAttribute("aria-selected", x === b)); piirra(d); }));
  piirra(d);
}

function piirra(d) {
  const el = $("#sm");
  if (valilehti === "tilanne") {
    el.innerHTML = `<div class="kaksi-saraketta">
      <section><h2>Tärkeimmät muutokset</h2><div class="md uutislista">${md(d.tarkeimmat)}</div></section>
      <section><h2>Seurattavat asiat</h2><div class="md uutislista hiljainen">${md(d.seurattavat)}</div></section></div>`;
  } else if (valilehti === "vaikutus") {
    const rivit = [...d.vaikutus].sort((a, b) => (b["Netto yhteensä %"] ?? 0) - (a["Netto yhteensä %"] ?? 0));
    const max = Math.max(...rivit.map((r) => Math.abs(r["Netto yhteensä %"] || 0)), 0.05);
    el.innerHTML = `
      <p class="vihje" style="margin-top:0">Palkki näyttää, paljonko joukkueen sisäpelin tuotosta (YHT ja kärkilyönnit, runkosarja 2026) lähti ja tuli siirroissa. Vasemmalle = menetti, oikealle = vahvistui. Ykköspesiksestä nousevan pelaajan luvut on kerrottu tasokertoimella.</p>
      <div class="vaikutus">${rivit.map((r) => {
        const n = r["Netto yhteensä %"] || 0, lev = (Math.abs(n) / max) * 50;
        return `<div class="v-rivi${r.Joukkue === "KPL" ? " oma" : ""}">
          <span class="v-nimi">${esc(r.Joukkue)}</span>
          <span class="v-palkki" aria-hidden="true"><span class="${n < 0 ? "miinus" : "plus"}" style="${n < 0 ? `right:50%;width:${lev}%` : `left:50%;width:${lev}%`}"></span></span>
          <span class="v-luku num">${pct(n)}</span>
          <span class="v-arvio">${esc(r.Arvio || "")}</span>
          <span class="v-tiedot pieni">Tuli ${r.Tulleet}, lähti ${r.Lähteneet}. YHT ${Math.round(r["YHT tuli"])} sisään / ${Math.round(r["YHT lähti"])} ulos (koko joukkue ${r["Joukkueen YHT 2026"]}). PJ 2027: ${esc(r["PJ 2027"] || "?")}</span>
        </div>`;
      }).join("")}</div>
      <p class="vihje">YHT = kunnarit + lyödyt + tuodut juoksut. Luvut eivät huomioi pelipaikkaa, ulkopeliä eikä nuorten kehitystä, joten ne kertovat mittakaavan, eivät joukkueen tasoa.</p>`;
  } else if (valilehti === "siirrot") {
    const joukkueet = [...new Set(d.siirrot.flatMap((s) => [s.Mistä, s.Mihin]).filter((x) => x && x !== "–"))].sort();
    el.innerHTML = `
      <div class="rivi suodattimet"><select id="sj"><option value="">Kaikki joukkueet</option>${joukkueet.map((j) => `<option>${esc(j)}</option>`).join("")}</select></div>
      <div class="taulu-wrap"><table>
        <thead><tr><th>Pvm</th><th>Pelaaja</th><th>Mistä</th><th>Mihin</th><th class="n">YHT 2026</th><th class="n">KL</th><th>Varmuus</th><th>Lähde</th></tr></thead>
        <tbody id="st"></tbody></table></div>
      <p class="vihje">"Koonti" tarkoittaa, että tieto on Supervuoron sopimuskoonnista, joka linkittää seurojen julkaisuihin; tarkkaa julkaisupäivää ei aina tiedetä.</p>`;
    $("#sj").value = siirtoSuodatin;
    const p = () => {
      $("#st").innerHTML = d.siirrot.filter((s) => !siirtoSuodatin || s.Mistä === siirtoSuodatin || s.Mihin === siirtoSuodatin).map((s) => `
        <tr${s.Mistä === "KPL" || s.Mihin === "KPL" ? ' class="oma"' : ""}><td class="pieni">${esc(String(s.Pvm).replace("koonti ", ""))}</td><td>${esc(s.Pelaaja)}</td><td>${esc(s.Mistä)}</td><td>${esc(s["Mihin (tieto)"] || s.Mihin)}</td>
        <td class="n">${s.Data === "ei dataa" ? "–" : `${s.YHT}<span class="pieni"> ${esc((s.Data || "").slice(0, 2))}</span>`}</td><td class="n">${s.Data === "ei dataa" ? "–" : s.KL}</td>
        <td><span class="varmuus ${varmuusLuokka(s.Varmuus)}">${esc(String(s.Varmuus).split(" – ")[0])}</span></td><td class="pieni">${lahde(s.Lähde)}</td></tr>`).join("");
    };
    $("#sj").onchange = (e) => { siirtoSuodatin = e.target.value; p(); };
    p();
  } else if (valilehti === "joukkueet") {
    const lista = Object.keys(d.kokoonpanot).sort((a, b) => (a === "KPL" ? -1 : b === "KPL" ? 1 : a.localeCompare(b)));
    el.innerHTML = `<div class="chipit" role="group" aria-label="Joukkue">${lista.map((j) => `<button class="chip" data-j="${j}" aria-pressed="${j === joukkue}">${esc(j)}</button>`).join("")}</div><div id="kok"></div>`;
    const p = () => {
      const k = d.kokoonpanot[joukkue] || {};
      const sopimukset = (k.sopimus || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
        const uusi = s.startsWith("*"), t = s.replace(/^\*/, ""), m = t.match(/^(.*?)\s+((?:19|20)\d\d.*)$/);
        return { nimi: m ? m[1] : t, sop: m ? m[2] : "", uusi };
      });
      const lahtijat = (k.lahtijat || "").split(";").map((s) => s.trim()).filter(Boolean).map((s) => s.split(" > "));
      const v = d.vaikutus.find((x) => x.Joukkue === joukkue);
      el.querySelector("#kok").innerHTML = `
        <h2>${esc(d.joukkueiden_nimet?.[joukkue] || joukkue)}</h2>
        ${k.pj ? `<p class="ingressi" style="margin-top:0">${esc(k.pj.replace(/\*/g, ""))}</p>` : ""}
        ${v ? `<p class="pieni">Sisään ${v.Tulleet}, ulos ${v.Lähteneet}. Siirtojen netto ${pct(v["Netto yhteensä %"])} (${esc(v.Arvio)}).</p>` : ""}
        <div class="kaksi-saraketta">
          <section><h3>Sopimus kaudelle 2027 (${sopimukset.length})</h3>
            <ul class="kokoonpano">${sopimukset.map((s) => `<li${s.uusi ? ' class="uusi"' : ""}><span>${esc(s.nimi)}</span><span class="pieni">${esc(s.sop)}</span>${s.uusi ? `<span class="merkki">Uusi</span>` : ""}</li>`).join("")}</ul>
            ${k.optio ? `<p class="pieni"><strong>Optio, käyttöä ei ilmoitettu:</strong> ${esc(k.optio)}</p>` : ""}
            ${k.ilman ? `<p class="pieni"><strong>Ilman sopimusta:</strong> ${esc(k.ilman)}</p>` : ""}
          </section>
          <section><h3>Lähteneet (${lahtijat.length})</h3>
            <ul class="kokoonpano">${lahtijat.map(([n, m]) => `<li><span>${esc(n)}</span><span class="pieni">${esc(m || "")}</span></li>`).join("") || `<li class="pieni">Ei lähtijöitä.</li>`}</ul>
          </section>
        </div>`;
    };
    $$(".chip[data-j]", el).forEach((b) => (b.onclick = () => { joukkue = b.dataset.j; $$(".chip[data-j]", el).forEach((x) => x.setAttribute("aria-pressed", x === b)); p(); }));
    p();
  } else {
    el.innerHTML = `<div class="taulu-wrap"><table>
      <thead><tr><th>Joukkue</th><th>PJ 2026</th><th>PJ 2027</th><th>Muutos</th><th>Huomio</th><th>Lähde</th></tr></thead>
      <tbody>${d.pelinjohtajat.map((p) => `<tr${p.Joukkue === "KPL" ? ' class="oma"' : ""}><td>${esc(p.Joukkue)}</td><td>${esc(p["PJ 2026"])}</td><td><strong>${esc(p["PJ 2027"])}</strong></td><td>${esc(p.Muutos)}</td><td class="pieni md-inline">${md(p.Huomio || "")}</td><td class="pieni">${lahde(p.Lähde)}</td></tr>`).join("")}</tbody></table></div>`;
  }
}
