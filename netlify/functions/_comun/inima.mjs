// _comun/inima.mjs — bătaia de inimă a funcțiilor programate.
//
// GAURA PE CARE O ASTUPĂ: tăcerea care seamănă a sănătate. Dacă funcțiile programate
// ale Netlify se opresc (o schimbare de plan, o dereglare), alarmele nu „cad" — pur și
// simplu ÎNCETEAZĂ să mai vină, iar lipsa de vești arată exact ca liniștea sănătoasă.
// Cine păzește paznicii? De aici încolo: fiecare rulare programată își scrie ora aici
// („bate inima"), iar paznicul de disponibilitate din GitHub Actions — canal INDEPENDENT
// de Netlify — întreabă endpointul public `stare-inimi` și sună dacă vreo inimă n-a mai
// bătut de prea mult.
//
// Bătaia nu aruncă niciodată: funcția are treaba ei; inima e martor, nu piedică.
import { getStore } from "@netlify/blobs";

/** Magazia inimilor: „acces" — aceeași casă neutră cu jetoanele și contoarele. */
const magazie = () => getStore("acces");

/**
 * Pragurile de îngrijorare, per funcție: de câte ori cadența programată poate lipsi
 * înainte să sune alarma. Generoase cu bună știință (programarea Netlify are joc de
 * minute, iar o rulare căzută izolat nu e o boală) — dar o zi de tăcere la o funcție
 * de 15 minute nu mai e joc, e oprire.
 */
export const INIMI = {
  "monitor-flux": { cadenta: "*/15 min", pragMin: 60 },
  "paznic-veghe": { cadenta: "*/30 min", pragMin: 120 },
  "registru-backup": { cadenta: "săptămânal (duminică 03:00)", pragMin: 8 * 24 * 60 },
  "magazii-backup": { cadenta: "săptămânal (duminică 03:30)", pragMin: 8 * 24 * 60 },
  "buletin-curatenie": { cadenta: "săptămânal (duminică 04:00)", pragMin: 8 * 24 * 60 },
  "raport-lunar": { cadenta: "lunar (ziua 1, 05:00)", pragMin: 33 * 24 * 60 },
  "cotizatie-reamintiri": { cadenta: "zilnic (06:00)", pragMin: 2 * 24 * 60 + 120 },
  "termene-reamintiri": { cadenta: "zilnic (06:30)", pragMin: 2 * 24 * 60 + 120 },
};

/** Scrie bătaia. Se cheamă la ÎNCEPUTUL fiecărei rulări programate. */
export async function bateInima(nume) {
  try {
    await magazie().setJSON("inima/" + nume, { la: new Date().toISOString() });
  } catch (err) {
    console.error(`Inima „${nume}" nu s-a putut scrie:`, err?.message || err);
  }
}

/**
 * Judecata — funcție PURĂ, ca să poată fi probată fără magazie.
 * O inimă care N-A BĂTUT NICIODATĂ nu alarmează (prima bătaie a săptămânalelor vine
 * abia duminică) — se raportează doar informativ. Alarma e pentru inima care A bătut
 * și a tăcut apoi peste prag: aceea e o funcție care mergea și s-a oprit.
 */
export function judecaInimile(batai, acum = Date.now()) {
  const intarziate = [];
  const nebatute = [];
  for (const [nume, reguli] of Object.entries(INIMI)) {
    const la = Date.parse(batai[nume]?.la || "");
    if (!Number.isFinite(la)) { nebatute.push(nume); continue; }
    const varstaMin = Math.floor((acum - la) / 60000);
    if (varstaMin > reguli.pragMin) {
      intarziate.push({ nume, cadenta: reguli.cadenta, ultimaBataie: batai[nume].la, deMinute: varstaMin });
    }
  }
  return { ok: intarziate.length === 0, intarziate, nebatute };
}

/**
 * Citește toate bătăile din magazie (pentru endpointul public stare-inimi).
 * Întoarce `{ batai, eroareMagazie }`. `eroareMagazie` e TRUE doar când magazia „acces"
 * nu s-a putut citi DELOC (toate cererile au aruncat) — o cheie absentă întoarce null
 * fără eroare, deci o inimă nebătută NU e confundată cu o magazie moartă, iar un sughiț
 * izolat printre citiri reușite nu ridică alarma. Așa, fereastra publică poate cădea
 * fail-CLOSED (nu „sănătos") când e cu adevărat oarbă.
 */
export async function citesteInimile() {
  const s = magazie();
  const batai = {};
  let citite = 0, cuEroare = 0;
  for (const nume of Object.keys(INIMI)) {
    try {
      batai[nume] = await s.get("inima/" + nume, { type: "json" });
      citite++;
    } catch {
      batai[nume] = null;
      cuEroare++;
    }
  }
  return { batai, eroareMagazie: citite === 0 && cuEroare > 0 };
}
