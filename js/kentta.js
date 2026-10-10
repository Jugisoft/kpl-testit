// Pesäpallokenttä ylhäältä (miesten kenttä, mitat Pelikirjasta, OKM/SLA-kenttäkuva).
// Koordinaatit metreinä: x vasen(-)/oikea(+) kotipesän takaa katsottuna, y syvyys kotirajasta.
import { esc } from "./util.js";

export const FIELD = {
  outline: [[0, 0], [21, 32], [21, 96], [-21, 96], [-21, 32], [-10.97, 16.72]],
  runLane: [[0, 0], [-6.7, 0], [-21, 20], [-21, 32], [-10.97, 16.72]],
  vara2: [[21, 35.5], [31, 35.5], [31, 99], [21, 99]],
  vara3: [[-21, 35.5], [-31, 35.5], [-31, 99], [-21, 99]],
  bases: { 1: [-10.97, 16.72], 2: [21, 38.5], 3: [-21, 38.5] },
  kotipesa: 5,
};
export const ROOLIT = [
  ["L", "Lukkari"], ["S", "Sieppari"], ["1V", "Ykkösvahti"], ["2V", "Kakkosvahti"], ["3V", "Kolmosvahti"],
  ["2P", "Kakkospolttaja"], ["3P", "Kolmospolttaja"], ["2K", "2-koppari"], ["3K", "3-koppari"],
];
export const TILANTEET = ["0-tilanne", "1-tilanne", "2-tilanne", "3-tilanne", "1–2-tilanne", "1–3-tilanne", "2–3-tilanne", "Ajolähtö (1–2–3)", "Kotiutus 3-pesältä"];
export const LYONTITYYPIT = [
  ["napy", "Näpy", "#38D6FF"], ["pomppu", "Pomppu", "#2EE59D"], ["kumura", "Kumura", "#A78BFA"], ["viistari", "Viistäri", "#FFC93C"],
  ["pystari", "Pystäri", "#FF9F43"], ["koppi", "Koppi", "#FF3B4E"], ["varmistus", "Varmistus", "#94A3B8"], ["kunnari", "Kunnari", "#F472B6"],
];
export const TULOKSET = [["onnistui", "Onnistui"], ["ei", "Ei onnistunut"], ["palo", "Palo"], ["haava", "Haava"]];
export const PAINOT = [["eteen", "Eteen"], ["taakse", "Taakse"], ["2-raja", "Kakkosrajalle"], ["3-raja", "Kolmosrajalle"], ["paikallaan", "Paikallaan"]];
export const tyyppiTieto = (k) => LYONTITYYPIT.find((t) => t[0] === k);

const Y = (y) => 100 - y;
const pts = (a) => a.map(([x, y]) => `${x},${Y(y)}`).join(" ");

// pisteet: [{x, y, vari, otsikko, id}], valittu: {x,y} | null
export function kenttaSvg({ pisteet = [], valittu = null, id = "kentta", aktiivinen = false } = {}) {
  const pesat = Object.entries(FIELD.bases).map(([n, [x, y]]) =>
    `<rect x="${x - 1.2}" y="${Y(y) - 1.2}" width="2.4" height="2.4" class="kp-pesa" transform="rotate(45 ${x} ${Y(y)})"/><text x="${x + (x > 0 ? -3.2 : 3.2)}" y="${Y(y) + 1}" class="kp-teksti" text-anchor="middle">${n}</text>`).join("");
  const kaari = Array.from({ length: 13 }, (_, i) => { const a = Math.PI + (i / 12) * Math.PI; return `${(Math.cos(a) * FIELD.kotipesa).toFixed(2)},${(Y(0) - Math.sin(a) * FIELD.kotipesa).toFixed(2)}`; }).join(" ");
  return `<svg class="kenttakuva${aktiivinen ? " aktiivinen" : ""}" id="${id}" viewBox="-33 -1 66 106" role="img" aria-label="Pesäpallokenttä ylhäältä">
    <polygon points="${pts(FIELD.vara2)}" class="kp-vara"/><polygon points="${pts(FIELD.vara3)}" class="kp-vara"/>
    <polygon points="${pts(FIELD.outline)}" class="kp-kentta"/>
    <polygon points="${pts(FIELD.runLane)}" class="kp-kaista"/>
    ${[20, 40, 60, 80].map((m) => `<line x1="-21" x2="21" y1="${Y(m)}" y2="${Y(m)}" class="kp-apu"/><text x="-20" y="${Y(m) - .6}" class="kp-mitta">${m} m</text>`).join("")}
    <polygon points="${kaari}" class="kp-koti"/>
    ${pesat}
    <text x="0" y="${Y(96) - 1.5}" class="kp-teksti" text-anchor="middle">takaraja</text>
    <text x="24" y="${Y(70)}" class="kp-teksti" transform="rotate(90 24 ${Y(70)})" text-anchor="middle">2-raja</text>
    <text x="-24" y="${Y(70)}" class="kp-teksti" transform="rotate(-90 -24 ${Y(70)})" text-anchor="middle">3-raja</text>
    ${pisteet.map((p) => `<circle cx="${p.x}" cy="${Y(p.y)}" r="1.25" fill="${p.vari}" class="kp-piste"${p.id ? ` data-id="${esc(p.id)}"` : ""}><title>${esc(p.otsikko || "")}</title></circle>`).join("")}
    ${valittu ? `<g class="kp-valittu"><circle cx="${valittu.x}" cy="${Y(valittu.y)}" r="2.2"/><circle cx="${valittu.x}" cy="${Y(valittu.y)}" r=".7"/></g>` : ""}
  </svg>`;
}

// Kentän klikkaus → metrikoordinaatit (0,1 m tarkkuus)
export function kenttaPiste(svg, e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return { x: Math.round(p.x * 10) / 10, y: Math.round((100 - p.y) * 10) / 10 };
}
