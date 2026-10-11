// Vastustajan pelaajien kuvat. Oma ladattu kuva (yksityinen tallennus, bucket "liitteet", kansio pelaajakuvat/)
// menee pesistulokset.fi:n kuvan edelle. pesistulokset.fi:n kuvan alla näytetään aina lähde.
import { sb } from "./db.js";
import { $, esc, ilmoita } from "./util.js";

const BUCKET = "liitteet";
const urlit = new Map();

async function kuvaUrl(polku) {
  if (!polku) return null;
  if (urlit.has(polku)) return urlit.get(polku);
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(polku, 3600 * 6);
  if (error) return null;
  urlit.set(polku, data.signedUrl);
  return data.signedUrl;
}

// Pienennetään selaimessa (pitkä sivu max 720 px, WebP), jottei tallennustila kulu
async function pienenna(tiedosto) {
  const kuva = await createImageBitmap(tiedosto);
  const k = Math.min(1, 720 / Math.max(kuva.width, kuva.height));
  const c = document.createElement("canvas");
  c.width = Math.round(kuva.width * k); c.height = Math.round(kuva.height * k);
  c.getContext("2d").drawImage(kuva, 0, 0, c.width, c.height);
  return new Promise((ok, ei) => c.toBlob((b) => (b ? ok(b) : ei(new Error("Kuvan käsittely epäonnistui"))), "image/webp", 0.85));
}

const nimikirjaimet = (nimi) => nimi.split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export function kuvaKehys(p, { iso = true } = {}) {
  return `<div class="pelaajakuva${iso ? " iso" : ""}" data-kuva-pelaaja="${p.id}">
    <div class="pk-paikka" aria-hidden="true"><span>${p.numero != null ? esc(String(p.numero)) : esc(nimikirjaimet(p.nimi))}</span></div>
    <label class="pk-vaihda" title="Lisää tai vaihda kuva (voit myös vetää kuvan tähän)">${p.kuva || p.kuva_url ? "Vaihda kuva" : "Lisää kuva"}<input type="file" accept="image/*" hidden></label>
  </div>${!p.kuva && p.kuva_url ? `<a class="kuvalahde" href="${esc(p.kuva_lahde || "https://www.pesistulokset.fi")}" target="_blank" rel="noopener">Kuva: pesistulokset.fi</a>` : ""}`;
}

// Lataa kuvan näkyviin ja kytkee vaihdon (tiedostovalinta tai vedä ja pudota)
export function kytkeKuva(el, p, jalkeen) {
  const kehys = el.querySelector(`[data-kuva-pelaaja="${p.id}"]`); if (!kehys) return;
  const nayta = async () => {
    const url = p.kuva ? await kuvaUrl(p.kuva) : p.kuva_url || null;
    const vanha = kehys.querySelector("img"); if (vanha) vanha.remove();
    if (url) kehys.insertAdjacentHTML("afterbegin", `<img src="${esc(url)}" alt="${esc(p.nimi)}" loading="lazy" onerror="this.parentNode.classList.remove('on-kuva');this.remove()">`);
    kehys.classList.toggle("on-kuva", !!url);
  };
  nayta();
  const lataa = async (tiedosto) => {
    if (!tiedosto || !tiedosto.type.startsWith("image/")) return ilmoita("Valitse kuvatiedosto.", true);
    kehys.classList.add("ladataan");
    try {
      const blob = await pienenna(tiedosto);
      const polku = `pelaajakuvat/${p.id}-${Date.now()}.webp`;
      const { error } = await sb.storage.from(BUCKET).upload(polku, blob, { contentType: "image/webp" });
      if (error) throw error;
      const { error: e2 } = await sb.from("vastustajapelaajat").update({ kuva: polku }).eq("id", p.id);
      if (e2) throw e2;
      const vanha = p.kuva; p.kuva = polku;
      if (vanha) sb.storage.from(BUCKET).remove([vanha]);
      ilmoita("Kuva tallennettu"); jalkeen ? jalkeen() : nayta();
    } catch (e) { ilmoita("Kuvan tallennus epäonnistui: " + e.message, true); }
    finally { kehys.classList.remove("ladataan"); }
  };
  kehys.querySelector("input[type=file]").onchange = (e) => lataa(e.target.files[0]);
  kehys.ondragover = (e) => { e.preventDefault(); kehys.classList.add("veto"); };
  kehys.ondragleave = () => kehys.classList.remove("veto");
  kehys.ondrop = (e) => { e.preventDefault(); kehys.classList.remove("veto"); lataa(e.dataTransfer.files[0]); };
}
