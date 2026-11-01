// KPL Keskus: valmennuksen aloitusnäkymä kopin koneelle.
import { sb, tila } from "../db.js";
import { $, $$, esc, pvm, ilmoita } from "../util.js";
import { haeHuomiot, haeSiirtomarkkinat, lataaNimet, md, AIHEOSIOT, JOUKKUEET, osioNimi, huomionOsio, tallennaMuistiinpano, kirjoittajanNimi, aikaSitten, omaEmail } from "../keskus.js";

let kanava = null;
let valittuOsio = "idea";
export function poistu() { if (kanava) { sb.removeChannel(kanava); kanava = null; } }

const rivi = (h) => `<li><a class="tuore" href="#/huomio/${h.id}">
  <span class="t-osio">${esc(osioNimi(huomionOsio(h)))}${h.tyyppi === "ottelumuistio" ? " · muistio" : ""}</span>
  <strong>${esc(h.otsikko)}</strong>
  <span class="pieni">${esc(kirjoittajanNimi(h.kirjoittaja))}, ${aikaSitten(h.luotu)}</span></a></li>`;

export async function nayta(main) {
  await lataaNimet();
  const [kaikki, sm] = await Promise.all([haeHuomiot(), haeSiirtomarkkinat().catch(() => null)]);
  const huomiot = kaikki.filter((h) => h.tyyppi !== "lyonti" && h.tyyppi !== "ulkopeli");
  const spJoukkue = tila.joukkueet.find((j) => /superpesis/i.test(j.nimi));
  const spKerrat = tila.kerrat.filter((k) => spJoukkue && k.joukkue_id === spJoukkue.id);
  const kpl = sm?.vaikutus?.find((v) => v.Joukkue === "KPL");
  const uutiset = (sm?.tarkeimmat || "").split("\n").filter((l) => l.trim().startsWith("-")).slice(0, 4).join("\n");
  const [{ count: kuvioita }, { count: pelaajia }] = await Promise.all([
    sb.from("pelikirja").select("id", { count: "exact", head: true }).eq("tyyppi", "kuvio"),
    sb.from("vastustajapelaajat").select("id", { count: "exact", head: true }).eq("aktiivinen", true).neq("joukkue", "KPL"),
  ]);
  const h = new Date().toLocaleString("fi-FI", { hour: "numeric", timeZone: "Europe/Helsinki" }) | 0;
  const tervehdys = h < 5 ? "Hyvää yötä" : h < 10 ? "Huomenta" : h < 17 ? "Päivää" : "Iltaa";
  const etunimi = (kirjoittajanNimi(omaEmail()) || "").split(" ")[0];
  // Tervehdyksen luku: vain valmentajien omat kirjaukset (ei Jarvisin profiileja tai muita automaattisia)
  const tuoreet = huomiot.filter((x) => Date.now() - new Date(x.luotu) < 7 * 864e5);
  const viikko = tuoreet.filter((x) => x.kirjoittaja !== "ai" && x.tyyppi !== "profiili").length;
  const profiileja = tuoreet.filter((x) => x.tyyppi === "profiili").length;
  const vastustajat = JOUKKUEET.filter((j) => j !== "KPL");
  const chip = (o) => `<button type="button" class="chip" data-osio="${o}" aria-pressed="${o === valittuOsio}">${esc(osioNimi(o))}</button>`;

  main.innerHTML = `
    <section class="etusivu-hero">
      <div class="hero-kuva" aria-hidden="true"></div>
      <div class="hero-sisalto">
        <div class="hero-tunnus"><img src="img/kpl-logo-192.png" alt="Kouvolan Pallonlyöjät" width="76" height="76"><span>Kouvolan Pallonlyöjät<br><b>Superpesis 2027</b></span></div>
        <h1>${esc(tervehdys)}${etunimi ? `, ${esc(etunimi)}` : ""}.</h1>
        <p class="hero-ala">${viikko ? `Valmennus on kirjannut viimeisen 7 päivän aikana ${viikko} ${viikko === 1 ? "uuden muistiinpanon" : "uutta muistiinpanoa"}.` : "Tervetuloa valmennuksen keskukseen. Kaikki muistiinpanot, kuviot ja tiedot yhdessä paikassa."}${profiileja ? ` Jarvis on tehnyt ${profiileja} ${profiileja === 1 ? "uuden pelaajaprofiilin" : "uutta pelaajaprofiilia"} kommentoitavaksi.` : ""}</p>
      </div>
      <form id="pika" class="pikakirjaus">
        <label for="pika-teksti" class="pika-otsikko">Mitä huomasit?</label>
        <textarea id="pika-teksti" name="teksti" rows="3" required placeholder="Kirjoita ajatus tai havainto. Ensimmäinen rivi on otsikko."></textarea>
        <div class="osiovalinta" role="group" aria-label="Osio">
          ${[...(tila.valmennus ? ["valmennus"] : []), ...AIHEOSIOT.filter((o) => o !== "muu")].map(chip).join("")}<span class="erotin" aria-hidden="true"></span>${JOUKKUEET.map(chip).join("")}
        </div>
        <div class="rivi"><button class="btn ensisij" type="submit">Tallenna</button><span class="pieni vihje-nappain">Ctrl + Enter tallentaa</span></div>
      </form>
    </section>

    <nav class="pikalinkit" aria-label="Pääosiot">
      <a href="#/muistio"><span class="pl-nimi">Muistio</span><span class="pl-luku num">${huomiot.length}</span><span class="pl-ala">muistiinpanoa ja ottelumuistiota</span></a>
      <a href="pelikirja.html?v=20261101-14"><span class="pl-nimi">Pelikirja</span><span class="pl-luku num">${kuvioita ?? "–"}</span><span class="pl-ala">ulkopelin kuviota</span></a>
      <a href="#/muistio/vastustajat"><span class="pl-nimi">Vastustajat</span><span class="pl-luku num">${pelaajia ?? "–"}</span><span class="pl-ala">pelaajaa ${vastustajat.length} joukkueesta</span></a>
      <a href="#/siirtomarkkinat"><span class="pl-nimi">Siirtomarkkinat</span><span class="pl-luku num">${sm?.siirrot?.length ?? "–"}</span><span class="pl-ala">siirtoa ja lähtöä kaudelle 2027</span></a>
      <a href="#/testit/superpesis"><span class="pl-nimi">Testit</span><span class="pl-luku num">${spKerrat.length}</span><span class="pl-ala">${spKerrat.length ? `edustuksen testikertaa, viimeisin ${pvm(spKerrat[0].pvm)}` : "edustuksen testikertaa"}</span></a>
    </nav>

    <div class="keskus-ruudukko">
      <section>
        <div class="osio-paa"><h2>Viimeisimmät muistiinpanot</h2><a href="#/muistio">Avaa muistio</a></div>
        <ol class="tuoreet" id="tuoreet">${huomiot.slice(0, 8).map(rivi).join("") || `<li class="tyhja">Ei vielä muistiinpanoja. Kirjoita ensimmäinen yllä olevaan kenttään.</li>`}</ol>
      </section>

      <aside class="k-sivu">
        <section class="paneeli">
          <div class="osio-paa"><h2>Siirtomarkkinoilla</h2><a href="#/siirtomarkkinat">Kaikki</a></div>
          ${kpl ? `<p class="kpl-netto">KPL <span class="num">${kpl.Tulleet}</span> tullut <span class="num">${kpl.Lähteneet}</span> lähtenyt</p>` : ""}
          ${uutiset ? `<div class="md uutislista tiivis">${md(uutiset)}</div>` : `<p class="pieni">Tietoja ei vielä viety.</p>`}
          ${sm?.tilannekatsaus_paivitetty ? `<p class="pieni">Päivitetty ${esc(sm.tilannekatsaus_paivitetty)}</p>` : ""}
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
      if (huomiot.some((x) => x.id === m.new.id) || m.new.tyyppi === "lyonti" || m.new.tyyppi === "ulkopeli") return;
      huomiot.unshift(m.new);
      $("#tuoreet").innerHTML = huomiot.slice(0, 8).map(rivi).join("");
    }).subscribe();
}
