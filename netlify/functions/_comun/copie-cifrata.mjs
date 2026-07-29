// =========================================================================
// copie-cifrata.mjs — criptarea unei copii de siguranță și trimiterea ei pe ramura
// de copii din depozitul privat.
//
// Partea asta era scrisă în `registru-backup.mjs` și mergea de luni de zile. Am scos-o
// aici NU ca să fie „mai frumos", ci pentru că a apărut al doilea client: copia
// celorlalte magazii. Două criptări scrise separat înseamnă, peste un an, două formate
// diferite — iar unealta de descifrare merge doar pe unul. Formatul e contractul dintre
// funcția care scrie copia și omul care, peste ani, o deschide; contractul se ține
// într-un singur loc.
//
// FORMATUL, neschimbat: "CFCR1" | sare(16) | iv(12) | cifrat(AES-GCM)
// Îl citește `scripts/descifreaza-copie.mjs` și îl probează `scripts/proba-copie.mjs`.
// Dacă vreodată se schimbă, se schimbă ACOLO în aceeași zi — altfel copiile vechi rămân
// niște octeți fără înțeles.
// =========================================================================

/** Antetul care spune ce e fișierul. O copie fără marcă e o copie pe care n-o recunoști. */
export const MARCA = "CFCR1";

/**
 * Criptare AES-GCM cu cheie derivată din parolă (PBKDF2, 210.000 de iterații — pragul
 * recomandat de OWASP pentru SHA-256). Antetul păstrează sarea și vectorul, ca arhiva
 * să se poată descifra doar cu parola, fără alte informații.
 */
export async function cripteaza(octeti, parola) {
  const sare = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(parola), "PBKDF2", false, ["deriveKey"]);
  const cheie = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sare, iterations: 210000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
  );
  const cifrat = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cheie, octeti));
  const out = new Uint8Array(5 + 16 + 12 + cifrat.length);
  out.set(new TextEncoder().encode(MARCA), 0);
  out.set(sare, 5);
  out.set(iv, 21);
  out.set(cifrat, 33);
  return out;
}

/** Pereche a criptării — folosită de probă, ca lanțul întreg să fie verificabil aici. */
export async function descifreaza(octeti, parola) {
  const marca = new TextDecoder().decode(octeti.slice(0, 5));
  if (marca !== MARCA) throw new Error("Nu e o copie CFC-Royal (marca: " + marca + ").");
  const sare = octeti.slice(5, 21);
  const iv = octeti.slice(21, 33);
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(parola), "PBKDF2", false, ["deriveKey"]);
  const cheie = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sare, iterations: 210000, hash: "SHA-256" },
    material, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cheie, octeti.slice(33)));
}

const base64 = (u8) => Buffer.from(u8).toString("base64");

export const REPO = () => process.env.BACKUP_GITHUB_REPO || "flaviansavescu-gif/cfc-royal-site";
export const RAMURA = () => process.env.BACKUP_GITHUB_RAMURA || "backup-registru";

async function github(cale, optiuni = {}) {
  return fetch("https://api.github.com" + cale, {
    ...optiuni,
    headers: {
      Authorization: "Bearer " + process.env.BACKUP_GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(optiuni.headers || {}),
    },
  });
}

/** Creează ramura de copii dacă nu există, pornind din vârful ramurii principale. */
export async function asiguraRamura() {
  const are = await github(`/repos/${REPO()}/git/ref/heads/${RAMURA()}`);
  if (are.ok) return true;
  const rep = await github(`/repos/${REPO()}`);
  if (!rep.ok) throw new Error("Depozitul nu răspunde: " + rep.status);
  const principala = (await rep.json()).default_branch;
  const varf = await github(`/repos/${REPO()}/git/ref/heads/${principala}`);
  if (!varf.ok) throw new Error("Nu am găsit vârful ramurii principale: " + varf.status);
  const sha = (await varf.json()).object.sha;
  const creat = await github(`/repos/${REPO()}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: "refs/heads/" + RAMURA(), sha }),
  });
  if (!creat.ok) throw new Error("Nu am putut crea ramura: " + creat.status + " " + (await creat.text()));
  return true;
}

/**
 * Pune fișierul pe ramura de copii. Dacă în aceeași zi mai există unul cu același nume
 * (repornire, rulare manuală), îl înlocuiește — o zi, o copie.
 */
export async function puneCopia(cale, octeti, mesaj) {
  let sha;
  const existent = await github(`/repos/${REPO()}/contents/${cale}?ref=${RAMURA()}`);
  if (existent.ok) sha = (await existent.json()).sha;

  const pus = await github(`/repos/${REPO()}/contents/${cale}`, {
    method: "PUT",
    body: JSON.stringify({
      message: mesaj,
      content: base64(octeti),
      branch: RAMURA(),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!pus.ok) throw new Error("Trimiterea a eșuat: " + pus.status + " " + (await pus.text()));
  return cale;
}

/** Lipsesc cheile? Spune-o o dată, limpede, la fel pentru toți cei care fac copii. */
export function configurareLipsa() {
  const lipsa = [
    !process.env.BACKUP_REGISTRU_PAROLA && "BACKUP_REGISTRU_PAROLA",
    !process.env.BACKUP_GITHUB_TOKEN && "BACKUP_GITHUB_TOKEN",
  ].filter(Boolean);
  return lipsa.length ? lipsa.join(" și ") : null;
}
