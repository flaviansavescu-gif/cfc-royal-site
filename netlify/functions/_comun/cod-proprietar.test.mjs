// Probă de comportament pentru alocarea ATOMICĂ a codului de proprietar (SEC-008).
// Două fișe publice pentru proprietari DIFERIȚI, cerute concurent, NU pot primi același
// cod P-. Handler real (registru-pedigree, acțiunea publică „caine"), magazie în memorie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bootstrapMockModule, magazieFalsa, reqJSON, mockBlobs } from "./_harness.mjs";

if (!bootstrapMockModule(import.meta.url)) {
  test("cod proprietar — sărită (mock.module indisponibil pe acest Node)", { skip: true }, () => {});
} else {
  const cert = (serie, cip, propNume) => ({
    serie, tip: "A", anulat: false, dmfId: "D-" + serie, numarWDF: null,
    caine: { nume: "Caine " + serie, rasa: "Rasa", sex: "M", microcip: cip, dataNasterii: "2024-01-01" },
    crescator: { nume: "Crescator", afix: "" },
    proprietar: { nume: propNume, localitate: "Oras " + propNume },
    ascendenta: {},
  });
  const store = magazieFalsa({
    "pedigree/CFCR-P-2026-0001": cert("CFCR-P-2026-0001", "941000000000011", "Proprietar Unu"),
    "pedigree/CFCR-P-2026-0002": cert("CFCR-P-2026-0002", "941000000000022", "Proprietar Doi"),
    "pedigree-caine/941000000000011": { serie: "CFCR-P-2026-0001" },
    "pedigree-caine/941000000000022": { serie: "CFCR-P-2026-0002" },
  });
  mockBlobs(store);
  const handler = (await import("../registru-pedigree.mjs")).default;

  const codDin = async (cautat) => {
    const res = await handler(reqJSON({ actiune: "caine", cautat }));
    assert.equal(res.status, 200);
    return (await res.json()).caine.proprietarCod;
  };

  test("SEC-008: doi proprietari diferiți, cereri CONCURENTE => coduri DISTINCTE", async () => {
    const [a, b] = await Promise.all([codDin("CFCR-P-2026-0001"), codDin("CFCR-P-2026-0002")]);
    assert.match(a, /^P-\d{6}$/);
    assert.match(b, /^P-\d{6}$/);
    assert.notEqual(a, b, "COLIZIUNE: doi proprietari cu același cod P-");
  });

  test("SEC-008: același proprietar => același cod (stabil, nu se realocă)", async () => {
    const a1 = await codDin("CFCR-P-2026-0001");
    const a2 = await codDin("CFCR-P-2026-0001");
    assert.equal(a1, a2);
  });

  test("SEC-008: sursa reală rezervă numărul cu onlyIfNew (blocaj de regresie)", () => {
    const src = readFileSync(fileURLToPath(new URL("../registru-pedigree.mjs", import.meta.url)), "utf8");
    const linia = src.split("\n").find((l) => l.includes('setJSON("cod-proprietar-luat/" + urm') && l.includes("onlyIfNew: true"));
    assert.ok(linia, "codProprietar trebuie să rezerve numărul atomic (onlyIfNew)");
  });
}
