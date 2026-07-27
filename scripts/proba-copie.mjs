// proba-copie.mjs — verifică lanțul copiei de siguranță: arhivă → criptare → descifrare.
//
// DE CE. O copie de siguranță se dovedește o singură dată: când ai nevoie de ea. Atunci
// e prea târziu să afli că parola nu se potrivește sau că arhiva nu se deschide. Proba
// asta parcurge tot drumul, inclusiv unealta de restaurare, exact cum ar face-o omul.
//
// Rulează: node scripts/proba-copie.mjs
import { zipSync, unzipSync } from "fflate";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

let rau = 0;
const t = (n, c, info) => { if (c) console.log("  ok  " + n); else { rau++; console.log("  RAU " + n + (info != null ? " -> " + info : "")); } };
const cod = new TextEncoder();
const SERIA = "CFCR-DMF-2026-0001";
const temp = (n) => join(tmpdir(), n);

const fisiere = {
  "CUPRINS.md": cod.encode("# Registrul genealogic CFC-Royal — copie de siguranță\n"),
  "date/dmf/abc.json": cod.encode(JSON.stringify({ serie: SERIA, pui: 5 })),
  "fisiere/dmf-fisier/abc/plata.jpg": new Uint8Array([255, 216, 255, 224, 1, 2, 3]),
};
const original = zipSync(fisiere, { level: 6 });

console.log("— arhiva —");
const desfacut = unzipSync(original);
t("arhiva se deschide", Object.keys(desfacut).length === 3);
t("cuprinsul e primul lucru", "CUPRINS.md" in desfacut);
t("datele stau in date/", "date/dmf/abc.json" in desfacut);
t("fisierele stau in fisiere/", "fisiere/dmf-fisier/abc/plata.jpg" in desfacut);
t("JSON-ul e citibil fara cod special",
  JSON.parse(new TextDecoder().decode(desfacut["date/dmf/abc.json"])).pui === 5);

// Aceeași criptare ca în netlify/functions/registru-backup.mjs.
async function cripteaza(octeti, parola) {
  const sare = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", cod.encode(parola), "PBKDF2", false, ["deriveKey"]);
  const cheie = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sare, iterations: 210000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const cifrat = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cheie, octeti));
  const out = new Uint8Array(5 + 16 + 12 + cifrat.length);
  out.set(cod.encode("CFCR1"), 0); out.set(sare, 5); out.set(iv, 21); out.set(cifrat, 33);
  return out;
}

console.log("— criptarea chiar ascunde —");
// Proba se face pe o arhivă NECOMPRIMATĂ. Pe una comprimată, șirul n-ar apărea literal
// nici înainte de criptare, deci „nu-l găsesc" n-ar dovedi nimic despre criptare.
const necomprimat = zipSync(fisiere, { level: 0 });
t("in arhiva necomprimata seria SE VEDE (proba de control)",
  Buffer.from(necomprimat).includes(Buffer.from(SERIA)));
const probaCifrata = await cripteaza(necomprimat, "parola-de-proba-123");
t("dupa criptare seria NU se mai vede",
  !Buffer.from(probaCifrata).includes(Buffer.from(SERIA)));

console.log("— drumul intreg, cu unealta de restaurare —");
const PAROLA = "parola-de-proba-123";
const cifrat = await cripteaza(original, PAROLA);
t("antetul CFCR1 e prezent", new TextDecoder().decode(cifrat.slice(0, 5)) === "CFCR1");

const caleEnc = temp("cfcr-proba.zip.enc");
const caleZip = temp("cfcr-proba-restaurat.zip");
writeFileSync(caleEnc, cifrat);
try {
  const iesire = execSync(`node scripts/descifreaza-copie.mjs "${caleEnc}" "${caleZip}"`, {
    encoding: "utf8", env: { ...process.env, BACKUP_REGISTRU_PAROLA: PAROLA } });
  t("unealta raporteaza succes", iesire.includes("Descifrat"), iesire.trim());
  const restaurat = new Uint8Array(readFileSync(caleZip));
  t("fisierul restaurat e identic cu originalul",
    Buffer.compare(Buffer.from(restaurat), Buffer.from(original)) === 0);
  const dd = unzipSync(restaurat);
  t("arhiva restaurata se deschide", Object.keys(dd).length === 3);
  t("scanul binar e neatins", dd["fisiere/dmf-fisier/abc/plata.jpg"][0] === 255);
  t("declaratia se citeste dupa restaurare",
    JSON.parse(new TextDecoder().decode(dd["date/dmf/abc.json"])).serie === SERIA);
} catch (e) { rau++; console.log("  RAU descifrarea a esuat -> " + (e.stdout || e.message)); }

console.log("— parola gresita —");
// Nu e destul ca scriptul să cadă: trebuie să cadă DIN MOTIVUL bun. Prima variantă a
// probei trecea și când scriptul avea o eroare de sintaxă — adică exact când unealta
// de restaurare era stricată.
try {
  execSync(`node scripts/descifreaza-copie.mjs "${caleEnc}" "${temp("cfcr-nu-conteaza.zip")}"`, {
    encoding: "utf8", env: { ...process.env, BACKUP_REGISTRU_PAROLA: "alta-parola" }, stdio: "pipe" });
  rau++; console.log("  RAU parola gresita a fost acceptata");
} catch (e) {
  const zis = String(e.stderr || e.stdout || "");
  t("parola gresita e respinsa CU MESAJUL potrivit",
    zis.includes("Nu am putut descifra"), zis.trim().split("\n")[0]);
}

for (const f of [caleEnc, caleZip]) { try { rmSync(f); } catch {} }
console.log(rau ? "\n" + rau + " căzute" : "\ntoate trecute");
process.exit(rau ? 1 : 0);
