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
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { construiesteArhiva } from "./_comun/registru-arhiva.mjs";
import { jurnalizeaza, ipCerere } from "./_comun/registru-jurnal.mjs";
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";

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

  // Și a doua cheie: asta e cererea prin care tot registrul, cu scanuri de acte și date
  // personale, pleacă pe un calculator din afara serverului. Dacă e o singură cerere
  // care merită două chei, ea e.
  if (!(await dispozitivCunoscut(getStore("registru"), String(body.dispozitiv || "").trim(), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);

  const maxMB = Math.min(Math.max(Number(body.maxMB) || 40, 1), 80);

  try {
    const { zip, rezumat } = await construiesteArhiva({ maxFisiere: maxMB * 1024 * 1024 });
    const nume = "registru-cfcr-" + new Date().toISOString().slice(0, 10) + ".zip";
    // Scoaterea întregului registru pe un calculator din afara serverului e cea mai
    // grea faptă din tot sistemul: date personale, scanuri de acte, tot. Se consemnează.
    await jurnalizeaza(getStore("registru"), {
      fapta: "arhiva-descarcata",
      actor: { rol: "admin", nume: "Administrator" },
      obiect: nume,
      detalii: `${rezumat.inregistrari} înregistrări, ${rezumat.fisiere} fișiere, ` +
        `${rezumat.fisiereOmise.length} omise (limită ${maxMB} MB)`,
      ip: ipCerere(req),
    });
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
