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

/** Verifică, pentru o funcție de poartă, că fiecare argument e o variabilă existentă. */
function verificaApeluri(numeFunctie, minim) {
  const fisiere = readdirSync(FUNCTII).filter((n) => n.endsWith(".mjs"));
  const tipar = new RegExp(numeFunctie + "\\(([^)]*)\\)", "g");
  let apeluri = 0;

  for (const nume of fisiere) {
    const sursa = readFileSync(join(FUNCTII, nume), "utf8");
    // Sursa fără apelurile verificate: altfel `esteAdmin(cod)` ar trece drept declarația
    // lui `cod`, iar verificarea s-ar confirma pe ea însăși.
    const faraApeluri = sursa.replace(new RegExp(numeFunctie + "\\([^)]*\\)", "g"), numeFunctie + "()");

    for (const m of sursa.matchAll(tipar)) {
      // Argumentele pot fi mai multe; le luăm pe toate, la prima virgulă de nivel 0.
      for (const arg of m[1].split(",").map((x) => x.trim())) {
        // Doar identificatori: sărim literalii (șiruri, numere) și constantele scrise cu
        // majuscule. Argumentele din apeluri imbricate ajung aici tăiate — de aceea
        // verificăm rădăcina, nu expresia.
        if (!arg || !/^[A-Za-z_$]/.test(arg)) continue;
        if (/^[A-Z_]+$/.test(arg)) continue;
        if (/^(getStore|String|Number|Boolean|await|new)\b/.test(arg)) continue;
        apeluri++;
        const r = radacina(arg);
        assert.ok(
          pareDeclarat(faraApeluri, r),
          `${nume}: ${numeFunctie}(${arg}) — „${r}" nu e declarat în fișier. ` +
          `În producție ar fi ReferenceError, adică 500 pe o poartă de securitate.`,
        );
      }
    }
  }
  assert.ok(apeluri >= minim, `se așteptau cel puțin ${minim} apeluri de ${numeFunctie}, s-au găsit ${apeluri}`);
}

test("fiecare apel esteAdmin(...) primește o variabilă care există", () => {
  verificaApeluri("esteAdmin", 10);
});

test("fiecare apel dispozitivCunoscut(...) primește variabile care există", () => {
  // Aceeași capcană, a doua oară: la extinderea celei de-a doua chei către Școală,
  // un script a scris `body.dispozitiv` în două funcții care n-au variabila `body`.
  // Sintaxă validă, 500 în producție pe o poartă de securitate.
  verificaApeluri("dispozitivCunoscut", 10);
});

test("mesajul de refuz al dispozitivului folosește un ajutor care există în fișier", () => {
  const fisiere = readdirSync(FUNCTII).filter((n) => n.endsWith(".mjs"));
  for (const nume of fisiere) {
    const sursa = readFileSync(join(FUNCTII, nume), "utf8");
    if (!sursa.includes("Dispozitiv nerecunoscut")) continue;
    // Unde se răspunde cu `json(...)`, funcția `json` trebuie să existe în fișier.
    const foloseste = /return json\(\{ eroare: "Dispozitiv nerecunoscut/.test(sursa);
    if (!foloseste) continue;
    assert.ok(
      /\bconst json = |\bfunction json\(/.test(sursa),
      `${nume}: răspunde cu json(...) dar nu are funcția json — ReferenceError în producție.`,
    );
  }
});

test("jetonul de dispozitiv se caută acolo unde a fost scris", () => {
  // Jetonul se naște la INTRARE și se scrie într-o singură magazie per platformă:
  // „registru" pentru registrul genealogic, „cursuri" pentru Școală. Două funcții ale
  // Școlii îl căutau în magaziile lor proprii („breed", „paa") — unde nu ajunge
  // niciodată. Răspundeau 403 la fiecare cerere, iar panoul dădea administratorul
  // afară, spunându-i că i s-a revocat codul. Platforma de lector mergea, fiindcă ea
  // nu cheamă acele două funcții: exact felul de defect care pare „la întâmplare".
  const PERMISE = new Set(["registru", "cursuri"]);
  const fisiere = readdirSync(FUNCTII).filter((n) => n.endsWith(".mjs"));
  let gasite = 0;

  for (const nume of fisiere) {
    const sursa = readFileSync(join(FUNCTII, nume), "utf8");
    for (const m of sursa.matchAll(/dispozitivCunoscut\(\s*getStore\(\s*["']([a-z-]+)["']\s*\)/g)) {
      gasite++;
      assert.ok(
        PERMISE.has(m[1]),
        `${nume}: caută dispozitivul în magazia „${m[1]}", dar jetoanele se scriu doar ` +
        `în „registru" sau „cursuri". Ar răspunde 403 la fiecare cerere.`,
      );
    }
  }
  assert.ok(gasite >= 3, `se așteptau cel puțin 3 verificări de dispozitiv, s-au găsit ${gasite}`);
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
