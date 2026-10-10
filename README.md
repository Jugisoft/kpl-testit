# KPL Keskus

Kouvolan Pallonlyöjien valmennuksen keskus: huomiot ja tietopankki (AI-sparraaja), siirtomarkkinat, analyysi, testit ja pelikirja. Sivu: https://jugisoft.github.io/kpl-testit/

- **Keskus (valmentajille, etusivu kirjautuneena):** pikakirjaus, tuoreimmat huomiot, siirtomarkkinat, testit.
- **Huomiot (`#/huomiot`, `#/huomio/:id`):** taulut `huomiot`, `huomio_kommentit`, `koosteet`. Uusi huomio kutsuu edge functionia `keskus-ai`, joka kommentoi huomion ja päivittää aiheen koosteen (vaatii salaisuuden `ANTHROPIC_API_KEY`; ilman sitä AI on pois päältä). Reaaliaikainen päivitys.
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
