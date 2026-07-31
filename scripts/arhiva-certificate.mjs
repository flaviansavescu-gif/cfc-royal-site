// arhiva-certificate.mjs — certificatele deja emise, ca sursă pentru numerele lipsă.
//
// DE CE. Formularul cuibului se scrie ÎNAINTE de emitere; numerele WDF individuale se
// atribuie DUPĂ. Când cineva salvează formularul între cele două momente, puii rămân în
// el cu ‹WDF.› și atât. Numărul lor există totuși — tipărit pe certificatul din mâna
// omului, în dosarul „Pedigree Pui".
//
// Cititorul de formulare nu ghicește niciodată un număr, și bine face. Aici nu ghicim
// nici noi: îl luăm din documentul emis, care e actul, și îl legăm de pui pe nume.
//
// TREI CHINGI, fiindcă un număr greșit aici înseamnă un act atribuit altui câine:
//   1. Potrivirea pe nume trebuie să fie EXACTĂ și unică. Două certificate care s-ar
//      potrivi la același pui, sau niciunul, opresc cuibul.
//   2. Puii care AU deja număr în formular se verifică față de certificat. Dacă nu se
//      potrivesc, cuibul se oprește — înseamnă că una dintre cele două surse minte.
//   3. Nu are voie să rămână niciun certificat nefolosit. Un certificat fără pui
//      înseamnă că am citit greșit fie formularul, fie dosarul.
import { readdirSync } from "node:fs";
import path from "node:path";

/** Numele, adus la o formă de comparat: fără diacritice, fără spații duble, majuscule. */
const cheie = (s) => String(s == null ? "" : s)
  .replace(/[ăâ]/gi, "a").replace(/[î]/gi, "i").replace(/[șş]/gi, "s").replace(/[țţ]/gi, "t")
  .replace(/\s+/g, " ").trim().toUpperCase();

/** Ultima parte a numelui: din „CĂȚELUȘUL POTRIVIT - MILO" iese „MILO". */
const numeScurt = (s) => {
  const p = String(s == null ? "" : s).split(/\s+[-–—]\s+/);
  return cheie(p[p.length - 1]);
};

/**
 * Seria, din numele fișierului. Pe disc apare cu cratimă („WDF-RO150195L25"), în registru
 * cu punct („WDF.RO150195L25") — e același număr, scris cum permite sistemul de fișiere.
 */
export function serieDinNume(numeFisier) {
  const m = /WDF[-_. ]?RO\s*(\d+)\s*([A-Z]\d{2})?/i.exec(String(numeFisier || ""));
  return m ? ("WDF.RO" + m[1] + (m[2] || "")).toUpperCase() : "";
}

/** Certificatele emise găsite în dosar: [{ serie, nume, fisier }]. */
export function certificateEmise(caleDosar) {
  let fisiere;
  try { fisiere = readdirSync(caleDosar); } catch { return []; }
  const out = [];
  for (const f of fisiere) {
    if (!/\.pdf$/i.test(f)) continue;
    const serie = serieDinNume(f);
    if (!serie) continue;
    // „WDF-RO150195L25 - Milo.pdf" -> numele e ce urmează după serie
    const dupa = path.basename(f, path.extname(f)).replace(/^.*?WDF[-_. ]?RO\s*\d+\s*(?:[A-Z]\d{2})?/i, "");
    out.push({ serie, nume: cheie(dupa.replace(/^[\s\-–—_]+/, "")), fisier: f });
  }
  return out;
}

/**
 * Pune numerele din certificate pe puii care nu le au, și verifică restul.
 * Modifică `pui` pe loc. Întoarce { completate, erori }.
 */
export function completeazaDinCertificate(pui, certificate) {
  const completate = [];
  const erori = [];
  if (!certificate.length) return { completate, erori };

  const folosite = new Set();

  pui.forEach((p, i) => {
    const cauta = numeScurt(p.nume);
    const gasite = certificate.filter((c) => c.nume && cauta && c.nume === cauta);

    if (gasite.length > 1) {
      erori.push(`puiul ${i + 1} (${p.nume}): ${gasite.length} certificate se potrivesc pe nume ` +
        `(${gasite.map((g) => g.serie).join(", ")}) — nu aleg eu`);
      return;
    }
    if (!gasite.length) {
      // Lipsa unui certificat e o problemă doar dacă puiul chiar n-are număr.
      if (!p.wdf) erori.push(`puiul ${i + 1} (${p.nume}): n-am găsit certificatul emis, iar formularul n-are număr`);
      return;
    }

    const c = gasite[0];
    folosite.add(c.serie);

    if (p.wdf && p.wdf !== c.serie) {
      erori.push(`puiul ${i + 1} (${p.nume}): formularul spune ${p.wdf}, certificatul spune ${c.serie}`);
      return;
    }
    if (!p.wdf) {
      p.wdf = c.serie;
      completate.push({ pui: i + 1, nume: p.nume, serie: c.serie, din: c.fisier });
    }
  });

  // Un certificat pe care nu l-a revendicat niciun pui înseamnă că cineva lipsește.
  for (const c of certificate) {
    if (!folosite.has(c.serie)) erori.push(`certificatul ${c.serie} (${c.fisier}) nu se potrivește cu niciun pui din formular`);
  }

  return { completate, erori };
}
