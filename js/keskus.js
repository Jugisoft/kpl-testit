// KPL Keskus: huomiot, kommentit, koosteet, siirtomarkkinat ja AI-kutsu.
import { sb, SUPABASE_URL, tila } from "./db.js";
import { esc } from "./util.js";

export const LUOKAT = {
  idea: "Idea",
  vastustaja: "Vastustaja",
  oma_peli: "Oma peli",
  merkkipeli: "Merkkipeli",
  pelaaja: "Pelaaja",
  muu: "Muu",
};
export const TILAT = { uusi: "Uusi", tyon_alla: "Työn alla", kaytossa: "Käytössä", arkisto: "Arkistossa" };
export const JOUKKUEET = ["SoJy", "ViVe", "Manse", "KiPa", "Tahko", "JoMa", "IPV", "PattU", "KeKi", "Ura", "PuMu"];

const valmentajat = new Map();
export async function lataaNimet() {
  if (valmentajat.size) return;
  const { data } = await sb.rpc("valmentajien_nimet");
  (data || []).forEach((v) => valmentajat.set(v.email, v.nimi));
}
export const kirjoittajanNimi = (email, ai = false) => (ai ? "AI-sparraaja" : valmentajat.get(email) || (email || "?").split("@")[0]);
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

export async function tallennaHuomio(h) {
  const rivi = {
    otsikko: h.otsikko.trim(),
    teksti: (h.teksti || "").trim(),
    luokka: h.luokka,
    vastustaja: h.luokka === "vastustaja" || h.vastustaja ? h.vastustaja || null : null,
    lahde: h.lahde?.trim() || null,
    tagit: h.tagit || [],
  };
  const { data, error } = await sb.from("huomiot").insert(rivi).select().single();
  if (error) throw error;
  pyydaAI(data.id); // ei odoteta
  return data;
}

// AI-sparraaja (edge function keskus-ai). Palauttaa { ok, syy? }.
export async function pyydaAI(huomioId) {
  try {
    const { data: s } = await sb.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/keskus-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` },
      body: JSON.stringify({ huomio_id: huomioId }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, syy: e.message };
  }
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
  `<span class="luokka l-${esc(h.luokka)}">${esc(LUOKAT[h.luokka] || h.luokka)}${h.vastustaja ? ` · ${esc(h.vastustaja)}` : ""}</span>`;
