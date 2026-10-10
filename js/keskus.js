// KPL Keskus: huomiot, kommentit, koosteet, siirtomarkkinat ja AI-kutsu.
import { sb, tila } from "./db.js";
import { esc } from "./util.js";

export const LUOKAT = {
  idea: "Ideat",
  oma_peli: "Oma peli",
  merkkipeli: "Merkkipeli",
  pelaaja: "Pelaajat",
  muu: "Muut",
  vastustaja: "Vastustaja",
};
export const JOUKKUEET = ["IPV", "JoMa", "KeKi", "KiPa", "Manse", "PattU", "PuMu", "SoJy", "Tahko", "Ura", "ViVe"];
// Osiot muistiossa: aiheet ja vastustajat. Avain: aihe (idea, oma_peli...) tai joukkueen lyhenne.
export const AIHEOSIOT = ["idea", "oma_peli", "merkkipeli", "pelaaja", "muu"];
export const osioNimi = (o) => (o === "kaikki" ? "Kaikki" : LUOKAT[o] || o);
export const osioKentat = (o) => (JOUKKUEET.includes(o) ? { luokka: "vastustaja", vastustaja: o } : { luokka: o, vastustaja: null });
export const huomionOsio = (h) => (h.luokka === "vastustaja" && h.vastustaja ? h.vastustaja : h.luokka);
export const koosteAvain = (o) => (JOUKKUEET.includes(o) ? `vastustaja:${o}` : o);

const valmentajat = new Map();
export async function lataaNimet() {
  if (valmentajat.size) return;
  const { data } = await sb.rpc("valmentajien_nimet");
  (data || []).forEach((v) => valmentajat.set(v.email, v.nimi));
}
export const kirjoittajanNimi = (email, ai = false) => (ai ? "Jarvis" : valmentajat.get(email) || (email || "?").split("@")[0]);
export const omaEmail = () => (tila.istunto?.user?.email || "").toLowerCase();

export async function haeHuomiot() {
  const { data, error } = await sb.from("huomiot").select("*").order("luotu", { ascending: false }).limit(1000);
  if (error) throw error;
  return data;
}
export async function haeHuomio(id) {
  const [h, k] = await Promise.all([
    sb.from("huomiot").select("*").eq("id", id).maybeSingle(),
    sb.from("huomio_kommentit").select("*").eq("huomio_id", id).order("luotu"),
  ]);
  if (h.error) throw h.error;
  return { huomio: h.data, kommentit: k.data || [] };
}
export async function kommenttimaarat() {
  const { data } = await sb.from("huomio_kommentit").select("huomio_id,ai");
  const m = new Map();
  (data || []).forEach((r) => { const o = m.get(r.huomio_id) || { n: 0, ai: 0 }; o.n++; if (r.ai) o.ai++; m.set(r.huomio_id, o); });
  return m;
}

// Tallentaa muistiinpanon osioon. Ensimmäinen rivi = otsikko, loput = teksti.
export async function tallennaMuistiinpano(teksti, osio) {
  const rivit = teksti.trim().split("\n");
  let otsikko = rivit[0].replace(/^#+\s*/, "").trim();
  let runko = rivit.slice(1).join("\n").trim();
  if (otsikko.length > 160) { runko = (otsikko + "\n" + runko).trim(); otsikko = otsikko.slice(0, 120).replace(/\s+\S*$/, "") + "…"; }
  const { data, error } = await sb.from("huomiot").insert({ otsikko, teksti: runko, ...osioKentat(osio) }).select().single();
  if (error) throw error;
  return data;
}
export const muistiinpanonTeksti = (h) => (h.teksti ? `${h.otsikko}\n${h.teksti}` : h.otsikko);
export async function paivitaMuistiinpano(id, teksti, osio) {
  const rivit = teksti.trim().split("\n");
  const muutos = { otsikko: rivit[0].replace(/^#+\s*/, "").trim().slice(0, 160), teksti: rivit.slice(1).join("\n").trim() };
  if (osio) Object.assign(muutos, osioKentat(osio));
  const { data, error } = await sb.from("huomiot").update(muutos).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function haeKoosteet() {
  const { data, error } = await sb.from("koosteet").select("*").order("paivitetty", { ascending: false });
  if (error) throw error;
  return data;
}

let smValimuisti = null;
export async function haeSiirtomarkkinat(pakota = false) {
  if (smValimuisti && !pakota) return smValimuisti;
  const { data, error } = await sb.from("siirtomarkkinat").select("data,paivitetty").eq("id", "nykyinen").maybeSingle();
  if (error) throw error;
  smValimuisti = data ? { ...data.data, paivitetty: data.paivitetty } : null;
  return smValimuisti;
}

// --- muotoilu

export function aikaSitten(s) {
  const d = new Date(s), nyt = Date.now(), min = Math.round((nyt - d) / 60000);
  if (min < 1) return "juuri nyt";
  if (min < 60) return `${min} min sitten`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} t sitten`;
  const pv = Math.round(h / 24);
  if (pv < 7) return pv === 1 ? "eilen" : `${pv} pv sitten`;
  return d.toLocaleDateString("fi-FI", { day: "numeric", month: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

// Pieni ja turvallinen markdown: ensin escape, sitten **lihavointi**, *kursiivi*, `koodi`, [linkki](https), otsikot ja listat.
export function md(teksti) {
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u.replace(/"/g, "%22")}" target="_blank" rel="noopener">${t}</a>`);
  const out = [];
  let lista = null;
  const sulje = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
  for (const rivi of String(teksti || "").split("\n")) {
    const l = rivi.trimEnd();
    let m;
    if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (lista !== "ul") { sulje(); out.push("<ul>"); lista = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (lista !== "ol") { sulje(); out.push("<ol>"); lista = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^(#{1,4})\s+(.*)/))) { sulje(); out.push(`<h4>${inline(m[2])}</h4>`); }
    else if (!l.trim()) { sulje(); }
    else { sulje(); out.push(`<p>${inline(l)}</p>`); }
  }
  sulje();
  return out.join("");
}

export const luokkaMerkki = (h) =>
  `<a class="luokka l-${esc(h.luokka)}" href="#/muistio/${esc(huomionOsio(h))}">${esc(h.luokka === "vastustaja" ? h.vastustaja || "Vastustaja" : LUOKAT[h.luokka] || h.luokka)}</a>`;
