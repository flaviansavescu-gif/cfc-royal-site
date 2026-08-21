// termene-reamintiri.mjs — termenele testelor de modul, anunțate ÎNAINTE, nu după.
//
// DE CE. Adminul fixează termene per modul (termene-module), iar după termen testul se
// închide singur. Până azi, candidatul afla asta abia când era prea târziu — cazul care
// a născut funcția: un termen pierdut, aflat pe WhatsApp, după. De-acum vestea vine
// înainte: cu 7 și cu 2 zile înaintea termenului.
//
// PE UNDE. Platforma nu ține e-mailurile candidaților — dar abonarea la Buletinul Școlii
// făcută DIN CONT poartă insigna candidatului (abonat/<sha256(email)>.membruId). Cine e
// abonat primește vestea DIRECT; cine nu, ajunge într-un singur e-mail-rezumat către
// administrator, care decide dacă îl mai prinde pe alt canal. Încă un motiv de abonare.
//
// FĂRĂ DUBLURI. O veste pe treaptă (7 zile / 2 zile), per candidat + modul + TERMEN:
// marcajul ține minte termenul pentru care s-a trimis — un termen mutat redeschide
// treptele, cum e firesc. Ferestre, nu egalități: o rulare căzută nu pierde vestea.
//
// Stocare (store "cursuri"):
//   termen-amintit/<cid>/<slug>  -> { p7?: <pana>, p2?: <pana> }
//   termen-amintit-admin/<slug>  -> { p7?: <pana>, p2?: <pana> }
import { getStore } from "@netlify/blobs";
import { trimite, escapeHtml, ADRESA_ASOCIATIEI } from "./_comun/posta.mjs";
import { bateInima } from "./_comun/inima.mjs";
import { json } from "./_comun/raspuns.mjs";

const TREPTE = [
  { cheia: "p7", deLaZile: 3, panaLaZile: 7, cand: "într-o săptămână" },
  { cheia: "p2", deLaZile: 0, panaLaZile: 2, cand: "în zilele următoare" },
];

/**
 * Judecata — funcție PURĂ, probabilă fără magazie: ce module au termen în vreo fereastră
 * de reamintire, și pe ce treaptă. `termene` e obiectul „termene-module".
 */
export function judecaTermenele(termene, acum = Date.now()) {
  const deAnuntat = [];
  for (const [slug, t] of Object.entries(termene || {})) {
    const pana = Date.parse(String(t?.pana || ""));
    if (!Number.isFinite(pana)) continue;
    const zile = Math.floor((pana - acum) / 86400e3);
    for (const treapta of TREPTE) {
      if (zile < treapta.deLaZile || zile > treapta.panaLaZile) continue;
      deAnuntat.push({ slug, pana: t.pana, treapta });
      break;                                  // o singură treaptă pe zi per modul
    }
  }
  return deAnuntat;
}

/** „modul-3" -> „Modulul 3" — numele omenesc al modulului, din slug. */
const numeModul = (slug) => {
  const nr = String(slug).match(/(\d+)$/);
  return nr ? "Modulul " + nr[1] : slug;
};

export default async () => {
  await bateInima("termene-reamintiri");
  const s = getStore("cursuri");

  const termene = (await s.get("termene-module", { type: "json" }).catch(() => null)) || {};
  const deAnuntat = judecaTermenele(termene);
  if (!deAnuntat.length) return json({ ok: true, trimise: 0 });

  // Candidații + legătura candidat -> e-mail (abonările făcute din cont poartă insigna).
  const candidati = new Map();
  try {
    const { blobs } = await s.list({ prefix: "candidat/" });
    for (const b of blobs) {
      const c = await s.get(b.key, { type: "json" }).catch(() => null);
      if (c) candidati.set(b.key.slice("candidat/".length), { nume: String(c.nume || "") });
    }
  } catch (err) {
    console.error("Listarea candidaților a eșuat — reamintirile se reiau mâine:", err);
    return json({ ok: false });
  }
  const emailDeCid = new Map();
  try {
    const { blobs } = await s.list({ prefix: "abonat/" });
    for (const b of blobs) {
      const a = await s.get(b.key, { type: "json" }).catch(() => null);
      if (a?.membruId && a.email && !emailDeCid.has(a.membruId)) emailDeCid.set(a.membruId, a.email);
    }
  } catch (err) { console.error("Listarea abonaților a eșuat:", err); }

  let trimise = 0;
  const pentruAdmin = [];   // { modul, pana, nume:[...] } — cei fără e-mail cunoscut

  for (const { slug, pana, treapta } of deAnuntat) {
    const dataRo = new Date(pana).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
    const neanuntati = [];
    for (const [cid, cand] of candidati) {
      // Doar cine NU a promovat testul modulului.
      const p = await s.get("progres/" + cid + "/" + slug, { type: "json" }).catch(() => null);
      if (p?.promovat) continue;

      const email = emailDeCid.get(cid);
      if (!email) { neanuntati.push(cand.nume || cid); continue; }

      const marcaj = (await s.get("termen-amintit/" + cid + "/" + slug, { type: "json" }).catch(() => null)) || {};
      if (marcaj[treapta.cheia] === pana) continue;      // deja anunțat pentru acest termen

      const aPlecat = await trimite({
        catre: email,
        subiect: `[Școala de Arbitraj] ${numeModul(slug)} — testul se închide pe ${dataRo}`,
        html: `<p>Bună, ${escapeHtml(cand.nume || "")},</p>` +
          `<p>Termenul testului de la <strong>${escapeHtml(numeModul(slug))}</strong> se împlinește ` +
          `${treapta.cand}: <strong>${escapeHtml(dataRo)}</strong>. Nu ai promovat încă acest test.</p>` +
          `<p>Îl poți susține oricând până la termen, din ` +
          `<a href="https://cfc-royal.ro/cursuri/${encodeURIComponent(slug)}/">pagina modulului</a> ` +
          `(intri cu codul tău personal). După termen, testul se închide și se mai poate susține doar la cerere.</p>` +
          `<p style="color:#888;font-size:12px">Școala de Arbitraj — Asociația Club Federal Chinologic Royal</p>`,
      });
      // Marcajul se scrie DOAR după ce vestea a plecat: o poștă căzută reîncearcă mâine.
      if (aPlecat) {
        trimise++;
        await s.setJSON("termen-amintit/" + cid + "/" + slug, { ...marcaj, [treapta.cheia]: pana })
          .catch((err) => console.error("Marcajul reamintirii nu s-a scris:", err));
      }
    }

    if (neanuntati.length) {
      const marcajAdmin = (await s.get("termen-amintit-admin/" + slug, { type: "json" }).catch(() => null)) || {};
      if (marcajAdmin[treapta.cheia] !== pana) {
        pentruAdmin.push({ slug, dataRo, nume: neanuntati, treapta: treapta.cheia, pana });
      }
    }
  }

  // Un singur rezumat către administrator, cu toți cei de neatins pe e-mail.
  if (pentruAdmin.length) {
    const corp = pentruAdmin.map((x) =>
      `<p><strong>${escapeHtml(numeModul(x.slug))}</strong> — termen ${escapeHtml(x.dataRo)}; ` +
      `fără e-mail cunoscut (neabonați la Buletin):</p>` +
      `<ul>${x.nume.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`).join("");
    const aPlecat = await trimite({
      catre: ADRESA_ASOCIATIEI,
      subiect: `[Școala de Arbitraj] Termene aproape — ${pentruAdmin.reduce((n, x) => n + x.nume.length, 0)} candidați de anunțat pe alt canal`,
      html: `<p>Candidații de mai jos nu au promovat testele cu termen apropiat și NU pot fi anunțați ` +
        `automat (nu s-au abonat la Buletin din contul lor):</p>` + corp +
        `<p style="color:#888;font-size:12px">Cine se abonează din cont primește aceste vești direct — fără drumul acesta.</p>`,
    });
    if (aPlecat) {
      trimise++;
      for (const x of pentruAdmin) {
        const m = (await s.get("termen-amintit-admin/" + x.slug, { type: "json" }).catch(() => null)) || {};
        await s.setJSON("termen-amintit-admin/" + x.slug, { ...m, [x.treapta]: x.pana })
          .catch((err) => console.error("Marcajul rezumatului nu s-a scris:", err));
      }
    }
  }

  console.log(`Reamintiri de termene: ${trimise} e-mailuri (${deAnuntat.length} module în fereastră).`);
  return json({ ok: true, trimise });
};

// În fiecare zi la 06:30 UTC — după reamintirile de cotizație, înaintea programului.
export const config = { schedule: "30 6 * * *" };
