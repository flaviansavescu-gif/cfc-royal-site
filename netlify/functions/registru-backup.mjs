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
import { curataMagazia } from "./registru-acces.mjs";
// Criptarea și trimiterea stau în modul comun, împreună cu copia celorlalte magazii:
// formatul fișierului e contractul cu unealta de descifrare și se ține într-un loc.
import {
  cripteaza, asiguraRamura, puneCopia, configurareLipsa,
  stergeCopiiVechi, LUNI_DE_PASTRARE,
} from "./_comun/copie-cifrata.mjs";

/** Cât încape într-un fișier trimis prin API-ul GitHub, cu marjă. */
const MAX_FISIERE_AUTO = 15 * 1024 * 1024;

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default async () => {
  const parola = process.env.BACKUP_REGISTRU_PAROLA;
  // Lipsa configurării NU e o eroare tăcută: fără mesajul ăsta în jurnal, cineva ar
  // putea crede ani la rând că are copii de siguranță.
  const lipsa = configurareLipsa();
  if (lipsa) {
    console.error("COPIA REGISTRULUI NU S-A FĂCUT: lipsește " + lipsa);
    return json({ ok: false, motiv: "neconfigurat" }, 200);
  }

  try {
    // Curățenia ÎNAINTE de arhivare: altfel copia ar căra săptămână de săptămână
    // ciorne abandonate și scanurile lor. O curățenie care depinde de cine își aduce
    // aminte să apese un buton nu se face niciodată.
    let curatenie = null;
    try {
      curatenie = await curataMagazia();
      if (curatenie.ciorneSterse || curatenie.coduriSterse) {
        console.log(`Curățenie: ${curatenie.ciorneSterse} ciorne, ${curatenie.fisiereSterse} fișiere, ` +
          `${curatenie.coduriSterse} coduri scoase din fișe.`);
      }
    } catch (err) { console.error("Curățenia dinaintea copiei a eșuat:", err); }

    const { zip, rezumat } = await construiesteArhiva({ maxFisiere: MAX_FISIERE_AUTO });
    const cifrat = await cripteaza(zip, parola);
    await asiguraRamura();

    const azi = new Date().toISOString().slice(0, 10);
    const cale = await puneCopia(
      `copii/registru-${azi}.zip.enc`, cifrat,
      `Copie registru ${azi} — ${rezumat.inregistrari} înregistrări, ${rezumat.fisiere} fișiere`);

    if (rezumat.fisiereOmise.length) {
      console.warn(`Copie făcută, dar ${rezumat.fisiereOmise.length} fișiere au depășit limita ` +
        `automată de ${MAX_FISIERE_AUTO / 1048576} MB. Folosește exportul manual pentru arhiva completă.`);
    }
    // Curățenia copiilor vechi, DUPĂ ce cea nouă e sus: dacă ștergerea cade, măcar
    // copia de azi există. Politica de confidențialitate promite că o informație ștearsă
    // iese din copii în cel mult 12 luni — aici se ține promisiunea, nu în vorbe.
    let vechi = null;
    try {
      vechi = await stergeCopiiVechi();
      if (vechi.sterse.length) {
        console.log(`Copii mai vechi de ${LUNI_DE_PASTRARE} luni, șterse: ${vechi.sterse.join(", ")}`);
      }
      if (vechi.erori.length) console.error("Curățenia copiilor vechi, cu erori:", vechi.erori);
    } catch (err) {
      console.error("Curățenia copiilor vechi a eșuat:", err);
    }

    console.log(`Copia registrului: ${cale} · ${rezumat.inregistrari} înregistrări · ` +
      `${rezumat.fisiere} fișiere · ${(cifrat.length / 1048576).toFixed(1)} MB criptați`);
    return json({ ok: true, cale, ...rezumat, curatenie, copiiVechiSterse: vechi?.sterse?.length ?? 0 });
  } catch (err) {
    console.error("COPIA REGISTRULUI A EȘUAT:", err);
    console.error("registru-backup:", err); return json({ ok: false, eroare: "A apărut o eroare internă. Încearcă din nou." }, 500);
  }
};

// Duminică la 3 dimineața — când nimeni nu depune declarații.
export const config = { schedule: "0 3 * * 0" };
