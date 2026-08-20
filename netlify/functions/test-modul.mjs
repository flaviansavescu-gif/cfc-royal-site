// test-modul.mjs — corectează testele platformei de cursuri (Școala de Arbitraj).
// Cheile de corectare stau NUMAI aici (pe server) — nu apar în paginile publice.
// La fiecare test corectat: rezultatul se salvează în registrul de rezultate (Netlify Blobs)
// și se trimite pe e-mail secretariatului prin Brevo (BREVO_API_KEY din environment).
//
// POARTĂ (adăugată la auditul de securitate). Funcția AVEA efecte fără nicio acreditare:
// oricine, fără cod, putea POSTa un rezultat „PROMOVAT" sub orice nume (otrăvind registrul
// de rezultate citit de administrator), umfla progresul unui candidat al cărui cid îl
// știa și inunda secretariatul cu e-mailuri. Acum orice corectare cere o identitate de
// platformă validă — ori cid-ul unui candidat înscris, ori un cod de admin/lector/arbitru/
// cod comun de candidați (exact cine are voie în Școală). Fără ea: 401, fără niciun efect.
import { getStore } from "@netlify/blobs";
import { rolLaIntrare, sha256 } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { trimite } from "./_comun/posta.mjs";
import { stareTermen, aplicaPenalizarea, formateazaTermen } from "./_comun/termen-test.mjs";

const PRAG = 70; // procent minim de promovare

/**
 * Cine cere corectarea? Aceeași poartă ca la datele de rase (breed-date): oricine e în
 * platforma Școlii — admin, lector, arbitru, candidat (cod individual sau codul comun).
 * Întoarce { rol, candidatId } sau null. `candidatId` e pus DOAR pentru un candidat cu cod
 * individual, ca progresul personal să se lege de identitatea autentificată, nu de un `id`
 * scris de client.
 */
async function cine({ cod, store }) {
  // Toți DOVEDESC un cod (M1): candidatul cu cod individual nu se mai identifică prin
  // insignă (care ajungea în listele lectorilor), ci prin codul lui. Serverul calculează
  // insigna. Un lector care vede insigna altui candidat nu-l mai poate impersona aici.
  const cod0 = String(cod || "").trim();
  if (!cod0) return null;
  const r = rolLaIntrare(cod0);
  if (r) {
    // Codul comun de candidați și rolurile de administrare NU au insignă personală.
    if (r.rol === "acces" || r.rol === "admin" || r.rol === "lector")
      return { rol: r.rol === "acces" ? "candidat-comun" : r.rol, candidatId: null };
  }
  const arb = await store.get("arbitru/" + sha256(cod0), { type: "json" }).catch(() => null);
  if (arb) return { rol: "arbitru", candidatId: null };
  const cand = await store.get("candidat/" + sha256(cod0), { type: "json" }).catch(() => null);
  if (cand) return { rol: "candidat", candidatId: sha256(cod0), nume: cand.nume || "" };
  return null;
}

// Cheia de răspunsuri per modul (indexul opțiunii corecte pentru fiecare întrebare).
const CHEI = {
  "modul-1": [0, 1, 2, 0, 1, 2, 1, 0, 1, 0, 1, 2],
  "modul-2": [0, 2, 1, 0, 1, 2, 0, 1, 2, 1],
  "modul-3": [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2],
  "modul-4": [0, 1, 2, 1, 0, 2, 1, 0, 2, 1],
  "modul-5": [1, 0, 2, 1, 0, 2, 1, 0, 2, 1],
  "modul-6": [1, 0, 2, 0, 2, 1, 0, 2, 1, 0],
  "modul-7": [1, 0, 2, 1, 0, 2, 1, 0, 2, 1],
  "modul-8": [0, 1, 2, 1, 0, 2, 1, 2, 0, 2],
  // Manualul de studiu individual (128 de pagini) — întrebările sunt în MANUAL.intrebari.
  "manual-studiu": [1, 2, 0, 2, 0, 1, 0, 2, 1, 2, 1, 0, 1, 0, 2],
};

const TITLURI = {
  "modul-1": "Modul 1 — Rolul, etica și conduita arbitrului",
  "modul-2": "Modul 2 — Structura expozițiilor și clasele de înscriere",
  "modul-3": "Modul 3 — Titlurile WDF: CAJC, CAC, CACIB, JBOB, BOB, BBR",
  "modul-4": "Modul 4 — Procedura completă de arbitraj",
  "modul-5": "Modul 5 — Ringul de onoare (Best in Show)",
  "modul-6": "Modul 6 — Situații speciale: DSQ, N.J., abateri",
  "modul-7": "Modul 7 — Contestații și procedura disciplinară",
  "modul-8": "Modul 8 — Rolul delegatului WDF",
  "manual-studiu": "Manual de studiu individual — Noțiuni de bază în arbitrajul chinologic",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let date;
  try {
    date = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  const { modul, nume, cod, raspunsuri } = date || {};
  // Object.hasOwn: pe obiect literal, `CHEI["constructor"]` ar trece prin moștenirea
  // de prototip și ar produce un 500 mai jos — poarta trebuie să vadă doar cheile reale.
  const cheie = Object.hasOwn(CHEI, String(modul || "")) ? CHEI[modul] : null;
  if (!cheie) return json({ eroare: "Testul acestui modul nu este activ." }, 404);
  if (!Array.isArray(raspunsuri) || raspunsuri.length !== cheie.length)
    return json({ eroare: "Răspunde la toate întrebările." }, 400);

  const store = getStore("cursuri");

  // POARTĂ: fără o identitate de platformă validă, nimic nu se corectează, se salvează
  // sau se trimite. Închide corectarea anonimă (falsificarea de rezultate / spam).
  const eu = await cine({ cod, store });
  if (!eu) return json({ eroare: "Intră în Școala de Arbitraj cu codul tău pentru a susține testul." }, 401);

  // ——— TERMENUL DE SUSȚINERE ———
  // Bariera stă AICI, la corectare — singurul loc prin care trece orice test — deci nu
  // poate fi ocolită din pagină. După termen: refuz, fără corectare, fără salvare, fără
  // e-mail. Într-o fereastră de reactivare: nota se reduce cu penalizarea ferestrei.
  // Administratorul și lectorii previzualizează liber (rezultatele lor nu sunt candidaturi).
  const eSupraveghetor = eu.rol === "admin" || eu.rol === "lector";
  let penalizare = 0;
  if (!eSupraveghetor) {
    const termene = await store.get("termene-module", { type: "json" }).catch(() => null);
    const t = stareTermen(termene && termene[modul]);
    if (t.inchis)
      return json({
        eroare: "Testul acestui modul s-a închis la " + formateazaTermen(termene[modul].pana) +
          ". Pentru o nouă perioadă de susținere, scrie secretariatului: contact@cfc-royal.ro.",
        inchis: true,
      }, 403);
    penalizare = t.penalizare;
  }

  // Identitatea candidatului: pentru un candidat cu cod individual, numele e cel din
  // registru (autoritativ, fără typo) și progresul se leagă de identitatea AUTENTIFICATĂ.
  // Pentru cod comun / admin-lector care previzualizează — numele scris în formular.
  let cand = (eu.nume || nume || "").trim();
  const candidatId = eu.candidatId;
  if (!cand || cand.length < 3) return json({ eroare: "Scrie numele complet." }, 400);

  // Corectare
  const gresite = [];
  let corecte = 0;
  cheie.forEach((c, i) => {
    if (Number(raspunsuri[i]) === c) corecte++;
    else gresite.push(i + 1);
  });
  const total = cheie.length;
  // Nota brută → nota finală: în fereastra de reactivare, penalizarea reduce nota, iar
  // promovarea (pragul de 70%) se judecă pe nota REDUSĂ — altfel penalizarea ar fi de formă.
  const procentBrut = Math.round((corecte / total) * 100);
  const procent = aplicaPenalizarea(procentBrut, penalizare);
  const promovat = procent >= PRAG;
  cand = cand.slice(0, 120);
  const titlu = TITLURI[modul] || modul;

  // 1) Registrul de rezultate (Netlify Blobs) — fiecare rezultat pe cheia lui, ca să nu
  //    existe curse (mai mulți candidați care termină simultan). Nu blocăm rezultatul dacă eșuează.
  try {
    const key = "rezultat/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    await store.setJSON(key, {
      nume: cand,
      id: candidatId || undefined,
      modul,
      titlu,
      corecte,
      total,
      procent,
      // Într-o fereastră de reactivare, registrul păstrează ambele valori: se vede
      // oricând ce a știut candidatul (brut) și ce a primit (după penalizare).
      procentBrut: penalizare ? procentBrut : undefined,
      penalizare: penalizare || undefined,
      promovat,
      data: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Registru rezultate eșuat:", err);
  }

  // 1b) Progresul PERSONAL al candidatului (doar pentru coduri individuale) — cel mai bun
  //     rezultat per modul, citit apoi pe tabloul candidatului de pe orice dispozitiv.
  //     Fiecare modul pe cheia LUI (progres/<id>/<modul>) — fără read-modify-write pe un
  //     obiect comun, deci fără curse când se dau două teste una după alta.
  if (candidatId) {
    try {
      const cheieProg = "progres/" + candidatId + "/" + modul;
      const vechi = await store.get(cheieProg, { type: "json" });
      if (!vechi || procent > vechi.procent || (promovat && !vechi.promovat)) {
        await store.setJSON(cheieProg, { procent, promovat, data: new Date().toISOString().slice(0, 10) });
      }
    } catch (err) {
      console.error("Salvare progres eșuată:", err);
    }
  }

  // 2) Notificare către secretariat — prin drumul comun al poștei (_comun/posta.mjs).
  await trimite({
    catre: "contact@cfc-royal.ro",
    subiect: `[Test ${promovat ? "PROMOVAT" : "nepromovat"}] ${cand} — ${titlu} (${procent}%)`,
    expeditor: { name: "Școala de Arbitraj CFC-Royal", email: "newsletter@cfc-royal.ro" },
    html: `
      <h2 style="margin:0 0 8px">Rezultat test — Școala de Arbitraj</h2>
      <p><b>Candidat:</b> ${esc(cand)}</p>
      <p><b>Test:</b> ${titlu}</p>
      <p><b>Scor:</b> ${corecte} / ${total} (${procent}%) — <b>${promovat ? "PROMOVAT ✅" : "NEPROMOVAT ❌"}</b></p>
      ${penalizare ? `<p><b>Fereastră de reactivare:</b> scor brut ${procentBrut}%, penalizare ${penalizare}% pentru depășirea termenului inițial.</p>` : ""}
      ${gresite.length ? `<p><b>Întrebări greșite:</b> ${gresite.join(", ")}</p>` : "<p>Fără greșeli. 🎉</p>"}
      <p style="color:#888;font-size:12px">Trimis automat de platforma de cursuri — cfc-royal.ro/cursuri/</p>`,
  });

  // Lista întrebărilor greșite se întoarce DOAR la promovare (recapitulare legitimă).
  // La eșec dăm doar scorul: altfel, două-trei încercări picate reconstruiau cheia.
  return json({
    total, corecte, procent, promovat,
    procentBrut: penalizare ? procentBrut : undefined,
    penalizare: penalizare || undefined,
    gresite: promovat ? gresite : undefined,
  });
});
