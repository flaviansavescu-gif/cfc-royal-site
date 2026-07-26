// examen-final.mjs — examenul final al Școlii de Arbitraj.
// Banca de întrebări stă NUMAI aici (server) — corectarea nu apare în paginile publice.
// La fiecare susținere se extrage aleatoriu un subset de întrebări (fără cheia de răspuns),
// se corectează pe server, se aplică pauza de reîncercare și se anunță secretariatul.
//
// EXAMINAREA FORMALIZATĂ (deciziile Colegiului din 26.07.2026):
//  • examenul se susține DOAR în sesiunile din calendar (de regulă 2/an), fiecare cu
//    comisia ei de examinare (președinte + membri), definite de administrator;
//  • rezultatul se poate CONTESTA în 3 zile; contestația admisă anulează încercarea
//    (nu mai contează la pauza de reîncercare — candidatul poate susține din nou).
//
// POST { id, actiune:"stare" }                 -> { activ, nrExtrase, prag, promovat, poateSustine,
//                                                   urmatoareaData, sesiune, urmatoareaSesiune, contestatie, poateContesta }
// POST { id, actiune:"start" }                 -> { sesiune:[{id,text,optiuni}], prag, nrExtrase }
// POST { id, actiune:"trimite", raspunsuri }   -> { corecte, total, procent, promovat, urmatoareaData }
// POST { id, actiune:"contesta", motiv }       -> { ok }
// POST { cod, actiune:"admin" }                -> { candidati:{cid:{promovat,ultimaData,incercari}} }
// POST { cod, actiune:"reset", candidatId }    -> { ok }
// POST { cod, actiune:"sesiuni" }              -> { sesiuni:[...] }
// POST { cod, actiune:"sesiune-salveaza", ... }-> { ok, id }
// POST { cod, actiune:"sesiune-sterge", id }   -> { ok }
// POST { cod, actiune:"contestatii" }          -> { contestatii:[...] }
// POST { cod, actiune:"solutioneaza", candidatId, decizie, motivare } -> { ok }
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

const ADMIN_HASH = "66c260e81fd07dae6c76578609d8e4982cb92bd510a7fde396069de586bd2bfb";
const NR_INTREBARI = 25;      // câte se extrag la un examen (sau toată banca, dacă e mai mică)
const MIN_ACTIV = 10;         // banca minimă pentru ca examenul să fie „activ”
const PRAG = 75;              // procent minim de promovare
const COOLDOWN_ZILE = 7;      // pauză după o picare
const COOLDOWN_MS = COOLDOWN_ZILE * 24 * 60 * 60 * 1000;
const CONTESTATIE_ZILE = 3;   // termenul de depunere a contestației, de la rezultat
const CONTESTATIE_MS = CONTESTATIE_ZILE * 24 * 60 * 60 * 1000;
// Fereastra de grație: cine A ÎNCEPUT examenul în sesiune îl poate trimite și după
// închiderea ei. Altfel, un candidat care începe la 23:50 în ultima zi și trimite la
// 00:05 pierdea tot — deși respectase regula la pornire.
const GRATIE_TRIMITERE_MS = 3 * 60 * 60 * 1000;

// Banca de întrebări (provizorie — lectorii o extind la 25+). corect = indexul opțiunii corecte.
const BANCA = [
  { id: "f1",  text: "Câte grupe de rase cuprinde clasificarea World Dog Federation (WDF)?", optiuni: ["8 grupe", "10 grupe", "12 grupe"], corect: 1 },
  { id: "f2",  text: "La o expoziție cu CACIB, cea mai înaltă distincție de rasă pe sex este:", optiuni: ["CAC", "CACIB", "CAJC"], corect: 1 },
  { id: "f3",  text: "Certificatul CAJC se acordă:", optiuni: ["câinilor din clasa Tineret care obțin calificativul maxim", "exclusiv campionilor", "câinilor din clasa Veterani"], corect: 0 },
  { id: "f4",  text: "La WDF există titlul BOS (Best Opposite Sex)?", optiuni: ["Da, este obligatoriu", "Nu, nu se acordă", "Doar la expozițiile naționale"], corect: 1 },
  { id: "f5",  text: "Ringul de onoare (Best in Show) la WDF se clasează:", optiuni: ["pe primele 5 locuri (Top 5) pe categorii", "doar locul 1", "pe grupe (Best in Group)"], corect: 0 },
  { id: "f6",  text: "Calificativul necesar pentru a putea acorda certificatele de tip CAC este:", optiuni: ["Foarte Bun", "Excelent", "Bun"], corect: 1 },
  { id: "f7",  text: "Un câine descalificat (DSQ) la o expoziție:", optiuni: ["primește totuși un calificativ", "nu primește niciun calificativ sau titlu", "primește automat locul 4"], corect: 1 },
  { id: "f8",  text: "Arbitrul evaluează câinele prin comparație cu:", optiuni: ["ceilalți câini din ring, indiferent de standard", "standardul oficial al rasei", "preferințele proprietarului"], corect: 1 },
  { id: "f9",  text: "Absența unui câine strigat în ring se consemnează ca:", optiuni: ["Absent", "Excelent", "CAC"], corect: 0 },
  { id: "f10", text: "Codul etic al arbitrului impune, în primul rând:", optiuni: ["favorizarea cunoscuților", "imparțialitate și evitarea conflictelor de interese", "arbitrarea rapidă, fără examinare"], corect: 1 },
  { id: "f11", text: "Fișa de arbitraj a câinelui conține:", optiuni: ["doar numele câinelui", "aprecierea descriptivă, calificativul și eventualele titluri", "doar semnătura arbitrului"], corect: 1 },
  { id: "f12", text: "În clasificarea WDF, grupa a 4-a este denumită:", optiuni: ["Teckeli", "Câini tip Bull", "Ogari"], corect: 1 },
];

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const nrExtrase = () => Math.min(NR_INTREBARI, BANCA.length);
const activ = () => BANCA.length >= MIN_ACTIV;

// Amestecare Fisher–Yates (rulăm în funcția Netlify, unde Math.random e disponibil).
function amesteca(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Eligibilitate din dosarul de examen: { promovat, poateSustine, urmatoareaData }
function eligibilitate(dosar) {
  if (dosar && dosar.promovat) return { promovat: true, poateSustine: false, urmatoareaData: null };
  const ultima = dosar && dosar.ultimaData ? Date.parse(dosar.ultimaData) : NaN;
  if (!isNaN(ultima)) {
    const gata = ultima + COOLDOWN_MS;
    if (Date.now() < gata) return { promovat: false, poateSustine: false, urmatoareaData: new Date(gata).toISOString() };
  }
  return { promovat: false, poateSustine: true, urmatoareaData: null };
}

async function candidatNume(store, id) {
  try {
    const c = await store.get("candidat/" + id, { type: "json" });
    return c ? String(c.nume || "").trim() : null;
  } catch { return null; }
}

// ——— Sesiunile de examen (calendar + comisie) ———
// sesiune-examen/<id> -> { nume, start:"AAAA-LL-ZZ", sfarsit:"AAAA-LL-ZZ", presedinte, membri:[], creat }
// O sesiune e „activă" pe toată durata zilelor ei, inclusiv capetele.
async function sesiuniToate(store) {
  const sesiuni = [];
  try {
    const { blobs } = await store.list({ prefix: "sesiune-examen/" });
    for (const b of blobs) {
      const s = await store.get(b.key, { type: "json" });
      if (s) sesiuni.push({ ...s, id: b.key.slice("sesiune-examen/".length) });
    }
  } catch (err) { console.error("Citire sesiuni eșuată:", err); }
  sesiuni.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return sesiuni;
}

function publicSesiune(s) {
  return s
    ? { id: s.id, nume: s.nume, start: s.start, sfarsit: s.sfarsit, presedinte: s.presedinte || "", membri: Array.isArray(s.membri) ? s.membri : [] }
    : null;
}

function sesiuneActivaSiUrmatoarea(sesiuni) {
  const azi = new Date().toISOString().slice(0, 10);
  const activa = sesiuni.find((s) => s.start <= azi && azi <= s.sfarsit) || null;
  const urmatoarea = sesiuni.find((s) => s.start > azi) || null;
  return { activa, urmatoarea };
}

// ——— Contestația rezultatului ———
// contestatie-examen/<cid> -> { nume, dataIncercare, procent, motiv, depusa,
//                              status: "depusa"|"admisa"|"respinsa", motivare?, solutionataLa? }
// Se poate contesta ULTIMA încercare nepromovată, în cel mult 3 zile de la rezultat.
function poateContesta(dosar, contestatie) {
  if (!dosar || dosar.promovat) return false;
  const ultima = Array.isArray(dosar.incercari) ? dosar.incercari[dosar.incercari.length - 1] : null;
  if (!ultima) return false;
  const t = Date.parse(ultima.data);
  if (isNaN(t) || Date.now() > t + CONTESTATIE_MS) return false;
  // O singură contestație per încercare.
  if (contestatie && contestatie.dataIncercare === ultima.data) return false;
  return true;
}

async function anuntaSecretariatul(subiect, html) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { console.error("BREVO_API_KEY lipsește:", subiect); return; }
  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Școala de Arbitraj CFC-Royal", email: "newsletter@cfc-royal.ro" },
        to: [{ email: "contact@cfc-royal.ro" }],
        subject: subiect,
        htmlContent: html,
      }),
    });
  } catch (err) { console.error("E-mail eșuat:", err); }
}

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = body.actiune || "stare";
  // Store-ul se creează abia după porți: cine nu trece de verificare nu atinge stocarea.

  // ——— Acțiuni de administrator ———
  const ACTIUNI_ADMIN = ["admin", "reset", "sesiuni", "sesiune-salveaza", "sesiune-sterge", "contestatii", "solutioneaza"];
  if (ACTIUNI_ADMIN.includes(actiune)) {
    if (sha256(body.cod || "") !== ADMIN_HASH) return json({ eroare: "Cod de administrator incorect." }, 401);
    const store = getStore("cursuri");

    if (actiune === "reset") {
      const cid = taie(body.candidatId, 128);
      if (!cid) return json({ eroare: "Lipsește candidatul." }, 400);
      try { await store.delete("examen/" + cid); } catch (err) { console.error(err); }
      return json({ ok: true });
    }

    if (actiune === "sesiuni") {
      return json({ sesiuni: await sesiuniToate(store) });
    }

    if (actiune === "sesiune-salveaza") {
      const nume = taie(body.nume, 120);
      const start = taie(body.start, 10);
      const sfarsit = taie(body.sfarsit, 10);
      const presedinte = taie(body.presedinte, 120);
      const membri = Array.isArray(body.membri)
        ? body.membri.map((m) => taie(m, 120)).filter(Boolean).slice(0, 8)
        : [];
      const eData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (nume.length < 3) return json({ eroare: "Dă un nume sesiunii (ex. Sesiunea de primăvară 2027)." }, 400);
      if (!eData(start) || !eData(sfarsit) || sfarsit < start)
        return json({ eroare: "Perioada sesiunii e invalidă (start ≤ sfârșit, format AAAA-LL-ZZ)." }, 400);
      if (presedinte.length < 3) return json({ eroare: "Numește președintele comisiei de examinare." }, 400);
      const id = taie(body.id, 60) || Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      await store.setJSON("sesiune-examen/" + id, {
        nume, start, sfarsit, presedinte, membri,
        creat: new Date().toISOString(),
      });
      return json({ ok: true, id });
    }

    if (actiune === "sesiune-sterge") {
      const id = taie(body.id, 60);
      if (!id) return json({ eroare: "Lipsește sesiunea." }, 400);
      try { await store.delete("sesiune-examen/" + id); } catch (err) { console.error(err); }
      return json({ ok: true });
    }

    if (actiune === "contestatii") {
      const contestatii = [];
      try {
        const { blobs } = await store.list({ prefix: "contestatie-examen/" });
        for (const b of blobs) {
          const c = await store.get(b.key, { type: "json" });
          if (c) contestatii.push({ ...c, candidatId: b.key.slice("contestatie-examen/".length) });
        }
      } catch (err) { console.error(err); }
      contestatii.sort((a, b) => String(b.depusa).localeCompare(String(a.depusa)));
      return json({ contestatii });
    }

    if (actiune === "solutioneaza") {
      const cid = taie(body.candidatId, 128);
      const decizie = taie(body.decizie, 10);
      const motivare = taie(body.motivare, 2000);
      if (!cid) return json({ eroare: "Lipsește candidatul." }, 400);
      if (decizie !== "admisa" && decizie !== "respinsa")
        return json({ eroare: "Decizia poate fi doar „admisa” sau „respinsa”." }, 400);
      if (motivare.length < 5) return json({ eroare: "Scrie motivarea deciziei — candidatul o va vedea." }, 400);

      const c = await store.get("contestatie-examen/" + cid, { type: "json" }).catch(() => null);
      if (!c || c.status !== "depusa") return json({ eroare: "Nu există o contestație în așteptare pentru acest candidat." }, 404);

      // Contestația ADMISĂ anulează încercarea contestată: dispare din dosar, deci nu
      // mai contează la pauza de reîncercare — candidatul poate susține din nou.
      if (decizie === "admisa") {
        const dosar = await store.get("examen/" + cid, { type: "json" }).catch(() => null);
        if (dosar && Array.isArray(dosar.incercari)) {
          const ramase = dosar.incercari.filter((i) => i.data !== c.dataIncercare);
          const ultima = ramase[ramase.length - 1] || null;
          await store.setJSON("examen/" + cid, {
            ...dosar,
            incercari: ramase,
            ultimaData: ultima ? ultima.data : null,
          });
        }
      }

      await store.setJSON("contestatie-examen/" + cid, {
        ...c,
        status: decizie,
        motivare,
        solutionataLa: new Date().toISOString(),
      });
      return json({ ok: true });
    }

    const candidati = {};
    try {
      const { blobs } = await store.list({ prefix: "examen/" });
      for (const b of blobs) {
        const cid = b.key.slice("examen/".length);
        const d = await store.get(b.key, { type: "json" });
        if (d) candidati[cid] = { promovat: !!d.promovat, ultimaData: d.ultimaData || null, incercari: Array.isArray(d.incercari) ? d.incercari.length : 0 };
      }
    } catch (err) { console.error("Listare examene eșuată:", err); }
    return json({ candidati });
  }

  // ——— Acțiuni de candidat (identificat prin id) ———
  const id = taie(body.id, 128);
  if (!id) return json({ eroare: "Intră cu codul tău personal pentru a susține examenul." }, 401);
  const store = getStore("cursuri");
  const nume = await candidatNume(store, id);
  if (!nume) return json({ eroare: "Cod de candidat invalid." }, 401);

  let dosar = null;
  try { dosar = await store.get("examen/" + id, { type: "json" }); } catch {}
  const elig = eligibilitate(dosar);
  const toate = await sesiuniToate(store);
  const { activa, urmatoarea } = sesiuneActivaSiUrmatoarea(toate);
  let contestatie = null;
  try { contestatie = await store.get("contestatie-examen/" + id, { type: "json" }); } catch {}

  if (actiune === "stare") {
    return json({
      activ: activ(),
      nrExtrase: nrExtrase(),
      prag: PRAG,
      ...elig,
      // Examenul se susține doar în sesiune: eligibilitatea personală rămâne separată,
      // dar butonul de start cere amândouă.
      poateSustine: elig.poateSustine && !!activa,
      inSesiune: !!activa,
      sesiune: publicSesiune(activa),
      urmatoareaSesiune: publicSesiune(urmatoarea),
      contestatie: contestatie
        ? { status: contestatie.status, motivare: contestatie.motivare || null, depusa: contestatie.depusa, solutionataLa: contestatie.solutionataLa || null }
        : null,
      poateContesta: poateContesta(dosar, contestatie),
      zileContestatie: CONTESTATIE_ZILE,
    });
  }

  if (actiune === "contesta") {
    if (!poateContesta(dosar, contestatie))
      return json({ eroare: "Poți contesta doar ultima încercare nepromovată, în cel mult " + CONTESTATIE_ZILE + " zile de la rezultat (o singură dată)." }, 409);
    const motiv = taie(body.motiv, 2000);
    if (motiv.length < 20)
      return json({ eroare: "Descrie motivul contestației (minim 20 de caractere) — comisia are nevoie de el." }, 400);
    const ultima = dosar.incercari[dosar.incercari.length - 1];
    // Contestația precedentă (dacă a existat) intră în istoric: o evidență formală nu
    // are voie să piardă deciziile motivate ale comisiei.
    const istoric = Array.isArray(contestatie?.istoric) ? contestatie.istoric.slice(-9) : [];
    if (contestatie?.status && contestatie.status !== "depusa") {
      istoric.push({
        dataIncercare: contestatie.dataIncercare,
        procent: contestatie.procent,
        motiv: contestatie.motiv,
        depusa: contestatie.depusa,
        status: contestatie.status,
        motivare: contestatie.motivare || null,
        solutionataLa: contestatie.solutionataLa || null,
      });
    }
    await store.setJSON("contestatie-examen/" + id, {
      nume,
      dataIncercare: ultima.data,
      procent: ultima.procent,
      motiv,
      depusa: new Date().toISOString(),
      status: "depusa",
      istoric,
    });
    await anuntaSecretariatul(
      `[Contestație examen] ${nume} (${ultima.procent}%)`,
      `<h2 style="margin:0 0 8px">Contestație — examenul final</h2>
       <p><b>Candidat:</b> ${nume.replace(/</g, "&lt;")}</p>
       <p><b>Încercarea contestată:</b> ${ultima.data} — ${ultima.procent}%</p>
       <p><b>Motivul:</b> ${motiv.replace(/</g, "&lt;")}</p>
       <p style="color:#888;font-size:12px">Se soluționează de comisia de examinare, din panoul de certificare al platformei.</p>`
    );
    return json({ ok: true });
  }

  if (actiune === "start") {
    if (!activ()) return json({ eroare: "Examenul final nu este încă activ." }, 409);
    if (!activa)
      return json({ eroare: urmatoarea
        ? `Examenul se susține doar în sesiunile din calendar. Următoarea: „${urmatoarea.nume}”, ${urmatoarea.start} – ${urmatoarea.sfarsit}.`
        : "Examenul se susține doar în sesiunile din calendar. Următoarea sesiune va fi anunțată de secretariat." }, 409);
    if (!elig.poateSustine)
      return json({ eroare: elig.promovat ? "Ai promovat deja examenul final." : "Poți relua examenul mai târziu.", urmatoareaData: elig.urmatoareaData }, 409);
    // Consemnăm pornirea: pe ea se sprijină fereastra de grație la trimitere.
    try {
      await store.setJSON("examen-inceput/" + id, { sesiuneId: activa.id, sesiuneNume: activa.nume, la: new Date().toISOString() });
    } catch (err) { console.error("Nu am putut consemna pornirea examenului:", err); }
    const sesiune = amesteca(BANCA).slice(0, nrExtrase()).map((q) => ({ id: q.id, text: q.text, optiuni: q.optiuni }));
    return json({ sesiune, prag: PRAG, nrExtrase: nrExtrase() });
  }

  if (actiune === "trimite") {
    if (!activ()) return json({ eroare: "Examenul final nu este încă activ." }, 409);
    // Dacă sesiunea s-a închis între pornire și trimitere, primim totuși lucrarea —
    // în limita ferestrei de grație. Munca deja făcută nu se pierde.
    let inceput = null;
    try { inceput = await store.get("examen-inceput/" + id, { type: "json" }); } catch {}
    const inGratie = !!inceput && Date.now() - Date.parse(inceput.la) <= GRATIE_TRIMITERE_MS;
    if (!activa && !inGratie)
      return json({ eroare: "Sesiunea de examen s-a închis, iar timpul de trimitere a expirat. Reia examenul în sesiunea următoare." }, 409);
    if (!elig.poateSustine)
      return json({ eroare: elig.promovat ? "Ai promovat deja examenul final." : "Poți relua examenul mai târziu.", urmatoareaData: elig.urmatoareaData }, 409);

    const raspunsuri = body.raspunsuri && typeof body.raspunsuri === "object" ? body.raspunsuri : null;
    const asteptat = nrExtrase();
    const chei = raspunsuri ? Object.keys(raspunsuri) : [];
    if (!raspunsuri || chei.length !== asteptat)
      return json({ eroare: "Răspunde la toate întrebările examenului." }, 400);

    let corecte = 0;
    for (const qid of chei) {
      const q = BANCA.find((x) => x.id === qid);
      if (q && Number(raspunsuri[qid]) === q.corect) corecte++;
    }
    const total = asteptat;
    const procent = Math.round((corecte / total) * 100);
    const promovat = procent >= PRAG;
    const acum = new Date().toISOString();

    // Actualizăm dosarul de examen (fiecare candidat pe cheia lui — fără curse).
    const incercari = (dosar && Array.isArray(dosar.incercari) ? dosar.incercari : []).slice(-9);
    incercari.push({ data: acum, procent, promovat, sesiune: activa?.nume || inceput?.sesiuneNume || "—" });
    // Pornirea s-a consumat: următoarea trimitere are nevoie de o pornire nouă.
    try { await store.delete("examen-inceput/" + id); } catch {}
    const nouDosar = { promovat: !!(dosar && dosar.promovat) || promovat, ultimaData: acum, incercari };
    try { await store.setJSON("examen/" + id, nouDosar); } catch (err) { console.error("Salvare examen eșuată:", err); }

    // Notificare secretariat (Brevo).
    const apiKey = process.env.BREVO_API_KEY;
    if (apiKey) {
      const html = `
        <h2 style="margin:0 0 8px">Examen final — Școala de Arbitraj</h2>
        <p><b>Candidat:</b> ${nume.replace(/</g, "&lt;")}</p>
        <p><b>Scor:</b> ${corecte} / ${total} (${procent}%) — <b>${promovat ? "PROMOVAT ✅" : "NEPROMOVAT ❌"}</b></p>
        <p style="color:#888;font-size:12px">Trimis automat de platforma de cursuri — cfc-royal.ro/cursuri/</p>`;
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            sender: { name: "Școala de Arbitraj CFC-Royal", email: "newsletter@cfc-royal.ro" },
            to: [{ email: "contact@cfc-royal.ro" }],
            subject: `[Examen final ${promovat ? "PROMOVAT" : "nepromovat"}] ${nume} (${procent}%)`,
            htmlContent: html,
          }),
        });
      } catch (err) { console.error("E-mail examen eșuat:", err); }
    } else {
      console.error("BREVO_API_KEY lipsește — rezultatul examenului nu a fost trimis pe e-mail.");
    }

    const urmatoareaData = promovat ? null : new Date(Date.now() + COOLDOWN_MS).toISOString();
    return json({ corecte, total, procent, promovat, prag: PRAG, urmatoareaData });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
};
