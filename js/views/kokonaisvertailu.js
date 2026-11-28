// Kokonaisvertailu (28.11.2026, Jugi): Valmentajien huone → Analyysi. Pelaajan kaikki testit T-pisteinä
// valittuun vertailuryhmään (ryhmän keskiarvo = 50) + lisävertailu verkkoon: toinen pelaaja, ryhmän paras tai oma aiempi kausi.
// Laskenta js/kokonaisydin.js. Tulokset viimeisen 24 kk ajalta (oma aiempi kausi: koko kausi).
import { tila, nimi, lataaTulokset } from "../db.js";
import { $, $$, esc, muotoile, testiParhaat, kausi, piirra, vari, pvmLyhyt } from "../util.js";
import { sanallinen } from "../huomioydin.js";
import { OMINAISUUDET, pelaajanTulokset, ryhmanNormit, profiili, aariarvot, rajaa, kuukausiaSitten } from "../kokonaisydin.js";

const IKKUNA_KK = 24;
const KULTA = "#F5A800", SININEN = "#7DD3FC";
let S = { pid: null, asteikko: "joukkue", lisa: "ei", toinen: null, kausi: null, tapa: "viimeisin" };
export const asetaPelaaja = (pid) => { S.pid = pid; };

const tanaan = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
const tNimi = (t) => (t === "nok_30m" ? "Nopeuskestävyys 9×30 m (ka)" : (tila.testi[t]?.nimi || t).replace(/^Edustuksen lyöntitesti: /, "LT: ").replace(/^Lyöntitesti: /, "Lyöntitesti: "));
const jNimi = (id) => tila.joukkueet.find((j) => j.id === id)?.nimi || "";
const T1 = (T) => (T == null ? "–" : Math.round(T));

// Vertailuryhmät valitulle pelaajalle (vain valmentajan alueen joukkueet)
function asteikot(p, sallitut) {
  const kaikki = [
    ["joukkue", `Oma joukkue (${jNimi(p.joukkue_id)})`, (q) => q.joukkue_id === p.joukkue_id],
    ["msu", "MSU (Miehet Superpesis)", (q) => q.joukkue_id === 3],
    ["juniorit", jNimi(1) || "Juniorit", (q) => q.joukkue_id === 1],
    ["vanhat", jNimi(2) || "Vanhat", (q) => q.joukkue_id === 2],
    ["psu", "PSU (juniorit ja Vanhat)", (q) => q.joukkue_id === 1 || q.joukkue_id === 2],
    ...(p.syntymavuosi ? [["ika", `Oma ikäluokka (synt. ${p.syntymavuosi})`, (q) => q.syntymavuosi === p.syntymavuosi]] : []),
    ...(p.treeniprofiili ? [["treeni", `Oma treeniryhmä (${({ b: "B-pojat", ei_b: "ei B", haastaja: "haastajat", reissu: "asuu muualla", msu: "MSU" })[p.treeniprofiili] || p.treeniprofiili})`, (q) => q.treeniprofiili === p.treeniprofiili && q.joukkue_id === p.joukkue_id]] : []),
    ["kaikki", "Kaikki pelaajat", () => true],
  ];
  return kaikki.filter(([k]) => (k === "msu" ? sallitut.has(3) : k === "juniorit" ? sallitut.has(1) : k === "vanhat" || k === "psu" ? sallitut.has(1) || sallitut.has(2) : true));
}

export async function piirraKokonaisvertailu(el, alueet) {
  el.innerHTML = `<p class="lataa">Ladataan testituloksia…</p>`;
  const rivit = testiParhaat(await lataaTulokset());
  const tn = tanaan();
  const ikkunassa = (r) => kuukausiaSitten(r.pvm, tn) <= IKKUNA_KK;
  const sallitut = new Set([...(alueet.includes("sp") ? [3] : []), ...(alueet.includes("psu") ? [1, 2] : [])]);
  const aktiiviset = tila.pelaajat.filter((q) => q.aktiivinen !== false && sallitut.has(q.joukkue_id));
  const testanneet = new Set(rivit.filter(ikkunassa).map((r) => r.pelaaja));
  const lista = aktiiviset.filter((q) => testanneet.has(q.id));
  if (!lista.length) { el.innerHTML = `<p class="pieni">Ei testituloksia viimeisen ${IKKUNA_KK} kk ajalta.</p>`; return; }
  if (!S.pid || !lista.some((q) => q.id === S.pid)) S.pid = lista[0].id;

  const valikko = (nimiAttr, arvo, ilman) => `<select name="${nimiAttr}">${tila.joukkueet.filter((j) => sallitut.has(j.id)).map((j) => [j, lista.filter((q) => q.joukkue_id === j.id && q.id !== ilman)]).filter(([, l]) => l.length)
    .map(([j, l]) => `<optgroup label="${esc(j.nimi)}">${l.sort((a, b) => nimi(a).localeCompare(nimi(b), "fi")).map((q) => `<option value="${q.id}"${q.id === arvo ? " selected" : ""}>${esc(nimi(q))}</option>`).join("")}</optgroup>`).join("")}</select>`;

  const piirraKaikki = () => {
    const p = tila.pelaaja[S.pid];
    const ast = asteikot(p, sallitut);
    if (!ast.some(([k]) => k === S.asteikko)) S.asteikko = "joukkue";
    const [, astNimi, astEhto] = ast.find(([k]) => k === S.asteikko);
    const ryhma = aktiiviset.filter(astEhto).map((q) => q.id);
    const normit = ryhmanNormit(rivit, ryhma, tila.testi, S.tapa, ikkunassa);
    const oma = pelaajanTulokset(rivit, S.pid, tila.testi, S.tapa, ikkunassa);
    const prof = profiili(oma, normit, tila.testi);
    const kaudet = [...new Set(rivit.filter((r) => r.pelaaja === S.pid).map((r) => kausi(r.pvm)))].sort().reverse();
    if (!S.kausi || !kaudet.includes(S.kausi)) S.kausi = kaudet[1] || kaudet[0];
    if (!S.toinen || S.toinen === S.pid || !lista.some((q) => q.id === S.toinen)) S.toinen = lista.find((q) => q.id !== S.pid && q.joukkue_id === p.joukkue_id)?.id || lista.find((q) => q.id !== S.pid)?.id;

    // lisävertailu
    let lisa = null;
    if (S.lisa === "pelaaja" && S.toinen) lisa = { nimi: nimi(tila.pelaaja[S.toinen]), prof: profiili(pelaajanTulokset(rivit, S.toinen, tila.testi, S.tapa, ikkunassa), normit, tila.testi) };
    else if (S.lisa === "karki") lisa = { nimi: "Ryhmän paras (kärkikolmikon ka)", prof: profiili(new Map([...normit].map(([t, n]) => [t, { arvo: n.karki, pvm: null }])), normit, tila.testi) };
    else if (S.lisa === "aiempi" && S.kausi) lisa = { nimi: `${p.etunimi} kaudella ${S.kausi}`, prof: profiili(pelaajanTulokset(rivit, S.pid, tila.testi, S.tapa, (r) => kausi(r.pvm) === S.kausi), normit, tila.testi) };

    const ar = aariarvot(prof);
    const omMukana = OMINAISUUDET.filter((o) => prof.ominaisuudet.find((x) => x.nimi === o).T != null || (lisa && lisa.prof.ominaisuudet.find((x) => x.nimi === o).T != null));
    const lisaT = (t) => lisa?.prof.testit.find((x) => x.testi === t);

    el.innerHTML = `
      <div class="kv-valinnat">
        <label class="tk-kentta"><span>Pelaaja</span>${valikko("pid", S.pid)}</label>
        <label class="tk-kentta"><span>Vertailuryhmä (= 50)</span><select name="asteikko">${ast.map(([k, n]) => `<option value="${k}"${k === S.asteikko ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        <label class="tk-kentta"><span>Lisäksi verkkoon</span><select name="lisa">${[["ei", "Ei muuta"], ["pelaaja", "Toinen pelaaja"], ["karki", "Ryhmän paras"], ["aiempi", "Oma aiempi kausi"]].map(([k, n]) => `<option value="${k}"${k === S.lisa ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        ${S.lisa === "pelaaja" ? `<label class="tk-kentta"><span>Toinen pelaaja</span>${valikko("toinen", S.toinen, S.pid)}</label>` : ""}
        ${S.lisa === "aiempi" ? `<label class="tk-kentta"><span>Kausi</span><select name="kausi">${kaudet.map((k) => `<option${k === S.kausi ? " selected" : ""}>${k}</option>`).join("")}</select></label>` : ""}
        <div class="tk-kentta"><span>Tulos</span><div class="jtt-segmentti" role="radiogroup" aria-label="Tulos">${[["viimeisin", "Viimeisin"], ["paras", "Paras"]].map(([k, n]) => `<button type="button" role="radio" data-tapa="${k}" aria-checked="${k === S.tapa}">${n}</button>`).join("")}</div></div>
      </div>
      <div class="kv-runko">
        <section class="paneeli kv-hero">
          <div class="kv-indeksi"><span class="kv-luku num">${T1(prof.indeksi)}</span><span class="kv-sel">Kokonaisindeksi<br><small>ryhmä = 50</small></span>
            ${lisa ? `<span class="kv-luku kv-lisa num">${T1(lisa.prof.indeksi)}</span><span class="kv-sel">${esc(lisa.nimi)}</span>` : ""}</div>
          <p class="kv-teksti">${esc(nimi(p))} verrattuna ryhmään <b>${esc(astNimi)}</b> (${ryhma.length} pelaajaa, tulokset ${IKKUNA_KK} kk ajalta, ${S.tapa === "paras" ? "paras tulos" : "viimeisin tulos"}).
            ${ar ? `Vahvin ominaisuus <b>${esc(ar.vahvin.nimi)}</b> (${T1(ar.vahvin.T)}), heikoin <b>${esc(ar.heikoin.nimi)}</b> (${T1(ar.heikoin.T)}).` : ""}</p>
          <div class="kv-sanallinen"><h3>Sanallinen analyysi</h3>${sanallinen({ etunimi: p.etunimi, indeksi: prof.indeksi, testit: prof.testit, luokat: Object.fromEntries(tila.testit.map((t) => [t.koodi, t.luokka])), nimet: Object.fromEntries(tila.testit.map((t) => [t.koodi, tNimi(t.koodi)])), ryhmaNimi: astNimi }).map((l) => `<p>${esc(l)}</p>`).join("")}</div>
          <div class="kv-verkko">${omMukana.length >= 3 ? `<canvas id="kv-verkko" aria-label="Ominaisuusprofiili hämähäkkiverkkona"></canvas>` : `<p class="pieni">Verkko tarvitsee vähintään kolme ominaisuutta. Testiprofiili alla.</p>`}</div>
          <p class="pieni kv-selite">T-piste: ryhmän keskiarvo 50, 10 pistettä = yksi keskihajonta. 60 = selvästi ryhmää parempi, 40 = selvästi heikompi. Juoksuissa nopeampi aika antaa isomman T:n. Ominaisuus = sen testien keskiarvo; kokonaisindeksi = ominaisuuksien keskiarvo.</p>
        </section>
        <section class="paneeli kv-testit">
          <h2>Testiprofiili</h2>
          ${OMINAISUUDET.map((o) => {
            const rr = prof.testit.filter((x) => x.ominaisuus === o).sort((a, b) => (tila.testi[a.testi]?.jarjestys ?? 0) - (tila.testi[b.testi]?.jarjestys ?? 0));
            if (!rr.length) return "";
            const omT = prof.ominaisuudet.find((x) => x.nimi === o).T;
            return `<div class="kv-ryhma"><h3>${esc(o)} <span class="num">${T1(omT)}</span></h3>${rr.map((x) => {
              const l = lisaT(x.testi), vanha = x.pvm && kuukausiaSitten(x.pvm, tn) > 12;
              const T = rajaa(x.T), leveys = T == null ? 0 : Math.abs(T - 50) / 30 * 50;
              return `<div class="kv-rivi${vanha ? " vanha" : ""}${x.T == null ? " eivert" : ""}">
                <span class="kv-nimi">${esc(tNimi(x.testi))}${x.normi?.pieni ? ` <span class="kv-pieni" title="Vertailuryhmässä vain ${x.normi.n} tulosta – suuntaa-antava">≈</span>` : ""}</span>
                <span class="kv-tulos num">${muotoile(x.arvo, x.testi)}<small>${x.pvm ? pvmLyhyt(x.pvm) : ""}</small></span>
                ${x.T == null ? `<span class="kv-ei">ei vertailukelpoinen (ryhmässä alle 3 tulosta)</span>` : `
                <span class="kv-palkki" aria-label="T ${T1(x.T)}"><i class="${x.T >= 50 ? "yli" : "ali"}" style="width:${leveys}%"></i>${l?.T != null ? `<b class="kv-merkki" style="left:${(rajaa(l.T) - 20) / 60 * 100}%" title="${esc(lisa.nimi)}: T ${T1(l.T)}"></b>` : ""}</span>
                <span class="kv-t num">${T1(x.T)}</span>`}
                <span class="kv-ryhmaka num" title="Ryhmän keskiarvo${l ? " / " + esc(lisa.nimi) : ""}">${x.normi ? muotoile(x.normi.ka, x.testi) : ""}${l?.arvo != null ? ` · <span class="kv-sin">${muotoile(l.arvo, x.testi)}</span>` : ""}</span>
              </div>`;
            }).join("")}</div>`;
          }).join("") || `<p class="pieni">Ei testituloksia viimeisen ${IKKUNA_KK} kk ajalta.</p>`}
          <p class="pieni kv-selite">Palkki keskiviivasta: oikealle parempi, vasemmalle heikompi kuin ryhmän keskiarvo. ${lisa ? `Sininen merkki = ${esc(lisa.nimi)}. ` : ""}Oikealla ryhmän keskiarvo${lisa ? " ja sininen vertailuarvo" : ""}. Himmeä rivi = tulos yli 12 kk vanha. ≈ = alle 8 tulosta ryhmässä.</p>
        </section>
      </div>`;

    $$("select", el).forEach((s) => (s.onchange = () => { S[s.name] = s.value; piirraKaikki(); }));
    $$("[data-tapa]", el).forEach((b) => (b.onclick = () => { S.tapa = b.dataset.tapa; piirraKaikki(); }));
    const c = $("#kv-verkko", el);
    if (c) piirra(c, {
      type: "radar",
      data: { labels: omMukana, datasets: [
        { label: nimi(p), data: omMukana.map((o) => rajaa(prof.ominaisuudet.find((x) => x.nimi === o).T)), borderColor: KULTA, backgroundColor: "rgba(245,168,0,.18)", pointBackgroundColor: KULTA, pointRadius: 3, spanGaps: true },
        ...(lisa ? [{ label: lisa.nimi, data: omMukana.map((o) => rajaa(lisa.prof.ominaisuudet.find((x) => x.nimi === o).T)), borderColor: SININEN, backgroundColor: "rgba(125,211,252,.10)", pointBackgroundColor: SININEN, pointRadius: 3, spanGaps: true }] : []),
        { label: "Ryhmän keskiarvo", data: omMukana.map(() => 50), borderColor: vari("--ink-3"), borderDash: [4, 4], pointRadius: 0, backgroundColor: "transparent" },
      ] },
      options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: vari("--ink-2") } }, tooltip: { callbacks: { label: (x) => `${x.dataset.label}: ${x.parsed.r == null ? "–" : Math.round(x.parsed.r)}` } } },
        scales: { r: { min: 20, max: 80, grid: { color: "rgba(245,168,0,.12)" }, angleLines: { color: "rgba(245,168,0,.12)" }, pointLabels: { color: vari("--ink-2"), font: { size: 13 } }, ticks: { stepSize: 10, backdropColor: "transparent", color: vari("--ink-3") } } } },
    });
  };
  piirraKaikki();
}
