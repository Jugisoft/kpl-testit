// Yksittäinen huomio: teksti, keskustelu (valmennus + AI-sparraaja), tila ja aiheen kooste.
import { sb, tila } from "../db.js";
import { $, $$, esc, ilmoita } from "../util.js";
import { LUOKAT, TILAT, JOUKKUEET, haeHuomio, lataaNimet, kirjoittajanNimi, aikaSitten, md, luokkaMerkki, pyydaAI, omaEmail } from "../keskus.js";

let kanava = null;
export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

export async function nayta(main, id) {
  await lataaNimet();
  let { huomio: h, kommentit } = await haeHuomio(id);
  if (!h) { main.innerHTML = `<h1>Huomiota ei löydy</h1><p class="ingressi">Se on ehkä poistettu.</p><p><a class="btn" href="#/huomiot">Kaikki huomiot</a></p>`; return; }
  const aihe = h.luokka === "vastustaja" && h.vastustaja ? `vastustaja:${h.vastustaja}` : h.luokka;
  const { data: kooste } = await sb.from("koosteet").select("*").eq("aihe", aihe).maybeSingle();
  const oma = h.kirjoittaja === omaEmail();

  main.innerHTML = `
    <p class="murupolku"><a href="#/huomiot">Huomiot</a></p>
    <article class="huomio-auki">
      <div class="h-paa">${luokkaMerkki(h)}
        <label class="tilavalinta">Tila <select id="tila">${Object.entries(TILAT).map(([k, v]) => `<option value="${k}"${h.tila === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
      <h1 class="h-iso">${esc(h.otsikko)}</h1>
      <p class="h-meta">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${new Date(h.luotu).toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" })}${h.lahde ? `. Lähde: ${esc(h.lahde)}` : ""}</p>
      <div class="md h-teksti">${h.teksti ? md(h.teksti) : `<p class="pieni">Ei lisätekstiä.</p>`}</div>
      ${oma || tila.admin ? `<p class="rivi"><button class="btn pieni-nappi" id="muokkaa">Muokkaa</button><button class="btn pieni-nappi vaara" id="poista">Poista huomio</button></p>` : ""}
    </article>

    <section class="keskustelu" aria-label="Keskustelu">
      <h2>Keskustelu</h2>
      <ol id="kommentit" class="kommentit"></ol>
      <form id="kommentti" class="kommentti-lomake">
        <label class="kentta">Lisää kommentti tai jatkokysymys
          <textarea name="teksti" rows="3" required maxlength="4000" placeholder="Esim. Sama näkyi myös 3.8. videolla, katsotaanko tarkemmin?"></textarea></label>
        <div class="rivi">
          <button class="btn ensisij" type="submit">Lähetä kommentti</button>
          <label class="chip"><input type="checkbox" name="ai" checked>Pyydä AI:lta vastaus</label>
        </div>
      </form>
    </section>

    ${kooste ? `<details class="paneeli kooste" open>
      <summary><span class="k-otsikko">Tietopankki: ${esc(kooste.otsikko)}</span><span class="pieni">päivitetty ${aikaSitten(kooste.paivitetty)}</span></summary>
      <div class="md">${md(kooste.sisalto)}</div></details>` : ""}`;

  const piirraKommentit = () => {
    const odottaa = h.ai_tila === "odottaa" && !kommentit.some((c) => c.ai && c.luotu > (kommentit.filter((x) => !x.ai).at(-1)?.luotu || h.luotu));
    $("#kommentit").innerHTML = kommentit.map((c) => `
      <li class="kommentti${c.ai ? " ai" : ""}">
        <div class="k-kuka">${c.ai ? `<span class="ai-merkki" aria-hidden="true">AI</span>` : ""}<strong>${esc(kirjoittajanNimi(c.kirjoittaja, c.ai))}</strong><span class="pieni">${aikaSitten(c.luotu)}</span>
          ${!c.ai && (c.kirjoittaja === omaEmail() || tila.admin) ? `<button class="linkkinappi" data-poista="${c.id}">Poista</button>` : ""}</div>
        <div class="md">${md(c.teksti)}</div>
      </li>`).join("") +
      (odottaa ? `<li class="kommentti ai odottaa"><div class="k-kuka"><span class="ai-merkki" aria-hidden="true">AI</span><strong>AI-sparraaja</strong></div><p class="ajattelee">Lukee huomion ja aiemmat merkinnät…</p></li>` : "") +
      (h.ai_tila === "pois" ? `<li class="kommentti jarjestelma"><p class="pieni">AI-sparraaja ei ole vielä käytössä. Ylläpitäjä kytkee sen päälle.</p></li>` : "") +
      (h.ai_tila === "virhe" ? `<li class="kommentti jarjestelma"><p class="pieni">AI-sparraaja ei saanut vastausta. <button class="linkkinappi" id="uudelleen">Yritä uudelleen</button></p></li>` : "") +
      (!kommentit.length && !odottaa && h.ai_tila === "valmis" ? `<li class="tyhja">Ei kommentteja.</li>` : "");
    $$("[data-poista]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Poistetaanko kommentti?")) return;
      const { error } = await sb.from("huomio_kommentit").delete().eq("id", b.dataset.poista);
      if (error) return ilmoita(error.message, true);
      kommentit = kommentit.filter((x) => x.id !== b.dataset.poista); piirraKommentit();
    }));
    const u = $("#uudelleen");
    if (u) u.onclick = () => kysyAI();
  };

  const kysyAI = async () => {
    h.ai_tila = "odottaa";
    await sb.from("huomiot").update({ ai_tila: "odottaa" }).eq("id", h.id);
    piirraKommentit();
    const r = await pyydaAI(h.id);
    if (!r.ok && r.syy) { h.ai_tila = /ei ole käytössä/.test(r.syy) ? "pois" : "virhe"; piirraKommentit(); }
  };

  $("#tila").onchange = async (e) => {
    const { error } = await sb.from("huomiot").update({ tila: e.target.value }).eq("id", h.id);
    if (error) ilmoita(error.message, true); else { h.tila = e.target.value; ilmoita(`Tila: ${TILAT[h.tila]}`); }
  };
  $("#kommentti").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), teksti = String(f.get("teksti")).trim();
    if (!teksti) return;
    const nappi = e.target.querySelector("[type=submit]"); nappi.disabled = true;
    const { data, error } = await sb.from("huomio_kommentit").insert({ huomio_id: h.id, teksti }).select().single();
    nappi.disabled = false;
    if (error) return ilmoita(error.message, true);
    if (!kommentit.some((x) => x.id === data.id)) kommentit.push(data);
    e.target.reset(); e.target.querySelector("[name=ai]").checked = true;
    piirraKommentit();
    if (f.get("ai")) kysyAI();
  };
  $("#poista")?.addEventListener("click", async () => {
    if (!confirm("Poistetaanko huomio ja sen keskustelu pysyvästi?")) return;
    const { error } = await sb.from("huomiot").delete().eq("id", h.id);
    if (error) return ilmoita(error.message, true);
    ilmoita("Huomio poistettu"); location.hash = "#/huomiot";
  });
  $("#muokkaa")?.addEventListener("click", () => muokkaa(main, h));

  piirraKommentit();
  poistu();
  kanava = sb.channel("huomio-" + h.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "huomio_kommentit", filter: `huomio_id=eq.${h.id}` }, (m) => {
      if (kommentit.some((x) => x.id === m.new.id)) return;
      kommentit.push(m.new); piirraKommentit();
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "huomiot", filter: `id=eq.${h.id}` }, (m) => {
      h = { ...h, ...m.new }; piirraKommentit();
    }).subscribe();
}

function muokkaa(main, h) {
  const art = $(".huomio-auki", main);
  art.innerHTML = `<form class="huomiolomake" id="muokkaus">
    <label class="kentta laaja">Otsikko<input type="text" name="otsikko" required maxlength="160" value="${esc(h.otsikko)}"></label>
    <label class="kentta">Teksti<textarea name="teksti" rows="8" maxlength="8000">${esc(h.teksti)}</textarea></label>
    <div class="lomake-rivi">
      <label class="kentta">Aihe<select name="luokka">${Object.entries(LUOKAT).map(([k, v]) => `<option value="${k}"${h.luokka === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="kentta">Vastustaja<select name="vastustaja"><option value="">–</option>${JOUKKUEET.map((j) => `<option${h.vastustaja === j ? " selected" : ""}>${j}</option>`).join("")}</select></label>
      <label class="kentta">Keneltä tieto tuli<input type="text" name="lahde" maxlength="120" value="${esc(h.lahde || "")}"></label>
    </div>
    <div class="rivi"><button class="btn ensisij" type="submit">Tallenna muutokset</button><a class="btn" href="#/huomio/${h.id}" id="peru">Peru</a></div></form>`;
  $("#peru").onclick = (e) => { e.preventDefault(); nayta(main, h.id); };
  $("#muokkaus").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (f.get("luokka") === "vastustaja" && !f.get("vastustaja")) return ilmoita("Valitse vastustaja.", true);
    const { error } = await sb.from("huomiot").update({ otsikko: String(f.get("otsikko")).trim(), teksti: String(f.get("teksti")).trim(), luokka: f.get("luokka"), vastustaja: f.get("vastustaja") || null, lahde: String(f.get("lahde")).trim() || null }).eq("id", h.id);
    if (error) return ilmoita(error.message, true);
    ilmoita("Muutokset tallennettu"); nayta(main, h.id);
  };
}
