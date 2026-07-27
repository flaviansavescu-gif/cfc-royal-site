// _comun/monitor.mjs — logica monitorizării fluxului critic.
//
// Partea de aici NU face cereri și NU trimite e-mailuri: decide doar CE ÎNSEAMNĂ
// rezultatele și CÂND merită deranjat cineva. E despărțită tocmai fiindcă e partea
// care poate greși urât în ambele feluri: o alertă la fiecare rulare îneacă
// destinatarul (și atunci nu se mai citește niciuna), iar tăcerea la o cădere
// lungă e exact eșecul pe care monitorizarea trebuia să-l prevină.
//
// REGULA: se scrie la SCHIMBAREA de stare, nu la starea în sine.
//   bun  -> rău   : alertă de cădere
//   rău  -> bun   : alertă de revenire (la fel de importantă: închide neliniștea)
//   rău  -> rău   : tăcere, cu o singură reamintire la fiecare `PRAG_REAMINTIRE_MS`
//   bun  -> bun   : tăcere
//
// Fără reamintire, o cădere de trei zile ar produce un singur e-mail luni dimineața
// și nimic după — ușor de ratat, imposibil de reconstituit.

/** La cât timp se reamintește o cădere care ține. */
export const PRAG_REAMINTIRE_MS = 6 * 3600e3;

/** O verificare a picat dacă are `ok: false`. Cele sărite nu se pun la socoteală. */
export function verificariCazute(verificari) {
  return (verificari || []).filter((v) => v && v.ok === false);
}

/** Starea de ansamblu: „bun" doar dacă nicio verificare nu a picat. */
export function stareDin(verificari) {
  return verificariCazute(verificari).length ? "rau" : "bun";
}

/**
 * Ce facem după o rulare.
 *
 * @param {object|null} veche  starea salvată la rularea anterioară
 * @param {Array} verificari   rezultatele rulării curente
 * @param {number} acum        marca de timp (ms)
 * @returns {{stare: object, alerta: null|{tip: string, subiect: string}}}
 */
export function decide(veche, verificari, acum = Date.now(), prag = PRAG_REAMINTIRE_MS) {
  const stareNoua = stareDin(verificari);
  const cazute = verificariCazute(verificari);
  const stareVeche = veche?.stare === "rau" ? "rau" : veche?.stare === "bun" ? "bun" : null;

  const stare = {
    stare: stareNoua,
    la: new Date(acum).toISOString(),
    verificari,
    // De când ține starea asta — ca să putem spune „e căzut de trei ore", nu doar „e căzut".
    de: stareVeche === stareNoua && veche?.de ? veche.de : new Date(acum).toISOString(),
    ultimaAlerta: veche?.ultimaAlerta || null,
  };

  let alerta = null;

  if (stareNoua === "rau" && stareVeche !== "rau") {
    alerta = { tip: "cadere", subiect: eticheta(cazute) };
  } else if (stareNoua === "bun" && stareVeche === "rau") {
    alerta = { tip: "revenire", subiect: "totul funcționează din nou" };
  } else if (stareNoua === "rau" && stareVeche === "rau") {
    const ultima = Date.parse(veche?.ultimaAlerta || "") || 0;
    if (acum - ultima >= prag) alerta = { tip: "reamintire", subiect: eticheta(cazute) };
  }
  // Prima rulare cu totul bine nu anunță pe nimeni: nu e o veste, e normalitatea.

  if (alerta) stare.ultimaAlerta = new Date(acum).toISOString();
  return { stare, alerta };
}

function eticheta(cazute) {
  if (!cazute.length) return "verificare picată";
  if (cazute.length === 1) return cazute[0].nume;
  return `${cazute.length} verificări picate: ` + cazute.map((v) => v.nume).join(", ");
}

/** De cât timp ține starea curentă, în cuvinte. */
export function deCandText(de, acum = Date.now()) {
  const t = Date.parse(de || "");
  if (!t) return "";
  const min = Math.max(0, Math.round((acum - t) / 60000));
  if (min < 60) return min <= 1 ? "de un minut" : `de ${min} de minute`;
  const ore = Math.round(min / 60);
  if (ore < 24) return ore === 1 ? "de o oră" : `de ${ore} ore`;
  const zile = Math.round(ore / 24);
  return zile === 1 ? "de o zi" : `de ${zile} zile`;
}
