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
console.log(rau ? rau + " cazute" : "toate trecute");
process.exit(rau ? 1 : 0);
