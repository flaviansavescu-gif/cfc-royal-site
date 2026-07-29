// Netlify Function — abonare newsletter în Brevo (lista #3).
// Primește un POST din formularul de pe site, adaugă/actualizează contactul în Brevo,
// apoi redirecționează către pagina de mulțumire.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params = new URLSearchParams(event.body || "");
  const email = (params.get("email") || "").trim();
  const botField = params.get("bot-field") || ""; // honeypot anti-spam
  const redirect = params.get("redirect") || "/ro/newsletter-ok/";

  const back = (status = 303) => ({ statusCode: status, headers: { Location: redirect }, body: "" });

  // Bot detectat (honeypot completat) — răspundem normal, dar nu salvăm.
  if (botField) return back();

  // Validare minimă de e-mail.
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return back();

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY lipsește din environment.");
    return back();
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, listIds: [3], updateEnabled: true }),
    });
    // 201 = creat, 204 = actualizat. 400 „Contact already exist" = deja abonat (ok).
    if (!res.ok && res.status !== 400) {
      console.error("Eroare Brevo:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Cerere Brevo eșuată:", err);
  }

  return back();
};
