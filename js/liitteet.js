// Liitetiedostot muistiinpanoihin (Supabase Storage, yksityinen bucket "liitteet").
import { sb } from "./db.js";
import { $$, esc, ilmoita } from "./util.js";
import { omaEmail } from "./keskus.js";
import { tila } from "./db.js";

const BUCKET = "liitteet";
export const MAX_KOKO = 25 * 1024 * 1024;
export const HYVAKSY = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.ppt,.pptx,.txt,.csv,.mp4,.mov";

export async function haeLiitteet(huomioIdt) {
  const m = new Map();
  if (huomioIdt && !huomioIdt.length) return m;
  let q = sb.from("liitteet").select("*").order("luotu");
  if (huomioIdt) q = q.in("huomio_id", huomioIdt.slice(0, 300));
  const { data } = await q;
  (data || []).forEach((l) => (m.get(l.huomio_id) || m.set(l.huomio_id, []).get(l.huomio_id)).push(l));
  return m;
}

const turvallinen = (n) => n.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);

export async function lataaTiedostot(huomioId, tiedostot) {
  const valmiit = [];
  for (const f of tiedostot) {
    if (f.size > MAX_KOKO) { ilmoita(`${f.name} on yli 25 Mt, sitä ei liitetty.`, true); continue; }
    const polku = `${huomioId}/${Date.now()}-${turvallinen(f.name)}`;
    const { error } = await sb.storage.from(BUCKET).upload(polku, f, { contentType: f.type || "application/octet-stream", upsert: false });
    if (error) { ilmoita(`${f.name}: lataus epäonnistui (${error.message})`, true); continue; }
    const { data, error: e2 } = await sb.from("liitteet").insert({ huomio_id: huomioId, polku, nimi: f.name, koko: f.size, mime: f.type || null }).select().single();
    if (e2) { await sb.storage.from(BUCKET).remove([polku]); ilmoita(`${f.name}: ${e2.message}`, true); continue; }
    valmiit.push(data);
  }
  return valmiit;
}

export async function poistaLiite(l) {
  const { error } = await sb.from("liitteet").delete().eq("id", l.id);
  if (error) throw error;
  await sb.storage.from(BUCKET).remove([l.polku]);
}

export async function poistaHuomionTiedostot(huomioId) {
  const { data } = await sb.from("liitteet").select("polku").eq("huomio_id", huomioId);
  if (data?.length) await sb.storage.from(BUCKET).remove(data.map((x) => x.polku));
}

const kuvako = (l) => /^image\//.test(l.mime || "") || /\.(png|jpe?g|gif|webp|heic)$/i.test(l.nimi);
const koko = (b) => (b == null ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} Mt` : `${Math.max(1, Math.round(b / 1024))} kt`);
const paate = (n) => (n.match(/\.([a-z0-9]{2,4})$/i)?.[1] || "tiedosto").toUpperCase();

export function liitteetHtml(lista = [], { muokattava = false } = {}) {
  if (!lista.length) return "";
  return `<ul class="liitteet">${lista.map((l) => `<li class="${kuvako(l) ? "kuvaliite" : "tiedostoliite"}">
    <a data-polku="${esc(l.polku)}" target="_blank" rel="noopener" download="${esc(l.nimi)}">
      ${kuvako(l) ? `<img alt="${esc(l.nimi)}" data-kuva="${esc(l.polku)}">` : `<span class="paate">${esc(paate(l.nimi))}</span>`}
      <span class="l-nimi">${esc(l.nimi)}</span><span class="pieni">${koko(l.koko)}</span></a>
    ${muokattava && (l.lisaaja === omaEmail() || tila.admin) ? `<button class="linkkinappi" data-poista-liite="${l.id}">Poista</button>` : ""}
  </li>`).join("")}</ul>`;
}

// Hakee allekirjoitetut osoitteet näkyville liitteille (voimassa tunnin).
export async function aktivoiLiitteet(el) {
  const linkit = $$("a[data-polku]:not([href])", el);
  if (!linkit.length) return;
  const polut = [...new Set(linkit.map((a) => a.dataset.polku))];
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(polut, 3600);
  const url = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  linkit.forEach((a) => {
    const u = url.get(a.dataset.polku); if (!u) return;
    a.href = u;
    const img = a.querySelector("img[data-kuva]"); if (img) img.src = u;
  });
}

// Tiedostokenttä + vedä ja pudota. Palauttaa funktion, joka antaa valitut tiedostot.
export function tiedostoValitsin(el) {
  let valitut = [];
  el.innerHTML = `<label class="liita"><input type="file" multiple accept="${HYVAKSY}"><span>Liitä tiedosto</span></label><span class="valitut pieni"></span>`;
  const input = el.querySelector("input"), nayta = el.querySelector(".valitut");
  const paivita = () => (nayta.textContent = valitut.length ? valitut.map((f) => f.name).join(", ") : "");
  input.onchange = () => { valitut = [...valitut, ...input.files]; input.value = ""; paivita(); };
  const kohde = el.closest("form") || el;
  kohde.addEventListener("dragover", (e) => { e.preventDefault(); kohde.classList.add("pudota"); });
  kohde.addEventListener("dragleave", () => kohde.classList.remove("pudota"));
  kohde.addEventListener("drop", (e) => { e.preventDefault(); kohde.classList.remove("pudota"); valitut = [...valitut, ...e.dataTransfer.files]; paivita(); });
  kohde.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { valitut = [...valitut, ...f]; paivita(); } });
  return { tiedostot: () => valitut, tyhjenna: () => { valitut = []; paivita(); } };
}
