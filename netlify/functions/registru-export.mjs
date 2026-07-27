// registru-export.mjs — descarcă tot registrul genealogic, la cerere.
//
// Butonul din panoul de administrare. Copia automată săptămânală (registru-backup)
// merge pe ramură privată și e criptată; asta e copia pe care o ține omul în mână:
// un ZIP obișnuit, deschis cu orice program, fără parolă și fără acest site.
//
// TOCMAI DE ACEEA e o descărcare, nu un fișier lăsat undeva: arhiva conține date
// personale (nume, adrese, telefoane, scanuri de acte). Iese o singură dată, către
// administratorul care a cerut-o, și nu rămâne nicăieri pe server.
//
// POST { cod, maxMB? } -> application/zip
import { actorDinCod } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { construiesteArhiva } from "./_comun/registru-arhiva.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  // Poarta ÎNAINTE de a atinge magazia, ca peste tot în registru.
  if (actorDinCod(String(body.cod || "").trim())?.rol !== "admin")
    return json({ eroare: "Doar administratorul poate descărca registrul." }, 401);

  const maxMB = Math.min(Math.max(Number(body.maxMB) || 40, 1), 80);

  try {
    const { zip, rezumat } = await construiesteArhiva({ maxFisiere: maxMB * 1024 * 1024 });
    const nume = "registru-cfcr-" + new Date().toISOString().slice(0, 10) + ".zip";
    return new Response(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="' + nume + '"',
        "Cache-Control": "no-store",
        // Cifrele ajung și în antete, ca pagina să poată spune ce s-a descărcat fără
        // să deschidă arhiva.
        "X-Registru-Inregistrari": String(rezumat.inregistrari),
        "X-Registru-Fisiere": String(rezumat.fisiere),
        "X-Registru-Omise": String(rezumat.fisiereOmise.length),
      },
    });
  } catch (err) {
    console.error("Exportul registrului a eșuat:", err);
    return json({ eroare: "Nu am putut construi arhiva: " + err.message }, 500);
  }
});
