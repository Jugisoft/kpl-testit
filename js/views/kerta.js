// Testikerran tulokset: paremmuusjärjestys, muutos edelliseen ja ennätykset.
import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, muotoileMuutos, pvm, paras, parannus, parhaatTulokset, pelaajaLinkki, mediaani, piirra, vari } from "../util.js";

let valittu = null;

export async function nayta(main, id) {
  const k = tila.kerta[id];
  if (!k) throw new Error("Testikertaa ei löytynyt.");
  const kaikki = await lataaTulokset(true);
  const tark = k.piikit ? "piikit" : "";
  const p1 = parhaatTulokset(kaikki), p2 = tark ? parhaatTulokset(kaikki, { tarkenne: tark }) : [];
  const parhaat = [...p1, ...p2.map((x) => ({ ...x, piikit: true }))];
  const tama = parhaat.filter((x) => x.kerta === id);
  const testit = [...new Set(tama.map((x) => x.testi))].sort((a, b) => tila.testi[a].jarjestys - tila.testi[b].jarjestys);
  if (!testit.includes(valittu)) valittu = testit[0];

  main.innerHTML = `
    <div class="rivi vali"><div><h1>${esc(k.nimi || "Testikerta")}</h1><div class="pieni">${pvm(k.pvm)}${k.piikit ? " · piikkiajat" : ""}</div></div>
      <div class="rivi"><a class="btn" href="#/syota/${id}">Syötä tuloksia</a><button class="btn" id="csv">Lataa CSV</button></div></div>
    <div class="testivalitsin" style="margin-top:18px">${testit.map((t) => `<button class="chip" data-t="${t}" aria-pressed="${t === valittu}">${esc(tila.testi[t].nimi)}</button>`).join("") || '<p class="tyhja">Ei vielä tuloksia.</p>'}</div>
    <div id="raportti"></div>`;
  $$(".chip[data-t]").forEach((b) => (b.onclick = () => { valittu = b.dataset.t; $$(".chip[data-t]").forEach((x) => x.setAttribute("aria-pressed", x === b)); piirraTesti(); }));
  $("#csv").onclick = () => lataaCsv(k, tama);

  function piirraTesti() {
    if (!valittu) return;
    const t = valittu, T = tila.testi[t];
    const rivit = tama.filter((x) => x.testi === t).map((x) => {
      const aiemmat = parhaat.filter((y) => y.pelaaja === x.pelaaja && y.testi === t && !!y.piikit === !!x.piikit && y.pvm < k.pvm);
      const edellinen = aiemmat.at(-1);
      const pb = paras(t, aiemmat.map((y) => y.arvo));
      return { ...x, p: tila.pelaaja[x.pelaaja], edellinen, pb, uusiPb: pb != null && parannus(t, x.arvo, pb) > 0 };
    }).sort((a, b) => (T.pienempi_parempi ? a.arvo - b.arvo : b.arvo - a.arvo));
    const vuodet = [...new Set(rivit.map((r) => r.p.syntymavuosi))].sort();
    $("#raportti").innerHTML = `
      <div class="ruudukko" style="margin-bottom:16px">
        ${vuodet.map((v) => { const a = rivit.filter((r) => r.p.syntymavuosi === v).map((r) => r.arvo); return `<div class="lukema"><div class="otsikko">${v || "?"} syntyneet · ${a.length} pelaajaa</div><div class="arvo">${muotoile(mediaani(a), t)}<small>${T.yksikko} mediaani</small></div><div class="muutos pieni">Paras ${muotoile(paras(t, a), t)}</div></div>`; }).join("")}
        <div class="lukema"><div class="otsikko">Uusia ennätyksiä</div><div class="arvo">${rivit.filter((r) => r.uusiPb).length}<small>/ ${rivit.length}</small></div><div class="muutos pieni">Parannus edelliseen: ${rivit.filter((r) => r.edellinen && parannus(t, r.arvo, r.edellinen.arvo) > 0).length} pelaajaa</div></div>
      </div>
      <div class="paneeli" style="margin-bottom:16px"><div class="kaavio matala"><canvas id="jakauma"></canvas></div></div>
      <div class="taulu-wrap"><table>
        <thead><tr><th class="n">#</th><th>Pelaaja</th><th class="n">Synt.</th><th class="n">Paras</th>${rivit.some((r) => r.n > 1) ? '<th class="n">Ka</th>' : ""}<th class="n">Edellinen</th><th class="n">Muutos</th><th class="n">Ennätys ennen</th><th></th></tr></thead>
        <tbody>${rivit.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${pelaajaLinkki(r.p)}</td><td class="n">${r.p.syntymavuosi || ""}</td>
          <td class="n iso" style="font-size:20px;font-weight:700">${muotoile(r.arvo, t)}</td>${rivit.some((x) => x.n > 1) ? `<td class="n">${muotoile(r.ka, t)}</td>` : ""}
          <td class="n">${r.edellinen ? `${muotoile(r.edellinen.arvo, t)} <span class="pieni">${pvm(r.edellinen.pvm)}</span>` : "–"}</td>
          <td class="n ${r.edellinen ? (parannus(t, r.arvo, r.edellinen.arvo) > 0 ? "pb" : parannus(t, r.arvo, r.edellinen.arvo) < 0 ? "huono" : "") : ""}">${r.edellinen ? muotoileMuutos(r.arvo - r.edellinen.arvo, t) : ""}</td>
          <td class="n">${muotoile(r.pb, t)}</td><td>${r.uusiPb ? '<span class="merkki">Uusi ennätys</span>' : r.pb == null ? '<span class="merkki harmaa">Ensimmäinen</span>' : ""}</td></tr>`).join("")}</tbody>
      </table></div>`;
    const arvot = rivit.map((r) => r.arvo);
    piirra($("#jakauma"), {
      type: "bar",
      data: { labels: rivit.map((r) => r.p.etunimi + " " + (r.p.sukunimi || "")[0] + "."), datasets: [{ data: arvot, backgroundColor: rivit.map((r) => (r.uusiPb ? vari("--green") : vari("--ink-3"))), borderRadius: 3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${muotoile(c.parsed.y, t)} ${T.yksikko}` } } },
        scales: { y: { beginAtZero: false, suggestedMin: T.pienempi_parempi ? Math.min(...arvot) * 0.97 : Math.min(...arvot) * 0.9, title: { display: true, text: T.yksikko } }, x: { ticks: { autoSkip: false, maxRotation: 60 } } } },
    });
  }
  piirraTesti();
}

function lataaCsv(k, tama) {
  const rivit = [["pelaaja", "syntymavuosi", "testi", "paras", "keskiarvo", "yrityksia"]];
  tama.forEach((x) => { const p = tila.pelaaja[x.pelaaja]; rivit.push([nimi(p), p.syntymavuosi || "", tila.testi[x.testi].nimi, String(x.arvo).replace(".", ","), x.ka != null ? x.ka.toFixed(3).replace(".", ",") : "", x.n]); });
  const csv = "﻿" + rivit.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `testit_${k.pvm}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
