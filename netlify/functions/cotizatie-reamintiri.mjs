// cotizatie-reamintiri.mjs — reamintirea cotizației, pe e-mail, în fiecare dimineață.
//
// DE CE. Cotizația nu expiră cu zgomot: omul pur și simplu uită, iar la prima depunere
// refuzată află că e „expirat". Trei vești, la timp, scutesc discuția: cu 30 de zile
// înainte, cu 7 zile înainte și în ziua expirării.
//
// FĂRĂ DUBLURI. Rularea e zilnică, dar o veste se trimite O DATĂ pe treaptă și pe termen:
// marcajul (cotizatie-amintit/<membruId>) ține minte scadența pentru care s-a trimis
// fiecare treaptă. Când registratura prelungește termenul, scadența se schimbă și
// treptele se deschid din nou — pentru noul termen, cum e firesc.
//
// Ferestre, nu egalități: dacă o rulare cade, vestea pleacă la următoarea, nu se pierde.
import { getStore } from "@netlify/blobs";
import { trimite, escapeHtml } from "./_comun/posta.mjs";
import { bateInima } from "./_comun/inima.mjs";
import { json } from "./_comun/raspuns.mjs";

const TREPTE = [
  { cheia: "p30", deLaZile: 8, panaLaZile: 30, subiect: "Cotizația expiră în curând",
    text: (data) => `Cotizația ta de membru CFC-Royal expiră la <strong>${data}</strong> — în circa o lună.` },
  // Ziua scadenței (zile=0) intră AICI, nu la „a expirat": cotizația e valabilă
  // INCLUSIV în ziua scadenței (așa o judecă și cotizatieLaZi din registru).
  { cheia: "p7", deLaZile: 0, panaLaZile: 7, subiect: "Cotizația expiră săptămâna aceasta",
    text: (data) => `Cotizația ta de membru CFC-Royal expiră la <strong>${data}</strong> — mai sunt cel mult câteva zile.` },
  // Fereastra din urmă e mărginită la 60 de zile: recuperăm uitucii recenți, dar prima
  // rulare nu scrie fișelor vechi/onorifice expirate cu ani în urmă.
  { cheia: "p0", deLaZile: -60, panaLaZile: -1, subiect: "Cotizația a expirat",
    text: (data) => `Cotizația ta de membru CFC-Royal a expirat la <strong>${data}</strong>. Până la reînnoire, depunerile din spațiul de crescător rămân închise.` },
];

/**
 * Judecata — funcție PURĂ, ca să poată fi probată fără magazie: ce trepte se cuvin
 * fiecărui membru azi, ținând cont de ce s-a trimis deja pentru scadența lui.
 * @param membri  [{ id, nume, email, cotizatiePana }]
 * @param marcaje { <id>: { p30?: scadența, p7?: scadența, p0?: scadența } }
 */
export function cineDeAmintit(membri, marcaje, acum = Date.now()) {
  const deTrimis = [];
  for (const m of membri) {
    const scadenta = Date.parse(String(m.cotizatiePana || ""));
    if (!Number.isFinite(scadenta) || !m.email) continue;
    // Scadența ține TOATĂ ziua (cotizatieLaZi include ziua scadenței), deci zilele se
    // numără până la SFÂRȘITUL ei: în ziua scadenței zile=0 (p7, „expiră azi"), abia a
    // doua zi zile=-1 („a expirat").
    const zile = Math.floor((scadenta + 86400e3 - 1 - acum) / 86400e3);
    const ale = marcaje[m.id] || {};
    for (const t of TREPTE) {
      if (zile < t.deLaZile || zile > t.panaLaZile) continue;
      if (ale[t.cheia] === m.cotizatiePana) continue;      // deja trimisă pentru acest termen
      deTrimis.push({ membru: m, treapta: t });
      break;                                               // o singură veste pe zi per membru
    }
  }
  return deTrimis;
}

export default async () => {
  await bateInima("cotizatie-reamintiri");
  const s = getStore({ name: "registru", consistency: "strong" });

  const membri = [];
  try {
    const { blobs } = await s.list({ prefix: "membru/" });
    for (const b of blobs) {
      const m = await s.get(b.key, { type: "json" }).catch(() => null);
      if (m) membri.push({ id: b.key.slice("membru/".length), nume: m.nume, email: m.email, cotizatiePana: m.cotizatiePana });
    }
  } catch (err) {
    console.error("Listarea membrilor a eșuat — reamintirile se reiau mâine:", err);
    return json({ ok: false });
  }

  const marcaje = {};
  for (const m of membri) {
    marcaje[m.id] = (await s.get("cotizatie-amintit/" + m.id, { type: "json" }).catch(() => null)) || {};
  }

  const deTrimis = cineDeAmintit(membri, marcaje);
  let trimise = 0;
  for (const { membru, treapta } of deTrimis) {
    const dataRo = new Date(membru.cotizatiePana).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
    const aPlecat = await trimite({
      catre: membru.email,
      subiect: "[CFC-Royal] " + treapta.subiect,
      html: `<p>Bună, ${escapeHtml(membru.nume || "")},</p>` +
        `<p>${treapta.text(escapeHtml(dataRo))}</p>` +
        `<p>Reînnoirea e simplă: faci transferul (vezi <a href="https://cfc-royal.ro/ro/tarife/">tarifele</a>), ` +
        `apoi <strong>declari plata cu dovada atașată</strong> din ` +
        `<a href="https://cfc-royal.ro/crescatori/">spațiul tău de crescător</a> — registratura confirmă și termenul se prelungește automat.</p>` +
        `<p style="color:#888;font-size:12px">Asociația Club Federal Chinologic Royal · membru World Dog Federation</p>`,
    });
    // Marcajul se scrie DOAR după ce vestea a plecat: o poștă căzută reîncearcă mâine.
    if (aPlecat) {
      trimise++;
      const ale = marcaje[membru.id] || {};
      await s.setJSON("cotizatie-amintit/" + membru.id, { ...ale, [treapta.cheia]: membru.cotizatiePana })
        .catch((err) => console.error("Marcajul reamintirii nu s-a scris:", err));
    }
  }

  console.log(`Reamintiri cotizație: ${trimise} trimise din ${deTrimis.length} cuvenite (${membri.length} membri).`);
  return json({ ok: true, trimise });
};

// În fiecare zi la 06:00 UTC — dimineața devreme, înaintea programului registraturii.
export const config = { schedule: "0 6 * * *" };
