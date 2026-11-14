// Minun pelini – tilastot-versio (14.11.2026): junioreiden ja muiden kuin Superpesis-pelaajien
// pelitilasto-osio. Data: Supabasen tilastot-taulu (pesistulokset.fi), sama lähde kuin vertailu.js.
// Näyttää KL% tilanteittain, roolin, sarjavalinnan, vertailun joukkuekavereihin ja urahistorian.
import { sb, tila, nimi } from "./db.js";
import { esc } from "./util.js";

// --- Vakiot ---
const SUMMA_K = ["O", "K", "L", "T", "KL", "KLY", "KL0", "KL1", "KL2", "KL3", "KLY0", "KLY1", "KLY2", "KLY3"];
const TILANTEET = [
  ["KLY0", "KL0", "0", "Nollatilanteessa", "kentälle pääsy"],
  ["KLY1", "KL1", "1", "1-tilanteessa", "1-tilanne"],
  ["KLY2", "KL2", "2", "2-tilanteessa", "2-tilanne"],
  ["KLY3", "KL3", "3", "Takatilanteessa", "takatilanne"],
];
const TVARIT = ["#94A3B8", "#7DD3FC", "#F5A800", "#2EE59D"];
const PIENI = 10; // alle tämän KLY-määrän prosentti on suuntaa-antava

// --- Data ---
let tilastot = null; // ref_id -> [{kausi, vaihe, joukkue, nimi, data}]
async function haeTilastot() {
  if (tilastot) return;
  tilastot = new Map();
  const { data } = await sb.from("tilastot").select("ref_id,nimi,joukkue,kausi,vaihe,data").eq("tyyppi", "pelaaja");
  (data || []).forEach((r) => (tilastot.get(r.ref_id) || tilastot.set(r.ref_id, []).get(r.ref_id)).push(r));
}

// --- Tilan hallinta ---
const S = { kausi: null, valitut: null }; // valitut = Set sarjojen nimistä tai null = kaikki
let edellinenId = null;

// --- Laskenta ---
function yhdista(d, valitut) {
  if (!d) return null;
  if (!valitut) return d;
  const ss = (d.sarjat || []).filter((x) => valitut.has(x.nimi));
  if (!ss.length) return null;
  const out = { sarjat: ss };
  SUMMA_K.forEach((k) => (out[k] = ss.reduce((a, x) => a + (x[k] || 0), 0)));
  return out;
}

function klPros(d, k, n) {
  if (!d || !d[n]) return null;
  return (100 * (d[k] || 0)) / d[n];
}

const fi = (v, d = 1) => (v == null || !isFinite(v) ? "–" : v.toFixed(d).replace(".", ","));
const pr = (v) => (v == null ? "–" : `${Math.round(v)} %`);

function rooli(d) {
  if (!d || !d.KLY || d.KLY < 20) return { nimi: "Liian vähän yrityksiä", syy: "alle 20 kärkilyöntiyritystä", tyhja: true };
  const o = [0, 1, 2, 3].map((n) => (d[`KLY${n}`] || 0) / d.KLY), pc = (x) => `${Math.round(x * 100)} %`;
  const max = Math.max(...o), n = o.indexOf(max);
  const toinen = [0, 1, 2, 3].filter((k) => k !== n).sort((a, b) => o[b] - o[a])[0];
  const lisa = o[toinen] >= 0.2 ? `, toiseksi eniten ${["nollatilanteessa", "1-tilanteessa", "2-tilanteessa", "takatilanteessa"][toinen]} ${pc(o[toinen])}` : "";
  if (max < 0.35) return { nimi: "Monipuolinen", syy: `mikään tilanne ei erotu (suurin ${["nollatilanteessa", "1-tilanteessa", "2-tilanteessa", "takatilanteessa"][n]} ${pc(max)})` };
  if (n === 0) return { nimi: "Kärkietenijä", syy: `${pc(o[0])} kärkilyönneistä nollatilanteessa (kentälle pääsy)${lisa}` };
  if (n === 1) return { nimi: "1-tilanteen vaihtaja", syy: `${pc(o[1])} kärkilyönneistä 1-tilanteessa${lisa}` };
  if (n === 2) return { nimi: "2-tilanteen vaihtaja", syy: `${pc(o[2])} kärkilyönneistä 2-tilanteessa${lisa}` };
  if (o[3] >= 0.5) return { nimi: "Kotiuttaja", syy: `${pc(o[3])} kärkilyönneistä takatilanteessa${lisa}` };
  return { nimi: "Vaihtaja / kotiuttaja", syy: `takatilanne ${pc(o[3])}, 1- ja 2-tilanne yhteensä ${pc(o[1] + o[2])}` };
}

// --- Pääfunktio ---
export async function piirraMinunPeliTilastot(el, pelaaja) {
  if (!pelaaja?.pesistulokset_id) { el.innerHTML = ""; return; }
  await haeTilastot();
  const rivit = (tilastot.get(pelaaja.pesistulokset_id) || []).filter((r) => r.vaihe === "kpl_kaikki");
  if (!rivit.length) { el.innerHTML = ""; return; }

  const kaudet = [...new Set(rivit.map((r) => r.kausi))].sort((a, b) => b - a);
  if (edellinenId !== pelaaja.pesistulokset_id) { S.kausi = kaudet[0]; S.valitut = null; edellinenId = pelaaja.pesistulokset_id; }
  if (!kaudet.includes(S.kausi)) S.kausi = kaudet[0];

  const piirra = () => {
    const kRivi = rivit.find((r) => r.kausi === S.kausi);
    const dRaaka = kRivi?.data;
    // sarjavalinta: tarkista että valitut sarjat löytyvät tältä kaudelta
    if (S.valitut && !(dRaaka?.sarjat || []).some((x) => S.valitut.has(x.nimi))) S.valitut = null;
    const d = yhdista(dRaaka, S.valitut);

    // joukkuekaverit samalla kaudella
    const joukkueId = pelaaja.joukkue_id;
    const kaverit = tila.pelaajat.filter((p) => p.joukkue_id === joukkueId && p.pesistulokset_id && p.id !== pelaaja.id);
    const kaveriData = kaverit.map((p) => {
      const r = (tilastot.get(p.pesistulokset_id) || []).find((x) => x.vaihe === "kpl_kaikki" && x.kausi === S.kausi);
      return r ? { p, d: yhdista(r.data, S.valitut) } : null;
    }).filter((x) => x && x.d && x.d.KLY);
    // joukkueen keskiarvo
    const jyhd = {};
    SUMMA_K.forEach((k) => { jyhd[k] = (d?.[k] || 0) + kaveriData.reduce((a, x) => a + (x.d[k] || 0), 0); });
    const jN = 1 + kaveriData.length;

    // ranking joukkueen sisällä KL%:n mukaan
    const kaikkiKl = [{ nimi: nimi(pelaaja), kl: klPros(d, "KL", "KLY"), kly: d?.KLY || 0, oma: true },
      ...kaveriData.map((x) => ({ nimi: nimi(x.p), kl: klPros(x.d, "KL", "KLY"), kly: x.d.KLY, oma: false }))
    ].filter((x) => x.kly >= PIENI).sort((a, b) => (b.kl || 0) - (a.kl || 0));
    const omaSija = kaikkiKl.findIndex((x) => x.oma) + 1;

    // sarjavalinnan HTML
    const svHtml = dRaaka?.sarjat?.length > 1 ? `<div class="mpt-sv">
      <button class="chip${!S.valitut ? " on" : ""}" data-mpt-sarja="" aria-pressed="${!S.valitut}">Kaikki sarjat</button>
      ${dRaaka.sarjat.map((x) => `<button class="chip${S.valitut?.has(x.nimi) ? " on" : ""}" data-mpt-sarja="${esc(x.nimi)}" aria-pressed="${!!S.valitut?.has(x.nimi)}" title="${esc(x.taso || x.nimi)}">${esc(x.nimi)} <small>${x.O}</small></button>`).join("")}
    </div>` : "";

    // KL% tilanteittain
    const klYht = klPros(d, "KL", "KLY");
    const klJoukkue = klPros(jyhd, "KL", "KLY");

    // rooli
    const R = rooli(d);

    // urahistoria
    const uraRivit = kaudet.map((k) => {
      const r = rivit.find((x) => x.kausi === k)?.data;
      if (!r) return null;
      const yht = (r.K || 0) + (r.L || 0) + (r.T || 0);
      const kl = r.KLY ? (100 * r.KL) / r.KLY : null;
      const sarjat = (r.sarjat || []).map((s) => s.nimi).join(", ");
      return { k, O: r.O, yht, kl, K: r.K, L: r.L, T: r.T, KLY: r.KLY, joukkue: kRivi?.joukkue, sarjat };
    }).filter(Boolean);

    el.innerHTML = `
      <div class="oma-osa-paa"><div><h2 id="mp-otsikko">Minun pelini</h2>
        <p class="pieni">Viralliset pelitilastot · kausi ${S.kausi} · lähde pesistulokset.fi</p></div>
        ${kaudet.length > 1 ? `<div class="chipit pieni-chipit">${kaudet.map((k) => `<button type="button" class="chip" data-mpt-kausi="${k}" aria-pressed="${k === S.kausi}">${k}</button>`).join("")}</div>` : ""}
      </div>
      ${svHtml}

      <div class="mpt-paa">
        ${d && d.KLY ? `
        <div class="paneeli mpt-kl-osio">
          <div class="mpt-iso"><span class="num">${pr(klYht)}</span><span>kärkilyönti-% (KL%)<br><small>${d.KL || 0} onnistunutta / ${d.KLY} yritystä · ${d.O || 0} ottelua</small></span></div>
          ${klJoukkue != null ? `<p class="pieni mpt-vertailu-teksti">Joukkueen keskiarvo ${pr(klJoukkue)}, ${klYht != null && klJoukkue != null ? (klYht >= klJoukkue ? `<b class="plus">+${fi(klYht - klJoukkue)} %-yks. yli joukkueen</b>` : `<b class="miinus">${fi(klYht - klJoukkue)} %-yks. alle joukkueen</b>`) : ""}</p>` : ""}
          <div class="mpt-tilanteet">
            ${TILANTEET.map(([kly, kl, lyh, otsikko, selite], i) => {
              const v = klPros(d, kl, kly); const n = d[kly] || 0; const pieni = n > 0 && n < PIENI;
              return `<div class="mpt-tilanne${pieni ? " pieni-otos" : ""}">
                <div class="mpt-til-palkki"><i style="height:${Math.max(2, v || 0)}%;background:${TVARIT[i]}"></i></div>
                <b class="num">${pr(v)}${pieni ? "*" : ""}</b>
                <span>${selite}</span>
                <small>${d[kl] || 0}/${n}</small>
              </div>`;
            }).join("")}
          </div>
        </div>

        <div class="paneeli mpt-rooli-osio">
          <h3>Roolini lyöjänä</h3>
          <div class="mpt-rooli-nimi">${esc(R.nimi)}</div>
          <p class="pieni">${esc(R.syy)}</p>
          ${!R.tyhja ? `<div class="mpt-jakauma" aria-label="Kärkilyöntiyritykset tilanteittain">${TILANTEET.map(([kly, , lyh, , selite], i) => {
            const o = d.KLY ? (100 * (d[kly] || 0)) / d.KLY : 0;
            return o > 0 ? `<i style="width:${o}%;background:${TVARIT[i]}" title="${selite}: ${d[kly]} yritystä (${Math.round(o)} %)">${o >= 12 ? lyh : ""}</i>` : "";
          }).join("")}</div>
          <div class="mpt-selite">${TILANTEET.map(([, , lyh, , selite], i) => `<span><i style="background:${TVARIT[i]}"></i>${lyh} = ${selite}</span>`).join("")}</div>` : ""}
          <div class="mpt-tuotto"><b>${d.T || 0}</b> tuotua · <b>${d.L || 0}</b> lyötyä · <b>${d.K || 0}</b> kunnaria</div>
        </div>
        ` : `<div class="paneeli"><p class="tyhja">Ei pelitilastoja kaudelta ${S.kausi}${S.valitut ? " valituissa sarjoissa" : ""}.</p></div>`}
      </div>

      ${kaikkiKl.length > 1 ? `<div class="paneeli mpt-ranking">
        <h3>KPL-joukkueen sisällä</h3>
        <p class="pieni">KL% joukkuekavereihisi verrattuna (vähintään ${PIENI} kärkilyöntiyritystä)</p>
        <ol class="mpt-top">${kaikkiKl.map((x, i) => `<li class="${x.oma ? "oma" : ""}"><span class="num">${i + 1}.</span><span>${esc(x.nimi)}</span><b class="num">${pr(x.kl)}</b><small>${x.kly} yrit.</small></li>`).join("")}</ol>
        ${omaSija ? `<p class="mpt-sija-teksti">${omaSija === 1 ? "Joukkueen paras KL%!" : `${omaSija}. / ${kaikkiKl.length} pelaajasta`}</p>` : ""}
      </div>` : ""}

      ${uraRivit.length > 1 ? `<div class="paneeli mpt-ura">
        <h3>Urahistoria</h3>
        <div class="taulu-wrap"><table><thead><tr><th class="l">Kausi</th><th>O</th><th>YHT</th><th>K</th><th>L</th><th>T</th><th>KL%</th><th class="l">Sarjat</th></tr></thead>
        <tbody>${uraRivit.map((u) => `<tr${u.k === S.kausi ? ' class="valittu"' : ""} data-mpt-ura="${u.k}">
          <td class="l">${u.k}</td><td>${u.O}</td><td><b>${u.yht}</b></td><td>${u.K || 0}</td><td>${u.L || 0}</td><td>${u.T || 0}</td>
          <td>${u.kl != null ? fi(u.kl) + " %" : "–"}</td><td class="l pieni">${esc(u.sarjat)}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="pieni">Kaikki viralliset sarjat yhteensä. Rivin klikkaus vaihtaa kauden.</p>
      </div>` : ""}

      <p class="vihje">Lähde pesistulokset.fi. KL% = kärkilyöntien onnistumis-%, tilanne = kärkietenijän lähtöpesä (0 = lyöjä itse kentälle). Eritasoisten sarjojen luvut eivät ole suoraan vertailukelpoisia – valitse tarkasteltavat sarjat yläpuolelta.${kaveriData.length ? "" : " Joukkuevertailua ei näytetä, koska muilla joukkuekavereilla ei ole pelitilastoja tältä kaudelta."}</p>`;

    // tapahtumat
    el.querySelectorAll("[data-mpt-kausi]").forEach((b) => (b.onclick = () => { S.kausi = +b.dataset.mptKausi; piirra(); }));
    el.querySelectorAll("[data-mpt-sarja]").forEach((c) => (c.onclick = () => {
      const n = c.dataset.mptSarja;
      if (!n) { S.valitut = null; }
      else { const v = new Set(S.valitut || []); v.has(n) ? v.delete(n) : v.add(n); S.valitut = v.size ? v : null; }
      piirra();
    }));
    el.querySelectorAll("[data-mpt-ura]").forEach((tr) => (tr.onclick = () => { S.kausi = +tr.dataset.mptUra; piirra(); }));
  };
  piirra();
}
