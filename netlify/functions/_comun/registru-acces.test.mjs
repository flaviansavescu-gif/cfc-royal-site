import handler from "../registru-acces.mjs";
const cere = (b) => handler(new Request("https://x/y", { method: "POST",
  headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }), {});
let rau = 0;
const t = async (nume, corp, ast) => {
  const r = await cere(corp);
  const bun = r.status === ast;
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + " -> " + r.status + " (asteptat " + ast + ")");
};
console.log("— solicitarea de acces (publica, fara cod) —");
await t("fara nume", { actiune: "cerere", email: "a@b.ro", telefon: "0740123456" }, 400);
await t("nume prea scurt", { actiune: "cerere", nume: "Io", email: "a@b.ro", telefon: "0740123456" }, 400);
await t("email invalid", { actiune: "cerere", nume: "Ion Popescu", email: "abc", telefon: "0740123456" }, 400);
await t("telefon prea scurt", { actiune: "cerere", nume: "Ion Popescu", email: "a@b.ro", telefon: "0740" }, 400);
await t("capcana umpluta -> tacere (200)", { actiune: "cerere", nume: "Robot Bot", email: "r@b.ro", telefon: "0740123456", website: "http://spam" }, 200);
console.log("— poarta administrarii —");
await t("listare cereri fara cod", { actiune: "cereri" }, 401);
await t("stergere cerere fara cod", { actiune: "cerere-sterge", id: "x" }, 401);
await t("trimitere cod fara drept de administrator", { actiune: "trimite-cod", codNou: "MBR-XXXX" }, 401);

// —— Destinatarul nu vine NICIODATA din cerere ——
// Trimiterea unui cod pe e-mail e cu un pas de „trimite orice text oriunde": daca
// adresa ar putea fi scrisa de client, functia ar deveni o unealta de expediere in
// numele asociatiei. Adresa se ia din fisa gasita dupa amprenta codului. Verificarea
// de aici prinde regresia in care cineva ar lega `catre` de corpul cererii.
{
  const { readFileSync } = await import("node:fs");
  const sursa = readFileSync(new URL("../registru-acces.mjs", import.meta.url), "utf8");
  const periculos = /catre:\s*(taie\()?body\./.test(sursa);
  if (periculos) rau++;
  console.log((periculos ? "  RAU " : "  ok  ") +
    "destinatarul e-mailului NU se ia din corpul cererii");
}

console.log("— chinotehnistii asociatiilor afiliate —");
await t("listare chinotehnisti fara cod", { actiune: "chinotehnisti" }, 401);
await t("adaugare chinotehnist fara cod", { actiune: "chinotehnist-adauga", nume: "Ion Pop", asociatie: "Asociatia X", email: "a@b.ro" }, 401);
await t("revocare chinotehnist fara cod", { actiune: "chinotehnist-sterge", id: "x" }, 401);

// Slugul asociatiei: pe el se leaga dosarele — diacriticele si spatiile trebuie sa
// dispara la fel de fiecare data, altfel aceeasi asociatie ar avea doua spatii.
{
  const { slugAsociatie } = await import("../registru-acces.mjs");
  const cazuri = [
    ["Asociația Chinologică Profesională CARPAȚII", "asociatia-chinologica-profesionala-carpatii"],
    ["  Strajerii   Munților  ", "strajerii-muntilor"],
    ["", ""],
  ];
  for (const [intrare, astept] of cazuri) {
    const gasit = slugAsociatie(intrare);
    const bun = gasit === astept;
    if (!bun) rau++;
    console.log((bun ? "  ok  " : "  RAU ") + "slug(" + JSON.stringify(intrare) + ") -> " + JSON.stringify(gasit));
  }
}

console.log(rau ? rau + " cazute" : "toate trecute");
process.exit(rau ? 1 : 0);
