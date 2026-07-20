// inscriere-expo.mjs — puntea de înscriere online între cfc-royal.ro și CFCR Expo Manager.
// Publicul trimite înscrieri; ele se strâng într-o coadă (Netlify Blobs) și sunt importate
// ulterior în managerul local de pe laptop. Regulile WDF (clasă vs. vârstă) sunt impuse aici.
//
// GET                                  -> { expozitii: [...deschise cu rase] }
// POST { showId, ...caine, ...proprietar, clasa }  -> înscriere publică (validată, în coadă, email)
// POST { secret, actiune:"config", config }        -> managerul publică/actualizează o expoziție
// POST { secret, actiune:"inchide", showId }        -> închide înscrierile online
// POST { secret, actiune:"coada", showId }          -> managerul trage înscrierile neimportate
// POST { secret, actiune:"marcheaza", showId, ids } -> managerul marchează înscrierile ca importate
import { getStore } from "@netlify/blobs";

const SECRET = process.env.EXPO_SYNC_SECRET || "";

// Clasele WDF și intervalele de vârstă (luni la data expoziției). Trebuie ținute în acord
// cu lib/domeniu.ts din manager.
const VARSTA = {
  baby: { min: 3, max: 6 },
  puppy: { min: 6, max: 9 },
  very_young: { min: 9, max: 12 },
  young: { min: 12, max: 18 },
  intermediara: { min: 15, max: 24 },
  deschisa: { min: 18, max: null },
  working: { min: 18, max: null },
  winner: { min: 15, max: null },
  champion: { min: 15, max: null },
  foreign_champion: { min: 15, max: null },
  veterani: { min: 120, max: null },
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function varstaInLuni(nastere, laData) {
  const d1 = new Date(nastere), d2 = new Date(laData);
  let luni = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) luni -= 1;
  return luni;
}

function clasaValida(clasa, nastere, dataShow) {
  const r = VARSTA[clasa];
  if (!r) return false;
  const luni = varstaInLuni(nastere, dataShow);
  if (luni < r.min) return false;
  if (r.max !== null && luni >= r.max) return false;
  return true;
}

function inchisPentruInscrieri(config) {
  if (!config || !config.deschis) return true;
  const limita = new Date(config.termen);
  limita.setHours(23, 59, 59, 999);
  return new Date() > limita;
}

export default async (req) => {
  const store = getStore("expozitii");

  // ——— Public: lista expozițiilor deschise ———
  if (req.method === "GET") {
    const expozitii = [];
    try {
      const { blobs } = await store.list({ prefix: "config/" });
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" });
        if (c && !inchisPentruInscrieri(c)) {
          expozitii.push({ showId: c.showId, nume: c.nume, data: c.data, termen: c.termen, locatie: c.locatie, rase: c.rase || [] });
        }
      }
    } catch (err) {
      console.error("Listare expoziții eșuată:", err);
    }
    expozitii.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    return json({ expozitii });
  }

  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  // ——— Manager (protejat cu secret) ———
  if (body.secret) {
    if (!SECRET || body.secret !== SECRET) return json({ eroare: "Secret invalid." }, 401);

    if (body.actiune === "config") {
      const c = body.config || {};
      if (!c.showId) return json({ eroare: "showId lipsă." }, 400);
      await store.setJSON("config/" + c.showId, { ...c, deschis: true });
      return json({ ok: true });
    }
    if (body.actiune === "inchide") {
      const c = await store.get("config/" + body.showId, { type: "json" });
      if (c) await store.setJSON("config/" + body.showId, { ...c, deschis: false });
      return json({ ok: true });
    }
    if (body.actiune === "coada") {
      const inscrieri = [];
      try {
        const { blobs } = await store.list({ prefix: "coada/" + body.showId + "/" });
        for (const b of blobs) {
          const i = await store.get(b.key, { type: "json" });
          if (i && !i.importat) inscrieri.push({ ...i, key: b.key });
        }
      } catch (err) {
        console.error("Citire coadă eșuată:", err);
      }
      return json({ inscrieri });
    }
    if (body.actiune === "marcheaza") {
      for (const key of body.chei || []) {
        try {
          const i = await store.get(key, { type: "json" });
          if (i) await store.setJSON(key, { ...i, importat: true });
        } catch (err) {
          console.error("Marcare eșuată:", err);
        }
      }
      return json({ ok: true });
    }
    return json({ eroare: "Acțiune necunoscută." }, 400);
  }

  // ——— Public: trimiterea unei înscrieri ———
  const showId = String(body.showId || "");
  const config = await store.get("config/" + showId, { type: "json" });
  if (!config) return json({ eroare: "Expoziție inexistentă." }, 404);
  if (inchisPentruInscrieri(config)) return json({ eroare: "Înscrierile pentru această expoziție nu mai sunt deschise." }, 400);

  const numeCaine = String(body.numeCaine || "").trim();
  const rasaId = String(body.rasaId || "");
  const sex = String(body.sex || "");
  const dataNasterii = String(body.dataNasterii || "");
  const clasa = String(body.clasa || "");
  const numeProp = String(body.numeProprietar || "").trim();
  const email = String(body.email || "").trim().toLowerCase();

  const rasa = (config.rase || []).find((r) => r.id === rasaId);
  if (numeCaine.length < 2) return json({ eroare: "Numele câinelui este obligatoriu." }, 400);
  if (!rasa) return json({ eroare: "Alege o rasă din listă." }, 400);
  if (!["M", "F"].includes(sex)) return json({ eroare: "Alege sexul câinelui." }, 400);
  if (!dataNasterii || isNaN(new Date(dataNasterii).getTime())) return json({ eroare: "Data nașterii este invalidă." }, 400);
  if (!VARSTA[clasa]) return json({ eroare: "Alege clasa de concurs." }, 400);
  if (numeProp.length < 3) return json({ eroare: "Numele proprietarului este obligatoriu." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ eroare: "Email invalid." }, 400);
  if (String(body.gdpr || "") !== "1") return json({ eroare: "Trebuie să accepți prelucrarea datelor (GDPR)." }, 400);
  // „Toți câinii participanți trebuie să fie identificați prin microchip, iar datele
  // acestuia trebuie să corespundă în mod exact cu documentele prezentate"
  // (Verificarea identității câinilor, 1.1). Era opțional aici, deși în manager e
  // obligatoriu — a doua cale, negardată.
  if (String(body.microcip || "").trim().length < 6)
    return json({ eroare: "Microcipul este obligatoriu (minimum 6 caractere)." }, 400);
  // Numarul de pedigree e obligatoriu daca exemplarul are pedigree. Exceptia declarata
  // e calea pedigree-ului de tipicitate (caine de rasa fara acte). Verificat si pe
  // server, nu doar in browser.
  if (String(body.pedigreeTipicitate || "") !== "1" && String(body.pedigree || "").trim().length < 2)
    return json({ eroare: "Numărul de pedigree este obligatoriu. Dacă exemplarul nu are acte, bifează pedigree de tipicitate." }, 400);
  if (!clasaValida(clasa, dataNasterii, config.data))
    return json({ eroare: "Vârsta câinelui la data expoziției nu se încadrează în clasa aleasă." }, 400);

  const inscriere = {
    showId,
    numeCaine: numeCaine.slice(0, 120),
    rasaId,
    rasaNumeRo: rasa.numeRo,
    sex,
    dataNasterii,
    pedigree: String(body.pedigree || "").trim().slice(0, 60) || null,
    pedigreeTipicitate: String(body.pedigreeTipicitate || "") === "1",
    microcip: String(body.microcip || "").trim().slice(0, 60) || null,
    crescator: String(body.crescator || "").trim().slice(0, 120) || null,
    // Art. 21 lit. f — se tipăresc în catalog; managerul le preia la import.
    culoareRoba: String(body.culoareRoba || "").trim().slice(0, 120) || null,
    tata: String(body.tata || "").trim().slice(0, 120) || null,
    mama: String(body.mama || "").trim().slice(0, 120) || null,
    clasa,
    numeProprietar: numeProp.slice(0, 120),
    email,
    telefon: String(body.telefon || "").trim().slice(0, 40) || null,
    adresa: String(body.adresa || "").trim().slice(0, 200) || null,
    tara: String(body.tara || "").trim().slice(0, 60) || null,
    creat: new Date().toISOString(),
    importat: false,
  };

  const key = "coada/" + showId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  await store.setJSON(key, inscriere);

  // Email de confirmare (Brevo), dacă e configurat.
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    const html = `<p>Bună, ${numeProp.replace(/</g, "&lt;")},</p>
      <p>Am primit înscrierea câinelui <b>${numeCaine.replace(/</g, "&lt;")}</b> (${rasa.numeRo}) la expoziția <b>${config.nume}</b> (${config.data}).</p>
      <p>Vei primi numărul de catalog după validarea de către secretariat.</p>
      <p>— Club Federal Chinologic Royal · World Dog Federation</p>`;
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "CFC-Royal Expoziții", email: "newsletter@cfc-royal.ro" },
          to: [{ email }],
          subject: `Înscriere primită — ${config.nume}`,
          htmlContent: html,
        }),
      });
    } catch (err) {
      console.error("Email confirmare eșuat:", err);
    }
  }

  return json({ ok: true });
};
