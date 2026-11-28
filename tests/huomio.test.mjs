import { test } from "node:test";
import assert from "node:assert/strict";
import { tarvitseeHuomiota, laasnaolo, suunnitelma, kuorma, kirjaukset, tavoitteet, missio, testikehitys, pisteet, sanallinen, ryhmaT } from "../js/huomioydin.js";

const T = "2026-11-28";
test("läsnäolo ja suunnitelma", () => {
  assert.equal(laasnaolo(80, 10).tila, "vihr"); assert.equal(laasnaolo(65, 10).tila, "kelt"); assert.equal(laasnaolo(40, 10).tila, "pun"); assert.equal(laasnaolo(40, 2).tila, "ei");
  assert.equal(suunnitelma(10, 9).tila, "vihr"); assert.equal(suunnitelma(10, 5).tila, "pun"); assert.equal(suunnitelma(2, 0).tila, "ei");
});
test("kuorma ja kirjaukset", () => {
  assert.equal(kuorma(null, 2).tila, "ei"); assert.equal(kuorma(1.0, 2).tila, "vihr"); assert.equal(kuorma(1.6, 1).tila, "kelt");
  assert.equal(kuorma(1.6, 0).tila, "pun"); assert.equal(kuorma(2.0, 2).tila, "pun"); assert.equal(kuorma(0.5, 3).tila, "kelt");
  assert.equal(kirjaukset("2026-11-27", T).tila, "vihr"); assert.equal(kirjaukset("2026-11-18", T).tila, "kelt"); assert.equal(kirjaukset("2026-11-01", T).tila, "pun"); assert.equal(kirjaukset(null, T).tila, "pun");
});
test("tavoitteet: odottaa testiä ei ole punainen", () => {
  assert.equal(tavoitteet([], T).tila, "ei");
  assert.equal(tavoitteet([{ luotu: "2026-10-01", takaraja: "2027-05-01", saavutettu: false, pct: 0, tuloksiaJalkeen: false }], T).tila, "odottaa");
  assert.equal(tavoitteet([{ luotu: "2026-10-01", takaraja: "2026-11-01", saavutettu: false, pct: 50, tuloksiaJalkeen: true }], T).tila, "pun");
  assert.equal(tavoitteet([{ luotu: "2026-10-01", takaraja: "2026-12-01", saavutettu: false, pct: 10, tuloksiaJalkeen: true }], T).tila, "kelt");
  assert.equal(tavoitteet([{ saavutettu: true, luotu: "2026-10-01" }], T).tila, "vihr");
});
test("missio ja testikehitys", () => {
  assert.equal(missio([]).tila, "ei");
  assert.equal(missio([{ tehty: 500, odotettu: 400 }]).tila, "vihr");
  assert.equal(missio([{ tehty: 300, odotettu: 400 }]).tila, "kelt");
  assert.equal(missio([{ tehty: 100, odotettu: 400 }]).tila, "pun");
  assert.equal(testikehitys([{ z: 0.5 }, { z: -0.1 }]).tila, "vihr");
  assert.equal(testikehitys([{ z: -0.5 }, { z: -0.3 }, { z: -0.4 }, { z: 0.3 }]).tila, "pun");
  assert.equal(testikehitys([{ z: -0.5 }, { z: -0.3 }, { z: 0.3 }]).tila, "kelt");
  assert.equal(tarvitseeHuomiota({ a: { tila: "pun" }, kuorma: { tila: "vihr" } }), false);
  assert.equal(tarvitseeHuomiota({ a: { tila: "pun" }, b: { tila: "pun" } }), true);
  assert.equal(tarvitseeHuomiota({ kuorma: { tila: "pun" } }), true);
  assert.equal(pisteet({ a: { tila: "pun" }, b: { tila: "kelt" }, c: { tila: "vihr" } }), 4);
});
test("sanallinen: lajitaito vahva, fysiikka heikko", () => {
  const luokat = { lyonti_koppi: "lajitaito", napy: "lajitaito", cooper: "fysiikka", kyykky: "fysiikka", "30m": "nopeus" };
  const testit = [{ testi: "lyonti_koppi", T: 62 }, { testi: "napy", T: 58 }, { testi: "cooper", T: 40 }, { testi: "kyykky", T: 42 }, { testi: "30m", T: 50 }];
  assert.equal(Math.round(ryhmaT(testit, luokat).lajitaito.T), 60);
  const l = sanallinen({ etunimi: "Elias", indeksi: 50, testit, luokat, nimet: { cooper: "Cooper" }, ryhmaNimi: "MSU" });
  const teksti = l.join(" ");
  assert.match(teksti, /vahvuus on lajitaito/);
  assert.match(teksti, /fysiikka jää selvästi jälkeen/);
  assert.match(teksti, /painopisteeksi kannattaa nostaa fysiikka/);
  assert.match(teksti, /Cooper \(40\)/);
});
