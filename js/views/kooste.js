// Valmentajan viikkokooste (1.11.2026): #/kooste. Kuka on treenannut minkäkin verran, omatoimiset kirjaukset ja
// havainnot (esim. liian kova kuormitus). Sama laskenta kuin pelaajan Viikkoni-osiossa (js/kuormaydin.js).
// Perjantaisin klo 13 palvelin tallentaa koosteen arkistoon ja se lähetetään valmentajille sähköpostilla.
import { sb, tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, testiParhaat } from "../util.js";
import { haeKuormaRivit, haeKalenteri, tooltip } from "../kuorma.js";
import { TYYPIT, lisaaPv, maanantai, tanaanHki, minStr, pvLyh, desi, kooste as laskeKooste } from "../kuormaydin.js";

let viikko = maanantai(tanaanHki());
let joukkue = null;

export async function nayta(main) {
  if (!tila.ohjaaja) { location.replace("#/oma"); return; }
  const ryhmat = tila.joukkueet.filter((j) => tila.pelaajat.some((p) => p.joukkue_id === j.id && p.aktiivinen));
  if (!joukkue || !ryhmat.some((j) => j.id === joukkue)) joukkue = (ryhmat.find((j) => j.alue === "psu") || ryhmat[0])?.id;
  main.innerHTML = `<h1>Viikkokooste</h1><p class="lataa">Lasketaan…</p>`;
  if (!joukkue) { main.innerHTML = `<h1>Viikkokooste</h1><p class="tyhja">Ei ryhmiä.</p>`; return; }
  const j = tila.joukkueet.find((x) => x.id === joukkue);
  const pelaajat = tila.pelaajat.filter((p) => p.joukkue_id === joukkue && p.aktiivinen);
  const alku = lisaaPv(viikko, -35), loppu = lisaaPv(viikko, 6);

  const [nh, tulokset, arkisto] = await Promise.all([
    haeKalenteri(joukkue, alku, loppu),
    lataaTulokset().then(testiParhaat),
    sb.from("viikkokoosteet").select("id,viikko,luotu,teksti,lahetetty").eq("joukkue_id", joukkue).order("viikko", { ascending: false }).limit(12),
  ]);
  const testipaivat = {};
  for (const t of tulokset) if (t.pvm >= alku && t.pvm <= loppu) (testipaivat[t.pelaaja] ||= new Set()).add(t.pvm);
  const data = await haeKuormaRivit(pelaajat, nh.tapahtumat || [], alku, loppu, Object.fromEntries(Object.entries(testipaivat).map(([k, v]) => [k, [...v]])));
  const k = laskeKooste(pelaajat.map((p) => ({ id: p.id, nimi: nimi(p), rivit: data.tulos[p.id] })), viikko);
  const maxMin = Math.max(60, ...k.rivit.map((r) => r.min));
  const nyt = viikko === maanantai(tanaanHki());

  main.innerHTML = `
    <div class="ko-paa">
      <div><p class="oma-yla">Valmennus</p><h1>Viikkokooste</h1>
        <p class="ingressi">Kuka on treenannut minkäkin verran ja mitä huomattavaa. Valmistuu automaattisesti perjantaisin klo 13 ja lähtee valmentajille sähköpostilla.</p></div>
      <div class="rivi">
        ${ryhmat.length > 1 ? `<label class="kentta">Ryhmä<select id="ko-ryhma">${ryhmat.map((r) => `<option value="${r.id}"${r.id === joukkue ? " selected" : ""}>${esc(r.nimi)}</option>`).join("")}</select></label>` : ""}
        <div class="rivi"><button class="btn oma-nuoli" data-vk="-7" aria-label="Edellinen viikko">‹</button><button class="btn oma-nuoli" data-vk="0">Nyt</button><button class="btn oma-nuoli" data-vk="7" aria-label="Seuraava viikko">›</button></div>
      </div>
    </div>
    <div class="tagit ko-tagit">
      <span>Ryhmä<b>${esc(j.nimi)}</b></span>
      <span>Viikko<b>${pvLyh(viikko)}–${pvLyh(lisaaPv(viikko, 6))}</b></span>
      <span>Laskettu<b>${nyt ? `ma–${pvLyh(k.viite)}` : "koko viikko"}</b></span>
      <span>Omatoimisia kirjanneet<b>${k.kirjanneet}/${k.rivit.length}</b></span>
      <span>Omatoimisten mediaani<b>${minStr(k.mediaaniOma)}</b></span>
    </div>

    <section class="paneeli">
      <h2 class="ko-h2">Havainnot</h2>
      ${k.havainnot.length ? `<ul class="ku-huomiot">${k.havainnot.map((h) => `<li class="${h.taso === "varoitus" ? "varoitus" : h.taso === "huomio" ? "tuleva" : ""}"><span aria-hidden="true">${h.taso === "varoitus" ? "▲" : h.taso === "huomio" ? "◆" : "i"}</span><span>${esc(h.teksti)}</span></li>`).join("")}</ul>` : `<p class="tyhja">Ei erityisiä havaintoja tältä viikolta.</p>`}
    </section>

    <section class="paneeli">
      <h2 class="ko-h2">Treenimäärät pelaajittain</h2>
      <p class="pieni">Järjestys suurimmasta kuorma-arviosta. Palkki = minuutit tyypeittäin. Ryhmän treenit oletetaan tehdyiksi, ellei pelaaja ole merkinnyt poissaoloa.</p>
      <div class="ko-taulu" role="table" aria-label="Treenimäärät pelaajittain">
        <div class="ko-rivi ko-otsikko" role="row"><span role="columnheader">Pelaaja</span><span role="columnheader">Minuutit tyypeittäin</span><span role="columnheader">Yht.</span><span role="columnheader">Omat</span><span role="columnheader" title="Viimeiset 7 pv / edellisten 4 viikon keskiarvo">Kuorma × taso</span><span role="columnheader">Lepo 7 pv</span><span role="columnheader">Määrät ja ohjelmat</span></div>
        ${k.rivit.map((r) => `<div class="ko-rivi" role="row">
          <a role="cell" href="#/oma/${r.id}" class="ko-nimi">${esc(r.nimi)}</a>
          <span role="cell" class="ko-palkki"><span class="ku-jakauma" style="width:${Math.max(2, (100 * r.min) / maxMin)}%">${TYYPIT.filter((t) => r.tyypit[t.k]).map((t) => `<i style="flex:${r.tyypit[t.k]};background:${t.vari}" data-tip="${t.nimi}: ${minStr(r.tyypit[t.k])}"></i>`).join("")}</span></span>
          <span role="cell" class="num">${r.min ? minStr(r.min) : "–"}</span>
          <span role="cell" class="num">${r.omaMin ? minStr(r.omaMin) : "–"}</span>
          <span role="cell" class="num ko-acwr ${r.acwr == null ? "" : r.acwr > 1.5 ? "korkea" : r.acwr < 0.6 ? "matala" : "ok"}">${r.acwr == null ? "–" : `${r.acwr > 1.5 ? "▲ " : ""}${desi(r.acwr, 2)}`}</span>
          <span role="cell" class="num${r.lepoViim7 === 0 ? " ko-ei" : ""}">${r.lepoViim7}</span>
          <span role="cell" class="ko-maarat">${[...Object.entries(r.maarat).map(([a, b]) => `${esc(a.toLowerCase())} ${b}`), r.km ? `${desi(r.km)} km` : "", r.lyonnit ? `${r.lyonnit} lyöntiä` : "", ...r.ohjelmat.map(esc)].filter(Boolean).join(" · ") || '<span class="tyhja">–</span>'}</span>
        </div>`).join("")}
      </div>
      <ul class="ku-selite pieni-selite">${TYYPIT.map((t) => `<li><i style="background:${t.vari}"></i>${t.nimi}</li>`).join("")}</ul>
    </section>

    <section class="paneeli ku-perusta ko-perusta">
      <b>Mihin arvio perustuu</b>
      <ul>
        <li><span>1</span><span>Ryhmän treenit Nimenhuudosta (valmentaja voi korjata tyypin ja keston, pelaaja merkitsee poissaolon).</span></li>
        <li><span>2</span><span>Pelaajan omat kirjaukset ohjelmakirjastosta (Voima 1–3, Piiri 1–2, juoksut, syötöt määrinä, lenkit km) ja lyöntipäiväkirja.</span></li>
        <li><span>3</span><span>Rasitus = treenityypin tai ohjelman <b>arvio</b> 0–10 × minuutit. Ei sykettä eikä pelaajan omaa tuntemusta.</span></li>
        <li><span>4</span><span>Kuorma × taso = viim. 7 pv / edellisten 4 vk keskiarvo. Yli 1,5 on tutkimuksissa liitetty kohonneeseen vammariskiin (Hulin ym. 2016). <b>Liian kova</b> = vähintään kaksi merkkiä (nousu > 1,5, ei lepopäivää 7 pv:ään, 4+ raskasta päivää putkeen) tai nousu > 1,8.</span></li>
      </ul>
    </section>

    <section class="paneeli">
      <h2 class="ko-h2">Perjantain koosteet</h2>
      ${(arkisto.data || []).length ? `<ul class="ko-arkisto">${arkisto.data.map((a) => `<li><details><summary><b>Viikko ${pvLyh(a.viikko)}</b> <span class="pieni">tehty ${new Date(a.luotu).toLocaleString("fi-FI", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}${a.lahetetty ? " · lähetetty sähköpostilla" : ""}</span></summary><pre>${esc(a.teksti)}</pre></details></li>`).join("")}</ul>` : `<p class="tyhja">Ensimmäinen kooste tallentuu perjantaina klo 13.</p>`}
    </section>`;

  tooltip(main);
  $$("[data-vk]", main).forEach((b) => (b.onclick = () => { const n = +b.dataset.vk; viikko = n ? lisaaPv(viikko, n) : maanantai(tanaanHki()); nayta(main); }));
  const sel = $("#ko-ryhma", main);
  if (sel) sel.onchange = () => { joukkue = +sel.value; nayta(main); };
}
