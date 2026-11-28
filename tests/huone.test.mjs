import { test } from "node:test";
import assert from "node:assert/strict";
import { omatAlueet, nakyyko, tehtavanTila, jarjestaTehtavat, lueTehtavarivi, etsiJasen } from "../js/huoneydin.js";

const admin = { email: "a@x", rooli: "admin", valmennusalue: [] };
const juuso = { email: "j@x", rooli: "valmentaja", valmennusalue: ["sp"] };
const lassi = { email: "l@x", rooli: "psu", valmennusalue: ["psu"] };
const anssi = { email: "an@x", rooli: "valmentaja", valmennusalue: ["psu", "sp"] };

test("omat alueet", () => {
  assert.deepEqual(omatAlueet(admin), ["sp", "psu", "yhteinen"]);
  assert.deepEqual(omatAlueet(juuso), ["sp", "yhteinen"]);
  assert.deepEqual(omatAlueet(anssi), ["psu", "sp", "yhteinen"]);
  assert.deepEqual(omatAlueet({ rooli: "valmentaja", valmennusalue: [] }), []);
  assert.deepEqual(omatAlueet(null), []);
});

test("näkyvyys: alue ja yksityinen", () => {
  const sp = { alue: "sp", kirjoittaja: "j@x" }, psu = { alue: "psu", kirjoittaja: "l@x" };
  const yks = { alue: "sp", yksityinen: true, kirjoittaja: "j@x" };
  assert.equal(nakyyko(sp, juuso), true);
  assert.equal(nakyyko(psu, juuso), false);
  assert.equal(nakyyko(psu, anssi), true);
  assert.equal(nakyyko({ alue: "yhteinen" }, lassi), true);
  assert.equal(nakyyko(yks, juuso), true);
  assert.equal(nakyyko(yks, anssi), false);
  assert.equal(nakyyko(yks, admin), true);
});

test("tehtävän tila ja järjestys", () => {
  const t = "2026-11-28";
  assert.equal(tehtavanTila({ maarapaiva: "2026-11-27" }, t), "myohassa");
  assert.equal(tehtavanTila({ maarapaiva: "2026-11-28" }, t), "tanaan");
  assert.equal(tehtavanTila({ maarapaiva: "2026-12-05" }, t), "pian");
  assert.equal(tehtavanTila({ maarapaiva: "2026-12-20" }, t), "myohemmin");
  assert.equal(tehtavanTila({}, t), "avoin");
  assert.equal(tehtavanTila({ tehty: true, maarapaiva: "2026-01-01" }, t), "tehty");
  const j = jarjestaTehtavat([{ id: 1, tehty: true }, { id: 2 }, { id: 3, maarapaiva: "2026-12-01" }, { id: 4, maarapaiva: "2026-11-01" }], t);
  assert.deepEqual(j.map((x) => x.id), [4, 3, 2, 1]);
});

test("tehtävärivin lukeminen", () => {
  const t = "2026-11-28";
  assert.deepEqual(lueTehtavarivi("- Varaa halli @Juuso 5.12.", t), { teksti: "Varaa halli", vastuuNimi: "Juuso", maarapaiva: "2026-12-05" });
  assert.deepEqual(lueTehtavarivi("- Testipäivä sovitaan 10.1.", t), { teksti: "Testipäivä sovitaan", vastuuNimi: null, maarapaiva: "2027-01-10" });
  assert.deepEqual(lueTehtavarivi("Soita @Anssi Lammila", t), { teksti: "Soita", vastuuNimi: "Anssi Lammila", maarapaiva: null });
  assert.equal(lueTehtavarivi("-   ", t), null);
});

test("vastuuhenkilön haku nimellä", () => {
  const jas = [{ email: "j@x", nimi: "Juuso Ilander" }, { email: "an@x", nimi: "Anssi Lammila" }];
  assert.equal(etsiJasen("juuso", jas).email, "j@x");
  assert.equal(etsiJasen("Anssi Lammila", jas).email, "an@x");
  assert.equal(etsiJasen("Pekka", jas), null);
});
