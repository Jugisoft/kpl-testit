// Ohje (16.10.2026): sivu kerrallaan mitä Keskuksessa on, mitä luvut ja laskurit tarkoittavat, sekä lyhenteet.
// Päivitä tätä, kun sivuja tai laskentaa muutetaan.
import { $, $$, esc } from "../util.js";

const SIVUT = [
  { id: "keskus", nimi: "Keskus", linkki: "#/",
    mita: "Etusivu. Pikakirjaus \"Mitä huomasit?\", viimeisimmät muistiinpanot, siirtomarkkinoiden tärkeimmät uutiset ja pikalinkit pääosioihin.",
    kohdat: [
      ["Pikakirjaus", "Kirjoita havainto ja valitse osio (esim. Ideat, Oma peli tai vastustaja). Ensimmäinen rivi on otsikko. Ctrl + Enter tallentaa."],
      ["Pikalinkkien luvut", "Muistiinpanojen, Pelikirjan kuvioiden, vastustajien pelaajien, siirtojen ja edustuksen testikertojen määrät."],
      ["Tervehdyksen luku", "Valmennuksen omat kirjaukset viimeiseltä 7 päivältä. Jarvisin pelaajaprofiilit mainitaan erikseen."],
    ] },
  { id: "muistio", nimi: "Muistio", linkki: "#/muistio",
    mita: "Valmennuksen muistiinpanot osioittain OneNoten tapaan: Ideat, Oma peli, Merkkipeli, Pelaajat, Muut ja jokainen vastustaja. Jarvisin kooste on osion alussa.",
    kohdat: [
      ["Valmennus-osio", "Valmentajien reflektio omasta joukkueesta. Näkyy vain valmentajille ja ylläpitäjälle, ei pelaajille."],
      ["Jarvisin kooste", "Jarvis kokoaa osion muistiinpanot pyynnöstä: Mitä tiedetään · Hypoteesit (varmuus heikko / kohtalainen / vahva) · Avoimet kysymykset."],
      ["Ottelumuistio", "Päivätty muistio ottelusta. Siihen voi liittää Word-, Excel-, kuva- tai PDF-tiedoston (enintään 25 Mt)."],
      ["Kommentit", "Kortin alle. Jarvisin kommentit näkyvät nimellä Jarvis."],
    ] },
  { id: "vastustajat", nimi: "Vastustajat", linkki: "#/muistio/vastustajat",
    mita: "Muistio → Vastustajat → joukkue. Välilehdet Sisäpeli, Ulkopeli, Muistiinpanot ja Ottelumuistiot. Pelaajan sivulla lyönnit, ulkopelin liikkeet ja Jarvisin pelaajaprofiili.",
    kohdat: [
      ["Suunniteltu rooli", "Missä tilanteessa vastustaja todennäköisesti käyttää pelaajaa, esim. 0-tilanne (kentälle pääsy), 1-tilanne (1-tilanteen purku), jokeri."],
      ["Roolitaulukko", "Koko joukkue: pelaajat × tilanteet. Korostettu ruutu = suunniteltu rooli, luku = kirjatut lyönnit, väri = yleisin lyöntityyppi."],
      ["Ottelulyönnit 2026", "Pelaajan kaikki Superpesis-lyönnit kaudelta 2026 pesistulokset.fi:n ottelutapahtumista. Väri = lopputulos: juoksu/kunnari (vihreä), kärkietenijä eteni (keltainen), palo (punainen), koppi (sininen), haava (violetti), laiton (harmaa, rajojen ulkopuolella), ei edennyt ja muu (tummat). Suodattimet: tilanne (kansiot 0, 1, 2, Takatilanne tai tarkka pesätilanne), palot, monesko lyönti, runkosarja/pudotuspelit. Tulosta napauttamalla sen voi piilottaa. Pisteet ovat pöytäkirjanpitäjän merkitsemiä, likimääräisiä."],
      ["Lyöntikartta", "Jokainen kirjattu lyönti pisteenä kentällä. x = sivusuunta (3-raja − / 2-raja +), y = syvyys kotirajasta metreinä."],
      ["Lyönnin kirjaus", "Tilanne, palot, monesko lyönti, lyöntityyppi ja lopputulos (onnistui / ei / palo / haava) sekä napautus kentälle."],
      ["Ulkopelin liike", "Pelipaikka, tilanne, painon suunta (eteen, taakse, 2-raja, 3-raja, paikallaan) ja sijainti."],
      ["Fläppitaulu", "Vastustajan ulkopelin kuviot tilanteittain: Asetelma ja Syötöstä, raahattavat pelaajat ja nuolet. Muutokset tulevat voimaan vasta Tallenna-napista. Erillään KPL:n omasta Pelikirjasta."],
      ["Pelaajaprofiili ja vikalista", "Jarvisin yhden sivun profiili. Viereen kirjataan korjaukset (sisältö, terminologia, puuttuu, ulkoasu), Jarvis korjaa ja merkitsee korjatuksi. Versionumero kasvaa jokaisesta päivityksestä."],
    ] },
  { id: "kortti", nimi: "Vastustajakortti", linkki: "#/kortti",
    mita: "Tulostettava A4-tiivistelmä yhdestä vastustajasta ottelupäivää varten. Osiot valitaan itse, tyhjät osiot jäävät pois. Valmennus-osion sisältöä ei tule korttiin.",
    kohdat: [
      ["Lyöjätaulukko", "Kokoonpano 2027 ja pelaajien tilastot runkosarjasta 2026: O, K+L, T, YHT, KL% ja tilanteittain KL0–KL3 (0 = kentälle pääsy, 1–3 = kärkilyönti kärkietenijän pesältä)."],
      ["Joukkueen kärkilyönnit vs. sarja", "Joukkueen onnistumis-% tilanteittain sarjan keskiarvoon verrattuna, sekä sisä- että ulkopelissä (ulkopelissä vastustajan onnistuminen sitä vastaan)."],
      ["Nousijat", "Ura ja PuMu pelasivat 2026 Ykköspesistä, joten Superpesis-lukuja ei ole."],
    ] },
  { id: "siirtomarkkinat", nimi: "Siirtomarkkinat", linkki: "#/siirtomarkkinat",
    mita: "Miesten Superpesiksen sopimukset, siirrot ja pelinjohtajat kaudelle 2027. Jarvis päivittää illalla seurojen tiedotteista.",
    kohdat: [
      ["Vaikutuspalkki", "Paljonko joukkueen sisäpelin tuotosta (YHT ja kärkilyönnit, runkosarja 2026) lähti ja tuli siirroissa. Vasemmalle = menetti, oikealle = vahvistui."],
      ["Netto %", "Netto YHT % = (tulleiden YHT − lähteneiden YHT) / joukkueen YHT 2026, Netto KL % samoin kärkilyönneille. Netto yhteensä = näiden keskiarvo, ja arvio (esim. aukko) perustuu siihen. Ykköspesiksestä tulevan luvut kerrotaan tasokertoimella."],
      ["Varmuus", "Vahvistettu = seuran tiedote. Koonti = Supervuoron sopimuskoonti, tarkka päivä ei aina tiedossa. Huhu = ei vahvistettu."],
      ["Rajoitus", "Luvut eivät huomioi pelipaikkaa, ulkopeliä eikä nuorten kehitystä: ne kertovat mittakaavan, eivät joukkueen tasoa."],
    ] },
  { id: "analyysi", nimi: "Analyysi", linkki: "#/analyysi",
    mita: "KPL:n sisäpeli 2026 sarjan rinnalla, linkit YDIN 2027 -analytiikkaan, juoksuodotukseen ja vastustajakortteihin.",
    kohdat: [
      ["YHT-sija", "KPL:n kunnarit + lyödyt + tuodut runkosarjassa 2026 ja sija sarjassa."],
      ["KL-sija", "Onnistuneet kärkilyönnit eli kuinka usein lyönnillä saatiin kärkietenijä seuraavalle pesälle (0-tilanteessa lyöjä kentälle)."],
    ] },
  { id: "juoksuodotus", nimi: "Juoksuodotus", linkki: "#/juoksuodotus",
    mita: "Montako juoksua vuoron loppuun mennessä keskimäärin syntyy tietystä pesätilanteesta ja palomäärästä. Pohjana kauden 2026 otteluiden kaikki lyöntivuorot.",
    kohdat: [
      ["Juoksuodotusmatriisi", "8 pesätilannetta × 0–2 paloa. Luku = keskimääräiset juoksut tilanteesta vuoron loppuun. Näkymät: sarja, joukkue ja joukkueen ero sarjaan (väri kyllästyy ±0,30 juoksun kohdalla)."],
      ["Himmeä solu", "Alle 60 lyöntivuoroa, suuntaa-antava."],
      ["Onnistumisen hyöty / epäonnistumisen hinta", "Paljonko onnistunut kärkilyönti nostaa ja epäonnistunut laskee juoksuodotusta tilanteessa."],
      ["Tarvittava onnistuminen (kynnys)", "Onnistumis-%, jolla kärkilyöntiä yrittävä lyöntivuoro on keskimäärin nollan arvoinen (= hinta / (hyöty + hinta)). Jos lyöjä onnistuu useammin, yrittäminen on keskimäärin plussalla. Lyöjän piste = hänen onnistumis-%:nsa samasta tilanteesta, vähintään 10 yritystä."],
      ["Juoksuarvo", "Lyöntivuoron arvo = juoksuodotus lyöntivuoron jälkeen + lyöntivuoron aikana tehdyt juoksut − juoksuodotus ennen. Keskitetty niin, että sarjan keskimääräinen lyöntivuoro = 0. Yhteensä = lisäarvon määrä, /100 lyöntivuoroa = tehokkuus. Kirjataan lyöjälle, joten etenijöiden ratkaisut ja ulkopelin virheet näkyvät myös siinä."],
      ["Tähti *", "Alle 120 lyöntivuoroa, suuntaa-antava."],
    ] },
  { id: "testit", nimi: "Testit", linkki: "#/testit",
    mita: "Edustuksen ja juniorien testitulokset: testikerrat, tulosten syöttö, pelaajakortit ja ikäluokkavertailut. Luokat: Fysiikka, Lyönti- ja heittovoima, Nopeus, Lajitaito.",
    kohdat: [
      ["Paras tulos", "Pelaajan paras hyväksytty yritys testikerralla. Hylätty (esim. haamu) syötetään h-kirjaimella eikä lasketa."],
      ["Lentävä 20 m", "Laskettu: 30 m aika − 10 m väliaika samasta juoksusta."],
      ["Ikäluokan rengas", "Montako prosenttia saman ikäluokan pelaajista pelaaja ylitti viimeisimmällä testikerralla."],
      ["Indeksi ja T-pisteet", "Pelaajan tulokset muutettuna T-pisteiksi verrattuna vertailuryhmään: 50 = keskitaso, 60 = selvästi yli. Indeksi = T-pisteiden keskiarvo profiilitesteistä (30 m, 10 m, lentävä 20 m, heitot, lyönti). Juoksuissa nopeampi aika = enemmän pisteitä."],
      ["Ikä", "Ikä, jonka pelaaja täyttää talven aikana (talvella 2025–26 vuonna 2009 syntynyt on 17)."],
      ["Ontto piste", "Alle viisi pelaajaa, suuntaa-antava."],
    ] },
  { id: "pelikirja", nimi: "Pelikirja", linkki: "pelikirja.html",
    mita: "KPL:n omat ulkopelin kuviot. Kirjasto tilannekansioittain (0-tilanne, 1-tilanne, 2-tilanne, Takatilanne), variaatiot vapaasti nimettäviä kansion sisällä.",
    kohdat: [
      ["Asetelma / Syötöstä", "Vaihe 1 = pelaajien paikat ennen syöttöä, vaihe 2 = liike syötöstä (nuolet). Toista-nappi animoi."],
      ["Saumat", "Avoin leveys lyöjän silmin mitattuna syvemmän pelaajan linjalla, metreinä."],
      ["Mitat", "Etäisyys kotipesästä (S ja 1V), lähimmästä sivurajasta ja polttolinjasta (2- ja 3-pesän välinen linja: + takana, − edessä)."],
      ["Ulottuvuus", "Kuinka paljon pelaaja ehtii peittää sivusuunnassa. Vaikuttaa saumojen leveyteen."],
      ["Ulkopelikuvio", "Joukkueen nimetty kuvio (esim. Mike = Tahko 2, Tappi, Oulu). Lista muokattavissa kirjastossa."],
      ["Koodisana", "Kutsu kentällä."],
      ["Toisen kuvio", "Muutokset toisen tekemään kuvioon tulevat voimaan vasta, kun tallennat ja vahvistat ne. Omat tallentuvat heti."],
    ] },
  { id: "lyonnit", nimi: "Lyöntipäiväkirja", linkki: "#/lyonnit",
    mita: "Pelaajan oma lyöntipäiväkirja. Pelaaja asettaa missiot ja kirjaa lyöntiensä määrän lajeittain, löi hän yhteisissä treeneissä tai omalla ajalla. Valmentajat näkevät Seuranta-välilehdellä kaikkien edistymisen, mutta eivät muokkaa.",
    kohdat: [
      ["Missio", "Laji, tavoitemäärä ja aikaväli, esim. 2000 lyöntiä pieneen 2-rajaan 31.3. mennessä. Mission edistymiseen lasketaan saman lajin kirjaukset mission aikaväliltä."],
      ["Iso luku / tavoite ja %", "Tehdyt lyönnit / tavoite ja osuus tavoitteesta."],
      ["Edellä / jäljessä aikataulusta", "Tehdyt lyönnit verrattuna tasaiseen tahtiin: tavoite × (kuluneet päivät / mission päivät). Esim. puolivälissä 2000 lyönnin missiota tasainen tahti on 1000."],
      ["Tahti 4 vk", "Lajin lyönnit viimeisen neljän viikon aikana jaettuna neljällä (lyhyemmässä missiossa kuluneilla viikoilla)."],
      ["Tarvitaan /vk", "Jäljellä oleva määrä jaettuna jäljellä olevilla viikoilla. Jos tahti 4 vk on suurempi, tavoite täyttyy nykymenolla."],
      ["Kertymäkäyrä", "Oranssi porrasviiva = kertyneet lyönnit päivittäin, katkoviiva = tasainen tahti alusta tavoitteeseen, pystyviiva = tänään."],
      ["Tällä viikolla / missioiden aikana", "Kaikki kirjatut lyönnit maanantaista alkaen / aikaisimman aktiivisen mission alusta."],
      ["Lyönnit viikoittain", "12 viikkoa, kaikki lajit yhteensä. Vie hiiri pylvään päälle nähdäksesi lajit."],
      ["Lyöntilajit", "Pieni 1-raja, Pieni 2-raja, Keskipieni, Ohitus, Rajakova 1-raja, Rajakova 2-raja, Kumura, Saumaveto, Ilmasauma, Viistari/pystäri, Koppi sekä tarvittaessa Muu laji."],
      ["Seuranta", "Pelaajat, missiot, edistyminen, aikataulu (+/− lyöntiä), lyönnit 4 viikossa ja viimeisin kirjauspäivä. Nimestä aukeaa pelaajan päiväkirja vain luku -tilassa."],
    ] },
];

const LYHENTEET = [
  { ryhma: "Tilastot (pesistulokset.fi)", rivit: [
    ["O", "Ottelut"], ["K", "Kunnarit: lyöjä pääsee omalla lyönnillään kolmospesälle ilman polttoyrityksiä välipesille"],
    ["L", "Lyödyt: lyönnillä kotiin tuodut muut etenijät"], ["K+L", "Kunnarit ja lyödyt, esim. 2+17"],
    ["T", "Tuodut: pelaaja itse juoksi kotiin"], ["YHT", "K + L + T"],
    ["KL", "Onnistuneet kärkilyönnit"], ["KLY", "Kärkilyöntiyritykset"], ["KL%", "Kärkilyöntiprosentti = KL / KLY"],
    ["KL0 / KL%0", "0-tilanne: lyöjä pyrkii kentälle etenijäksi (kentälle pääsy)"],
    ["KL1 / KL%1", "Kärkilyönti 1. pesältä eli 1-tilanteen purku"], ["KL2 / KL%2", "Kärkilyönti 2. pesältä eli 2-tilanteen purku"],
    ["KL3 / KL%3", "Kärkilyönti 3. pesältä eli kotiutus"],
    ["Lähtöpesä", "Pesä, jolla kärkietenijä seisoo lyöntihetkellä. Numerointi viittaa aina siihen."] ] },
  { ryhma: "Tilanteet", rivit: [
    ["0-tilanne", "Kenttäpesillä ei ketään"], ["1-tilanne", "Kärkietenijä ykkösellä"], ["2-tilanne", "Kärkietenijä kakkosella (myös 1–2)"],
    ["Takatilanne", "Etenijä kolmosella (3, 1–3, 2–3, ajolähtö 1–2–3, kotiutus)"], ["Ajolähtö", "Kaikki pesät täynnä, etenijät lähtevät syötöstä"],
    ["Kotiutuskilpailu", "Tasatilanteen ratkaisu: etenijä kolmosella, kolme lyöntiä kotiuttaa"], ["Palot", "Vuoron palot 0–2"] ] },
  { ryhma: "Pelipaikat", rivit: [
    ["L", "Lukkari"], ["S", "Sieppari"], ["1V / 2V / 3V", "Ykkös-, kakkos- ja kolmosvahti"],
    ["2P / 3P", "Kakkos- ja kolmospolttaja"], ["2K / 3K", "2- ja 3-koppari"], ["Ly / E1", "Pelikirjassa vastustajan lyöjä ja etenijä (sininen)"] ] },
  { ryhma: "Lyönnit ja tulokset", rivit: [
    ["Kumura", "Kaarevan lentoradan lyönti"], ["Viistari / pystäri", "Viistomaila- / pystymailalyönti"], ["Sauma", "Lyönti kahden ulkopelaajan väliseen saumaan"],
    ["Onnistui / ei / palo / haava", "Lyönnin lopputulos kirjauksessa: kärkietenijä eteni / ei edennyt / paloi / haavoittui"] ] },
  { ryhma: "Merkinnät", rivit: [
    ["Vahvistettu / koonti / huhu", "Tiedon varmuus siirtomarkkinoilla"], ["Esimerkki", "Pelikirjan esimerkkikuvio, muokkaa vapaasti"],
    ["●", "Pelikirjassa: kuviossa tallentamattomia muutoksia"], ["Suuntaa-antava", "Pieni otos. Juoksuodotuksessa alle 60 lyöntivuoroa, testeissä alle 5 pelaajaa, lyöjävertailuissa alle 10 yritystä"] ] },
];

export async function nayta(main, osio) {
  const sisalto = SIVUT.map((s) => `<section class="oh-sivu" id="oh-${s.id}" data-haku="${esc((s.nimi + " " + s.mita + " " + s.kohdat.flat().join(" ")).toLowerCase())}">
      <div class="oh-paa"><h2>${esc(s.nimi)}</h2><a class="btn oh-avaa" href="${s.linkki}">Avaa sivu</a></div>
      <p class="oh-mita">${esc(s.mita)}</p>
      <dl class="oh-lista">${s.kohdat.map(([t, x]) => `<div data-haku="${esc((t + " " + x).toLowerCase())}"><dt>${esc(t)}</dt><dd>${esc(x)}</dd></div>`).join("")}</dl>
    </section>`).join("");
  const lyh = `<section class="oh-sivu" id="oh-lyhenteet" data-haku="lyhenteet"><div class="oh-paa"><h2>Lyhenteet ja termit</h2></div>
    ${LYHENTEET.map((g) => `<div class="oh-ryhma"><h3>${esc(g.ryhma)}</h3><dl class="oh-lista oh-lyh">${g.rivit.map(([t, x]) => `<div data-haku="${esc((t + " " + x).toLowerCase())}"><dt>${esc(t)}</dt><dd>${esc(x)}</dd></div>`).join("")}</dl></div>`).join("")}</section>`;

  main.innerHTML = `
    <h1>Ohje</h1>
    <p class="ingressi">Mitä Keskuksessa on ja mitä luvut tarkoittavat, sivu kerrallaan. Termit pesistulokset.fi:n mukaan.</p>
    <div class="oh-runko">
      <nav class="oh-sisallys" aria-label="Ohjeen sisällys">
        <input type="search" id="oh-haku" placeholder="Hae termiä, esim. KL% tai tahti" aria-label="Hae ohjeesta">
        ${[...SIVUT, { id: "lyhenteet", nimi: "Lyhenteet ja termit" }].map((s) => `<a href="#/ohje/${s.id}" data-oh="${s.id}">${esc(s.nimi)}</a>`).join("")}
      </nav>
      <div class="oh-sisalto">${sisalto}${lyh}<p class="tyhja" id="oh-eitulos" hidden>Ei osumia.</p></div>
    </div>`;

  const haku = $("#oh-haku");
  haku.oninput = () => {
    const q = haku.value.trim().toLowerCase();
    let osumia = 0;
    $$(".oh-sivu").forEach((s) => {
      const rivit = $$("[data-haku]", s);
      let n = 0;
      rivit.forEach((r) => { const ok = !q || r.dataset.haku.includes(q); r.hidden = !ok; n += ok; });
      const ok = !q || n > 0 || s.dataset.haku.includes(q);
      if (q && n === 0 && ok) rivit.forEach((r) => (r.hidden = false));
      s.hidden = !ok; osumia += ok;
      $$(".oh-ryhma", s).forEach((g) => (g.hidden = !!q && $$("dl > div", g).every((r) => r.hidden)));
    });
    $("#oh-eitulos").hidden = osumia > 0;
  };
  const kohde = osio && document.getElementById("oh-" + osio);
  $$("[data-oh]").forEach((a) => a.setAttribute("aria-current", a.dataset.oh === osio ? "true" : "false"));
  if (kohde) kohde.scrollIntoView({ block: "start" });
}
