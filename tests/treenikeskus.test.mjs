// Aja: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { tallennusRpe, naytaRpe, rpeVari, laajennaPaketti, viikonPaivat, viikonpaiva, OLETUSVARIT } from "../js/treenikeskusydin.js";

test("asteikko 1–5 muunnetaan tasavälein 1–10:een", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((x) => tallennusRpe(x, 5)), [2, 4, 6, 8, 10]);
  assert.deepEqual([2, 4, 6, 8, 10].map((x) => naytaRpe(x, 5)), [1, 2, 3, 4, 5]);
});

test("asteikko 1–10 säilyy ja rajataan", () => {
  assert.equal(tallennusRpe(7, 10), 7);
  assert.equal(naytaRpe(7, 10), 7);
  assert.equal(tallennusRpe(12, 10), 10);
  assert.equal(tallennusRpe(0, 5), 2);
  assert.equal(naytaRpe(7, 5), 4); // 3,5 pyöristyy ylös
  assert.equal(naytaRpe(1, 5), 1);
});

test("rasituksen väri pelaajan omista väreistä", () => {
  const oma = { asteikko: 5, varit: ["#111111", "#222222", "#333333", "#444444", "#555555"] };
  assert.equal(rpeVari(6, oma), "#333333");
  assert.equal(rpeVari(10, null), OLETUSVARIT[10][9]);
});

test("viikonpäivä ma=1 … su=7", () => {
  assert.equal(viikonpaiva("2026-11-30"), 1);
  assert.equal(viikonpaiva("2026-12-06"), 7);
});

test("viikkopohja laajenee voimassaolon sisällä ja vain alkaen-päivästä", () => {
  const p = { alku: "2026-11-30", loppu: "2026-12-13", rivit: [{ vp: 1, koodi: "voima1", kesto_min: 60, rpe: 7 }, { vp: 4, koodi: "lenkki", kesto_min: 45, rpe: 4 }] };
  const r = laajennaPaketti(p, "2026-12-02");
  assert.deepEqual(r.map((x) => [x.paiva, x.treeniohjelma]), [["2026-12-03", "lenkki"], ["2026-12-07", "voima1"], ["2026-12-10", "lenkki"]]);
  assert.equal(r[1].viikko, "2026-12-07");
  assert.equal(r[1].kesto_min, 60);
  assert.deepEqual(laajennaPaketti({ ...p, rivit: [] }, "2026-11-30"), []);
});

test("yhteinen ohjelma näkyy vain jaksolla, omat aina, ei tuplia", () => {
  const ohjelma = [
    { id: "y1", paiva: "2026-11-30", joukkue_id: 3, pelaaja_id: null, otsikko: "Nopeus +" },
    { id: "y2", paiva: "2026-12-07", joukkue_id: 3, pelaaja_id: null, otsikko: "Nopeus +" },
    { id: "o1", paiva: "2026-11-30", pelaaja_id: "p", treeniohjelma: "voima1" },
    { id: "o1", paiva: "2026-11-30", pelaaja_id: "p", treeniohjelma: "voima1" },
  ];
  const paketit = [{ yhteinen: true, alku: "2026-11-30", loppu: "2026-12-06" }];
  const vk1 = viikonPaivat("2026-11-30", { ohjelma, paketit });
  assert.deepEqual(vk1[0].suunnitellut.map((s) => s.id), ["y1", "o1"]);
  const vk2 = viikonPaivat("2026-12-07", { ohjelma, paketit });
  assert.deepEqual(vk2[0].suunnitellut.map((s) => s.id), []);
});

test("toteuma liittyy suunniteltuun, ylimääräinen erikseen", () => {
  const ohjelma = [{ id: "o1", paiva: "2026-12-01", pelaaja_id: "p", treeniohjelma: "voima1" }, { id: "o2", paiva: "2026-12-01", pelaaja_id: "p", treeniohjelma: "lenkki" }];
  const toteumat = [{ id: "t1", pvm: "2026-12-01", ohjelma_id: "o2", ohjelma: "sali" }, { id: "t2", pvm: "2026-12-01", ohjelma: "voima1" }, { id: "t3", pvm: "2026-12-01", ohjelma: "pyora" }];
  const [, ti] = viikonPaivat("2026-11-30", { ohjelma, toteumat });
  assert.equal(ti.suunnitellut.find((s) => s.id === "o2").toteuma.id, "t1");
  assert.equal(ti.suunnitellut.find((s) => s.id === "o1").toteuma.id, "t2");
  assert.deepEqual(ti.ylimaaraiset.map((t) => t.id), ["t3"]);
});

test("sairausjakso yli viikon rajan näkyy molemmilla viikoilla", () => {
  const sairaudet = [{ alku: "2026-12-05", loppu: "2026-12-08" }];
  const a = viikonPaivat("2026-11-30", { sairaudet }), b = viikonPaivat("2026-12-07", { sairaudet });
  assert.deepEqual(a.map((d) => d.sairas), [false, false, false, false, false, true, true]);
  assert.deepEqual(b.map((d) => d.sairas), [true, true, false, false, false, false, false]);
});

test("yhteisen tapahtuman kirjaus liittyy tapahtuma_uid:llä", () => {
  const ohjelma = [{ id: "superi27-2026-12-01-1", tapahtuma: true, paiva: "2026-12-01", pelaaja_id: null, otsikko: "Kupat + laji" }];
  const toteumat = [{ id: "t9", pvm: "2026-12-01", tapahtuma_uid: "superi27-2026-12-01-1", ohjelma: "laji" }];
  const paketit = [{ yhteinen: true, alku: "2026-11-30", loppu: "2026-12-06" }];
  const [, ti] = viikonPaivat("2026-11-30", { ohjelma, toteumat, paketit });
  assert.equal(ti.suunnitellut[0].toteuma.id, "t9");
  assert.deepEqual(ti.ylimaaraiset, []);
});
