// tarife-manager.test.mjs — taxele de expoziție: site (tarife.ts) = Manager (lib/taxe.ts).
//
// Cele două tabele trăiesc în proiecte diferite și s-au mai despărțit o dată (notat în
// memoria proiectului). Azi coincid; proba de față îngheață acordul: local (unde se
// lucrează la amândouă), orice despărțire cade aici — ca la proba claselor de vârstă.
//   node --test src/data/tarife-manager.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AICI = dirname(fileURLToPath(import.meta.url));
const MANAGER = join(AICI, "..", "..", "..", "..", "..", "cfcr-expo-manager", "lib", "taxe.ts");

// Sumele de pe pagina publică de tarife (sursa unică a site-ului), pe id-uri stabile.
function sumeleSite() {
  const s = readFileSync(join(AICI, "tarife.ts"), "utf8");
  const suma = (id) => {
    const m = s.slice(s.indexOf(`id: "${id}"`)).match(/valoare:\s*(\d+)/);
    return m ? Number(m[1]) : null;
  };
  return {
    nationala: { membru: [suma("expo-cac-primul-membru"), suma("expo-cac-urmatorii-membru")],
                 nemembru: [suma("expo-cac-primul-nemembru"), suma("expo-cac-urmatorii-nemembru")] },
    internationala: { membru: [suma("expo-cacib-primul-membru"), suma("expo-cacib-urmatorii-membru")],
                      nemembru: [suma("expo-cacib-primul-nemembru"), suma("expo-cacib-urmatorii-nemembru")] },
  };
}

if (!existsSync(MANAGER)) {
  test("taxe site/manager — sărită (managerul nu e pe acest disc)", { skip: true }, () => {});
} else {
  const sursaMan = readFileSync(MANAGER, "utf8");
  const grila = (tip) => {
    const rand = sursaMan.split("\n").find((l) => l.trim().startsWith(tip + ":"));
    assert.ok(rand, `nu găsesc grila „${tip}" în lib/taxe.ts — s-a schimbat forma fișierului?`);
    const n = [...rand.matchAll(/primul:\s*(\d+),\s*urmatorii:\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const student = Number(rand.match(/student:\s*(\d+)/)?.[1]);
    return { membru: n[0], nemembru: n[1], student };
  };

  test("grila expozițiilor: site = manager, cifră cu cifră", () => {
    const site = sumeleSite();
    for (const tip of ["nationala", "internationala"]) {
      const man = grila(tip);
      assert.deepEqual(man.membru, site[tip].membru, `${tip}/membru diferă între manager și tarife.ts`);
      assert.deepEqual(man.nemembru, site[tip].nemembru, `${tip}/nemembru diferă între manager și tarife.ts`);
      assert.equal(man.student, 10, `${tip}: reducerea de student trebuie să fie 10%`);
    }
  });

  test("speciala de rasă folosește grila națională (cum spune pagina de tarife)", () => {
    const site = sumeleSite();
    const man = grila("speciala");
    assert.deepEqual(man.membru, site.nationala.membru);
    assert.deepEqual(man.nemembru, site.nationala.nemembru);
  });
}
