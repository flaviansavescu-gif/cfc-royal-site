// =========================================================================
// copie-acum.mjs — declanșează LA CERERE copiile de siguranță ale datelor site-ului.
//
// DE CE EXISTĂ. Copiile automate (`registru-backup`, `magazii-backup`) rulează doar
// duminica. Dar sunt clipe în care vrei o copie ACUM, nu peste o săptămână: după ce ai
// schimbat parola de criptare (ca să existe o arhivă pe care noua parolă chiar o
// deschide), înaintea probei anuale, sau pur și simplu înainte de o schimbare mare.
//
// Rulează exact aceeași logică — nicio a doua cale prin care s-ar putea strica ceva.
// Se cheamă cele două funcții programate și li se adună rezultatele.
//
// PROTECȚIE. Un declanșator de copie citește toate datele asociației și scrie în depozit;
// nu poate sta deschis. Cere secretul comun `EXPO_SYNC_SECRET` (cel dintre manager și
// site), printr-un POST — nu în adresă, ca să nu rămână în jurnalele de acces.
//
//   POST /.netlify/functions/copie-acum   { "secret": "..." }
//
// AUTO-PROBĂ. După ce scrie arhivele, le aduce înapoi de pe ramură și le descifrează cu
// parola din mediu. Dacă se deschid, răspunsul o spune: nu doar „am scris o arhivă", ci
// „am scris o arhivă pe care parola de acum chiar o deschide".
// =========================================================================
import registruBackup from "./registru-backup.mjs";
import { secretEgal } from "./_comun/secret.mjs";
import magaziiBackup from "./magazii-backup.mjs";
import { descifreaza, REPO, RAMURA } from "./_comun/copie-cifrata.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status, headers: { "Content-Type": "application/json; charset=utf-8" },
  });

/** Aduce o arhivă de pe ramura de copii și încearcă s-o deschidă cu parola din mediu. */
async function probeazaArhiva(cale) {
  const parola = process.env.BACKUP_REGISTRU_PAROLA;
  if (!parola) return { cale, deschisa: false, motiv: "fără parolă în mediu" };
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO()}/contents/${cale}?ref=${RAMURA()}`, {
      headers: {
        Authorization: "Bearer " + process.env.BACKUP_GITHUB_TOKEN,
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!r.ok) return { cale, deschisa: false, motiv: "nu am putut aduce arhiva: " + r.status };
    const octeti = new Uint8Array(await r.arrayBuffer());
    const clar = await descifreaza(octeti, parola);
    const eZip = clar[0] === 0x50 && clar[1] === 0x4b; // "PK"
    return { cale, deschisa: true, eZip, octeti: clar.length };
  } catch (err) {
    return { cale, deschisa: false, motiv: err.message };
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return json({ eroare: "Folosește POST cu { secret }." }, 405);
  }
  const body = await req.json().catch(() => null);
  if (!body || !secretEgal(body.secret, process.env.EXPO_SYNC_SECRET)) {
    return json({ eroare: "Neautorizat" }, 401);
  }

  const pornit = new Date().toISOString();
  const rezultat = { pornit, registru: null, magazii: null, proba: [] };

  // Registrul întâi, ca la program (3:00 înaintea celorlalte). Fiecare cu try/catch-ul ei:
  // dacă una cade, cealaltă tot pleacă, și răspunsul spune limpede care a mers.
  try {
    rezultat.registru = await (await registruBackup(new Request("https://local/registru", { method: "POST" }))).json();
  } catch (err) {
    rezultat.registru = { ok: false, eroare: err.message };
  }
  try {
    rezultat.magazii = await (await magaziiBackup()).json();
  } catch (err) {
    rezultat.magazii = { ok: false, eroare: err.message };
  }

  // Auto-probă: adună căile scrise și încearcă să le deschidă cu parola de acum.
  const cai = [];
  if (rezultat.registru?.cale) cai.push(rezultat.registru.cale);
  for (const m of rezultat.magazii?.reusite || []) if (m.cale) cai.push(m.cale);
  for (const cale of cai) rezultat.proba.push(await probeazaArhiva(cale));

  const toateDeschise = rezultat.proba.length > 0 && rezultat.proba.every((p) => p.deschisa);
  const ok = rezultat.registru?.ok !== false && rezultat.magazii?.ok !== false && toateDeschise;
  rezultat.ok = ok;
  rezultat.rezumat = ok
    ? `${cai.length} arhive scrise și TOATE se deschid cu parola de acum.`
    : "Ceva n-a mers — vezi câmpurile de mai sus.";

  return json(rezultat, ok ? 200 : 500);
};
