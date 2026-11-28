# Kehittyneet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Valmennukselle oma näkymä `#/kehittyneet`, jossa testi kerrallaan pelaajat lajitellaan muutoksen mukaan (viimeisin testikerta vs. edellinen).

**Architecture:** Laskenta puhtaana funktiona `js/kehittyneetydin.js` (ei DOM:ia, ei tilaa – testattavissa nodella kuten treenikeskusydin.js). Näkymä `js/views/kehittyneet.js` lataa tulokset samoin kuin testit.js (`lataaTulokset` → `juoksutYhteen` → `parhaatTulokset`, Superpesis/juniorit-jako joukkueen nimestä) ja piirtää listan.

**Tech Stack:** Vanilla ES-moduulit, import map index.html:ssä, Supabase (vain luku), node:test.

**Spec:** `docs/superpowers/specs/2026-11-28-kehittyneet-design.md`

## Global Constraints
- Nykyiset Testit-näkymät eivät muutu. Ei tietokantamuutoksia.
- Mobiilityylit vain `@media`-lohkoon, selainversio ennallaan.
- Versio nostetaan `python3 versio.py`, tarkistus `python3 versio.py --tarkista`.
- Ohje-sivulle osio id `kehittyneet`.
- Julkaisu (push) vasta Jugin luvalla – juoksutestien syöttö kesken.

## Review Focus
- Juoksut (pienempi parempi): parannus positiivinen, kun aika pienenee.
- Pelaaja, jolla vain yksi testikerta → "ei vertailukohtaa", ei listalle.
- Kaksi kertaa samana päivänä (eri testikerrat) → järjestys pvm, sitten kerran luontiaika/id; ei nollamuutoksia virheellisesti.
- Väli > 12 kk → merkintä `vanha: true`.
- Prosenttimuutos, kun edellinen arvo 0 → `pct: null`, ei Infinity.

---

### Task 1: Laskenta `kehittyneet()`

**Files:**
- Create: `js/kehittyneetydin.js`
- Test: `tests/kehittyneet.test.mjs`

**Interfaces:**
- Produces: `kehittyneet(rivit, { pienempiParempi, alkaen = null }) -> { lista, ilmanVertailua }`
  - `rivit`: `[{ pelaaja, kerta, pvm, arvo }]` (yhden testin kerran parhaat)
  - `alkaen`: ISO-pvm; mukaan vain pelaajat, joiden viimeisin pvm ≥ alkaen (null = kaikki)
  - `lista`: `[{ pelaaja, uusi, uusiPvm, vanha, vanhaPvm, ero, pct, kk, vanhaVertailu }]` lajiteltuna `ero` laskevasti (ero > 0 = parani)
  - `ilmanVertailua`: `[{ pelaaja, uusi, uusiPvm }]`
- Produces: `viimeisinPvm(rivit) -> string|null`

- [ ] **Step 1: Kirjoita testit** – 30 m: A 4.36→4.18 (ero 0.18, pct ≈ 4.13), B 4.08→4.11 (ero −0.03) → järjestys [A, B]; pituus (suurempi parempi) 250→262 ero 12; yksi kerta → ilmanVertailua; `alkaen` rajaa; kk-väli 2025-03-29→2026-11-28 → `vanhaVertailu: true`; vanha 0 → pct null.
- [ ] **Step 2:** `node --test tests/` → FAIL (moduuli puuttuu)
- [ ] **Step 3:** Toteuta. Pelaajan kerrat pvm-järjestykseen; viimeisin ja edellinen eri pvm:llä (saman päivän useat kerrat yhdistetään parhaaksi). kk = kuukausiero pyöristettynä.
- [ ] **Step 4:** `node --test tests/` → PASS
- [ ] **Step 5:** Commit `feat: kehittyneet-laskenta`

### Task 2: Näkymä, reitti, valikko, ohje

**Files:**
- Create: `js/views/kehittyneet.js` (`export async function nayta(main, ryhma, testi)`)
- Modify: `app.js` (import, reitti `/^\/kehittyneet(?:\/([a-z]+))?(?:\/([\w-]+))?$/` osio "testit"; valikkorivi "Kehittyneet" Testit-alavalikkoon RYHMAT ja RYHMAT_PSU, poistetaan valikosta kun ei `tila.valmennus || tila.admin || tila.psu`)
- Modify: `index.html` import map (uudet tiedostot), `js/views/ohje.js` (osio kehittyneet), versio

**Interfaces:** Consumes `kehittyneet`, `viimeisinPvm` (Task 1); `muotoile`, `muotoileMuutos`, `pvmLyhyt`, `pelaajaLinkki`, `parhaatTulokset`, `juoksutYhteen` (util.js).

- [ ] **Step 1:** Näkymä: ryhmäsegmentti (sallitutRyhmat), testivalinta pomppuvalikkona (vain testit, joissa ≥2 kertaa jollain pelaajalla), juniorien ikäluokkasuodatin, rajaus Viimeisin testipäivä (oletus) / Tämä jakso / Kaikki. Taulukko: sija, pelaaja + s.vuosi, uusi (pvm), edellinen (pvm), muutos yksikkö + %, väri vihreä/punainen, ⚠ jos > 12 kk. Alla "Ei vertailukohtaa". Ei-valmennus → "Näkymä on valmennukselle".
- [ ] **Step 2:** Reitti, valikko, import map, ohje, `python3 versio.py`.
- [ ] **Step 3:** Tarkistus: `node --test tests/`, `python3 versio.py --tarkista`, `node --check` uusille tiedostoille; paikallinen palvelin + selain (jos saatavilla) näyttää tämän päivän 30 m -listan Hallikainen/Sauvala ym.
- [ ] **Step 4:** Commit `feat: Kehittyneet-näkymä testeihin` (ei pushia ennen lupaa).
