// Ottelulyönnit kentällä (16.10.2026): pesistulokset.fi:n ottelutapahtumista. YDIN 2027 hakee jokaisen päättyneen
// ottelun kerran iltaajossa klo 21.30 ja kirjoittaa lyönnit julkiseen repoon (data/out/lyonnit_<kausi>/), josta tämä lukee.
// Väri = lyönnin lopputulos, suodattimet kausi / tilanne / palot / monesko lyönti / vaihe. Lisäksi pienet kartat tilannekansioittain.
import { $$, esc } from "./util.js";
import { kenttaSvg } from "./kentta.js";

const LAHDE = "https://raw.githubusercontent.com/Jugisoft/ydin-2027/main/data/out";
const KAUDET = [2027, 2026];   // lisää uusi kausi alkuun

export const TULOS = {
  kunnari: ["Kunnari", "#2EE59D"], juoksu: ["Juoksu", "#2EE59D"], eteni: ["Kärkilyönti", "#F5A800"],
  palo: ["Palo", "#FF3B4E"], koppi: ["Koppi", "#7DD3FC"],
  laiton: ["Laiton", "#8C877D"], ei_edennyt: ["Ei edennyt", "#5E5850"], muu: ["Muu", "#3E3A35"],
};
// Haava yhdistetään koppiin (Jugi, korjaamo 1.11.2026).
const YHDISTA = { haava: "koppi" };
const JARJ = ["juoksu", "kunnari", "eteni", "palo", "koppi", "laiton", "ei_edennyt", "muu"];
const KANSIOT = [["0-tilanne", ["0"]], ["1-tilanne", ["1"]], ["2-tilanne", ["2", "1–2"]], ["Takatilanne", ["3", "1–3", "2–3", "1–2–3"]]];
const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const hakemistot = new Map();   // kausi -> hakemisto | null
const valimuisti = new Map();   // kausi:id -> lyönnit
const s = { kausi: null, tilanne: "", palot: "", lyonti: "", vaihe: "0", piilossa: new Set(["muu"]) };

async function hae(polku) {
  try { const r = await fetch(`${LAHDE}/${polku}`, { cache: "no-cache" }); return r.ok ? await r.json() : null; } catch { return null; }
}
export async function haeHakemisto(kausi) {
  if (!hakemistot.has(kausi)) hakemistot.set(kausi, await hae(`lyonnit_${kausi}/hakemisto.json`));
  return hakemistot.get(kausi);
}
// Pelaaja nimellä (siirtyneet pelaajat löytyvät kauden joukkueestaan); kaksi samannimistä → saman joukkueen ensin
export async function etsiPelaaja(kausi, nimi, joukkue) {
  const h = await haeHakemisto(kausi); if (!h) return null;
  const ehd = h.pelaajat.filter((p) => norm(p.nimi) === norm(nimi));
  return ehd.find((p) => p.joukkue === joukkue) || ehd[0] || null;
}
async function haeLyonnit(kausi, id) {
  const k = `${kausi}:${id}`;
  if (!valimuisti.has(k)) valimuisti.set(k, await hae(`lyonnit_${kausi}/p${id}.json`));
  return valimuisti.get(k);
}

const chip = (ryhma, k, n, arvo) => `<button type="button" class="chip" data-r="${ryhma}" data-k="${k}" aria-pressed="${arvo === k}">${n}</button>`;

export async function piirraOttelulyonnit(el, pelaaja) {
  el.innerHTML = `<p class="lataa">Ladataan lyöntejä…</p>`;
  const kaudet = [];
  for (const k of KAUDET) {
    const p = await etsiPelaaja(k, pelaaja.nimi, pelaaja.joukkue);
    if (!p) continue;
    const d = await haeLyonnit(k, p.id);
    if (d) kaudet.push({ kausi: k, p, d, h: await haeHakemisto(k) });
  }
  if (!kaudet.length) { el.innerHTML = `<p class="tyhja">Pelaajalla ei ole Superpesiksen ottelulyöntejä${pelaaja.joukkue === "Ura" || pelaaja.joukkue === "PuMu" ? " (nousijajoukkue, Ykköspesis)" : ""}.</p>`; return; }
  if (!kaudet.some((k) => String(k.kausi) === s.kausi) && s.kausi !== "kaikki") s.kausi = String(kaudet[0].kausi);
  const kaikki = kaudet.flatMap(({ kausi, d, h }) => d.l.map(([x, y, t, palot, lyonti, tulos, vaihe]) => ({ kausi, x, y, tilanne: h.tilanteet[t], palot, lyonti, tulos: YHDISTA[h.tulokset[tulos]] || h.tulokset[tulos], vaihe })));
  const piirra = () => {
    const L = kaikki.filter((l) => s.kausi === "kaikki" || String(l.kausi) === s.kausi);
    const kd = kaudet.find((k) => String(k.kausi) === s.kausi) || kaudet[0];
    const pohja = L.filter((l) => (s.palot === "" || l.palot === +s.palot) && (s.lyonti === "" || l.lyonti === +s.lyonti) && (s.vaihe === "" || l.vaihe === +s.vaihe));
    const valitut = pohja.filter((l) => s.tilanne === "" || KANSIOT.find(([k]) => k === s.tilanne)?.[1].includes(l.tilanne) || l.tilanne === s.tilanne);
    const nakyvat = valitut.filter((l) => !s.piilossa.has(l.tulos));
    const lkm = (a, t) => a.filter((l) => l.tulos === t).length;
    const pros = (n, a) => (a.length ? Math.round((100 * n) / a.length) : 0);
    const pisteet = (a) => [...a].sort((p, q) => JARJ.indexOf(q.tulos) - JARJ.indexOf(p.tulos))
      .map((l) => ({ x: l.x, y: l.y, vari: TULOS[l.tulos][1], otsikko: `${TULOS[l.tulos][0]} · ${l.tilanne === "0" ? "0" : l.tilanne}-tilanne, ${l.palot} paloa, ${l.lyonti}. lyönti` }));
    el.innerHTML = `
      <div class="ok-paa">
        <p class="pieni">${esc(kd.d.nimi)} · ${L.length} lyöntiä${s.kausi === "kaikki" ? "" : ` · ${esc(kd.d.joukkue)} ${kd.kausi}${kd.p.joukkue !== pelaaja.joukkue ? " (silloinen joukkue)" : ""}`} · lähde pesistulokset.fi</p>
      </div>
      <div class="ok-suod">
        ${kaudet.length > 1 ? `<div class="chipit pieni-chipit" aria-label="Kausi">${kaudet.map((k) => chip("kausi", String(k.kausi), `Kausi ${k.kausi}`, s.kausi)).join("")}${chip("kausi", "kaikki", "Kaikki kaudet", s.kausi)}</div>` : ""}
        <div class="chipit pieni-chipit" aria-label="Tilanne">${chip("tilanne", "", "Kaikki tilanteet", s.tilanne)}${KANSIOT.map(([k]) => chip("tilanne", k, k, s.tilanne)).join("")}<span class="erotin"></span>${kd.h.tilanteet.map((t) => chip("tilanne", t, t === "0" ? "0" : t, s.tilanne)).join("")}</div>
        <div class="chipit pieni-chipit">${chip("palot", "", "Kaikki palot", s.palot)}${[0, 1, 2].map((n) => chip("palot", String(n), `${n} paloa`.replace("1 paloa", "1 palo"), s.palot)).join("")}
          <span class="erotin"></span>${chip("lyonti", "", "Kaikki lyönnit", s.lyonti)}${[1, 2, 3].map((n) => chip("lyonti", String(n), `${n}. lyönti`, s.lyonti)).join("")}
          <span class="erotin"></span>${chip("vaihe", "0", "Runkosarja", s.vaihe)}${chip("vaihe", "1", "Pudotuspelit", s.vaihe)}${chip("vaihe", "", "Molemmat", s.vaihe)}</div>
      </div>
      <div class="ok-runko">
        <div class="kentta-kehys ok-iso">${kenttaSvg({ id: "ok-kartta", pisteet: pisteet(nakyvat), r: nakyvat.length > 300 ? 0.8 : 1 })}</div>
        <div class="ok-jakauma">
          <h3>${valitut.length} lyöntiä${s.tilanne ? ` · ${esc(s.tilanne === "0" ? "0-tilanne" : s.tilanne.includes("tilanne") ? s.tilanne : s.tilanne + "-tilanne")}` : ""}</h3>
          <p class="pieni">Napauta tulosta piilottaaksesi sen kartalta.</p>
          <ul>${JARJ.filter((t) => t !== "kunnari" || lkm(valitut, t)).map((t) => { const n = lkm(valitut, t); return `<li><button type="button" class="ok-tulos${s.piilossa.has(t) ? " pois" : ""}" data-tulos="${t}">
            <span class="pallura" style="background:${TULOS[t][1]}"></span><span class="ok-nimi">${TULOS[t][0]}</span><span class="num ok-n">${n}</span><span class="num ok-p">${pros(n, valitut)} %</span>
            <span class="ok-palkki"><span style="width:${pros(n, valitut)}%;background:${TULOS[t][1]}"></span></span></button></li>`; }).join("")}</ul>
          ${valitut.length && valitut.length < 15 ? `<p class="pieni">Pieni otos, suuntaa-antava.</p>` : ""}
        </div>
      </div>
      <h3>Tilanteittain</h3>
      <div class="ok-pienet">${KANSIOT.map(([k, tt]) => { const a = pohja.filter((l) => tt.includes(l.tilanne)); const v = a.filter((l) => !s.piilossa.has(l.tulos));
        return `<button type="button" class="ok-pieni${s.tilanne === k ? " valittu" : ""}" data-kansio="${k}"><span class="ok-pieni-ots">${k} <span class="pieni">${a.length}</span></span>
          <div class="kentta-kehys">${kenttaSvg({ id: "ok-" + k, pisteet: pisteet(v), r: 0.9 })}</div>
          <span class="pieni">palo ${pros(lkm(a, "palo"), a)} % · koppi ${pros(lkm(a, "koppi"), a)} % · laiton ${pros(lkm(a, "laiton"), a)} %</span></button>`; }).join("")}</div>
      <p class="vihje">Pisteet ovat pöytäkirjanpitäjän merkitsemiä kohtia, joten ne ovat likimääräisiä. Juoksu = lyönnin seurauksena tehtiin juoksu. Kärkilyönti = onnistunut kärkilyönti, kärkietenijä eteni (0-tilanteessa lyöjä kentälle). Koppi sisältää myös haavat. Ei edennyt = kärkilyönti epäonnistui ilman paloa tai koppia. Laiton-pisteet näkyvät rajojen ulkopuolella. Selitteet: <a href="#/ohje/vastustajat">Ohje</a>.</p>`;
    $$("[data-r]", el).forEach((b) => (b.onclick = () => { s[b.dataset.r] = b.dataset.k; piirra(); }));
    $$("[data-tulos]", el).forEach((b) => (b.onclick = () => { const t = b.dataset.tulos; s.piilossa.has(t) ? s.piilossa.delete(t) : s.piilossa.add(t); if (t === "juoksu") s.piilossa.has(t) ? s.piilossa.add("kunnari") : s.piilossa.delete("kunnari"); piirra(); }));
    $$("[data-kansio]", el).forEach((b) => (b.onclick = () => { s.tilanne = s.tilanne === b.dataset.kansio ? "" : b.dataset.kansio; piirra(); el.querySelector(".ok-suod")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }));
  };
  piirra();
}
