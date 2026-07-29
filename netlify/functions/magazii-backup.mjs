// =========================================================================
// magazii-backup.mjs — copia automată a CELORLALTE magazii, o dată pe săptămână.
//
// Registrul genealogic avea copie de siguranță din prima zi, fiindcă acolo stau
// pedigree-urile. Restul datelor asociației — Școala de Arbitraj cu tot parcursul
// candidaților, înscrierile online cu verificările registraturii, sesiunile din Judge
// Comparison Room — nu aveau niciuna. Trăiau într-un singur loc, la un singur furnizor,
// și dacă acel loc s-ar fi pierdut, s-ar fi pierdut și ele.
//
// FIECARE MAGAZIE, FIȘIERUL EI. Nu una mare: dacă una se strică sau se umflă peste
// limita GitHub, celelalte trebuie să plece oricum. De aceea fiecare are try/catch-ul
// ei, iar la sfârșit se spune limpede care au reușit și care nu.
//
// ACEEAȘI PAROLĂ ca la registru (`BACKUP_REGISTRU_PAROLA`) și aceeași ramură. O a doua
// parolă ar însemna încă un lucru de ținut minte și încă un fel în care o copie devine
// nedescifrabilă. Se deschid toate cu `node scripts/descifreaza-copie.mjs`.
//
// Variabile de mediu — aceleași cu ale copiei registrului:
//   BACKUP_REGISTRU_PAROLA, BACKUP_GITHUB_TOKEN, BACKUP_GITHUB_REPO, BACKUP_GITHUB_RAMURA
// =========================================================================
import { arhiveazaMagazia, MAGAZII } from "./_comun/magazie-arhiva.mjs";
import { cripteaza, asiguraRamura, puneCopia, configurareLipsa } from "./_comun/copie-cifrata.mjs";

/** Cât încape într-un fișier trimis prin API-ul GitHub, cu marjă. */
const MAX_FISIERE = 10 * 1024 * 1024;

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

export default async () => {
  const lipsa = configurareLipsa();
  // Lipsa configurării NU e o eroare tăcută: fără mesajul ăsta în jurnal, cineva ar putea
  // crede ani la rând că are copii de siguranță.
  if (lipsa) {
    console.error("COPIA MAGAZIILOR NU S-A FĂCUT: lipsește " + lipsa);
    return json({ ok: false, motiv: "neconfigurat" }, 200);
  }

  const parola = process.env.BACKUP_REGISTRU_PAROLA;
  const azi = new Date().toISOString().slice(0, 10);
  const reusite = [];
  const cazute = [];

  try {
    await asiguraRamura();
  } catch (err) {
    console.error("COPIA MAGAZIILOR A EȘUAT (ramura):", err);
    return json({ ok: false, eroare: err.message }, 500);
  }

  for (const { nume } of MAGAZII) {
    try {
      const { zip, rezumat } = await arhiveazaMagazia(nume, { maxFisiere: MAX_FISIERE });

      // O magazie goală nu e o eroare (Breed Explorer poate n-are încă instalări), dar nu
      // are rost să umple ramura cu arhive de zero înregistrări.
      if (!rezumat.inregistrari && !rezumat.fisiere) {
        console.log(`Magazia „${nume}" e goală — nicio copie.`);
        reusite.push({ magazie: nume, goala: true });
        continue;
      }

      const cifrat = await cripteaza(zip, parola);
      const cale = `copii/${nume}-${azi}.zip.enc`;
      await puneCopia(cale, cifrat,
        `Copie ${nume} ${azi} — ${rezumat.inregistrari} înregistrări, ${rezumat.fisiere} fișiere`);

      if (rezumat.fisiereOmise.length) {
        console.warn(`„${nume}": ${rezumat.fisiereOmise.length} fișiere au depășit limita de ` +
          `${MAX_FISIERE / 1048576} MB și NU sunt în copie.`);
      }
      console.log(`Copie „${nume}": ${cale} · ${rezumat.inregistrari} înregistrări · ` +
        `${rezumat.fisiere} fișiere · ${rezumat.sarite} chei trecătoare sărite · ` +
        `${(cifrat.length / 1048576).toFixed(1)} MB criptați`);
      reusite.push({ magazie: nume, cale, inregistrari: rezumat.inregistrari, fisiere: rezumat.fisiere });
    } catch (err) {
      // Una căzută nu le oprește pe celelalte. Dar se strigă, nu se înghite.
      console.error(`COPIA MAGAZIEI „${nume}" A EȘUAT:`, err);
      cazute.push({ magazie: nume, eroare: err.message });
    }
  }

  if (cazute.length) {
    console.error(`ATENȚIE: ${cazute.length} din ${MAGAZII.length} magazii nu s-au salvat: ` +
      cazute.map((x) => x.magazie).join(", "));
  }
  return json({ ok: cazute.length === 0, azi, reusite, cazute }, cazute.length ? 500 : 200);
};

// Duminică la 3:30 — la o jumătate de oră după copia registrului, ca să nu se bată pe
// aceeași ramură și pe aceleași minute de funcție.
export const config = { schedule: "30 3 * * 0" };
