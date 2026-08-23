// stare-inimi.mjs — fereastra publică prin care paznicul din GitHub Actions se uită
// la inimile funcțiilor programate și la sănătatea poștei.
//
// DE CE PUBLICĂ. Paznicul de disponibilitate rulează în afara Netlify (ca să vadă și
// căderile Netlify) și nu are chei — deci fereastra trebuie să fie deschisă. Ce se
// vede prin ea nu e sensibil: numele funcțiilor programate (scrise oricum în depozitul
// public), ora ultimei rulări și un DA/NU despre poștă. Niciun secret, nicio adresă,
// niciun conținut.
//
//   GET -> { ok, [magazie:false], intarziate:[...], nebatute:[...], posta:{ ok, verificatLa } }
//
// `ok: false` => paznicul din Actions eșuează rularea, iar GitHub trimite e-mail —
// canalul INDEPENDENT de Brevo și de Netlify. Așa, și „poșta a murit" are cine s-o spună.
// Paznicul trebuie să citească `.ok` de NIVEL SUPERIOR (jq/parse), NU un grep pe substring:
// răspunsul are și `posta.ok`, iar un grep neancorat ar trece verde din cauza lui.
import { getStore } from "@netlify/blobs";
import { judecaInimile, citesteInimile } from "./_comun/inima.mjs";
import { json } from "./_comun/raspuns.mjs";

export default async () => {
  const { batai, eroareMagazie } = await citesteInimile();
  const inimi = judecaInimile(batai);

  // Sănătatea poștei: DOAR booleanul. NU întoarcem `detaliu` — el poartă soldul de credite
  // Brevo și textul erorilor, iar fereastra e PUBLICĂ (o citește paznicul din GitHub Actions,
  // fără chei). Detaliul complet rămâne în panoul admin autentificat (stare-ecosistem).
  const posta = await getStore("acces").get("posta-sanatate", { type: "json" }).catch(() => null);
  const postaOk = posta ? !!posta.ok : true;

  // FAIL-CLOSED: dacă magazia „acces" nu se poate citi DELOC, fereastra NU minte „sănătos" —
  // altfel paznicul paznicilor ar orbi exact pe dependența pe care o veghează.
  return json({
    ok: inimi.ok && postaOk && !eroareMagazie,
    ...(eroareMagazie ? { magazie: false } : {}),
    intarziate: inimi.intarziate,
    nebatute: inimi.nebatute,
    posta: { ok: postaOk, verificatLa: posta?.verificatLa || null },
  });
};
