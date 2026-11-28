# Kehittyneet – eniten parantaneet pelaajat (design, 28.11.2026)

## Miksi
Valmennus haluaa testipäivän jälkeen nähdä yhdellä silmäyksellä, kuka paransi eniten edelliseen testikertaansa verrattuna. Muutos näkyy jo Testit-sivun rivien perässä, mutta ei omana lajiteltuna listana.

## Tavoitteet
- Oma näkymä Testit-osion alla (sivupalkissa Testit → Kehittyneet), nykyiset näkymät ennallaan.
- Testi kerrallaan (Jugin valinta A): valitaan testi ja ryhmä (Superpesis / Juniorit + ikäluokka).
- Jokaisen pelaajan viimeisin testikerta vs. hänen edellinen testikertansa samassa testissä, lajiteltu muutoksen mukaan (eniten parantanut ylimpänä).
- Toimii myös puhelimella vaikuttamatta selainversioon.

## Ei nyt
- Analyysisivu (myöhemmin).
- Kaikki testit samalla listalla prosentteina (vaihtoehto B, voidaan lisätä myöhemmin valinnaksi).
- Pelaajille näkyvä versio.

## Vaihtoehdot
- **A. Testi kerrallaan** – valittu. Luvut testin omissa yksiköissä, helppo lukea.
- B. Kaikki testit samalla listalla %-muutoksena – sekavampi, sama pelaaja monta kertaa.
- C. Pelaajakohtainen keskimääräinen parannus – tiivis, mutta yksittäiset testit piiloon.

## Ratkaisut (Clauden ehdotukset, Jugi voi korjata)
- Kerran tulos = kerran paras, samalla logiikalla kuin Testit-sivulla (juoksutYhteen: 30 m:n piikkiajat ja NOK-juoksut mukana; pienempi parempi käännetään oikein päin).
- Rajaus "Viimeisin testi": oletus = ryhmän viimeisin testipäivä tässä testissä (esim. tänään juosseet); valinnat: tämä testijakso (syksy/kevät), kaikki.
- Rivillä: sija, pelaaja (linkki pelaajakortille), syntymävuosi, viimeisin tulos + pvm, edellinen + pvm, muutos (yksikkö ja %), väli kuukausina – merkintä, jos edellisestä yli 12 kk.
- Heikentyneet listan lopussa punaisella, parantaneet vihreällä. Pelaajat, joilla vasta yksi testikerta, erikseen "ei vertailukohtaa".
- Näkyvyys: valmennuksen valikot (Master-valmennus ja PSU). PSU näkee vain juniorit kuten nyt (rajaus tietokannassa).
- Ohje-sivulle oma osio (#/ohje/kehittyneet), versiotunniste nostetaan.

## Rakentajalle jää
Ulkoasun yksityiskohdat Keskuksen nykyisen tyylin mukaan, tiedostojako (oma js/views/kehittyneet.js).
