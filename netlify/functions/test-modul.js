// test-modul.js — corectează testele platformei de cursuri (Școala de Arbitraj).
// Cheile de corectare stau NUMAI aici (pe server) — nu apar în paginile publice.
// Trimite rezultatul pe e-mail secretariatului prin Brevo (BREVO_API_KEY din environment).

const PRAG = 70; // procent minim de promovare

// Cheia de răspunsuri per modul (indexul opțiunii corecte pentru fiecare întrebare).
const CHEI = {
  "modul-1": [0, 1, 2, 0, 1, 2, 1, 0, 1, 0, 1, 2],
};

const TITLURI = {
  "modul-1": "Modul 1 — Rolul, etica și conduita arbitrului",
};

exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (event.httpMethod !== "POST") return json(405, { eroare: "Metodă nepermisă." });

  let date;
  try {
    date = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { eroare: "Cerere invalidă." });
  }

  const { modul, nume, raspunsuri } = date;
  const cheie = CHEI[modul];
  if (!cheie) return json(404, { eroare: "Testul acestui modul nu este activ." });
  if (!nume || typeof nume !== "string" || nume.trim().length < 3)
    return json(400, { eroare: "Scrie numele complet." });
  if (!Array.isArray(raspunsuri) || raspunsuri.length !== cheie.length)
    return json(400, { eroare: "Răspunde la toate întrebările." });

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

  // Notificare către secretariat (nu blocăm rezultatul dacă e-mailul eșuează)
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    const titlu = TITLURI[modul] || modul;
    const cand = nume.trim().slice(0, 120);
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

  return json(200, { total, corecte, procent, promovat, gresite });
};
