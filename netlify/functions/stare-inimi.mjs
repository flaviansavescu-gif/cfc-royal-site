// stare-inimi.mjs — fereastra publică prin care paznicul din GitHub Actions se uită
// la inimile funcțiilor programate și la sănătatea poștei.
//
// DE CE PUBLICĂ. Paznicul de disponibilitate rulează în afara Netlify (ca să vadă și
// căderile Netlify) și nu are chei — deci fereastra trebuie să fie deschisă. Ce se
// vede prin ea nu e sensibil: numele funcțiilor programate (scrise oricum în depozitul
// public), ora ultimei rulări și un DA/NU despre poștă. Niciun secret, nicio adresă,
// niciun conținut.
//
//   GET -> { ok, intarziate:[...], nebatute:[...], posta:{ ok, detaliu, verificatLa } }
//
// `ok: false` => paznicul din Actions eșuează rularea, iar GitHub trimite e-mail —
// canalul INDEPENDENT de Brevo și de Netlify. Așa, și „poșta a murit" are cine s-o spună.
import { getStore } from "@netlify/blobs";
import { judecaInimile, citesteInimile } from "./_comun/inima.mjs";
import { json } from "./_comun/raspuns.mjs";

export default async () => {
  const batai = await citesteInimile();
  const inimi = judecaInimile(batai);

  // Sănătatea poștei, scrisă de monitor-flux la fiecare rulare (deci cel mult veche de
  // 15 minute + pragul lui). Lipsa ei nu alarmează aici — inima lui monitor-flux o face.
  const posta = await getStore("acces").get("posta-sanatate", { type: "json" }).catch(() => null);
  const postaOk = posta ? !!posta.ok : true;

  return json({
    ok: inimi.ok && postaOk,
    intarziate: inimi.intarziate,
    nebatute: inimi.nebatute,
    posta: posta || { ok: true, detaliu: "încă neverificată (prima rulare a monitorului urmează)" },
  });
};
