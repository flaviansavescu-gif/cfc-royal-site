// Poarta de administrator — verificarea unei clase de greșeală pe care `node --check`
// n-o vede.
//
// DE CE EXISTĂ. Amprenta administratorului fusese copiată în zece funcții. La unificarea
// lor am înlocuit comparațiile cu `esteAdmin(...)` și, într-un fișier, am scris un nume
// de variabilă care nu exista în acel domeniu. Sintaxa e perfect validă, deci
// verificatorul a trecut fără o vorbă. S-ar fi văzut abia în producție, ca eroare 500 pe
// o poartă de securitate — adică din reclamații, nu din teste.
//
// Ce se verifică aici:
//   1. STATIC — argumentul fiecărui apel `esteAdmin(...)` e chiar declarat în fișier.
//   2. VIU — funcțiile care se pot chema local refuză cu 401, nu crapă cu 500.
//
// De ce doar unele viu: restul trec prin `cuLimitareCod`, care citește contorul din
// magazie ÎNAINTE de handler (corect — altfel n-ar putea limita). Local nu există Blobs,
// iar clientul reîncearcă îndelung. Nu e un defect al funcțiilor: e prețul verificării
// limitei, plătit înaintea oricărei alte munci.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { esteAdmin, ADMIN_HASH, sha256 } from "./roluri.mjs";

const AICI = dirname(fileURLToPath(import.meta.url));
const FUNCTII = join(AICI, "..");

/** Numele rădăcină dintr-o expresie: `body.cod` -> `body`, `cod` -> `cod`. */
const radacina = (expr) => String(expr).trim().split(/[.[(]/)[0].trim();

/**
 * Pare declarat în fișier? (const/let/var, parametru, destructurare)
 *
 * ATENȚIE: se cheamă pe o sursă din care apelurile `esteAdmin(...)` au fost deja scoase.
 * Prima versiune a acestui test se confirma singură: tiparul de parametru `(cod)` se
 * potrivea chiar pe apelul verificat, `esteAdmin(cod)`. Testul trecea și cu greșeala
 * reintrodusă — adică nu verifica nimic. Găsit reintroducând anume defectul.
 */
function pareDeclarat(sursa, nume) {
  const tipare = [
    new RegExp(`\\b(const|let|var)\\s+${nume}\\b`),
    new RegExp(`\\b(const|let|var)\\s*\\{[^}]*\\b${nume}\\b[^}]*\\}`),
    new RegExp(`function\\s*[\\w$]*\\s*\\([^)]*\\b${nume}\\b`),
    new RegExp(`\\(\\s*${nume}\\s*[,)]`),          // parametru de funcție-săgeată
    new RegExp(`\\b${nume}\\s*=>`),                 // parametru unic de funcție-săgeată
    new RegExp(`^import\\b.*\\b${nume}\\b`, "m"),
  ];
  return tipare.some((t) => t.test(sursa));
}

test("fiecare apel esteAdmin(...) primește o variabilă care există", () => {
  const fisiere = readdirSync(FUNCTII).filter((n) => n.endsWith(".mjs"));
  let apeluri = 0;

  for (const nume of fisiere) {
    const sursa = readFileSync(join(FUNCTII, nume), "utf8");
    // Sursa fără apelurile de poartă: altfel `esteAdmin(cod)` ar trece drept declarația
    // lui `cod`, iar verificarea s-ar confirma pe ea însăși.
    const faraApeluri = sursa.replace(/esteAdmin\([^)]*\)/g, "esteAdmin()");

    for (const m of sursa.matchAll(/esteAdmin\(([^)]*)\)/g)) {
      const arg = m[1].trim();
      if (!arg || /^["'`]/.test(arg)) continue;     // literal, nu variabilă
      apeluri++;
      const r = radacina(arg);
      assert.ok(
        pareDeclarat(faraApeluri, r),
        `${nume}: esteAdmin(${arg}) — „${r}" nu e declarat în fișier. ` +
        `În producție ar fi ReferenceError, adică 500 pe o poartă de securitate.`,
      );
    }
  }
  assert.ok(apeluri >= 10, `se așteptau cel puțin 10 apeluri de poartă, s-au găsit ${apeluri}`);
});

test("amprenta administratorului există într-un SINGUR loc", () => {
  const fisiere = readdirSync(FUNCTII).filter((n) => n.endsWith(".mjs"));
  const copii = fisiere.filter((n) => readFileSync(join(FUNCTII, n), "utf8").includes(ADMIN_HASH));
  assert.deepEqual(copii, [], "amprenta nu are ce căuta în funcții — se importă din _comun/roluri.mjs");
});

// Funcțiile fără ambalaj de limitare se pot chema direct, deci le verificăm pe viu.
for (const [nume, corp] of [
  ["rezultate-cursuri", { cod: "GRESIT" }],
  ["stare-cursuri", { cod: "GRESIT", id: "x", online: true }],
]) {
  test(`${nume}: cod greșit -> 401, nu 500`, async () => {
    const mod = await import(`../${nume}.mjs`);
    const req = new Request("https://cfc-royal.ro/.netlify/functions/" + nume, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corp),
    });
    let raspuns;
    try { raspuns = await mod.default(req, {}); }
    catch (err) { assert.fail(`${nume} a aruncat în loc să refuze: ${err.message}`); }
    assert.notEqual(raspuns.status, 500, `${nume} a răspuns 500 — poarta s-a rupt`);
    assert.equal(raspuns.status, 401);
  });
}

test("esteAdmin refuză orice cod greșit; amprenta NU e cheie de intrare", () => {
  assert.equal(esteAdmin(""), false);
  assert.equal(esteAdmin(null), false);
  assert.equal(esteAdmin(undefined), false);
  assert.equal(esteAdmin("GRESIT"), false);
  assert.equal(esteAdmin(ADMIN_HASH), false, "cine are amprenta tot nu intră — îi trebuie codul");
});

test("amprenta e o valoare SHA-256 validă", () => {
  assert.match(ADMIN_HASH, /^[0-9a-f]{64}$/);
  assert.equal(sha256("").length, 64);
});
