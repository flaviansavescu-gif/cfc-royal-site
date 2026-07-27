// registru-backup.mjs — copia automată a registrului genealogic, o dată pe săptămână.
//
// Rulează singură (funcție programată Netlify) și pune o arhivă CRIPTATĂ pe o ramură
// separată din depozitul privat. Ramura e separată fiindcă istoricul de cod și copiile
// de siguranță n-au ce căuta împreună: una se citește, cealaltă se restaurează.
//
// DE CE CRIPTATĂ. Arhiva conține nume, adrese, telefoane și scanuri de acte. Depozitul
// e privat, dar „privat" înseamnă doar că azi are acces cine trebuie. Cheia rămâne la
// asociație, în variabila `BACKUP_REGISTRU_PAROLA`; fără ea, arhiva nu spune nimic
// nimănui — nici măcar cuiva care ajunge la depozit.
//
// PAROLA TREBUIE SĂ EXISTE ȘI ÎN AFARA ACESTUI SISTEM. O copie pe care n-o poți
// descifra e o copie pierdută. Ține-o și pe telefon, ca la managerul de expoziții.
//
// Variabile de mediu (Netlify → Site settings → Environment variables):
//   BACKUP_REGISTRU_PAROLA  — parola de criptare (obligatorie)
//   BACKUP_GITHUB_TOKEN     — jeton GitHub cu drept de scriere pe depozit (obligatoriu)
//   BACKUP_GITHUB_REPO      — implicit „flaviansavescu-gif/cfc-royal-site"
//   BACKUP_GITHUB_RAMURA    — implicit „backup-registru"
import { construiesteArhiva } from "./_comun/registru-arhiva.mjs";

const REPO = process.env.BACKUP_GITHUB_REPO || "flaviansavescu-gif/cfc-royal-site";
const RAMURA = process.env.BACKUP_GITHUB_RAMURA || "backup-registru";
/** Cât încape într-un fișier trimis prin API-ul GitHub, cu marjă. */
const MAX_FISIERE_AUTO = 15 * 1024 * 1024;

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

/**
 * Criptare AES-GCM cu cheie derivată din parolă (PBKDF2, 210.000 de iterații — pragul
 * recomandat de OWASP pentru SHA-256). Antetul păstrează sarea și vectorul, ca arhiva
 * să se poată descifra doar cu parola, fără alte informații.
 */
async function cripteaza(octeti, parola) {
  const sare = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(parola), "PBKDF2", false, ["deriveKey"]);
  const cheie = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sare, iterations: 210000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
  );
  const cifrat = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cheie, octeti));
  // Format: "CFCR1" | sare(16) | iv(12) | cifrat
  const out = new Uint8Array(5 + 16 + 12 + cifrat.length);
  out.set(new TextEncoder().encode("CFCR1"), 0);
  out.set(sare, 5);
  out.set(iv, 21);
  out.set(cifrat, 33);
  return out;
}

const base64 = (u8) => Buffer.from(u8).toString("base64");

async function github(cale, optiuni = {}) {
  const r = await fetch("https://api.github.com" + cale, {
    ...optiuni,
    headers: {
      Authorization: "Bearer " + process.env.BACKUP_GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(optiuni.headers || {}),
    },
  });
  return r;
}

/** Creează ramura de copii dacă nu există, pornind din vârful ramurii principale. */
async function asiguraRamura() {
  const are = await github(`/repos/${REPO}/git/ref/heads/${RAMURA}`);
  if (are.ok) return true;
  const rep = await github(`/repos/${REPO}`);
  if (!rep.ok) throw new Error("Depozitul nu răspunde: " + rep.status);
  const principala = (await rep.json()).default_branch;
  const varf = await github(`/repos/${REPO}/git/ref/heads/${principala}`);
  if (!varf.ok) throw new Error("Nu am găsit vârful ramurii principale: " + varf.status);
  const sha = (await varf.json()).object.sha;
  const creat = await github(`/repos/${REPO}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: "refs/heads/" + RAMURA, sha }),
  });
  if (!creat.ok) throw new Error("Nu am putut crea ramura: " + creat.status + " " + (await creat.text()));
  return true;
}

export default async () => {
  const parola = process.env.BACKUP_REGISTRU_PAROLA;
  const jeton = process.env.BACKUP_GITHUB_TOKEN;
  // Lipsa configurării NU e o eroare tăcută: fără mesajul ăsta în jurnal, cineva ar
  // putea crede ani la rând că are copii de siguranță.
  if (!parola || !jeton) {
    console.error("COPIA REGISTRULUI NU S-A FĂCUT: lipsește " +
      [!parola && "BACKUP_REGISTRU_PAROLA", !jeton && "BACKUP_GITHUB_TOKEN"].filter(Boolean).join(" și "));
    return json({ ok: false, motiv: "neconfigurat" }, 200);
  }

  try {
    const { zip, rezumat } = await construiesteArhiva({ maxFisiere: MAX_FISIERE_AUTO });
    const cifrat = await cripteaza(zip, parola);
    await asiguraRamura();

    const azi = new Date().toISOString().slice(0, 10);
    const cale = `copii/registru-${azi}.zip.enc`;

    // Dacă în aceeași zi mai există una (repornire, rulare manuală), o înlocuim.
    let sha;
    const existent = await github(`/repos/${REPO}/contents/${cale}?ref=${RAMURA}`);
    if (existent.ok) sha = (await existent.json()).sha;

    const pus = await github(`/repos/${REPO}/contents/${cale}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Copie registru ${azi} — ${rezumat.inregistrari} înregistrări, ${rezumat.fisiere} fișiere`,
        content: base64(cifrat),
        branch: RAMURA,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!pus.ok) throw new Error("Trimiterea a eșuat: " + pus.status + " " + (await pus.text()));

    if (rezumat.fisiereOmise.length) {
      console.warn(`Copie făcută, dar ${rezumat.fisiereOmise.length} fișiere au depășit limita ` +
        `automată de ${MAX_FISIERE_AUTO / 1048576} MB. Folosește exportul manual pentru arhiva completă.`);
    }
    console.log(`Copia registrului: ${cale} · ${rezumat.inregistrari} înregistrări · ` +
      `${rezumat.fisiere} fișiere · ${(cifrat.length / 1048576).toFixed(1)} MB criptați`);
    return json({ ok: true, cale, ...rezumat });
  } catch (err) {
    console.error("COPIA REGISTRULUI A EȘUAT:", err);
    return json({ ok: false, eroare: err.message }, 500);
  }
};

// Duminică la 3 dimineața — când nimeni nu depune declarații.
export const config = { schedule: "0 3 * * 0" };
