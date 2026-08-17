// =========================================================================
// buletin-curatenie.mjs — mătura săptămânală a datelor de abonare.
//
// DE CE EXISTĂ. Politica de confidențialitate promite două termene, iar o promisiune de
// ștergere fără mecanism de ștergere e mai rea decât tăcerea:
//
//   • cererea de abonare NECONFIRMATĂ ține 48 de ore, apoi se șterge singură. Fără
//     confirmare nu există consimțământ, deci nu există temei să păstrăm adresa nici
//     măcar o zi în plus — și nici să rămână un link de confirmare valabil la nesfârșit;
//   • dovada acordului se păstrează 3 ani DE LA RETRAGERE (cât poate fi contestată o
//     comunicare primită), apoi se șterge și ea.
//
// Dovezile ACTIVE — ale oamenilor care sunt încă abonați — nu se ating: ele sunt tocmai
// ce ne cere art. 7 alin. 1 să putem arăta.
//
// De ce funcție programată, nu curățenie „la prima deschidere a registrului", ca la
// cererile DSAR: registrul DSAR are o pagină pe care cineva chiar o deschide. Abonările
// n-au. O magazie pe care n-o deschide nimeni nu se curăță singură.
// =========================================================================
import { magazie, VALABILITATE_CONFIRMARE_MS } from "./_comun/buletin-acord.mjs";

/** Dovada se păstrează 3 ani de la RETRAGERE — aceeași socoteală ca la cererile DSAR. */
export const RETENTIE_DOVADA_MS = 3 * 365 * 24 * 3600e3;

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

/** A trecut termenul? `null`/nedatat = NU ștergem (mai bine o păstrăm în plus). */
export function deSters(momentIso, termenMs, acum = Date.now()) {
  const t = Date.parse(momentIso ?? "");
  return Number.isFinite(t) && acum - t > termenMs;
}

export default async () => {
  const s = magazie();
  const acum = Date.now();
  let cereriSterse = 0, dovezSterse = 0, jetoaneSterse = 0, cazute = 0;

  // 1) Cererile de abonare rămase neconfirmate.
  try {
    const { blobs } = await s.list({ prefix: "buletin-asteptare/" });
    for (const b of blobs) {
      try {
        const c = await s.get(b.key, { type: "json" });
        if (c && deSters(c.cerut, VALABILITATE_CONFIRMARE_MS, acum)) {
          await s.delete(b.key);
          cereriSterse++;
        }
      } catch (err) { cazute++; console.error("Curățenie cerere:", b.key, err); }
    }
  } catch (err) { cazute++; console.error("Listare cereri eșuată:", err); }

  // 2) Dovezile acordurilor RETRASE, după termen. Odată cu dovada pleacă și jetonul de
  //    dezabonare rămas, dacă mai există: fără dovadă, el n-ar mai duce nicăieri.
  try {
    const { blobs } = await s.list({ prefix: "buletin-acord/" });
    for (const b of blobs) {
      try {
        const d = await s.get(b.key, { type: "json" });
        if (!d?.retrasLa) continue;                       // încă abonat — nu se atinge
        if (!deSters(d.retrasLa, RETENTIE_DOVADA_MS, acum)) continue;
        await s.delete(b.key);
        dovezSterse++;
        if (d.jetonDezabonare) {
          try { await s.delete("buletin-dezabonare/" + d.jetonDezabonare); jetoaneSterse++; }
          catch (err) { console.error("Jeton rămas:", err); }
        }
      } catch (err) { cazute++; console.error("Curățenie dovadă:", b.key, err); }
    }
  } catch (err) { cazute++; console.error("Listare dovezi eșuată:", err); }

  const raport = { cereriSterse, dovezSterse, jetoaneSterse, cazute };
  if (cazute) console.error("Curățenia buletinului a avut căderi:", raport);
  return json({ ok: cazute === 0, ...raport }, cazute ? 500 : 200);
};

// Duminică la 4:00 — după copiile de siguranță, ca ce se șterge azi să existe în copia
// de ieri încă o vreme (copiile se rotesc oricum, vezi politica).
export const config = { schedule: "0 4 * * 0" };
