# KPL testit

KPL:n pesäpalloilijoiden talvitestien syöttö ja analyysi. Sivu: https://jugisoft.github.io/kpl-testit/

- **Julkinen etusivu:** ikäluokkien kehitys ilman nimiä (`julkinen_yhteenveto()`, vähintään 3 pelaajaa / ryhmä).
- **Valmentajille (kirjautuminen):** testikerrat ja tulosten syöttö, testikerran tulokset, pelaajakortit, ryhmäanalyysi, hallinta.
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
