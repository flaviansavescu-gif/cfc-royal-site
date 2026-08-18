// paznic-raport.mjs — ce a văzut paznicul de intruziune, pentru pagina de administrare.
//
// Doar CITEȘTE. Nu blochează, nu șterge, nu trimite nimic — veghea și scrisorile sunt
// treaba lui `paznic-veghe`. Aici e doar fereastra prin care se poate uita omul când se
// întreabă ceva, între două rapoarte de luni.
//
// De ce o funcție separată, și nu aceeași: funcțiile PROGRAMATE de pe Netlify nu se pot
// chema prin HTTP. Paznicul care veghează trebuie să fie programat; fereastra prin care
// te uiți la el trebuie să fie chemabilă. Regula de judecată e aceeași pentru amândoi,
// fiindcă stă într-un singur loc (`_comun/paznic.mjs`).
//
// POST { cod, dispozitiv, zile? } -> { verdict, acum:{...}, saptamana:{...} }   (doar admin)
import { getStore } from "@netlify/blobs";
import { esteAdmin } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import {
  strange, strangeZile, judeca, momentLocal,
  ORE_VEGHE, RETENTIE_ZILE, USI_PENTRU_SEMNAL, REFUZURI_PENTRU_ALARMA, URME_PENTRU_ALARMA,
} from "./_comun/paznic.mjs";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

/** Ce se poate arăta din faptele strânse — fără amprente întregi. */
function pentruEcran(f) {
  return {
    refuzuri: f.refuzuri,
    estimat: f.trunchiat,
    urme: f.urme.size,
    ore: f.ore,
    peUsa: Object.entries(f.peUsa)
      .map(([usa, n]) => ({ usa: usa.replace(/-/g, " "), n }))
      .sort((a, b) => b.n - a.n),
    // Vizitatorii cu cele mai multe uși încercate — primii, că despre ei e vorba.
    // Amprenta se arată doar din opt caractere: destul cât să deosebești două rânduri
    // între ele, prea puțin cât să însemne ceva despre o persoană.
    vizitatori: Object.entries(f.peUrma)
      .map(([amprenta, d]) => ({
        urma: amprenta.slice(0, 8),
        incercari: d.n,
        usi: [...(d.usi || [])].map((u) => u.replace(/-/g, " ")),
      }))
      .sort((a, b) => b.usi.length - a.usi.length || b.incercari - a.incercari)
      .slice(0, 25),
  };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  if (!esteAdmin(String(body.cod || "").trim()))
    return json({ eroare: "Doar administratorul poate vedea ce a văzut paznicul." }, 401);
  // A doua cheie, ca la toate acțiunile grele de administrare.
  if (!(await dispozitivCunoscut(getStore("registru"), String(body.dispozitiv || "").trim(), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);

  const s = getStore("acces");
  const zile = Math.max(1, Math.min(RETENTIE_ZILE, Number(body.zile) || 7));

  const acum = await strange(s, ORE_VEGHE);
  const perioada = await strangeZile(s, zile);

  let stare = null;
  try { stare = await s.get("paznic-stare", { type: "json" }); } catch (err) { console.error(err); }

  return json({
    la: momentLocal(new Date()),
    verdict: judeca(acum),
    acum: pentruEcran(acum),
    perioada: { ...pentruEcran(perioada), zile },
    ultimaScrisoare: stare?.la ? { stare: stare.stare, la: stare.la } : null,
    praguri: {
      usiPentruSemnal: USI_PENTRU_SEMNAL,
      refuzuriPentruAlarma: REFUZURI_PENTRU_ALARMA,
      urmePentruAlarma: URME_PENTRU_ALARMA,
      oreVeghe: ORE_VEGHE,
      retentieZile: RETENTIE_ZILE,
    },
  });
});
