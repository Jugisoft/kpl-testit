// Lyöntianalyysi 2026 (6.11.2026): Pesäpalloliiton tapahtumadatasta (Events + Hits 2026, runkosarja) puretut
// pelaajakohtaiset luvut: merkatut lyönnit, laittomat, tehokkuusindeksit, merkattujen matriisi, lyöntivalinnat ja lyöntikartat.
// Data: analyysit-taulu, avain spl_2026_p<pesistulokset-tunnus>. Luku vain admin/valmentaja/pelaaja (RLS), ei junioreille.
import { sb } from "./db.js";
import { esc } from "./util.js";

const fi = (x, d = 1) => (x == null ? "–" : x.toFixed(d).replace(".", ",").replace("-", "−"));
const pc = (x, d = 1) => (x == null ? "–" : `${fi(x, d)} %`);
const S = { tilanne: null, pelaaja: null };

// Ero sarjaan prosenttiyksikköinä; parempi = suurempi, ellei pienempiParempi
function ero(oma, sarja, pienempiParempi = false) {
  if (oma == null || sarja == null) return "";
  const e = oma - sarja, hyva = pienempiParempi ? e < 0 : e > 0;
  if (Math.abs(e) < 0.05) return `<span class="la-ero">sama kuin sarja</span>`;
  return `<span class="la-ero ${hyva ? "hyva" : "heikko"}">${e > 0 ? "+" : "−"}${fi(Math.abs(e))} pp</span>`;
}
const kortti = (otsikko, arvo, yks, ala, eroHtml = "") =>
  `<div class="kpi la-kpi"><div class="otsikko">${otsikko}</div><div class="arvo">${arvo}${yks ? `<small>${yks}</small>` : ""}</div>${eroHtml ? `<div class="la-kpi-ero">${eroHtml}</div>` : "<div></div>"}<div class="ala">${ala}</div></div>`;
const sarjaLuku = (teksti) => { const m = /sarja\s*([−\-]?[\d,]+)/.exec(teksti || ""); return m ? parseFloat(m[1].replace(",", ".").replace("−", "-")) : null; };
const ilmanSarjaa = (teksti) => (teksti || "").replace(/\s*·\s*sarja\s*[−\-]?[\d,]+/, "");

const TILANNE_JARJ = ["0-tilanne", "1-tilanne", "1-2-tilanne", "Ajolähtö", "0-2-tilanne", "1-3-tilanne", "0-3-tilanne", "2-3-tilanne"];
const SELITE_M = [["#3ddc84", "●", "kärkilyönti"], ["#c9c2b6", "○", "takapalo + kärkilyönti"], ["#ff5a5a", "■", "palo"], ["#ffd23f", "▲", "haava"], ["#c58cff", "+", "läpilyönti"], ["#f2b33d", "★", "kunnari"]];
const SELITE_E = [["#3ddc84", "●", "kärkilyönti"], ["#ff5a5a", "●", "muu lopputulos"]];
const SELITE_0 = [["#3ddc84", "●", "kärkilyönti"], ["#ffd23f", "▲", "haava"], ["#ff5a5a", "■", "palo"], ["#8a847a", "●", "muu / vapaa"], ["#c58cff", "+", "läpilyönti"], ["#f2b33d", "★", "kunnari"]];
const selite = (lista) => `<div class="la-selite">${lista.map(([v, m, t]) => `<span><i style="color:${v}">${m}</i>${t}</span>`).join("")}</div>`;

export async function piirraLyontianalyysi(el, pelaaja) {
  if (!el) return;
  if (!pelaaja?.pesistulokset_id) { el.innerHTML = ""; return; }
  const { data } = await sb.from("analyysit").select("data,paivitetty").eq("avain", `spl_2026_p${pelaaja.pesistulokset_id}`).maybeSingle();
  if (!data?.data) { el.innerHTML = ""; return; }
  const d = data.data;
  const tilanteet = Object.keys(d.tilanteet || {});
  if (S.pelaaja !== pelaaja.pesistulokset_id || !tilanteet.includes(S.tilanne)) { S.tilanne = tilanteet[0]; S.pelaaja = pelaaja.pesistulokset_id; }
  const piirra = () => {
    el.innerHTML = `
      <div class="oma-osa-paa"><div><h2 id="la-otsikko">Lyöntianalyysi 2026</h2>
        <p class="pieni">Pesäpalloliiton tapahtumadata · Superpesis 2026 runkosarja · kaikki lyöntisi, myös toisessa joukkueessa · vertailu = koko sarja</p></div>
        <span class="la-leima">Vain joukkueen käyttöön</span></div>
      ${yleiskuva(d)}
      <div class="mp-tilanteet la-tilanteet" role="tablist" aria-label="Analysoitu tilanne">${tilanteet.map((t) => {
        const q = d.tilanteet[t];
        return `<button role="tab" class="mp-tilanne" data-la-til="${esc(t)}" aria-selected="${t === S.tilanne}"><span>${esc(t)}</span><b>${q.lyonnit ?? "–"}</b><small>lyöntiä${q.n_merk != null ? ` · ${q.n_merk} merkattua` : ""}</small></button>`;
      }).join("")}</div>
      ${tilanne(S.tilanne, d.tilanteet[S.tilanne])}
      <p class="pieni la-lahde">Lähde: ${esc(d.lahde || "Suomen Pesäpalloliitto")}. Kärkilyönti sisältää läpilyönnit, kunnarit ja takapalolliset kärkilyönnit. Merkatuista on poistettu kopit ja laittomalta paluut. Ei-merkatut = 1. ja 2. lyönti ilman merkkiä.</p>`;
    el.querySelectorAll("[data-la-til]").forEach((b) => (b.onclick = () => { S.tilanne = b.dataset.laTil; piirra(); el.querySelector(".la-tilanteet")?.scrollIntoView({ block: "nearest" }); }));
  };
  piirra();
}

function yleiskuva(d) {
  const kovatS = sarjaLuku(d.kovat_teksti);
  const jak = TILANNE_JARJ.filter((t) => d.jakauma?.[t] != null).map((t) => [t, d.jakauma[t]]);
  const max = Math.max(1, ...jak.map(([, n]) => n));
  return `<div class="la-yla">
    <div class="kpi-rivi la-kpit">
      ${kortti("Lyönnit", d.lyonnit, "", `${d.juoksut} juoksua · ${d.lapilyonnit} läpilyöntiä · ${d.kunnarit} kunnaria${d.jokerina ? ` · jokerina ${pc(d.jokerina)}` : ""}`)}
      ${kortti("Merkattuja", fi(d.merkattuja), "%", `ilman 0-tilannetta · sarja ${pc(d.merkattuja_sarja)}`)}
      ${kortti("Merkattujen KL-%", fi(d.merk_kl), "%", `${d.merk_yrit} merkattua · sarja ${pc(d.merk_kl_sarja)}`, ero(d.merk_kl, d.merk_kl_sarja))}
      ${kortti("Merkattu laiton-%", fi(d.laiton), "%", `${d.laittomia} laitonta · sarja ${pc(d.laiton_sarja)}`, ero(d.laiton, d.laiton_sarja, true))}
      ${kortti("Ei-merkattujen KL-%", fi(d.eimerk_kl), "%", `${d.eimerk_n} lyöntiä · sarja ${pc(d.eimerk_kl_sarja)}`, ero(d.eimerk_kl, d.eimerk_kl_sarja))}
      ${kortti("Kovien tehokkuusindeksi", fi(d.kovat), "", esc(ilmanSarjaa(d.kovat_teksti)) + (kovatS != null ? ` · sarja ${fi(kovatS)}` : ""), kovatS != null ? ero(d.kovat, kovatS).replace(" pp", "") : "")}
      ${kortti("Pienten tehokkuusindeksi", fi(d.pienet), "", esc(d.pienet_teksti || ""))}
      ${kortti(esc(d.pomput_otsikko || "Laittomat pomput"), d.pomput == null ? "–" : fi(d.pomput), d.pomput == null ? "" : "%", esc(d.pomput_teksti || ""))}
    </div>
    <div class="paneeli la-jakauma"><h3>Lyönnit tilanteittain</h3>
      ${jak.map(([t, n]) => `<div class="la-j-rivi${d.tilanteet?.[t] ? " analysoitu" : ""}"><span>${esc(t)}</span><div class="mp-palkki"><i style="width:${(100 * n) / max}%"></i></div><b class="num">${n}</b></div>`).join("")}
      <p class="pieni" style="margin:8px 0 0">Keltaiset = tarkemmin analysoidut päätilanteesi alla.</p>
    </div>
  </div>`;
}

function tilanne(nimi, q) {
  if (!q) return "";
  const nolla = !q.matriisi?.length;
  const kartta = `<figure class="la-kartta${nolla ? " yksi" : ""}">
      ${nolla ? `<figcaption><span>Kaikki lyönnit (${q.lyonnit})</span></figcaption>` : `<figcaption><span>Merkatut (${q.n_merk})</span><span>Ei-merkatut 1.–2. lyönnit</span></figcaption>`}
      <img src="${q.kartta}" alt="${esc(nimi)}: lyöntikartta" loading="lazy">
      ${nolla ? selite(SELITE_0) : `<div class="la-selitteet"><div><b>Merkatut</b>${selite(SELITE_M)}</div><div><b>Ei-merkatut</b>${selite(SELITE_E)}</div></div>`}
    </figure>`;
  if (nolla) {
    const t = (o, a, ala) => `<div class="la-luku"><span>${o}</span><b class="num">${a}</b><small>${ala}</small></div>`;
    return `<div class="la-runko">
      <div class="paneeli la-kartta-p"><h3>Lyöntikartta</h3>${kartta}</div>
      <div class="paneeli"><h3>${esc(nimi)}: lyöntien lopputulokset</h3>
        <div class="la-luvut">
          ${t("Kärkilyönti-%", pc(q.kl), `${q.kl_n} kärkilyöntiä`)}
          ${t("Läpilyönti-%", pc(q.lapi), `${q.lapi_n} läpilyöntiä · ${q.kunnarit} kunnaria`)}
          ${t("Haava-%", pc(q.haava), `${q.haava_n} haavaa`)}
          ${t("Palo-%", pc(q.palo), `${q.palo_n} paloa`)}
          ${t("Kopit", pc(q.kopit), `kaikkiaan ${q.kaikkiaan} lyöntiä`)}
          ${t("Juoksut", q.juoksut ?? "–", "nollatilanteen lyönneistä")}
        </div>
        <h3 style="margin-top:22px">Lyöntivalinnat</h3>
        ${valinnat(q.valinnat?.kaikki, "eimerk")}
      </div>
    </div>`;
  }
  return `<div class="la-runko">
    <div class="paneeli la-kartta-p"><h3>Lyöntikartta</h3>${kartta}</div>
    <div class="paneeli">
      <h3>Merkattujen kärkilyönti-%</h3>
      <p class="pieni" style="margin-top:0">${esc(nimi)} · monesko lyönti × palot ennen lyöntiä</p>
      ${matriisi(q.matriisi)}
      ${q.merkki ? merkki(q.merkki) : ""}
      <div class="la-pienet">
        <div><span>Lyönnit</span><b class="num">${q.lyonnit ?? "–"}</b></div>
        <div><span>Juoksut</span><b class="num">${q.juoksut ?? "–"}</b></div>
        <div><span>Läpilyönnit</span><b class="num">${q.lapilyonnit ?? "–"}</b></div>
        <div><span>Kopit</span><b class="num">${pc(q.kopit)}</b></div>
      </div>
    </div>
  </div>
  <div class="la-runko">
    <div class="paneeli"><h3>Lyöntivalinnat: merkatut (${q.valinnat?.n_merk ?? "–"})</h3>${valinnat(q.valinnat?.merkatut, "merk")}</div>
    <div class="paneeli"><h3>Lyöntivalinnat: ei-merkatut 1.–2. lyönnit (${q.valinnat?.n_eimerk ?? "–"})</h3>${valinnat(q.valinnat?.eimerkatut, "eimerk")}</div>
  </div>`;
}

function matriisi(M) {
  const sarakkeet = ["0 paloa", "1 palo", "2 paloa", "Yht."];
  const vari = (p) => (p == null ? "transparent" : `rgba(245,168,0,${(0.08 + 0.72 * Math.min(1, Math.max(0, (p - 20) / 60))).toFixed(2)})`);
  return `<table class="la-matriisi">
    <thead><tr><th></th>${sarakkeet.map((s) => `<th>${s}</th>`).join("")}</tr></thead>
    <tbody>${M.map((r) => `<tr class="${r.rivi === "Yhteensä" ? "yht" : ""}"><th>${esc(r.rivi)}</th>${r.solut.map((c, i) => {
      const pieni = c.n > 0 && c.n < 5;
      const tumma = c.pct != null && c.pct >= 55;
      return `<td class="${i === 3 ? "yhtsar " : ""}${pieni ? "pieni-otos " : ""}${tumma ? "tumma" : ""}" style="background:${vari(c.pct)}" title="${c.n} merkattua${pieni ? ", pieni otos" : ""}"><b class="num">${c.n ? pc(c.pct) : "–"}</b><small>${c.n ? `n=${c.n}` : ""}</small></td>`;
    }).join("")}</tr>`).join("")}</tbody></table>
    <p class="pieni" style="margin:6px 0 0">Väri tummenee onnistumisen kasvaessa. Himmeä luku = alle 5 lyöntiä.</p>`;
}

function merkki(m) {
  return `<div class="la-merkki"><h3>Milloin merkki tulee</h3>
    ${[0, 1, 2].map((i) => `<div class="la-m-rivi"><span>${i + 1}. lyönti</span>
      <div class="la-m-palkit"><div class="mp-palkki oma"><i style="width:${m.oma[i] || 0}%"></i></div><div class="mp-palkki sarja"><i style="width:${m.sarja[i] || 0}%"></i></div></div>
      <b class="num">${pc(m.oma[i])}</b><small>sarja ${m.sarja[i]} %</small></div>`).join("")}
    <p class="pieni" style="margin:4px 0 0">${m.n} merkattua lyöntiä. Ylempi palkki = sinä, alempi = sarja.</p></div>`;
}

function valinnat(rivit, tyyppi) {
  if (!rivit?.length) return `<p class="tyhja">Ei lyöntejä.</p>`;
  const sar = tyyppi === "merk" ? [["haava", "Haava"], ["palo", "Palo"], ["laiton", "Laiton"]] : [["haava", "Haava"], ["palo", "Palo"], ["vapaa", "Vapaa"]];
  return `<div class="taulu-wrap la-valinnat"><table>
    <thead><tr><th>Lyönti</th><th>n</th><th>Osuus</th><th>KL-%</th><th>Sarja</th>${sar.map(([, o]) => `<th class="la-mob-pois">${o}</th>`).join("")}</tr></thead>
    <tbody>${rivit.map((r) => {
      const yht = r.lyonti === "Yhteensä", pieni = !yht && r.n < 5;
      const parempi = r.kl != null && r.sarja_kl != null && r.n >= 5 && r.kl - r.sarja_kl >= 5;
      const heikompi = r.kl != null && r.sarja_kl != null && r.n >= 5 && r.sarja_kl - r.kl >= 5;
      return `<tr class="${yht ? "yht" : ""}${pieni ? " pieni-otos" : ""}"><td>${esc(r.lyonti)}</td><td class="num">${r.n}</td>
        <td><div class="la-osuus"><i style="width:${Math.min(100, r.osuus || 0)}%"></i><span class="num">${fi(r.osuus)}</span></div></td>
        <td class="num la-kl${parempi ? " hyva" : heikompi ? " heikko" : ""}">${r.kl == null ? "–" : fi(r.kl)}</td>
        <td class="num himmea">${fi(r.sarja_kl)}</td>
        ${sar.map(([k]) => `<td class="num la-mob-pois">${fi(r[k])}</td>`).join("")}</tr>`;
    }).join("")}</tbody></table></div>
    <p class="pieni" style="margin:6px 0 0">Luvut prosentteja. Sarja = sarjan KL-% samalla lyönnillä. KL-% vihreä = vähintään 5 pp sarjaa parempi, punainen = vähintään 5 pp heikompi (vähintään 5 lyöntiä).</p>`;
}
