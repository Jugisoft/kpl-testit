import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, paras, parhaatTulokset, pelaajaLinkki, pvm } from "../util.js";

let suodatin = { joukkue: "", aktiiviset: true, haku: "" };

export async function nayta(main) {
  const parhaat = parhaatTulokset(await lataaTulokset());
  const tieto = (pid, t) => { const a = parhaat.filter((x) => x.pelaaja === pid && x.testi === t); return { pb: paras(t, a.map((x) => x.arvo)), viim: a.at(-1) }; };
  const kerrat = (pid) => new Set(parhaat.filter((x) => x.pelaaja === pid).map((x) => x.kerta)).size;

  main.innerHTML = `
    <h1>Pelaajat</h1>
    <div class="rivi" style="margin:14px 0">
      <input type="text" id="haku" placeholder="Hae nimellä" value="${esc(suodatin.haku)}" style="width:220px">
      <select id="joukkue"><option value="">Kaikki ryhmät</option>${tila.joukkueet.map((j) => `<option value="${j.id}">${esc(j.nimi)}</option>`).join("")}</select>
      <label class="chip"><input type="checkbox" id="akt" ${suodatin.aktiiviset ? "checked" : ""}>Vain nykyiset pelaajat</label>
    </div>
    <div class="taulu-wrap"><table>
      <thead><tr><th>Pelaaja</th><th class="n">Synt.</th><th>Ryhmä</th><th class="n">Testikertoja</th><th class="n">30 m ennätys</th><th class="n">30 m viimeisin</th><th class="n">Lyönti ennätys</th><th class="n">Heitto vauhdista</th></tr></thead>
      <tbody id="lista"></tbody></table></div>`;
  $("#joukkue").value = suodatin.joukkue;
  const piirra = () => {
    const h = suodatin.haku.toLowerCase();
    const lista = tila.pelaajat.filter((p) => (!suodatin.aktiiviset || p.aktiivinen) && (!suodatin.joukkue || String(p.joukkue_id) === suodatin.joukkue) && (!h || nimi(p).toLowerCase().includes(h)))
      .sort((a, b) => (a.syntymavuosi || 9999) - (b.syntymavuosi || 9999) || nimi(a).localeCompare(nimi(b), "fi"));
    $("#lista").innerHTML = lista.map((p) => {
      const j = (t) => tieto(p.id, t);
      const t30 = j("30m"), ly = j("lyonti"), hv = j("heitto_vauhti");
      return `<tr><td>${pelaajaLinkki(p)}</td><td class="n">${p.syntymavuosi || ""}</td><td>${esc(tila.joukkueet.find((x) => x.id === p.joukkue_id)?.nimi || "")}</td><td class="n">${kerrat(p.id)}</td>
        <td class="n">${muotoile(t30.pb, "30m")}</td><td class="n">${t30.viim ? `${muotoile(t30.viim.arvo, "30m")} <span class="pieni">${pvm(t30.viim.pvm)}</span>` : "–"}</td><td class="n">${muotoile(ly.pb, "lyonti")}</td><td class="n">${muotoile(hv.pb, "heitto_vauhti")}</td></tr>`;
    }).join("") || `<tr><td colspan="8" class="tyhja">Ei pelaajia näillä ehdoilla.</td></tr>`;
  };
  $("#haku").oninput = (e) => { suodatin.haku = e.target.value; piirra(); };
  $("#joukkue").onchange = (e) => { suodatin.joukkue = e.target.value; piirra(); };
  $("#akt").onchange = (e) => { suodatin.aktiiviset = e.target.checked; piirra(); };
  piirra();
}
