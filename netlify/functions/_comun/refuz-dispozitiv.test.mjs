// refuz-dispozitiv.test.mjs — 403-ul de „Dispozitiv nerecunoscut" nu mai e numărat ca
// forță brută (auditul registraturii, 23.08). Un dispozitiv expirat NU e o ghicire de
// cod — omul a dovedit un cod valid; a-l număra îl bloca (429) la o reîncărcare a
// panoului, care lansează ~8-10 cereri autentificate deodată.
//   node --test netlify/functions/_comun/refuz-dispozitiv.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../", import.meta.url));

test("literalul din raspunsuri se potriveste cu constanta ANTET_REFUZ_DREPT", async () => {
  const { ANTET_REFUZ_DREPT } = await import("./drepturi-registru.mjs");
  assert.equal(ANTET_REFUZ_DREPT, "x-refuz-drept",
    "daca redenumesti constanta, actualizeaza si codemod-ul care a pus literalul in cele 30 de functii");
});

test("fiecare 403 de dispozitiv nerecunoscut poarta antetul de refuz-de-drept", () => {
  const lipsuri = [];
  for (const nume of readdirSync(DIR)) {
    if (!nume.endsWith(".mjs") || nume.endsWith(".test.mjs")) continue;
    const sursa = readFileSync(DIR + nume, "utf8");
    if (!sursa.includes("Dispozitiv nerecunoscut")) continue;
    // Fiecare apariție a mesajului trebuie urmată, în aceeași expresie json(...), de antet.
    const re = /Dispozitiv nerecunoscut\.[^"]*"\s*\}\s*,\s*403\s*(,\s*\{\s*antete:\s*\{\s*"x-refuz-drept":\s*"1"\s*\}\s*\}\s*)?\)/g;
    let m;
    while ((m = re.exec(sursa)) !== null) {
      if (!m[1]) lipsuri.push(nume);
    }
  }
  assert.deepEqual(lipsuri, [],
    "aceste funcții au un 403 de dispozitiv fără antetul de refuz-de-drept — vor fi numărate ca forță brută");
});
