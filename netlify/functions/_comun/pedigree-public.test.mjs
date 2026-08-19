// Probă de comportament pe handlerul PUBLIC de pedigree (P2-5 A: privacy publică).
// Rulează handlerul real cu o magazie în memorie și verifică că fișa publică a câinelui
// NU scurge date personale: microcip mascat, fără nume/adresă/telefon de proprietar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("privacy publică pedigree — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  const CIP = "941000024681357";
  const store = magazieFalsa({
    "pedigree/CFCR-P-2026-0001": {
      serie: "CFCR-P-2026-0001", tip: "A", anulat: false,
      dmfId: "DMF1", numarWDF: "WDF-0100",
      caine: { nume: "Argos", rasa: "Ciobănesc", sex: "M", microcip: CIP, dataNasterii: "2024-01-01" },
      crescator: { nume: "Ana Crescatoru", afix: "de Cerna" },
      proprietar: { nume: "ION POP SECRET", adresa: "Str. Ascunsă nr. 1", localitate: "Cluj", telefon: "0722000111" },
      ascendenta: {},
    },
    "pedigree-caine/941000024681357": { serie: "CFCR-P-2026-0001" },
  });
  mockBlobs(store);
  const handler = (await import("../registru-pedigree.mjs")).default;

  test("A: fișa publică maschează microcipul și NU expune PII de proprietar", async () => {
    const res = await handler(reqJSON({ actiune: "caine", cautat: "CFCR-P-2026-0001" }));
    assert.equal(res.status, 200);
    const body = await res.json();
    const brut = JSON.stringify(body);

    // microcipul complet NU apare nicăieri; forma mascată păstrează doar ultimele 4.
    assert.ok(!brut.includes(CIP), "microcipul COMPLET nu are voie în răspunsul public");
    assert.ok(body.caine, "fișa câinelui trebuie să existe");
    assert.notEqual(body.caine.microcip, CIP);
    assert.match(String(body.caine.microcip), /1357$/, "trebuie să rămână doar ultimele 4 cifre");

    // datele personale ale proprietarului NU apar (nume/adresă/telefon).
    assert.ok(!brut.includes("ION POP SECRET"), "numele proprietarului nu are voie public");
    assert.ok(!brut.includes("Ascunsă"), "adresa proprietarului nu are voie public");
    assert.ok(!brut.includes("0722000111"), "telefonul proprietarului nu are voie public");

    // creșterea E publică (crescător + afix), proprietarul apare doar prin cod pseudonim.
    assert.equal(body.caine.crescator?.nume || body.crescator?.nume || "", "Ana Crescatoru");
  });

  test("A: input periculos rămâne 400 (guard SEC-001 activ și prin handlerul real)", async () => {
    const res = await handler(reqJSON({ actiune: "caine", cautat: "../../" }));
    assert.equal(res.status, 400);
  });

  test("A: referință inexistentă => 404 curat, nu 500", async () => {
    const res = await handler(reqJSON({ actiune: "caine", cautat: "CFCR-P-2099-0001" }));
    assert.equal(res.status, 404);
  });
}
