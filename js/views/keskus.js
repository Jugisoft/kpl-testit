// KPL Keskus: valmennuksen aloitusnäkymä kopin koneelle.
import { sb, tila } from "../db.js";
import { $, esc, pvm } from "../util.js";
import { haeHuomiot, kommenttimaarat, haeSiirtomarkkinat, lataaNimet, md } from "../keskus.js";
import { lomake, kytkeLomake, huomioRivi } from "./huomiot.js";

let kanava = null;
export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

export async function nayta(main) {
  await lataaNimet();
  const [huomiot, maarat, sm] = await Promise.all([haeHuomiot(), kommenttimaarat(), haeSiirtomarkkinat().catch(() => null)]);
  const spJoukkue = tila.joukkueet.find((j) => /superpesis/i.test(j.nimi));
  const spKerrat = tila.kerrat.filter((k) => spJoukkue && k.joukkue_id === spJoukkue.id);
  const kpl = sm?.vaikutus?.find((v) => v.Joukkue === "KPL");
  const viikko = huomiot.filter((h) => Date.now() - new Date(h.luotu) < 7 * 864e5).length;
  const uutiset = (sm?.tarkeimmat || "").split("\n").filter((l) => l.trim().startsWith("-")).slice(0, 5).join("\n");

  main.innerHTML = `
    <section class="kirjaus">
      <h1>Mitä huomasit?</h1>
      <form id="pika" class="pikakirjaus">${lomake()}</form>
    </section>

    <div class="keskus-ruudukko">
      <section class="k-huomiot">
        <div class="osio-paa"><h2>Tuoreimmat huomiot</h2><a href="#/huomiot">Kaikki ${huomiot.length} huomiota</a></div>
        <p class="pieni">${viikko ? `${viikko} uutta viimeisen viikon aikana.` : "Ei uusia huomioita tällä viikolla."}</p>
        <ol class="huomiolista" id="tuoreet">${huomiot.slice(0, 6).map((h) => huomioRivi(h, maarat.get(h.id))).join("") || `<li class="tyhja">Kirjaa ensimmäinen huomio yllä olevaan kenttään.</li>`}</ol>
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

  kytkeLomake($("#pika"), async (h) => { location.hash = `#/huomio/${h.id}`; });

  poistu();
  kanava = sb.channel("keskus-huomiot")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "huomiot" }, (m) => {
      if (huomiot.some((x) => x.id === m.new.id)) return;
      huomiot.unshift(m.new);
      $("#tuoreet").innerHTML = huomiot.slice(0, 6).map((h) => huomioRivi(h, maarat.get(h.id))).join("");
    }).subscribe();
}
