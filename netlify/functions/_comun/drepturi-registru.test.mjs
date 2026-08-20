import { poateFace, jurnalDoarAleMele, motivRefuz, ANTET_REFUZ_DREPT } from "./drepturi-registru.mjs";
import { readFileSync } from "node:fs";

let rau = 0;
const e = (nume, bun) => { if (!bun) rau++; console.log((bun ? "  ok  " : "  RAU ") + nume); };

const ADMIN = { rol: "admin" };
const REG = { rol: "registratura", poateDaAcces: false };
const REG_CU_DREPT = { rol: "registratura", poateDaAcces: true };

console.log("— administratorul poate tot —");
for (const a of ["cereri", "membri", "membru-adauga", "membru-sterge", "registratori",
                 "registrator-adauga", "registrator-sterge", "curatenie", "monitor", "trimite-cod"]) {
  e("admin: " + a, poateFace(a, ADMIN));
}

console.log("— munca de secretariat e a oricărui registrator —");
for (const a of ["cereri", "cerere-sterge", "membri", "jurnal", "jurnal-fapte"]) {
  e("registrator: " + a, poateFace(a, REG));
}

console.log("— dar codurile le dă doar cel desemnat —");
for (const a of ["membru-adauga", "membru-cotizatie", "trimite-cod"]) {
  e("registrator FĂRĂ drept nu poate: " + a, !poateFace(a, REG));
  e("registratorul desemnat poate: " + a, poateFace(a, REG_CU_DREPT));
}

console.log("— registratura DĂ acces, administratorul îl IA —");
e("nici măcar cel desemnat nu poate șterge un membru", !poateFace("membru-sterge", REG_CU_DREPT));
e("nu-și poate vedea colegii de registratură", !poateFace("registratori", REG_CU_DREPT));
e("nu poate adăuga un registrator", !poateFace("registrator-adauga", REG_CU_DREPT));
e("nu poate șterge un registrator", !poateFace("registrator-sterge", REG_CU_DREPT));
e("nu poate schimba e-mailul unui registrator", !poateFace("registrator-email", REG_CU_DREPT));
e("nu poate descărca arhiva / face curățenie", !poateFace("curatenie", REG_CU_DREPT));
e("nu vede starea sistemului", !poateFace("monitor", REG_CU_DREPT));

console.log("— o acțiune necunoscută e închisă, nu deschisă —");
e("acțiune nouă, neenumerată", !poateFace("actiune-viitoare-oarecare", REG_CU_DREPT));
e("acțiune inventată de client", !poateFace("stergeTot", REG));
e("admin trece oricum", poateFace("actiune-viitoare-oarecare", ADMIN));

console.log("— fără actor nu se poate nimic —");
e("null", !poateFace("cereri", null));
e("rol necunoscut", !poateFace("cereri", { rol: "membru" }));
e("rol lipsă", !poateFace("cereri", {}));
e("„poateDaAcces\" adevărat la alt rol nu ajută", !poateFace("membru-adauga", { rol: "membru", poateDaAcces: true }));

console.log("— jurnalul: registratura își vede doar faptele ei —");
e("registratura, felie proprie", jurnalDoarAleMele(REG) === true);
e("administratorul vede tot", jurnalDoarAleMele(ADMIN) === false);

console.log("— mesajul de refuz spune ce se poate face —");
e("îl trimite la administrator pentru dreptul lipsă",
  motivRefuz("membru-adauga", REG).includes("administratorul"));
e("mesaj generic în rest", motivRefuz("curatenie", REG) === "Nu ai dreptul la această operațiune.");

console.log("— refuzul de drept se deosebește de o încercare de spargere —");
{
  const sursa = readFileSync(new URL("../registru-acces.mjs", import.meta.url), "utf8");
  e("poarta pune antetul pe refuzul de drept", sursa.includes("ANTET_REFUZ_DREPT"));
  const lim = readFileSync(new URL("./limitare.mjs", import.meta.url), "utf8");
  e("limitatorul citește antetul", lim.includes("ANTET_REFUZ_DREPT"));
  e("și nu mai numără orbește 403", lim.includes("!refuzDeDrept"));
  // Dispozitivul nerecunoscut e altceva: acolo chiar poate fi un cod furat, folosit de
  // pe alt calculator. Refuzul acela NU poartă antetul, deci rămâne numărat.
  const intreCele = sursa.slice(
    sursa.indexOf("dispozitivCunoscut(store(), dispozitiv, eu.rol)"),
    sursa.indexOf("poateFace(actiune, eu)"),
  );
  e("dispozitivul nerecunoscut RĂMÂNE numărat", !intreCele.includes("ANTET_REFUZ_DREPT"));
  e("antetul are un nume", typeof ANTET_REFUZ_DREPT === "string" && ANTET_REFUZ_DREPT.length > 3);
}

console.log("— alerta de cerere ajunge la cine poate rezolva —");
{
  const acc = readFileSync(new URL("../registru-acces.mjs", import.meta.url), "utf8");
  e("cererea strânge adresele registratorilor", acc.includes("anuntaLa"));
  const jur = readFileSync(new URL("./registru-jurnal.mjs", import.meta.url), "utf8");
  e("jurnalul le folosește", jur.includes("anunta(intrare, date?.anuntaLa)"));
  // Lista se dă ÎNTREAGĂ lui trimite() — join(",") făcea din două adrese UN „destinatar"
  // pe care Brevo îl respingea în tăcere (defect reparat 20.08).
  e("adresa asociației rămâne rezervă", jur.includes("destinatari.length ? destinatari : ADRESA_ASOCIATIEI"));
  e("lista NU se mai lipește cu virgulă", !jur.includes("destinatari.join"));
  e("textul nu mai trimite la secțiunea scoasă", !jur.includes("Solicitări de acces"));
  e("textul trimite la spațiul Registraturii", jur.includes("registru/registratura"));
}

// —— Poarta e chiar folosită, nu doar scrisă ——
// Un tabel de drepturi frumos, pe care funcția nu-l consultă, e mai rău decât niciunul:
// dă impresia că zona e apărată.
{
  const sursa = readFileSync(new URL("../registru-acces.mjs", import.meta.url), "utf8");
  e("registru-acces cheamă poateFace", /poateFace\(/.test(sursa));
  e("nu mai există poarta veche „doar administratorul\"",
    !/rol !== "admin"\)\s*\n?\s*return json\(\{ eroare: "Doar administratorul poate administra/.test(sursa));
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
