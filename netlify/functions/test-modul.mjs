// test-modul.mjs — corectează testele platformei de cursuri (Școala de Arbitraj).
// Cheile de corectare stau NUMAI aici (pe server) — nu apar în paginile publice.
// La fiecare test corectat: rezultatul se salvează în registrul de rezultate (Netlify Blobs)
// și se trimite pe e-mail secretariatului prin Brevo (BREVO_API_KEY din environment).
import { getStore } from "@netlify/blobs";

const PRAG = 70; // procent minim de promovare

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
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let date;
  try {
    date = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  const { modul, nume, raspunsuri } = date || {};
  const cheie = CHEI[modul];
  if (!cheie) return json({ eroare: "Testul acestui modul nu este activ." }, 404);
  if (!nume || typeof nume !== "string" || nume.trim().length < 3)
    return json({ eroare: "Scrie numele complet." }, 400);
  if (!Array.isArray(raspunsuri) || raspunsuri.length !== cheie.length)
    return json({ eroare: "Răspunde la toate întrebările." }, 400);

  // Corectare
  const gresite = [];
  let corecte = 0;
  cheie.forEach((c, i) => {
    if (Number(raspunsuri[i]) === c) corecte++;
    else gresite.push(i + 1);
  });
  const total = cheie.length;
  const procent = Math.round((corecte / total) * 100);
  const promovat = procent >= PRAG;
  const cand = nume.trim().slice(0, 120);
  const titlu = TITLURI[modul] || modul;

  // 1) Registrul de rezultate (Netlify Blobs) — fiecare rezultat pe cheia lui, ca să nu
  //    existe curse (mai mulți candidați care termină simultan). Nu blocăm rezultatul dacă eșuează.
  try {
    const store = getStore("cursuri");
    const key = "rezultat/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    await store.setJSON(key, {
      nume: cand,
      modul,
      titlu,
      corecte,
      total,
      procent,
      promovat,
      data: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Registru rezultate eșuat:", err);
  }

  // 2) Notificare către secretariat prin Brevo
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    const html = `
      <h2 style="margin:0 0 8px">Rezultat test — Școala de Arbitraj</h2>
      <p><b>Candidat:</b> ${cand.replace(/</g, "&lt;")}</p>
      <p><b>Test:</b> ${titlu}</p>
      <p><b>Scor:</b> ${corecte} / ${total} (${procent}%) — <b>${promovat ? "PROMOVAT ✅" : "NEPROMOVAT ❌"}</b></p>
      ${gresite.length ? `<p><b>Întrebări greșite:</b> ${gresite.join(", ")}</p>` : "<p>Fără greșeli. 🎉</p>"}
      <p style="color:#888;font-size:12px">Trimis automat de platforma de cursuri — cfc-royal.ro/cursuri/</p>`;
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "Școala de Arbitraj CFC-Royal", email: "newsletter@cfc-royal.ro" },
          to: [{ email: "contact@cfc-royal.ro" }],
          subject: `[Test ${promovat ? "PROMOVAT" : "nepromovat"}] ${cand} — ${titlu} (${procent}%)`,
          htmlContent: html,
        }),
      });
    } catch (err) {
      console.error("E-mail rezultat eșuat:", err);
    }
  } else {
    console.error("BREVO_API_KEY lipsește — rezultatul nu a fost trimis pe e-mail.");
  }

  return json({ total, corecte, procent, promovat, gresite });
};
