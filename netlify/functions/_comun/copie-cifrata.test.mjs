// copie-cifrata.test.mjs — probează că mutarea criptării în modul comun N-A SCHIMBAT
// formatul fișierului.
//
// Mutarea unui cod care merge e cea mai ieftină cale spre un dezastru tăcut: copia
// săptămânală pleacă mai departe, nimeni nu se uită la ea, iar peste un an se descoperă
// că unealta de descifrare nu mai potrivește antetul. Proba asta ține formatul locului.
//
// Rulează: node netlify/functions/_comun/copie-cifrata.test.mjs
import { cripteaza, descifreaza, MARCA, configurareLipsa } from "./copie-cifrata.mjs";
import { readFileSync } from "node:fs";

let rau = 0;
const e = (nume, bun, info) => {
  if (!bun) rau++;
  console.log((bun ? "  ok  " : "  RAU ") + nume + (!bun && info != null ? " -> " + info : ""));
};

const cod = new TextEncoder();
const PAROLA = "parolă de probă, cu diacritice și spații";

console.log("— formatul, neschimbat: „CFCR1\" | sare(16) | iv(12) | cifrat —");
{
  const original = cod.encode("Declarație de montă și fătare — CFCR-DMF-2026-0001");
  const c = await cripteaza(original, PAROLA);

  e("marca e la început", new TextDecoder().decode(c.slice(0, 5)) === MARCA);
  e("marca e exact „CFCR1\"", MARCA === "CFCR1", MARCA);
  e("antetul are 33 de octeți înainte de date", c.length === 33 + original.length + 16,
    "lungime " + c.length + ", text " + original.length);
  // 16 = eticheta de autentificare AES-GCM, adăugată la sfârșit.

  const inapoi = await descifreaza(c, PAROLA);
  e("se descifrează la fix ce era", new TextDecoder().decode(inapoi) === new TextDecoder().decode(original));
}

console.log("— fără parola bună nu se deschide —");
{
  const c = await cripteaza(cod.encode("ceva"), PAROLA);
  let aAruncat = false;
  try { await descifreaza(c, "altă parolă"); } catch { aAruncat = true; }
  e("parola greșită dă eroare, nu date greșite", aAruncat);

  let aAruncatMarca = false;
  try { await descifreaza(cod.encode("XXXXX" + "0".repeat(60)), PAROLA); } catch { aAruncatMarca = true; }
  e("un fișier străin e refuzat după marcă", aAruncatMarca);
}

console.log("— sarea și vectorul sunt altele de fiecare dată —");
{
  const a = await cripteaza(cod.encode("același text"), PAROLA);
  const b = await cripteaza(cod.encode("același text"), PAROLA);
  const felie = (u8, de, la) => Buffer.from(u8.slice(de, la)).toString("hex");
  e("sare diferită la a doua criptare", felie(a, 5, 21) !== felie(b, 5, 21));
  e("vector diferit la a doua criptare", felie(a, 21, 33) !== felie(b, 21, 33));
  e("deci și textul cifrat iese altfel", felie(a, 33, 60) !== felie(b, 33, 60));
}

console.log("— unealta de descifrare citește ACELAȘI format —");
{
  // Dacă cineva schimbă formatul aici și uită scriptul, copiile devin niște octeți.
  const s = readFileSync(new URL("../../../scripts/descifreaza-copie.mjs", import.meta.url), "utf8");
  e("scriptul caută marca CFCR1", s.includes("CFCR1"));
  e("scriptul taie antetul la 33", /slice\(\s*33\s*\)/.test(s) || s.includes("33"));
  e("scriptul folosește 210000 de iterații", s.includes("210000"));
}

console.log("— configurarea lipsă se spune pe nume —");
{
  const paroleVechi = [process.env.BACKUP_REGISTRU_PAROLA, process.env.BACKUP_GITHUB_TOKEN];
  delete process.env.BACKUP_REGISTRU_PAROLA;
  delete process.env.BACKUP_GITHUB_TOKEN;
  e("le numește pe amândouă", configurareLipsa() === "BACKUP_REGISTRU_PAROLA și BACKUP_GITHUB_TOKEN");
  process.env.BACKUP_REGISTRU_PAROLA = "x";
  e("o numește pe cea care lipsește", configurareLipsa() === "BACKUP_GITHUB_TOKEN");
  process.env.BACKUP_GITHUB_TOKEN = "y";
  e("tace când e totul pus", configurareLipsa() === null);
  if (paroleVechi[0] != null) process.env.BACKUP_REGISTRU_PAROLA = paroleVechi[0]; else delete process.env.BACKUP_REGISTRU_PAROLA;
  if (paroleVechi[1] != null) process.env.BACKUP_GITHUB_TOKEN = paroleVechi[1]; else delete process.env.BACKUP_GITHUB_TOKEN;
}

console.log("— amândouă copiile folosesc același modul —");
{
  const reg = readFileSync(new URL("../registru-backup.mjs", import.meta.url), "utf8");
  const mag = readFileSync(new URL("../magazii-backup.mjs", import.meta.url), "utf8");
  e("copia registrului îl importă", reg.includes('from "./_comun/copie-cifrata.mjs"'));
  e("copia magaziilor îl importă", mag.includes('from "./_comun/copie-cifrata.mjs"'));
  e("copia registrului nu mai are criptare proprie", !reg.includes("PBKDF2"));
  e("nici trimitere proprie", !reg.includes("api.github.com"));
}

console.log(rau ? rau + " căzute" : "toate trecute");
process.exit(rau ? 1 : 0);
