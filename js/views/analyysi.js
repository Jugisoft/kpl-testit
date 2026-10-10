// Analyysi: KPL sarjan rinnalla, linkit YDIN-analytiikkaan ja tulossa olevat työkalut.
import { $, esc } from "../util.js";
import { haeSiirtomarkkinat, haeKoosteet, aikaSitten } from "../keskus.js";

const YDIN = "https://jugisoft.github.io/ydin-2027/";

export async function nayta(main) {
  const [d, koosteet] = await Promise.all([haeSiirtomarkkinat(), haeKoosteet()]);
  const v = d?.vaikutus || [];
  const vertailu = (kentta) => {
    const r = v.filter((x) => typeof x[kentta] === "number").sort((a, b) => b[kentta] - a[kentta]);
    const max = Math.max(...r.map((x) => x[kentta]), 1);
    const sija = r.findIndex((x) => x.Joukkue === "KPL") + 1;
    return { sija, n: r.length, html: r.map((x) => `<div class="pylvas-rivi${x.Joukkue === "KPL" ? " oma" : ""}"><span>${esc(x.Joukkue)}</span><span class="pylvas"><span style="width:${(x[kentta] / max) * 100}%"></span></span><span class="num">${x[kentta]}</span></div>`).join("") };
  };
  const yht = vertailu("Joukkueen YHT 2026"), kl = vertailu("Joukkueen KL 2026");

  main.innerHTML = `
    <h1>Analyysi</h1>
    <p class="ingressi">Kauden 2027 otteluanalyysit tulevat tänne, kun pelit alkavat. Siihen asti pohjana ovat kauden 2026 luvut ja valmennuksen tietopankki.</p>

    ${v.length ? `<h2>KPL:n sisäpeli 2026 sarjan rinnalla</h2>
    <div class="kaksi-saraketta">
      <section class="paneeli"><h3>Juoksut yhteensä (YHT)</h3><p class="pieni">KPL ${yht.sija}. / ${yht.n}. Kunnarit + lyödyt + tuodut, runkosarja 2026.</p><div class="pylvaat">${yht.html}</div></section>
      <section class="paneeli"><h3>Onnistuneet kärkilyönnit (KL)</h3><p class="pieni">KPL ${kl.sija}. / ${kl.n}. Etenijän saaminen seuraavalle pesälle lyönnillä.</p><div class="pylvaat">${kl.html}</div></section>
    </div>
    <p class="vihje">Nousijoiden (Ura, PuMu) luvut ovat Ykköspesiksestä eivätkä ole suoraan vertailukelpoisia. Joukkueiden kokoonpanot ovat muuttuneet, katso <a href="#/siirtomarkkinat">Siirtomarkkinat</a>.</p>` : ""}

    <h2>Tietopankki</h2>
    ${koosteet.length ? `<ul class="linkkilista">${koosteet.slice(0, 8).map((k) => `<li><a href="#/huomiot">${esc(k.otsikko)}</a><span class="pieni">${k.huomioita} huomiota, päivitetty ${aikaSitten(k.paivitetty)}</span></li>`).join("")}</ul>`
      : `<p>Koosteita ei vielä ole. Ne syntyvät, kun <a href="#/huomiot">huomioita</a> kirjataan.</p>`}

    <h2>YDIN-analytiikka</h2>
    <p>Koko sarjan tilastot ja analyysit pesistulokset.fi:n datasta. Julkinen sivusto, avautuu uuteen välilehteen.</p>
    <ul class="linkkilista">
      <li><a href="${YDIN}kausi-2026.html" target="_blank" rel="noopener">Kausi 2026</a><span class="pieni">Sarjataulukko, tunnusluvut ja kauden kulku</span></li>
      <li><a href="${YDIN}joukkueet.html" target="_blank" rel="noopener">Joukkueet</a><span class="pieni">Joukkuekohtaiset sisä- ja ulkopelin luvut</span></li>
      <li><a href="${YDIN}pelaajat.html" target="_blank" rel="noopener">Pelaajat</a><span class="pieni">Pelaajakortit ja vertailu</span></li>
      <li><a href="${YDIN}lukkarit.html" target="_blank" rel="noopener">Lukkarit</a><span class="pieni">Lukkareiden tunnusluvut</span></li>
      <li><a href="${YDIN}vertailu.html" target="_blank" rel="noopener">Vertailu</a><span class="pieni">Kaksi joukkuetta tai pelaajaa rinnakkain</span></li>
    </ul>

    <h2>Työn alla</h2>
    <ul class="tulossa">
      <li><strong>Juoksuodotus pesätilanteittain.</strong> Montako juoksua vuorosta keskimäärin syntyy, kun pesillä on tietty tilanne ja paloja tietty määrä. Pohja lyöjäjärjestyksen, jokerien ja kärkilyönnin riskin arviointiin.</li>
      <li><strong>Vastustajakortit.</strong> Lyöjät, nopeudet, lyöntisuunnat ja merkkiprofiili yhdellä sivulla ottelupäivää varten.</li>
      <li><strong>Merkinmurtaja.</strong> Vastustajan viuhkamerkkien analyysi videolta kirjatuista havainnoista.</li>
    </ul>`;
}
