// descifreaza-copie.mjs — deschide o copie de siguranță a registrului genealogic.
//
// Copiile automate ajung criptate pe ramura `backup-registru`, în `copii/`. Fără unealta
// asta ar fi doar niște octeți: o copie pe care n-o poți descifra nu e o copie, e o
// speranță. Scriptul nu are nevoie de site, de Netlify sau de internet — doar de Node
// și de parolă.
//
// Folosire:
//   node scripts/descifreaza-copie.mjs copii/registru-2026-08-02.zip.enc [iesire.zip]
//
// Parola se cere de la tastatură, ca să nu rămână în istoricul liniei de comandă.
// Poate veni și din variabila BACKUP_REGISTRU_PAROLA, pentru rulări automate.
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const [, , intrare, iesireData] = process.argv;
if (!intrare) {
  console.error("Folosire: node scripts/descifreaza-copie.mjs <fisier.zip.enc> [iesire.zip]");
  process.exit(1);
}
const iesire = iesireData || intrare.replace(/\.enc$/, "") || "registru-restaurat.zip";

function cereParola() {
  if (process.env.BACKUP_REGISTRU_PAROLA) return Promise.resolve(process.env.BACKUP_REGISTRU_PAROLA);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((rez) => rl.question("Parola copiei: ", (r) => { rl.close(); rez(r); }));
}

const octeti = new Uint8Array(readFileSync(intrare));
// Format scris de registru-backup.mjs: "CFCR1" | sare(16) | iv(12) | cifrat
const antet = new TextDecoder().decode(octeti.slice(0, 5));
if (antet !== "CFCR1") {
  // Fără ghilimele românești în șiruri JS: „…" închide șirul și rupe scriptul.
  console.error("Fișierul nu pare o copie a registrului (antet: " + antet + ").");
  process.exit(1);
}
const sare = octeti.slice(5, 21);
const iv = octeti.slice(21, 33);
const cifrat = octeti.slice(33);

const parola = await cereParola();
const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(parola), "PBKDF2", false, ["deriveKey"]);
const cheie = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt: sare, iterations: 210000, hash: "SHA-256" },
  material, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
);

try {
  const clar = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cheie, cifrat));
  writeFileSync(iesire, clar);
  console.log("✓ Descifrat în " + iesire + " (" + (clar.length / 1048576).toFixed(1) + " MB).");
  console.log("  Deschide-l ca pe orice arhivă ZIP; începe cu CUPRINS.md.");
} catch {
  // AES-GCM nu spune „parolă greșită", spune doar că nu se verifică — dar în practică
  // asta înseamnă fie parola greșită, fie fișierul stricat.
  console.error("Nu am putut descifra: parolă greșită sau fișier deteriorat.");
  process.exit(1);
}
