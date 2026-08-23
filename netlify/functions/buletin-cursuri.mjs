// buletin-cursuri.mjs — Buletinul Școlii de Arbitraj (newsletter intern).
//
// Arhiva trăiește în platformă (o văd toți membrii: candidați, arbitri, lectori,
// administrator), iar cine vrea îl primește și pe e-mail. Adresele se dau EXPLICIT,
// din pagina buletinului (opt-in), și se pot scoate oricând de acolo — nu se
// refolosește lista publică de newsletter a site-ului.
//
// Stocare (store „cursuri"):
//   buletin/<ts>-<rand>  -> { titlu, text, data }
//   abonat/<sha256(email)> -> { email, nume?, creat }
//
// POST { actiune:"lista",       cod|cid }          -> { buletine:[...] }        (orice membru)
// POST { actiune:"aboneaza",    cod|cid, email }   -> { ok }                    (orice membru)
// POST { actiune:"dezaboneaza", cod|cid, email }   -> { ok }                    (orice membru)
// POST { actiune:"publica",     cod, titlu, text } -> { ok, trimise, esuate }   (doar admin)
// POST { actiune:"sterge",      cod, key }         -> { ok }                    (doar admin)
// POST { actiune:"abonati",     cod }              -> { abonati:[...] }         (doar admin)
import { getStore } from "@netlify/blobs";
import { rolLaIntrare, actorDinCod, sha256, LECTORI } from "./_comun/roluri.mjs";
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { segmentCheieValid } from "./_comun/cheie-blob.mjs";
import {
  magazie as magazieJetoane, cheieDezabonare, jetonNou, jetonDezabonare,
} from "./_comun/buletin-acord.mjs";
import { json } from "./_comun/raspuns.mjs";

/** E membru al platformei? (candidat cu cod individual, arbitru, lector, admin sau cod comun) */
async function esteMembru(body, store) {
  if (await membruIndividual(body, store)) return true;
  // Codul comun și cel de administrator dau acces la ARHIVĂ, dar nu la abonări.
  const cod = String(body.cod || "").trim();
  return !!(cod && rolLaIntrare(cod));
}

/**
 * Membrul IDENTIFICABIL — candidat cu cod propriu, lector sau arbitru.
 * Abonările se leagă de el: altfel, oricine are codul COMUN (împărțit între candidați)
 * putea abona adresa altcuiva fără consimțământ sau, mai rău, o putea dezabona tăcut.
 */
async function membruIndividual(body, store) {
  // M1: câmpul `cid` poartă CODUL candidatului, nu insigna; insigna internă = sha256(cod).
  const cid = String(body.cid || "").trim();
  if (cid) {
    const insigna = sha256(cid);
    try {
      const c = await store.get("candidat/" + insigna, { type: "json" });
      if (c) return { id: insigna, nume: String(c.nume || "").trim() || "Candidat", rol: "candidat" };
    } catch (err) { console.error(err); }
  }
  const cod = String(body.cod || "").trim();
  if (cod) {
    const fix = rolLaIntrare(cod);
    if (fix?.rol === "lector") return { id: sha256(cod), nume: fix.nume, rol: "lector" };
    if (fix) return null; // admin sau cod comun — nu au identitate personală
    try {
      const a = await store.get("arbitru/" + sha256(cod), { type: "json" });
      if (a) return { id: sha256(cod), nume: String(a.nume || "").trim() || "Arbitru", rol: "arbitru" };
    } catch (err) { console.error(err); }
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = String(body.actiune || "");
  // Cine nu trece de o poartă nu atinge stocarea — de aceea store-ul se creează abia după.
  const esteAdmin = actorDinCod(String(body.cod || ""))?.rol === "admin";

  // —— Acțiunile membrilor ——
  if (actiune === "lista" || actiune === "aboneaza" || actiune === "dezaboneaza") {
    // Fără nicio acreditare nu atingem stocarea.
    if (!String(body.cid || "").trim() && !String(body.cod || "").trim())
      return json({ eroare: "Buletinul este disponibil doar membrilor platformei." }, 403);
    const store = getStore("cursuri");
    if (!(await esteMembru(body, store)))
      return json({ eroare: "Buletinul este disponibil doar membrilor platformei." }, 403);

    if (actiune === "lista") {
      const buletine = [];
      try {
        const { blobs } = await store.list({ prefix: "buletin/" });
        for (const b of blobs) {
          const x = await store.get(b.key, { type: "json" });
          if (x) buletine.push({ ...x, key: b.key });
        }
      } catch (err) { console.error("Citire buletine eșuată:", err); }
      buletine.sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
      return json({ buletine });
    }

    const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
    if (!EMAIL_RE.test(email)) return json({ eroare: "Scrie o adresă de e-mail validă." }, 400);
    const cheie = "abonat/" + sha256(email);

    // Abonările cer identitate personală: cu codul comun nu se poate abona sau dezabona
    // nimeni — nici pe sine, nici, mai ales, pe altcineva.
    const membru = await membruIndividual(body, store);
    const existent = await store.get(cheie, { type: "json" }).catch(() => null);

    if (actiune === "aboneaza") {
      if (!membru)
        return json({ eroare: "Abonarea se face cu codul tău personal (de candidat, arbitru sau lector), nu cu codul comun." }, 403);
      // O adresă aparține unui singur membru: nu se poate prelua adresa altcuiva.
      // DAR stăpânul înregistrat poate fi o insignă MOARTĂ (cod regenerat, abonare
      // dinaintea refactorului identității): atunci înregistrarea e orfană și refuzul
      // bloca pe nedrept chiar omul adresei (cazul din 23.08 — „deja abonată de alt
      // membru", deși atenționarea îl arăta neabonat). Orfanele se preiau; adresa
      // unui stăpân ÎN VIAȚĂ rămâne de neatins.
      if (existent && existent.membruId && existent.membruId !== membru.id) {
        const [candidatViu, arbitruViu] = await Promise.all([
          store.get("candidat/" + existent.membruId, { type: "json" }).catch(() => null),
          store.get("arbitru/" + existent.membruId, { type: "json" }).catch(() => null),
        ]);
        const lectorViu = LECTORI.some((l) => l.hash === existent.membruId);
        if (candidatViu || arbitruViu || lectorViu)
          return json({ eroare: "Adresa este deja abonată de alt membru al platformei. Dacă adresa e chiar a ta, scrie-ne — administratorul o poate elibera din panou." }, 409);
        console.log(`Abonare orfană preluată: ${email} (stăpânul vechi ${existent.membruId.slice(0, 8)}… nu mai există).`);
      }
      const inregistrare = {
        email,
        membruId: membru.id,
        nume: membru.nume,
        rol: membru.rol,
        creat: existent?.creat || new Date().toISOString(),
        jetonDezabonare: existent?.jetonDezabonare || null,
      };
      await store.setJSON(cheie, inregistrare);
      // Jetonul se face acum, nu la prima trimitere: linkul de dezabonare trebuie să
      // existe din clipa în care există abonarea.
      await jetonDezabonare(store, cheie, inregistrare);
      return json({ ok: true });
    }

    // dezaboneaza — doar propria adresă; administratorul poate scoate pe oricine (din panou).
    if (!esteAdmin) {
      if (!membru)
        return json({ eroare: "Dezabonarea se face cu codul tău personal, nu cu codul comun." }, 403);
      if (existent && existent.membruId && existent.membruId !== membru.id) {
        // Aceeași judecată ca la abonare: stăpânul mort nu mai apără nimic — a-i refuza
        // omului dezabonarea propriei adrese ar fi și absurd, și contra GDPR.
        const [candidatViu, arbitruViu] = await Promise.all([
          store.get("candidat/" + existent.membruId, { type: "json" }).catch(() => null),
          store.get("arbitru/" + existent.membruId, { type: "json" }).catch(() => null),
        ]);
        if (candidatViu || arbitruViu || LECTORI.some((l) => l.hash === existent.membruId))
          return json({ eroare: "Poți dezabona doar adresa pe care ai abonat-o tu." }, 403);
      }
    }
    try { await store.delete(cheie); } catch (err) { console.error(err); }
    // …și jetonul din linkurile deja trimise: după ce omul a ieșit, un link rămas valabil
    // ar dezabona a doua oară o adresă care nu mai e abonată.
    if (existent?.jetonDezabonare) {
      try { await magazieJetoane().delete(cheieDezabonare(existent.jetonDezabonare)); }
      catch (err) { console.error(err); }
    }
    return json({ ok: true });
  }

  // —— Acțiunile administratorului ——
  if (!esteAdmin) return json({ eroare: "Doar administratorul poate face această operație." }, 401);

  const store = getStore("cursuri");
  // A doua cheie: codul de admin singur nu ajunge (trimitere în masă, ștergere, listă de
  // abonați). Cere jetonul dispozitivului, ca restul funcțiilor de administrare.
  if (!(await dispozitivCunoscut(store, String(body.dispozitiv || "").trim(), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });

  if (actiune === "abonati") {
    const abonati = [];
    try {
      const { blobs } = await store.list({ prefix: "abonat/" });
      for (const b of blobs) {
        const a = await store.get(b.key, { type: "json" });
        // `nume`/`rol` lipsesc la abonările vechi (dinainte de legarea de membru).
        if (a) abonati.push({ email: a.email, creat: a.creat, nume: a.nume || null, rol: a.rol || null });
      }
    } catch (err) { console.error(err); }
    abonati.sort((a, b) => String(a.email).localeCompare(String(b.email)));
    return json({ abonati });
  }

  if (actiune === "sterge") {
    const key = String(body.key || "");
    if (!key.startsWith("buletin/") || !segmentCheieValid(key.slice("buletin/".length))) return json({ eroare: "Cheie invalidă." }, 400);
    try { await store.delete(key); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  if (actiune === "publica") {
    const titlu = String(body.titlu || "").trim().slice(0, 200);
    const text = String(body.text || "").trim().slice(0, 20000);
    if (titlu.length < 3) return json({ eroare: "Scrie un titlu." }, 400);
    if (text.length < 10) return json({ eroare: "Scrie conținutul buletinului." }, 400);

    const data = new Date().toISOString();
    const key = "buletin/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    await store.setJSON(key, { titlu, text, data });

    // TRIMITEREA S-A MUTAT ÎN FUNDAL (buletin-trimite-background): funcțiile obișnuite
    // au 10 secunde, iar trimiterea sincronă ar fi fost retezată pe la ~120–150 de
    // abonați — o parte primeau buletinul, o parte nu, fără nicio eroare vizibilă.
    // Aici doar numărăm abonații, scriem jetonul de pornire (o singură folosință, ca la
    // registratura-citeste) și pornim fundalul. Arhiva e deja scrisă — ea e sursa de
    // adevăr; un e-mail care nu pleacă nu anulează publicarea.
    let abonati = 0;
    try { abonati = (await store.list({ prefix: "abonat/" })).blobs.length; } catch (err) { console.error(err); }

    let trimitere = "pornita";
    if (abonati > 0) {
      const jeton = jetonNou();
      await store.setJSON("buletin-fundal/" + jeton, { key, titlu, text, creat: new Date().toISOString() });
      const origine = process.env.URL || new URL(req.url).origin;
      try {
        const r = await fetch(origine + "/.netlify/functions/buletin-trimite-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jeton }),
        });
        if (r.status !== 202 && !r.ok) throw new Error("fundalul a răspuns " + r.status);
      } catch (err) {
        // Dacă fundalul n-a pornit, jetonul se șterge (să nu rămână o pornire moartă),
        // iar panoul află cinstit: buletinul E publicat în arhivă, dar e-mailurile nu
        // au plecat — se poate reîncerca publicarea sau anunța altfel.
        await store.delete("buletin-fundal/" + jeton).catch(() => {});
        console.error("Trimiterea în fundal nu a pornit:", err?.message || err);
        trimitere = "nepornita";
      }
    } else {
      trimitere = "fara-abonati";
    }

    return json({ ok: true, key, abonati, trimitere });
  }

  // Rezultatul trimiterii din fundal, pentru panoul de administrare.
  if (actiune === "stare-trimitere") {
    const key = String(body.key || "");
    if (!key.startsWith("buletin/") || !segmentCheieValid(key.slice("buletin/".length))) return json({ eroare: "Cheie invalidă." }, 400);
    const stare = await store.get("buletin-trimitere/" + key.replace(/^buletin\//, ""), { type: "json" }).catch(() => null);
    return json({ stare: stare || null });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
