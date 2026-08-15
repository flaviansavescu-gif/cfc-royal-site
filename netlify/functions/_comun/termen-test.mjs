// termen-test.mjs — regulile termenului de susținere al unui test de modul.
//
// Administratorul poate fixa, per test, un TERMEN până la care testul se poate susține.
// După termen, corectarea refuză testul. Reactivarea înseamnă un termen NOU, însoțit de
// o PENALIZARE (procent ales de administrator la fiecare reactivare): orice notă obținută
// în fereastra reactivată se reduce cu acel procent, iar promovarea se judecă pe nota
// redusă. Cine a promovat în termen nu e atins — progresul lui e deja salvat.
//
// Regulile stau aici, într-un modul pur (fără magazie, fără rețea), ca să poată fi
// probate automat. `test-modul` (corectarea) și `stare-cursuri` (administrarea) le
// folosesc pe amândouă — o singură definiție a adevărului.

/** Penalizarea se ține între 0 și 90%: 100% ar face orice notă zero — o închidere mascată. */
export function curataPenalizarea(p) {
  const n = Math.round(Number(p) || 0);
  return Math.min(90, Math.max(0, n));
}

/**
 * Starea unui termen la momentul `acum`.
 * Fără termen (sau cu termen ilizibil): testul e DESCHIS, fără penalizare — termenul e
 * opțional, iar o dată coruptă nu are voie să închidă un test.
 */
export function stareTermen(termen, acum = Date.now()) {
  if (!termen || !termen.pana) return { areTermen: false, inchis: false, penalizare: 0 };
  const pana = Date.parse(termen.pana);
  if (!Number.isFinite(pana)) return { areTermen: false, inchis: false, penalizare: 0 };
  return { areTermen: true, inchis: acum > pana, penalizare: curataPenalizarea(termen.penalizare) };
}

/** Nota finală: nota brută redusă cu penalizarea, rotunjită, ținută în [0, 100]. */
export function aplicaPenalizarea(procentBrut, penalizare) {
  const brut = Math.min(100, Math.max(0, Number(procentBrut) || 0));
  const p = Math.round((brut * (100 - curataPenalizarea(penalizare))) / 100);
  return Math.min(100, Math.max(0, p));
}

/** Termenul, pe românește și pe ora României — indiferent unde rulează serverul. */
export function formateazaTermen(iso) {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      timeZone: "Europe/Bucharest",
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}
