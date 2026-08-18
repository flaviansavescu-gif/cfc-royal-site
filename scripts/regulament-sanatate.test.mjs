// regulament-sanatate.test.mjs — regulamentul si programul trebuie sa spuna ACELASI lucru.
//
// Regulamentul de crestere si sanatate (Hot. 181/13-08-2026) scrie in Art. 15 tipurile de
// test recunoscute, iar in Art. 17 ce rezultate sunt favorabile. Aceleasi lucruri sunt
// scrise, separat, in codul care le aplica: netlify/functions/_comun/teste-sanatate.mjs
//
// PRIMEJDIA: cineva adauga un tip de test in cod (sau schimba un prag) si uita
// regulamentul. Atunci actul adoptat de Consiliul Director spune una, iar site-ul face
// alta — si nimeni nu vede, fiindca fiecare fisier, citit singur, e corect.
//
// Proba de aici leaga cele doua. Daca nu se mai potrivesc, build-ul se opreste.
//
// Ruleaza: node scripts/regulament-sanatate.test.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TIPURI_TEST, favorabil } from "../netlify/functions/_comun/teste-sanatate.mjs";

const RADACINA = fileURLToPath(new URL("..", import.meta.url));
const REGULAMENT = join(RADACINA, "src", "content", "documente", "ro", "regulament-crestere-sanatate.md");

let rau = 0;
const t = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

console.log("\nRegulamentul de crestere si sanatate se potriveste cu programul\n");

const text = readFileSync(REGULAMENT, "utf8");

// ——— Art. 15: fiecare tip de test din cod trebuie sa apara in tabelul regulamentului ———
for (const [cod, def] of Object.entries(TIPURI_TEST)) {
  t(
    `Art. 15 pomeneste testul „${def.nume}"`,
    text.includes(def.nume),
    `tipul „${cod}" exista in cod, dar numele lui nu apare in regulament`,
  );

  // si rezultatele acceptate, pentru cele cu lista inchisa
  if (def.rezultate) {
    const lipsa = def.rezultate.filter((r) => {
      // cautam rezultatul pe randul de tabel al testului
      const rand = text.split("\n").find((l) => l.includes(def.nume) && l.includes("|"));
      return !rand || !rand.includes(r);
    });
    t(
      `Art. 15 enumera toate rezultatele pentru „${def.nume}"`,
      lipsa.length === 0,
      `lipsesc din tabel: ${lipsa.join(", ")}`,
    );
  }
}

// ——— Art. 17: rezultatele favorabile ———
// Regulamentul scrie: HD A, B, C · ED 0, 1 · ochi liber · ADN depus
const FAVORABILE_IN_REGULAMENT = {
  hd: ["A", "B", "C"],
  ed: ["0", "1"],
  ochi: ["liber"],
  adn: ["depus"],
};

for (const [cod, bune] of Object.entries(FAVORABILE_IN_REGULAMENT)) {
  for (const r of bune) {
    t(`Art. 17: „${cod}=${r}" e favorabil si in program`, favorabil(cod, r) === true);
  }
  // si ca restul NU sunt favorabile
  const def = TIPURI_TEST[cod];
  if (def?.rezultate) {
    for (const r of def.rezultate.filter((x) => !bune.includes(x))) {
      t(`Art. 17: „${cod}=${r}" NU e favorabil, nici in program`, favorabil(cod, r) === false);
    }
  }
}

// testul genetic nu se judeca automat — Art. 17 alin. (2)
t("Art. 17 alin. (2): testul genetic ramane neutru in program", favorabil("genetic", "orice") === null);

// ——— pragurile de bunastare din regulament, ca sa nu se schimbe din greseala ———
const PRAGURI = [
  ["vârsta minimă a femelei — 18 luni", /vârstei de \*\*18 luni\*\* la data montei/],
  ["vârsta maximă a femelei — 8 ani", /vârstei de \*\*8 ani\*\* la data montei/],
  ["vârsta minimă a masculului — 12 luni", /vârstei de \*\*12 luni\*\*/],
  ["odihna între fătări — 10 luni", /cel puțin \*\*10 luni\*\*/],
  ["cuiburi în 24 de luni — 3", /\*\*3 cuiburi în 24 de luni\*\*/],
  ["cezariene — 2", /\*\*două ori prin operație cezariană\*\*/],
  ["înstrăinarea puilor — 8 săptămâni", /vârstei de \*\*8 săptămâni\*\*/],
  ["preaviz teste obligatorii — 12 luni", /cel puțin \*\*12 luni\*\* de la publicare/],
];
for (const [nume, re] of PRAGURI) {
  t(`pragul „${nume}" e neatins`, re.test(text), "s-a schimbat in regulament — de vazut daca e voit");
}

// ——— actul trebuie sa poarte hotararea, nu un loc gol ———
t("regulamentul poarta numarul hotararii", /hotarare:\s*"181\/13-08-2026"/.test(text));
t("nu au ramas locuri goale in text", !/_{3,}/.test(text), "a ramas un loc gol necompletat");

console.log(rau ? `\n${rau} probe cazute\n` : "\nToate probele au trecut\n");
process.exit(rau ? 1 : 0);
