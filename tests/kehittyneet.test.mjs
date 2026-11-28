// Aja: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { kehittyneet, viimeisinPvm } from "../js/kehittyneetydin.js";

const r = (pelaaja, pvm, arvo, kerta = pvm) => ({ pelaaja, kerta, pvm, arvo });

test("juoksu: pienempi parempi, lajittelu eniten parantanut ensin", () => {
  const { lista } = kehittyneet([r("A", "2026-04-08", 4.36), r("A", "2026-11-28", 4.18), r("B", "2026-04-08", 4.08), r("B", "2026-11-28", 4.11)], { pienempiParempi: true });
  assert.deepEqual(lista.map((x) => x.pelaaja), ["A", "B"]);
  assert.ok(Math.abs(lista[0].ero - 0.18) < 1e-9);
  assert.ok(Math.abs(lista[0].pct - 4.128) < 0.01);
  assert.ok(Math.abs(lista[1].ero + 0.03) < 1e-9);
  assert.equal(lista[0].vanha, 4.36);
  assert.equal(lista[0].uusiPvm, "2026-11-28");
});

test("suurempi parempi", () => {
  const { lista } = kehittyneet([r("A", "2026-03-01", 250), r("A", "2026-11-01", 262)], { pienempiParempi: false });
  assert.equal(lista[0].ero, 12);
});

test("yksi testikerta → ei vertailukohtaa", () => {
  const { lista, ilmanVertailua } = kehittyneet([r("A", "2026-11-28", 4.2)], { pienempiParempi: true });
  assert.equal(lista.length, 0);
  assert.deepEqual(ilmanVertailua, [{ pelaaja: "A", uusi: 4.2, uusiPvm: "2026-11-28" }]);
});

test("alkaen rajaa viimeisimmän testin mukaan", () => {
  const rivit = [r("A", "2026-04-08", 4.3), r("A", "2026-11-28", 4.2), r("B", "2026-03-01", 4.5), r("B", "2026-04-08", 4.4)];
  const { lista } = kehittyneet(rivit, { pienempiParempi: true, alkaen: "2026-11-28" });
  assert.deepEqual(lista.map((x) => x.pelaaja), ["A"]);
});

test("yli 12 kk väli merkitään", () => {
  const { lista } = kehittyneet([r("A", "2025-03-29", 4.36), r("A", "2026-11-28", 4.18)], { pienempiParempi: true });
  assert.equal(lista[0].vanhaVertailu, true);
  assert.equal(lista[0].kk, 20);
  const b = kehittyneet([r("A", "2026-04-08", 4.3), r("A", "2026-11-28", 4.2)], { pienempiParempi: true }).lista[0];
  assert.equal(b.vanhaVertailu, false);
});

test("edellinen 0 → pct null", () => {
  const { lista } = kehittyneet([r("A", "2026-03-01", 0), r("A", "2026-11-01", 5)], { pienempiParempi: false });
  assert.equal(lista[0].pct, null);
  assert.equal(lista[0].ero, 5);
});

test("saman päivän kaksi kertaa yhdistetään parhaaksi", () => {
  const { lista } = kehittyneet([r("A", "2026-04-08", 4.3, "k1"), r("A", "2026-11-28", 4.25, "k2"), r("A", "2026-11-28", 4.2, "k3")], { pienempiParempi: true });
  assert.equal(lista[0].uusi, 4.2);
  assert.equal(lista[0].vanha, 4.3);
});

test("viimeisinPvm", () => {
  assert.equal(viimeisinPvm([r("A", "2026-04-08", 1), r("B", "2026-11-28", 1)]), "2026-11-28");
  assert.equal(viimeisinPvm([]), null);
});
