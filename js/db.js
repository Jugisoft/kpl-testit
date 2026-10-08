// Supabase-yhteys, datan lataus ja tallennus.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

export const SUPABASE_URL = "https://xytpwmzcghixulnzdakv.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5dHB3bXpjZ2hpeHVsbnpkYWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NjMyNTgsImV4cCI6MjEwNzAzOTI1OH0.d3eiBFma8eT3nq-NhPmH2lurROo7XC0MXMkqDXVm3rs"; // julkinen anon-avain, oikeudet hoitaa RLS

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

export const tila = {
  istunto: null,
  valmentaja: false,
  admin: false,
  testit: [],          // testimääritelmät
  testi: {},           // koodi -> testi
  joukkueet: [],
  pelaajat: [],        // vain kirjautuneelle
  pelaaja: {},
  kerrat: [],
  kerta: {},
  tulokset: null,      // kaikki tulokset (lazy)
};

// Johdettu testi: lentävä 20 m = 30 m − 10 m samasta yrityksestä
export const LENTAVA = { koodi: "lentava20", nimi: "Lentävä 20 m", ryhma: "nopeus", yksikko: "s", pienempi_parempi: true, desimaalit: 2, jarjestys: 12, johdettu: true };

export async function lataaPerus() {
  const [t, j, k] = await Promise.all([
    sb.from("testit").select("*").order("jarjestys"),
    sb.from("joukkueet").select("*").order("id"),
    sb.from("testikerrat").select("*").order("pvm", { ascending: false }),
  ]);
  if (t.error) throw t.error;
  tila.testit = [...t.data, LENTAVA].sort((a, b) => a.jarjestys - b.jarjestys);
  tila.testi = Object.fromEntries(tila.testit.map((x) => [x.koodi, x]));
  tila.joukkueet = j.data || [];
  tila.kerrat = k.data || [];
  tila.kerta = Object.fromEntries(tila.kerrat.map((x) => [x.id, x]));
}

export async function tarkistaRooli() {
  const { data } = await sb.auth.getSession();
  tila.istunto = data.session;
  tila.valmentaja = tila.admin = false;
  if (!tila.istunto) return;
  const [v, a] = await Promise.all([sb.rpc("on_valmentaja"), sb.rpc("on_admin")]);
  tila.valmentaja = !!v.data;
  tila.admin = !!a.data;
}

export async function lataaPelaajat() {
  const { data, error } = await sb.from("pelaajat").select("*").eq("poistettu", false).order("sukunimi").order("etunimi");
  if (error) throw error;
  tila.pelaajat = data;
  tila.pelaaja = Object.fromEntries(data.map((p) => [p.id, p]));
}

async function haeKaikki(taulu, select, suodatin) {
  const out = [];
  for (let alku = 0; ; alku += 1000) {
    let q = sb.from(taulu).select(select).range(alku, alku + 999).order("id");
    if (suodatin) q = suodatin(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export async function lataaTulokset(pakota = false) {
  if (tila.tulokset && !pakota) return tila.tulokset;
  const rivit = await haeKaikki("tulokset", "id,testikerta_id,pelaaja_id,testi,yritys,arvo,tarkenne,hyvaksytty,huomio");
  rivit.forEach((r) => (r.arvo = Number(r.arvo)));
  tila.tulokset = rivit.filter((r) => tila.pelaaja[r.pelaaja_id]);
  return tila.tulokset;
}

export async function lataaKerranTulokset(kertaId) {
  const { data, error } = await sb.from("tulokset").select("*").eq("testikerta_id", kertaId).limit(5000);
  if (error) throw error;
  data.forEach((r) => (r.arvo = Number(r.arvo)));
  return data;
}

export const nimi = (p) => (p ? [p.etunimi, p.sukunimi].filter(Boolean).join(" ") : "?");
export const nimikirjaimet = (p) => ((p?.etunimi || "?")[0] + (p?.sukunimi || "")[0]).toUpperCase();
