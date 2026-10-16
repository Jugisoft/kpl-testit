// Ottelulyönnit kentällä (16.10.2026): pesistulokset.fi:n kauden 2026 ottelutapahtumista, Jarvis vie
// skriptillä 05 Jarvis/Työkalut/lyontikartat.py tauluun analyysit (lyonnit_2026 + lyonnit_2026_p<id>).
// Väri = lyönnin lopputulos, suodattimet tilanne / palot / monesko lyönti / vaihe. Lisäksi pienet kartat tilannekansioittain.
import { sb } from "./db.js";
import { $$, esc } from "./util.js";
import { kenttaSvg } from "./kentta.js";

export const TULOS = {
  kunnari: ["Kunnari", "#2EE59D"], juoksu: ["Juoksu", "#2EE59D"], eteni: ["Kärkietenijä eteni", "#F5A800"],
  palo: ["Palo", "#FF3B4E"], koppi: ["Koppi", "#7DD3FC"], haava: ["Haava", "#A78BFA"],
  laiton: ["Laiton", "#8C877D"], ei_edennyt: ["Ei edennyt", "#5E5850"], muu: ["Muu", "#3E3A35"],
};
const JARJ = ["juoksu", "kunnari", "eteni", "palo", "koppi", "haava", "laiton", "ei_edennyt", "muu"];
const KANSIOT = [["0-tilanne", ["0"]], ["1-tilanne", ["1"]], ["2-tilanne", ["2", "1–2"]], ["Takatilanne", ["3", "1–3", "2–3", "1–2–3"]]];
const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

let hakemisto = null;
const valimuisti = new Map();
const s = { tilanne: "", palot: "", lyonti: "", vaihe: "0", piilossa: new Set(["muu"]) };

export async function haeHakemisto() {
  if (hakemisto) return hakemisto;
  const { data } = await sb.from("analyysit").select("data").eq("avain", "lyonnit_2026").maybeSingle();
  hakemisto = data?.data || null;
  return hakemisto;
}
// Pelaaja nimellä (siirtyneet pelaajat löytyvät 2026-joukkueestaan); kaksi samannimistä → saman joukkueen ensin
export async function etsiPelaaja(nimi, joukkue) {
  const h = await haeHakemisto(); if (!h) return null;
  const ehd = h.pelaajat.filter((p) => norm(p.nimi) === norm(nimi));
  return ehd.find((p) => p.joukkue === joukkue) || ehd[0] || null;
}
async function haeLyonnit(id) {
  if (valimuisti.has(id)) return valimuisti.get(id);
  const { data } = await sb.from("analyysit").select("data").eq("avain", `lyonnit_2026_p${id}`).maybeSingle();
  valimuisti.set(id, data?.data || null);
  return data?.data || null;
}

const chip = (ryhma, k, n, arvo) => `<button type="button" class="chip" data-r="${ryhma}" data-k="${k}" aria-pressed="${arvo === k}">${n}</button>`;

export async function piirraOttelulyonnit(el, pelaaja) {
  el.innerHTML = `<p class="lataa">Ladataan lyöntejä…</p>`;
  const h = await haeHakemisto();
  const loydetty = h && await etsiPelaaja(pelaaja.nimi, pelaaja.joukkue);
  if (!loydetty) { el.innerHTML = `<p class="tyhja">Pelaajalla ei ole Superpesiksen ottelulyöntejä kaudelta 2026${pelaaja.joukkue === "Ura" || pelaaja.joukkue === "PuMu" ? " (nousijajoukkue, Ykköspesis)" : ""}.</p>`; return; }
  const d = await haeLyonnit(loydetty.id);
  if (!d) { el.innerHTML = `<p class="tyhja">Lyöntejä ei saatu ladattua.</p>`; return; }
  const L = d.l.map(([x, y, t, palot, lyonti, tulos, vaihe]) => ({ x, y, tilanne: h.tilanteet[t], palot, lyonti, tulos: h.tulokset[tulos], vaihe }));
  const piirra = () => {
    const pohja = L.filter((l) => (s.palot === "" || l.palot === +s.palot) && (s.lyonti === "" || l.lyonti === +s.lyonti) && (s.vaihe === "" || l.vaihe === +s.vaihe));
    const valitut = pohja.filter((l) => s.tilanne === "" || KANSIOT.find(([k]) => k === s.tilanne)?.[1].includes(l.tilanne) || l.tilanne === s.tilanne);
    const nakyvat = valitut.filter((l) => !s.piilossa.has(l.tulos));
    const lkm = (a, t) => a.filter((l) => l.tulos === t).length;
    const pros = (n, a) => (a.length ? Math.round((100 * n) / a.length) : 0);
    const pisteet = (a) => [...a].sort((p, q) => JARJ.indexOf(q.tulos) - JARJ.indexOf(p.tulos))
      .map((l) => ({ x: l.x, y: l.y, vari: TULOS[l.tulos][1], otsikko: `${TULOS[l.tulos][0]} · ${l.tilanne === "0" ? "0" : l.tilanne}-tilanne, ${l.palot} paloa, ${l.lyonti}. lyönti` }));
    el.innerHTML = `
      <div class="ok-paa">
        <p class="pieni">${esc(d.nimi)} · ${esc(d.joukkue)} 2026 · ${L.length} lyöntiä ${loydetty.joukkue !== pelaaja.joukkue ? `(pelasi 2026 joukkueessa ${esc(loydetty.joukkue)})` : ""} · lähde pesistulokset.fi</p>
      </div>
      <div class="ok-suod">
        <div class="chipit pieni-chipit" aria-label="Tilanne">${chip("tilanne", "", "Kaikki tilanteet", s.tilanne)}${KANSIOT.map(([k]) => chip("tilanne", k, k, s.tilanne)).join("")}<span class="erotin"></span>${h.tilanteet.map((t) => chip("tilanne", t, t === "0" ? "0" : t, s.tilanne)).join("")}</div>
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
      <p class="vihje">Pisteet ovat pöytäkirjanpitäjän merkitsemiä kohtia, joten ne ovat likimääräisiä. Juoksu = lyönnin seurauksena tehtiin juoksu. Kärkietenijä eteni = onnistunut kärkilyönti (0-tilanteessa lyöjä kentälle). Ei edennyt = kärkilyönti epäonnistui ilman paloa tai koppia. Laiton-pisteet näkyvät rajojen ulkopuolella. Selitteet: <a href="#/ohje/vastustajat">Ohje</a>.</p>`;
    $$("[data-r]", el).forEach((b) => (b.onclick = () => { s[b.dataset.r] = b.dataset.k; piirra(); }));
    $$("[data-tulos]", el).forEach((b) => (b.onclick = () => { const t = b.dataset.tulos; s.piilossa.has(t) ? s.piilossa.delete(t) : s.piilossa.add(t); if (t === "juoksu") s.piilossa.has(t) ? s.piilossa.add("kunnari") : s.piilossa.delete("kunnari"); piirra(); }));
    $$("[data-kansio]", el).forEach((b) => (b.onclick = () => { s.tilanne = s.tilanne === b.dataset.kansio ? "" : b.dataset.kansio; piirra(); el.querySelector(".ok-suod")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }));
  };
  piirra();
}
