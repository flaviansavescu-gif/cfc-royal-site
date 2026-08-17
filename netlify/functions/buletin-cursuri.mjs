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
import { rolLaIntrare, actorDinCod, sha256 } from "./_comun/roluri.mjs";
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { magazie as magazieJetoane, cheieDezabonare, jetonNou } from "./_comun/buletin-acord.mjs";

/**
 * Jetonul de dezabonare al unui abonat: îl face dacă nu-l are, îl întoarce dacă îl are.
 *
 * Cu el, linkul din josul fiecărui buletin scoate adresa dintr-un singur clic, fără cod
 * și fără formular — cum promite politica de confidențialitate. Abonații mai vechi
 * (dinainte de regula asta) își primesc jetonul la prima trimitere de după.
 */
async function jetonDezabonare(store, cheie, abonat) {
  if (abonat?.jetonDezabonare) return abonat.jetonDezabonare;
  const jeton = jetonNou();
  try {
    await magazieJetoane().setJSON(cheieDezabonare(jeton), { email: abonat.email, lista: "scoala" });
    await store.setJSON(cheie, { ...abonat, jetonDezabonare: jeton });
  } catch (err) {
    console.error("Jetonul de dezabonare nu s-a putut păstra:", err);
    return null;
  }
  return jeton;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
      if (existent && existent.membruId && existent.membruId !== membru.id)
        return json({ eroare: "Adresa este deja abonată de alt membru al platformei." }, 409);
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
      if (existent && existent.membruId && existent.membruId !== membru.id)
        return json({ eroare: "Poți dezabona doar adresa pe care ai abonat-o tu." }, 403);
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
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403);

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
    if (!key.startsWith("buletin/")) return json({ eroare: "Cheie invalidă." }, 400);
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

    // Trimiterea pe e-mail: către toți abonații, individual (adresele nu se văd între ele).
    // Un eșec de e-mail nu anulează publicarea — arhiva din platformă e sursa de adevăr.
    let trimise = 0, esuate = 0;
    const apiKey = process.env.BREVO_API_KEY;
    if (apiKey) {
      // Fiecare abonat vine cu jetonul lui: linkul de dezabonare e personal, altfel n-ar
      // avea cum să scoată exact adresa aceea dintr-un singur clic.
      let abonati = [];
      try {
        const { blobs } = await store.list({ prefix: "abonat/" });
        for (const b of blobs) {
          const a = await store.get(b.key, { type: "json" });
          if (!a?.email) continue;
          abonati.push({ email: a.email, jeton: await jetonDezabonare(store, b.key, a) });
        }
      } catch (err) { console.error(err); }

      const corp =
        `<h2 style="margin:0 0 12px;color:#1F4D3A">${esc(titlu)}</h2>` +
        `<div style="white-space:pre-line;line-height:1.55">${esc(text)}</div>` +
        `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">`;
      const htmlPentru = (jeton) =>
        corp +
        `<p style="color:#888;font-size:12px">Buletinul Școlii de Arbitraj — CFC-Royal · ` +
        `arhiva completă: <a href="https://cfc-royal.ro/cursuri/buletin/">cfc-royal.ro/cursuri/buletin/</a></p>` +
        (jeton
          ? `<p style="color:#888;font-size:12px">Nu mai vrei buletinul? ` +
            `<a href="https://cfc-royal.ro/.netlify/functions/buletin-dezabonare?j=${jeton}">Dezabonează-mă</a>` +
            ` — un singur clic, fără cod și fără formular.</p>`
          : `<p style="color:#888;font-size:12px">Dezabonarea: din pagina buletinului, cu codul tău.</p>`);

      // În LOTURI paralele, nu unul câte unul: secvențial, la ~300 ms per e-mail,
      // funcția expira pe la 30 de abonați și o parte din oameni nu primeau nimic.
      const LOT = 8;
      async function trimiteUnul({ email, jeton }) {
        try {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              sender: { name: "Școala de Arbitraj CFC-Royal", email: "newsletter@cfc-royal.ro" },
              to: [{ email }],
              subject: "[Școala de Arbitraj] " + titlu,
              htmlContent: htmlPentru(jeton),
            }),
          });
          if (res.ok) trimise++; else { esuate++; console.error("Brevo:", res.status, await res.text()); }
        } catch (err) { esuate++; console.error("Trimitere eșuată:", err); }
      }
      for (let i = 0; i < abonati.length; i += LOT) {
        await Promise.all(abonati.slice(i, i + LOT).map(trimiteUnul));
      }
    } else if ((await store.list({ prefix: "abonat/" })).blobs.length) {
      console.error("BREVO_API_KEY lipsește — buletinul NU a plecat pe e-mail.");
    }

    return json({ ok: true, key, trimise, esuate });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
