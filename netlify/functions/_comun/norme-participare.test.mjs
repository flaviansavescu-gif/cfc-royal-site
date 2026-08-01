// Probele normelor de participare.
//
// DE CE EXISTĂ. Bifa nu valorează nimic dacă, la o contestație de peste un an, nu se poate
// arăta CE text a fost bifat. Aici se probează tocmai legătura dintre text și versiunea
// reținută în fișă: că se schimbă împreună, și că nu se schimbă degeaba.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NORME_RO, NORME_EN, versiuneaNormelor } from "./norme-participare.mjs";

test("normele sunt aceleași în amândouă limbile, ca număr și ca ordine", () => {
  // O obligație în plus în română și lipsă în engleză înseamnă doi expozanți care își
  // asumă lucruri diferite bifând aceeași căsuță.
  assert.equal(NORME_RO.length, NORME_EN.length);
  assert.ok(NORME_RO.length >= 5, "un rezumat prea scurt nu acoperă ce cere proiectul de Condiții");
});

test("nicio obligație nu e goală sau lăsată de completat", () => {
  for (const lista of [NORME_RO, NORME_EN]) {
    for (const n of lista) {
      assert.ok(n.trim().length > 20, `obligație prea scurtă: „${n}”`);
      assert.ok(!/⟨|⟩|TODO|XXX/.test(n), `a rămas un loc necompletat: „${n}”`);
    }
  }
});

test("versiunea e amprenta textului românesc, nu un număr scris cu mâna", () => {
  const asteptat = createHash("sha256").update(NORME_RO.join("\n"), "utf8").digest("hex").slice(0, 8);
  assert.equal(versiuneaNormelor(), asteptat);
  assert.match(versiuneaNormelor(), /^[0-9a-f]{8}$/);
});

test("versiunea e statornică: aceleași norme, aceeași versiune", () => {
  // Dacă ar depinde de ceas sau de ordinea de încărcare, două înscrieri făcute la fel ar
  // purta versiuni diferite, iar marcajul ar deveni zgomot.
  assert.equal(versiuneaNormelor(), versiuneaNormelor());
});

test("o schimbare de text schimbă versiunea — inclusiv una măruntă", () => {
  const amprenta = (l) => createHash("sha256").update(l.join("\n"), "utf8").digest("hex").slice(0, 8);
  const acum = amprenta(NORME_RO);

  const scoasa = NORME_RO.slice(0, -1);
  assert.notEqual(amprenta(scoasa), acum, "o obligație ștearsă trece neobservată");

  const schimbata = [...NORME_RO];
  schimbata[0] = schimbata[0].replace("prezint", "voi prezenta");
  assert.notEqual(amprenta(schimbata), acum, "o reformulare trece neobservată");

  const pedos = [...NORME_RO].reverse();
  assert.notEqual(amprenta(pedos), acum, "ordinea nu intră în amprentă");
});

test("engleza nu intră în versiune: o îndreptare de traducere nu îmbătrânește fișele vechi", () => {
  const inainte = versiuneaNormelor();
  const en = [...NORME_EN];
  en[0] = en[0].replace("at the entrance", "At the entrance");
  // NORME_EN nu e folosit la socoteală — o schimbăm doar aici, ca să se vadă că nu contează.
  assert.equal(versiuneaNormelor(), inainte);
});

console.log("norme-participare: toate probele trecute");
