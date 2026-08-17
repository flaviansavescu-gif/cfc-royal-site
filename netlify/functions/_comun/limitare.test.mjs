// Probele zidului anti-forta-bruta (limitare.mjs) — regulile pe care le-a rupt auditul
// din 17.08.2026. Fara ghilimele romanesti in titluri (regula casei).
//
// Doua portite reale, gasite si reparate atunci:
//   1. `resetLimita` la ORICE raspuns 200 — iar functii ca progres-cursuri raspundeau
//      200 si la un cod inexistent, deci 19 ghiciri + o cerere fara valoare stergeau
//      contorul, la nesfarsit.
//   2. corpul trimis ca FORMULAR (nu JSON) facea `req.clone().json()` sa arunce, iar
//      ambalajul lasa cererea complet nenumarata (breed-instalare accepta formulare).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cite = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const LIMITARE = cite("./limitare.mjs");

test("ambalajul NU mai reseteaza contorul la orice raspuns reusit", () => {
  // Resetarea ramane treaba functiilor care chiar au dovedit o acreditare
  // (acces-cursuri, breed-date cheama explicit resetLimita).
  assert.ok(
    !/raspuns\.ok\)\s*await resetLimita/.test(LIMITARE),
    "resetLimita legat de raspuns.ok a reaparut in ambalaj — portita din 17.08 e redeschisa",
  );
  assert.ok(/inregistreazaEsec\(cheie\)/.test(LIMITARE), "numararea esecurilor a disparut");
});

test("un corp care NU e JSON se considera purtator de cod (fail-closed)", () => {
  // Inainte: `catch { areCod = false }` => trecea nelimitat.
  assert.ok(
    /catch\s*\{[\s\S]*areCod = req\.method === "POST"/.test(LIMITARE),
    "corpul necitibil nu mai e tratat fail-closed — ghicirea prin formular redevine nelimitata",
  );
});

test("functiile de citire refuza un cod necunoscut cu 401, nu cu 200", () => {
  for (const f of ["../progres-cursuri.mjs", "../autorizare-cursuri.mjs", "../asistente-cursuri.mjs"]) {
    const sursa = cite(f);
    assert.ok(
      /Cod necunoscut\.".*401|401\)/.test(sursa) && /candidat\/" \+ id/.test(sursa),
      `${f}: lipseste refuzul 401 la cod necunoscut (ghicitul redevine nenumarat)`,
    );
  }
});

test("pragurile raman cele documentate", () => {
  assert.ok(/MAX_ESECURI = 20/.test(LIMITARE));
  assert.ok(/FEREASTRA_MS = 10 \* 60e3/.test(LIMITARE));
  assert.ok(/BLOCARE_MS = 5 \* 60e3/.test(LIMITARE));
});
