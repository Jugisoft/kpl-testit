// Treenikeskus (26.11.2026): puhtaat apufunktiot – ei DOM:ia eikä tietokantaa, testit tests/treenikeskus.test.mjs.
// Rasitus tallennetaan aina 1–10; pelaajan oma asteikko (5 tai 10) vain näytössä. Viikkopohja (treenipaketit)
// laajennetaan päiväriveiksi ohjelma-tauluun.
import { lisaaPv, maanantai } from "./kuormaydin.js";

// oletusvärit vihreästä punaiseen/violettiin
export const OLETUSVARIT = {
  5: ["#2EE59D", "#E5D52E", "#F5A800", "#FF3B4E", "#A78BFA"],
  10: ["#2EE59D", "#5EE07A", "#9BDB4F", "#D2D23A", "#F5C400", "#F5A800", "#FF7A3D", "#FF3B4E", "#D83BA8", "#A78BFA"],
};

const rajaa = (x, ala, yla) => Math.min(yla, Math.max(ala, x));

/** Pelaajan asteikon arvo → tallennettava 1–10 (1–5: 1→2 … 5→10). */
export function tallennusRpe(arvo, asteikko = 10) {
  const a = rajaa(Math.round(+arvo || 1), 1, asteikko);
  return asteikko === 5 ? a * 2 : a;
}

/** Tallennettu 1–10 → pelaajan asteikko. */
export function naytaRpe(rpe10, asteikko = 10) {
  const r = rajaa(Math.round(+rpe10 || 1), 1, 10);
  return asteikko === 5 ? rajaa(Math.round(r / 2), 1, 5) : r;
}

/** Rasituksen väri pelaajan omilla väreillä. */
export function rpeVari(rpe10, asetukset) {
  const asteikko = asetukset?.asteikko === 5 ? 5 : 10;
  const varit = asetukset?.varit?.length === asteikko ? asetukset.varit : OLETUSVARIT[asteikko];
  return varit[naytaRpe(rpe10, asteikko) - 1];
}

/** ISO-viikonpäivä 1 = ma … 7 = su */
export const viikonpaiva = (pvm) => ((new Date(pvm + "T12:00:00Z").getUTCDay() + 6) % 7) + 1;

/**
 * Viikkopohja → päivärivit ohjelma-tauluun. Vain päivät, jotka ovat ≥ alkaen ja voimassaolon sisällä.
 * @returns {{paiva:string, viikko:string, treeniohjelma:string, kesto_min:number|null, rpe:number|null, jarjestys:number}[]}
 */
export function laajennaPaketti(paketti, alkaen) {
  const ulos = [];
  const rivit = paketti.rivit || [];
  if (!rivit.length) return ulos;
  for (let d = alkaen > paketti.alku ? alkaen : paketti.alku; d <= paketti.loppu; d = lisaaPv(d, 1)) {
    const vp = viikonpaiva(d);
    rivit.forEach((r, i) => {
      if (+r.vp === vp) ulos.push({ paiva: d, viikko: maanantai(d), treeniohjelma: r.koodi, kesto_min: r.kesto_min ?? null, rpe: r.rpe ?? null, jarjestys: i });
    });
  }
  return ulos;
}

/** ISO-viikkonumero */
export function viikkoNumero(pvm) {
  const d = new Date(pvm + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const v1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - v1) / 86400000 + 1) / 7);
}

/** Seuraako pelaaja yhteistä ohjelmaa tänä päivänä (paketti, jossa yhteinen = true). */
export const seuraaYhteista = (paketit, pvm) => (paketit || []).some((p) => p.yhteinen && p.alku <= pvm && pvm <= p.loppu);

/**
 * Viikon seitsemän päivää: suunnitellut (omat + yhteiset jaksoilla), toteutuneet ja sairaus.
 * Toteuma liitetään suunniteltuun ohjelma_id:llä, muuten saman päivän samalla treeniohjelmalla.
 */
export function viikonPaivat(ma, { ohjelma = [], toteumat = [], sairaudet = [], paketit = [] } = {}) {
  const kaytetyt = new Set();
  return Array.from({ length: 7 }, (_, i) => {
    const pvm = lisaaPv(ma, i);
    const nahdyt = new Set();
    const suunnitellut = ohjelma
      .filter((o) => o.paiva === pvm && (o.pelaaja_id || seuraaYhteista(paketit, pvm)))
      .filter((o) => (nahdyt.has(o.id) ? false : nahdyt.add(o.id)))
      .sort((a, b) => (a.pelaaja_id ? 1 : 0) - (b.pelaaja_id ? 1 : 0) || (a.jarjestys ?? 0) - (b.jarjestys ?? 0));
    const paivan = toteumat.filter((t) => t.pvm === pvm);
    for (const s of suunnitellut) {
      s.toteuma = paivan.find((t) => t.ohjelma_id === s.id || (s.tapahtuma && t.tapahtuma_uid === s.id)) || paivan.find((t) => !t.ohjelma_id && s.treeniohjelma && t.ohjelma === s.treeniohjelma && !kaytetyt.has(t.id)) || null;
      if (s.toteuma) kaytetyt.add(s.toteuma.id);
    }
    return {
      pvm,
      suunnitellut,
      toteutuneet: paivan,
      ylimaaraiset: paivan.filter((t) => !kaytetyt.has(t.id)),
      sairas: sairaudet.some((s) => s.alku <= pvm && pvm <= s.loppu),
    };
  });
}
