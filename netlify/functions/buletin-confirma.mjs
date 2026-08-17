// buletin-confirma.mjs — abonarea la buletin, PASUL 2 din 2: confirmarea adresei.
//
// Aici se întâmplă trei lucruri, în ordinea asta:
//   1. adresa intră în lista de difuzare (Brevo, lista #3);
//   2. se scrie DOVADA consimțământului — ce text a bifat omul, când, de unde, când a
//      confirmat (art. 7 alin. 1 GDPR: operatorul trebuie să poată dovedi acordul);
//   3. i se dă un jeton de dezabonare, ca orice mesaj primit să aibă un link care
//      funcționează dintr-un singur clic, fără cod și fără formular.
//
// Cererea de așteptare se ȘTERGE la final: linkul nu se poate folosi de două ori.
//
// GET /.netlify/functions/buletin-confirma?j=<jeton>
import {
  magazie, cheieAsteptare, cheieDezabonare, cheieDovada,
  jetonNou, amprentaIp, expirat,
} from "./_comun/buletin-acord.mjs";
import { escapeHtml } from "./_comun/posta.mjs";

const LISTA_SITE = 3;

/** Pagina simplă pe care o vede omul în browser după ce apasă linkul. */
function raspuns(titlu, mesaj, status = 200) {
  const html =
    `<!doctype html><html lang="ro"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<title>${escapeHtml(titlu)} — CFC-Royal</title>` +
    `<style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#F7F6F2;` +
    `color:#23301f;margin:0;padding:48px 20px;display:flex;justify-content:center}` +
    `main{max-width:34rem;background:#fff;border:1px solid #e2e0d8;border-radius:10px;padding:32px}` +
    `h1{font-size:1.4rem;margin:0 0 12px;color:#1F4D3A}p{line-height:1.6;margin:0 0 12px}` +
    `a{color:#1F4D3A}</style></head><body><main>` +
    `<h1>${escapeHtml(titlu)}</h1><p>${mesaj}</p>` +
    `<p><a href="https://cfc-royal.ro/">Înapoi la cfc-royal.ro</a></p>` +
    `</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async (req) => {
  const jeton = new URL(req.url).searchParams.get("j") || "";
  if (!/^[a-f0-9]{32}$/.test(jeton)) {
    return raspuns("Link nevalabil", "Linkul de confirmare nu e complet. Copiază-l întreg din e-mail.", 400);
  }

  const s = magazie();
  const cerere = await s.get(cheieAsteptare(jeton), { type: "json" }).catch(() => null);
  if (!cerere) {
    return raspuns(
      "Link folosit sau expirat",
      "Cererea nu mai există: ori ai confirmat deja (caz în care ești abonat), ori au trecut " +
      "cele 48 de ore. Poți cere din nou abonarea din subsolul site-ului.",
      404,
    );
  }
  if (expirat(cerere)) {
    try { await s.delete(cheieAsteptare(jeton)); } catch (err) { console.error(err); }
    return raspuns(
      "Link expirat",
      "Linkul era valabil 48 de ore. Cere abonarea din nou, din subsolul site-ului.",
      410,
    );
  }

  // 1) În lista de difuzare.
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY lipsește — confirmarea nu poate intra în listă.");
    return raspuns(
      "Ceva n-a mers",
      "Nu am putut înregistra abonarea acum. Încearcă peste câteva minute sau scrie-ne la " +
      `<a href="mailto:contact@cfc-royal.ro">contact@cfc-royal.ro</a>.`,
      503,
    );
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: cerere.email, listIds: [LISTA_SITE], updateEnabled: true }),
    });
    // 201 = creat, 204 = actualizat, 400 „Contact already exist" = deja acolo (bine).
    if (!res.ok && res.status !== 400) {
      console.error("Eroare Brevo:", res.status, await res.text().catch(() => ""));
      return raspuns("Ceva n-a mers", "Nu am putut înregistra abonarea acum. Încearcă din nou peste câteva minute.", 502);
    }
  } catch (err) {
    console.error("Cerere Brevo eșuată:", err);
    return raspuns("Ceva n-a mers", "Nu am putut înregistra abonarea acum. Încearcă din nou peste câteva minute.", 502);
  }

  // 2) Dovada + 3) jetonul de dezabonare.
  const jetonDez = jetonNou();
  try {
    await s.setJSON(cheieDovada(cerere.email), {
      email: cerere.email,
      lista: "site",
      text: cerere.text,
      versiune: cerere.versiune,
      cerutLa: cerere.cerut,
      ipCerere: cerere.ip,
      confirmatLa: new Date().toISOString(),
      ipConfirmare: amprentaIp(req),
      jetonDezabonare: jetonDez,
    });
    await s.setJSON(cheieDezabonare(jetonDez), { email: cerere.email, lista: "site" });
  } catch (err) {
    // Dovada e importantă, dar omul e deja în listă: nu-l punem să reia totul.
    console.error("Dovada consimțământului nu s-a putut scrie:", err);
  }

  try { await s.delete(cheieAsteptare(jeton)); } catch (err) { console.error(err); }

  const linkDez = `https://cfc-royal.ro/.netlify/functions/buletin-dezabonare?j=${jetonDez}`;
  return raspuns(
    "Gata — ești abonat",
    `Buletinul Clubului Federal Chinologic Royal va ajunge la <b>${escapeHtml(cerere.email)}</b>.` +
    `</p><p>Te poți retrage oricând, dintr-un singur clic: ` +
    `<a href="${linkDez}">dezabonează-mă</a>. Același link e la finalul fiecărui mesaj.`,
  );
};
