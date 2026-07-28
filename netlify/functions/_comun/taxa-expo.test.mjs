import { calculeazaTaxa, normalizeazaGrila, grilaAreTaxe, taxaVeche, areTaxeVechi } from "./taxa-expo.mjs";

let rau = 0;
const e = (nume, primit, asteptat) => {
  const bun = JSON.stringify(primit) === JSON.stringify(asteptat);
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + " -> " + JSON.stringify(primit) +
    (bun ? "" : " (așteptat " + JSON.stringify(asteptat) + ")"));
};

// Grila oficială a unei expoziții C.A.C.I.B., cu reducerea de student.
const CACIB = {
  membru: { primul: 120, urmatorii: 60 },
  nemembru: { primul: 150, urmatorii: 75 },
  scutite: [],
  student: 10,
};
const CAC = {
  membru: { primul: 100, urmatorii: 50 },
  nemembru: { primul: 120, urmatorii: 60 },
  scutite: [],
  student: 10,
};

console.log("— cele patru cadrane —");
e("CAC, membru, primul", calculeazaTaxa(CAC, { membru: true, primul: true }), 100);
e("CAC, membru, al doilea", calculeazaTaxa(CAC, { membru: true, primul: false }), 50);
e("CAC, nemembru, primul", calculeazaTaxa(CAC, { membru: false, primul: true }), 120);
e("CAC, nemembru, al doilea", calculeazaTaxa(CAC, { membru: false, primul: false }), 60);
e("CACIB, membru, primul", calculeazaTaxa(CACIB, { membru: true, primul: true }), 120);
e("CACIB, nemembru, primul", calculeazaTaxa(CACIB, { membru: false, primul: true }), 150);
e("CACIB, nemembru, al doilea", calculeazaTaxa(CACIB, { membru: false, primul: false }), 75);

console.log("— reducerea de student se aplică sumei finale —");
e("CAC, membru, primul, student", calculeazaTaxa(CAC, { membru: true, primul: true, student: true }), 90);
e("CACIB, nemembru, al doilea, student (67,5 -> 68)",
  calculeazaTaxa(CACIB, { membru: false, primul: false, student: true }), 68);
e("student fără reducere configurată",
  calculeazaTaxa({ ...CAC, student: 0 }, { membru: true, primul: true, student: true }), 100);

console.log("— clasele scutite nu se taxează, oricine ai fi —");
const cuScutiri = { ...CAC, scutite: ["baby", "puppy"] };
e("baby, nemembru, primul", calculeazaTaxa(cuScutiri, { membru: false, primul: true, clasa: "baby" }), 0);
e("deschisa, nemembru, primul", calculeazaTaxa(cuScutiri, { membru: false, primul: true, clasa: "deschisa" }), 120);

console.log("— implicit: nemembru și primul câine (cazul cel mai scump, niciodată în minus) —");
e("fără declarații", calculeazaTaxa(CAC, {}), 120);

console.log("— date stricate nu aruncă și nu produc sume negative —");
e("grilă lipsă", calculeazaTaxa(null, { membru: true, primul: true }), 0);
e("grilă goală", calculeazaTaxa({}, { membru: false, primul: true }), 0);
e("sume negative -> 0", calculeazaTaxa({ nemembru: { primul: -50 } }, { primul: true }), 0);
e("sume text", calculeazaTaxa({ nemembru: { primul: "120" } }, { primul: true }), 120);
e("reducere absurdă e plafonată la 100%",
  calculeazaTaxa({ nemembru: { primul: 120 }, student: 500 }, { primul: true, student: true }), 0);
e("normalizarea completează ce lipsește",
  normalizeazaGrila({ membru: { primul: 100 } }),
  { membru: { primul: 100, urmatorii: 0 }, nemembru: { primul: 0, urmatorii: 0 }, scutite: [], student: 0 });

console.log("— o expoziție fără taxe nu arată deloc secțiunea de plată —");
e("grilă goală", grilaAreTaxe({}), false);
e("grilă cu o singură sumă", grilaAreTaxe({ nemembru: { primul: 120 } }), true);

console.log("— calea veche (taxa pe clasă) rămâne neatinsă —");
e("clasa cu taxă", taxaVeche({ deschisa: 100, baby: 0 }, "deschisa"), 100);
e("clasa fără taxă", taxaVeche({ deschisa: 100, baby: 0 }, "baby"), 0);
e("clasă necunoscută", taxaVeche({ deschisa: 100 }, "veterani"), 0);
e("are taxe vechi", areTaxeVechi({ deschisa: 100 }), true);
e("nu are taxe vechi", areTaxeVechi({ baby: 0 }), false);

// —— Suma NU vine niciodată din cerere ——
// Formularul afișează un preț, dar cine trimite cererea poate scrie orice în ea.
// Dacă taxa ar fi citită din corpul cererii, oricine s-ar înscrie cu 0 lei și ar
// trece de verificarea „ai plătit?" fără să fi plătit. Verificarea de aici prinde
// regresia în care cineva ar lega taxa de `body`.
{
  const { readFileSync } = await import("node:fs");
  const sursa = readFileSync(new URL("../inscriere-expo.mjs", import.meta.url), "utf8");
  const periculos = /\btaxa\s*=\s*(Number\()?\s*body\./.test(sursa) || /body\.taxa\b/.test(sursa);
  if (periculos) rau++;
  console.log((periculos ? "  RAU " : "  ok  ") + "taxa se recalculează pe server, nu se ia din cerere");

  const recalculeaza = /const taxa = grila\s*\n?\s*\?\s*calculeazaTaxa\(/.test(sursa);
  if (!recalculeaza) rau++;
  console.log((recalculeaza ? "  ok  " : "  RAU ") + "taxa se calculează cu calculeazaTaxa din grila expoziției");
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
