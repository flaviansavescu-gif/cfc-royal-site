// _comun/posta.mjs — trimiterea de e-mailuri, dintr-un singur loc.
//
// Erau trei locuri care construiau aceeași cerere către Brevo, fiecare cu expeditorul
// lui scris de mână. Când se schimbă furnizorul sau adresa, se schimbă aici.
//
// Regula casei: o trimitere eșuată NU aruncă. Funcțiile care cheamă de aici au deja
// făcut treaba (au înregistrat o declarație, au consemnat o faptă) — un e-mail care nu
// pleacă nu are voie să transforme o operațiune reușită într-o eroare pentru om.
// Întoarce `true`/`false`, iar eșecul se vede în jurnalul funcției.

const EXPEDITOR = { name: "Registrul genealogic CFC-Royal", email: "newsletter@cfc-royal.ro" };

/**
 * Adresa la care ajung alertele și codurile de administrator.
 *
 * E cutia pe care președintele o CITEȘTE, nu neapărat cea mai instituțională: un cod de
 * intrare valabil 10 minute și o alertă de faptă gravă nu au ce căuta într-o cutie pe
 * care o deschide cineva săptămânal. Se poate muta oricând din Netlify, fără publicare,
 * prin variabila ALERTE_EMAIL.
 */
export const ADRESA_ASOCIATIEI = process.env.ALERTE_EMAIL || "flavian.savescu@gmail.com";

export const escapeHtml = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** E configurată trimiterea? Fără cheie, nimic nu pleacă nicăieri. */
export const postaConfigurata = () => !!process.env.BREVO_API_KEY;

/**
 * @returns {Promise<boolean>} a plecat?
 */
export async function trimite({ catre, subiect, html, expeditor }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error(`E-MAIL NETRIMIS (lipsește BREVO_API_KEY): „${subiect}" către ${catre}`);
    return false;
  }
  if (!catre) {
    console.error(`E-MAIL NETRIMIS (fără destinatar): „${subiect}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: expeditor || EXPEDITOR,
        to: [{ email: catre }],
        subject: subiect,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      console.error("Brevo:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("Trimiterea e-mailului a eșuat:", err);
    return false;
  }
}

/** Antetul comun al e-mailurilor instituționale. */
export function pagina(titlu, culoare, corp) {
  return (
    `<h2 style="margin:0 0 4px;color:${culoare}">${escapeHtml(titlu)}</h2>` +
    `<p style="color:#666;margin:0 0 18px">Registrul genealogic — Asociația Club Federal Chinologic Royal</p>` +
    corp
  );
}
