// buletin-dezabonare.mjs — retragerea acordului, dintr-un singur clic.
//
// DE CE. Politica de confidențialitate promite, negru pe alb: „Se retrage dintr-un singur
// clic, din orice mesaj primit." Promisiunea n-avea mecanism. Buletinul Școlii trimitea
// oamenii la o pagină din platformă, unde trebuiau să intre cu codul lor și să apese încă
// două butoane; iar buletinul site-ului se sprijinea pe linkul pus de furnizor. Cine îți
// citește mesajul pe telefon, în trei secunde, nu face nimic din toate astea.
//
// Acum linkul din mesaj poartă un jeton propriu, aleator, legat de adresă. Un clic și
// gata: adresa iese din lista din care a venit mesajul. Fără cod, fără formular, fără
// întrebări — GDPR cere ca retragerea să fie la fel de ușoară ca darea acordului
// (art. 7 alin. 3), iar aici e chiar mai ușoară.
//
// DOVADA NU SE ȘTERGE. Rămâne, cu momentul retragerii scris în ea: dacă cineva reclamă
// că a primit mesaje după ce s-a dezabonat, trebuie să putem arăta exact când a ieșit.
//
// GET /.netlify/functions/buletin-dezabonare?j=<jeton>
import { getStore } from "@netlify/blobs";
import {
  magazie, cheieDezabonare, cheieDovada, amprentaEmail,
} from "./_comun/buletin-acord.mjs";
import { escapeHtml } from "./_comun/posta.mjs";

const LISTA_SITE = 3;

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

/** Scoate adresa din lista de difuzare a site-ului (Brevo). */
async function scoateDinBrevo(email) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts/lists/${LISTA_SITE}/contacts/remove`, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ emails: [email] }),
    });
    // 400 „contact already removed" e tot un succes din punctul de vedere al omului.
    if (!res.ok && res.status !== 400) {
      console.error("Brevo (scoatere din listă):", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Scoaterea din listă a eșuat:", err);
    return false;
  }
}

/** Scoate adresa dintre abonații Buletinului Școlii (magazia „cursuri"). */
async function scoateDinScoala(email) {
  try {
    await getStore("cursuri").delete("abonat/" + amprentaEmail(email));
    return true;
  } catch (err) {
    console.error("Scoaterea de la Buletinul Școlii a eșuat:", err);
    return false;
  }
}

export default async (req) => {
  const jeton = new URL(req.url).searchParams.get("j") || "";
  if (!/^[a-f0-9]{32}$/.test(jeton)) {
    return raspuns("Link nevalabil", "Linkul de dezabonare nu e complet. Copiază-l întreg din e-mail.", 400);
  }

  const s = magazie();
  const leg = await s.get(cheieDezabonare(jeton), { type: "json" }).catch(() => null);
  if (!leg?.email) {
    return raspuns(
      "Ești deja dezabonat",
      "Linkul nu mai duce la nicio adresă activă — fie te-ai dezabonat deja, fie adresa a fost " +
      "scoasă între timp. Nu mai primești nimic de la noi.",
      404,
    );
  }

  const scos = leg.lista === "scoala" ? await scoateDinScoala(leg.email) : await scoateDinBrevo(leg.email);
  if (!scos) {
    return raspuns(
      "Ceva n-a mers",
      "Nu am putut face dezabonarea acum. Încearcă din nou peste câteva minute sau scrie-ne la " +
      `<a href="mailto:contact@cfc-royal.ro">contact@cfc-royal.ro</a> — o facem cu mâna.`,
      502,
    );
  }

  // Dovada rămâne, dar poartă de acum momentul retragerii.
  try {
    const d = await s.get(cheieDovada(leg.email), { type: "json" }).catch(() => null);
    if (d) await s.setJSON(cheieDovada(leg.email), { ...d, retrasLa: new Date().toISOString() });
  } catch (err) { console.error(err); }

  // Jetonul se consumă: un link de dezabonare nu are de ce să mai funcționeze a doua oară.
  try { await s.delete(cheieDezabonare(jeton)); } catch (err) { console.error(err); }

  return raspuns(
    "Gata — te-ai dezabonat",
    `Adresa <b>${escapeHtml(leg.email)}</b> a fost scoasă din ` +
    (leg.lista === "scoala" ? "lista Buletinului Școlii de Arbitraj" : "lista buletinului informativ") +
    `. Nu mai primești mesaje. Dacă te răzgândești, te poți abona oricând din subsolul site-ului.`,
  );
};
