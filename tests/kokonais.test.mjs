import { test } from "node:test";
import assert from "node:assert/strict";
import { pelaajanTulokset, normi, tPiste, ryhmanNormit, profiili, aariarvot, rajaa } from "../js/kokonaisydin.js";

const T = {
  "30m": { pienempi_parempi: true, alaluokka: "Pikanopeus" },
  "10m": { pienempi_parempi: true, alaluokka: "Pikanopeus" },
  cooper: { pienempi_parempi: false, alaluokka: "Kestävyys" },
  lentava20: { pienempi_parempi: true, alaluokka: "Pikanopeus", johdettu: true },
};
const r = (pelaaja, testi, arvo, pvm) => ({ pelaaja, testi, arvo, pvm });
const R = [
  r("a", "30m", 4.3, "2026-04-01"), r("a", "30m", 4.2, "2025-10-01"), r("a", "cooper", 2800, "2026-04-01"), r("a", "lentava20", 2.5, "2026-04-01"),
  r("b", "30m", 4.5, "2026-04-01"), r("b", "cooper", 2600, "2026-04-01"),
  r("c", "30m", 4.4, "2026-04-01"), r("c", "cooper", 2700, "2026-04-01"),
  r("d", "30m", 4.6, "2026-04-01"),
];

test("viimeisin vs paras, johdettu pois", () => {
  const v = pelaajanTulokset(R, "a", T, "viimeisin");
  assert.equal(v.get("30m").arvo, 4.3);
  assert.equal(v.has("lentava20"), false);
  assert.equal(pelaajanTulokset(R, "a", T, "paras").get("30m").arvo, 4.2);
  assert.equal(pelaajanTulokset(R, "a", T, "paras", (x) => x.pvm >= "2026-01-01").get("30m").arvo, 4.3);
});

test("normi ja T-piste, suunta", () => {
  assert.equal(normi([1, 2]), null);
  assert.equal(normi([2, 2, 2]), null);
  const n = normi([2600, 2700, 2800]);
  assert.equal(n.ka, 2700); assert.equal(n.sd, 100); assert.equal(n.pieni, true);
  assert.equal(tPiste(2800, n, false), 60);
  assert.equal(tPiste(2800, n, true), 40);
  assert.equal(tPiste(null, n, false), null);
  assert.equal(rajaa(95), 80); assert.equal(rajaa(10), 20);
});

test("ryhmän normit ja karki", () => {
  const N = ryhmanNormit(R, ["a", "b", "c", "d"], T, "viimeisin");
  assert.equal(N.get("30m").n, 4);
  assert.ok(Math.abs(N.get("30m").karki - 4.4) < 1e-9);   // 4.3, 4.4, 4.5
  assert.equal(N.get("cooper").karki, 2700);
});

test("profiili ja kokonaisindeksi", () => {
  const N = ryhmanNormit(R, ["a", "b", "c", "d"], T, "viimeisin");
  const p = profiili(pelaajanTulokset(R, "a", T, "viimeisin"), N, T);
  const kest = p.ominaisuudet.find((o) => o.nimi === "Kestävyys");
  assert.equal(kest.T, 60);
  const pika = p.ominaisuudet.find((o) => o.nimi === "Pikanopeus");
  assert.ok(pika.T > 50);
  assert.ok(Math.abs(p.indeksi - (kest.T + pika.T) / 2) < 1e-9);
  assert.equal(aariarvot(p).vahvin.nimi, pika.T > 60 ? "Pikanopeus" : "Kestävyys");
});
