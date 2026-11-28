// Tiedotteet (28.11.2026, Jugi): kertaluonteinen info-ikkuna, kun käyttäjä avaa Keskuksen. Kohde 'valmennus'
// (admin, valmentaja, psu) tai 'kaikki'. Luettu-merkintä taulussa tiedote_luettu; rajaus tietokannassa (RLS).
import { sb, tila } from "./db.js";
import { $, esc } from "./util.js";
import { md } from "./keskus.js";

let naytetty = false;
export async function naytaTiedotteet() {
  if (naytetty || !tila.jasen) return;
  naytetty = true;
  const tanaan = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const { data: t, error } = await sb.from("tiedotteet").select("*").order("luotu");
  if (error || !t?.length) return;
  const voimassa = t.filter((x) => !x.voimassa_asti || x.voimassa_asti >= tanaan);
  if (!voimassa.length) return;
  const { data: l } = await sb.from("tiedote_luettu").select("tiedote_id").in("tiedote_id", voimassa.map((x) => x.id));
  const luetut = new Set((l || []).map((x) => x.tiedote_id));
  const lukematta = voimassa.filter((x) => !luetut.has(x.id));
  for (const x of lukematta) await nayta(x);
}

function nayta(x) {
  return new Promise((valmis) => {
    const d = document.createElement("dialog");
    d.className = "tk-dialogi tiedote-dialogi";
    d.innerHTML = `<form method="dialog" class="tk-lomake">
      <header><h2>${esc(x.otsikko)}</h2><button class="tr-sulje" value="myohemmin" aria-label="Sulje">✕</button></header>
      <div class="md tiedote-teksti">${md(x.teksti)}</div>
      <div class="tk-napit"><button class="btn" value="myohemmin">Näytä myöhemmin uudelleen</button><button class="btn ensisij" value="luettu">Selvä, kiitos</button></div>
    </form>`;
    document.body.append(d);
    d.addEventListener("close", async () => {
      if (d.returnValue === "luettu" && !tila.katselu) await sb.from("tiedote_luettu").insert({ tiedote_id: x.id });
      d.remove(); valmis();
    });
    d.showModal();
    $(".btn.ensisij", d).focus();
  });
}
