// KPL Keskus: valmennuksen aloitusnäkymä kopin koneelle.
import { sb, tila } from "../db.js";
import { $, $$, esc, pvm, ilmoita } from "../util.js";
import { haeHuomiot, haeSiirtomarkkinat, lataaNimet, md, AIHEOSIOT, JOUKKUEET, osioNimi, huomionOsio, tallennaMuistiinpano, kirjoittajanNimi, aikaSitten } from "../keskus.js";

let kanava = null;
let valittuOsio = "idea";
export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

const rivi = (h) => `<li><a class="tuore" href="#/huomio/${h.id}">
  <span class="t-osio">${esc(osioNimi(huomionOsio(h)))}</span>
  <strong>${esc(h.otsikko)}</strong>
  <span class="pieni">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}</span></a></li>`;

export async function nayta(main) {
  await lataaNimet();
  const [huomiot, sm] = await Promise.all([haeHuomiot(), haeSiirtomarkkinat().catch(() => null)]);
  const spJoukkue = tila.joukkueet.find((j) => /superpesis/i.test(j.nimi));
  const spKerrat = tila.kerrat.filter((k) => spJoukkue && k.joukkue_id === spJoukkue.id);
  const kpl = sm?.vaikutus?.find((v) => v.Joukkue === "KPL");
  const uutiset = (sm?.tarkeimmat || "").split("\n").filter((l) => l.trim().startsWith("-")).slice(0, 4).join("\n");
  const chip = (o) => `<button type="button" class="chip" data-osio="${o}" aria-pressed="${o === valittuOsio}">${esc(osioNimi(o))}</button>`;

  main.innerHTML = `
    <section class="kirjaus">
      <h1>Mitä huomasit?</h1>
      <form id="pika" class="pikakirjaus">
        <textarea name="teksti" rows="3" required aria-label="Muistiinpano" placeholder="Kirjoita ajatus tai havainto. Ensimmäinen rivi on otsikko."></textarea>
        <div class="osiovalinta" role="group" aria-label="Osio">
          ${AIHEOSIOT.filter((o) => o !== "muu").map(chip).join("")}<span class="erotin" aria-hidden="true"></span>${JOUKKUEET.map(chip).join("")}
        </div>
        <div class="rivi"><button class="btn ensisij" type="submit">Tallenna</button><span class="pieni vihje-nappain">Ctrl + Enter tallentaa</span></div>
      </form>
    </section>

    <div class="keskus-ruudukko">
      <section>
        <div class="osio-paa"><h2>Viimeisimmät muistiinpanot</h2><a href="#/muistio">Avaa muistio</a></div>
        <ol class="tuoreet" id="tuoreet">${huomiot.slice(0, 8).map(rivi).join("") || `<li class="tyhja">Ei vielä muistiinpanoja. Kirjoita ensimmäinen yllä olevaan kenttään.</li>`}</ol>
      </section>

      <aside class="k-sivu">
        <section class="paneeli">
          <div class="osio-paa"><h2>Siirtomarkkinat</h2><a href="#/siirtomarkkinat">Avaa</a></div>
          ${kpl ? `<p class="kpl-netto">KPL <span class="num">${kpl.Tulleet}</span> tullut <span class="num">${kpl.Lähteneet}</span> lähtenyt</p>` : ""}
          ${uutiset ? `<div class="md uutislista tiivis">${md(uutiset)}</div>` : `<p class="pieni">Tietoja ei vielä viety.</p>`}
          ${sm?.tilannekatsaus_paivitetty ? `<p class="pieni">Päivitetty ${esc(sm.tilannekatsaus_paivitetty)}</p>` : ""}
        </section>
        <section class="paneeli">
          <div class="osio-paa"><h2>Testit</h2><a href="#/superpesis">Edustus</a></div>
          ${spKerrat.length ? `<p>Viimeisin edustuksen testikerta ${pvm(spKerrat[0].pvm)}${spKerrat[0].nimi ? `: ${esc(spKerrat[0].nimi)}` : ""}.</p>` : `<p class="pieni">Edustuksen testikertoja ei vielä ole.</p>`}
          <p class="rivi"><a class="btn" href="#/superpesis">Edustuksen testit</a><a class="btn" href="#/kerrat">Juniorit</a></p>
        </section>
        <section class="paneeli">
          <div class="osio-paa"><h2>Pelikirja</h2></div>
          <p class="pieni">Ulkopelin kuviot ja fläppitaulu.</p>
          <p><a class="btn" href="pelikirja.html">Avaa pelikirja</a></p>
        </section>
      </aside>
    </div>`;

  const form = $("#pika"), ta = form.querySelector("textarea");
  $$(".chip[data-osio]", form).forEach((b) => (b.onclick = () => {
    valittuOsio = b.dataset.osio;
    $$(".chip[data-osio]", form).forEach((x) => x.setAttribute("aria-pressed", x === b));
    ta.focus();
  }));
  ta.onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!ta.value.trim()) return;
    const nappi = form.querySelector("[type=submit]"); nappi.disabled = true;
    try {
      const h = await tallennaMuistiinpano(ta.value, valittuOsio);
      if (!huomiot.some((x) => x.id === h.id)) huomiot.unshift(h);
      ta.value = "";
      ilmoita(`Tallennettu osioon ${osioNimi(valittuOsio)}`);
      $("#tuoreet").innerHTML = huomiot.slice(0, 8).map(rivi).join("");
    } catch (err) { ilmoita("Tallennus epäonnistui: " + err.message, true); }
    finally { nappi.disabled = false; }
  };

  poistu();
  kanava = sb.channel("keskus-huomiot")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "huomiot" }, (m) => {
      if (huomiot.some((x) => x.id === m.new.id)) return;
      huomiot.unshift(m.new);
      $("#tuoreet").innerHTML = huomiot.slice(0, 8).map(rivi).join("");
    }).subscribe();
}
