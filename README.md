# KPL Keskus

Kouvolan Pallonlyöjien valmennuksen keskus: muistio, siirtomarkkinat, analyysi, testit ja pelikirja. Sivu: https://jugisoft.github.io/kpl-testit/

- **Keskus (valmentajille, etusivu kirjautuneena):** pikakirjaus, viimeisimmät muistiinpanot, siirtomarkkinat, testit.
- **Muistio (`#/muistio/:osio[/:välilehti]`, `#/huomio/:id`):** OneNote-tyyliset muistiinpanot osioittain (aiheet ja joukkueet), ensimmäinen rivi = otsikko. Joukkueosiossa välilehdet muistiinpanot, pelaajat ja ottelumuistiot. Taulut `huomiot` (tyyppi: muistiinpano / lyonti / ulkopeli / ottelumuistio, `pelaaja_id`, `tiedot` jsonb, `ottelu_pvm`), `huomio_kommentit`, `koosteet`. Koosteet ja Jarvis-kommentit (`ai = true`) kirjoittaa Jarvis pyynnöstä.
- **Pelaajasivu (`#/vp/:id[/lyonnit|ulkopeli|muistiinpanot]`):** taulu `vastustajapelaajat` (kokoonpanot 2027 tuotu siirtomarkkinoista). Lyönnit tilanteittain kentälle (x/y metreinä, kenttä Pelikirjan mitoista `js/kentta.js`), ulkopelin painon suunta, muistiinpanot.
- **Liitteet:** yksityinen Storage-bucket `liitteet` (max 25 Mt/tiedosto), taulu `liitteet`; vain valmentajat, linkit allekirjoitettuina (1 h).
- **Siirtomarkkinat (`#/siirtomarkkinat`):** taulu `siirtomarkkinat` (yksi jsonb-rivi). Jarvis vie datan vaultista skriptillä `vie_portaaliin.py` → edge function `keskus-vienti` (avaimen sha256 taulussa `vientiavaimet`).
- **Analyysi (`#/analyysi`):** KPL sarjan rinnalla 2026, tietopankki, linkit YDIN 2027 -analytiikkaan.

- **Julkinen etusivu:** ikäluokkien kehitys ilman nimiä (`julkinen_yhteenveto()`, vähintään 3 pelaajaa / ryhmä).
- **Valmentajille (kirjautuminen):** testikerrat ja tulosten syöttö, testikerran tulokset, pelaajakortit, ryhmäanalyysi, hallinta.
- **Superpesis (valmentajille):** `#/superpesis` – miesten edustuksen tutkatestit (heitot, lyönnit mailoittain) ja lyöntitestit. Ryhmä `Miehet Superpesis` (`joukkueet.julkinen = false`) on rajattu pois julkisista funktioista.
- **Pelikirja (valmentajille, testivaihe):** `pelikirja.html` – ulkopelin fläppitaulu ja yhteinen kuviokirjasto. Kirjautuminen jaettu tämän sivun kanssa; data taulussa `pelikirja` (vain `valmentajat`), vikalista taulussa `pelikirja_vikalista` (valmentajat lukevat ja lisäävät, admin muuttaa tilaa).
- **Tekniikka:** staattinen sivu (HTML + ES-moduulit, ei build-vaihetta), Supabase (Postgres + RLS + Auth), Chart.js.

## Rakenne

| Tiedosto | Sisältö |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Runko, tyylit, reititys ja kirjautuminen |
| `js/db.js` | Supabase-yhteys ja datan lataus |
| `js/util.js` | Muotoilu, parhaat tulokset, kaaviot |
| `js/views/*.js` | Näkymät: koti, kirjaudu, kerrat, syotto, kerta, pelaajat, pelaaja, ryhma, hallinta |

## Tietokanta

Taulut: `joukkueet`, `valmentajat`, `pelaajat`, `testit`, `testikerrat`, `osallistujat`, `tulokset` (yksi rivi = yksi yritys).
Oikeudet: kirjautumaton näkee vain testilistan, testikerrat ja nimettömän yhteenvedon. Nimet ja tulokset näkyvät vain `valmentajat`-taulun sähköposteille.

Julkinen anon-avain sivun koodissa on tarkoituksellinen: kaikki oikeudet hoidetaan tietokannan RLS-säännöillä.
Varmuuskopiot ja keep-alive-ajo ovat erillisessä yksityisessä repossa.
