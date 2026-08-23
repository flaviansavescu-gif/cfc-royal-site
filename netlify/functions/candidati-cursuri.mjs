// candidati-cursuri.mjs — registrul candidaților (coduri individuale de acces).
// Totul necesită codul de administrator. Fiecare candidat pe cheia lui:
//   candidat/<sha256(cod)> -> { nume, cod, creat }
// Progresul candidatului stă separat, pe progres/<sha256(cod)> (vezi test-modul.mjs).
//
// POST { cod, actiune:"lista" }          -> [ { nume, cod, id, creat, prima_logare, ultima_logare } ]  (adminul vede codurile + când a intrat candidatul)
// POST { cod, actiune:"adauga", nume }   -> { ok, candidat:{ nume, cod, id, creat } }  (generează un cod unic)
// POST { cod, actiune:"sterge", id }     -> { ok }  (șterge candidatul și progresul lui)
import { getStore } from "@netlify/blobs";
import { createHash, randomInt } from "node:crypto";
import { stergeUrmeleCandidatului, curataOrfanii } from "./_comun/curatare.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { json } from "./_comun/raspuns.mjs";
import { VERSIUNE as VERSIUNE_COD_ETIC } from "./cod-etic.mjs";
// Alfabet fără caractere ambigue (0/O, 1/I/L) — codurile se dictează ușor la telefon.
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

// 8 caractere, nu 4: cu 4 existau ~0,9 milioane de variante, enumerabile într-o oră.
// Cu 8 sunt ~850 de miliarde — imposibil de ghicit, mai ales cu limitarea încercărilor
// de la intrare. Codurile deja emise (de 4) rămân valabile: se caută după amprentă.
function codNou() {
  let c = "ARB-";
  for (let i = 0; i < 8; i++) c += ALFABET[randomInt(0, ALFABET.length)];
  return c;
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ eroare: "Cerere invalidă." }, 400);
  }

  if (!esteAdmin(body.cod))
    return json({ eroare: "Cod de administrator incorect." }, 401);
  // A doua cheie: codul singur nu mai deschide administrarea Școlii.
  if (!(await dispozitivCunoscut(getStore("cursuri"), String(body.dispozitiv || "").trim(), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403, { antete: { "x-refuz-drept": "1" } });

  const store = getStore("cursuri");
  const actiune = body.actiune || "lista";

  if (actiune === "lista") {
    const lista = [];
    try {
      const { blobs } = await store.list({ prefix: "candidat/" });
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" });
        // Codul NU se mai întoarce: nu se mai păstrează nicăieri. Rămâne însă tot ce
        // spune CINE a intrat și când — asta era partea folositoare a listei.
        if (c) lista.push({
          nume: c.nume, creat: c.creat,
          prima_logare: c.prima_logare || null, ultima_logare: c.ultima_logare || null,
          id: b.key.slice("candidat/".length),
        });
      }
    } catch (err) {
      console.error("Listare candidați eșuată:", err);
    }
    lista.sort((a, b) => (a.nume || "").localeCompare(b.nume || "", "ro"));
    return json(lista);
  }

  // ——— Atenționările candidaților: cine NU și-a asumat Codul Etic / NU e abonat ———
  // Două obligații de la intrarea în Școală, urmărite nominal: asumarea versiunii
  // CURENTE a Codului Etic (actul pe care se sprijină procedura disciplinară) și
  // abonarea la Buletin — singurul canal prin care se ține legătura cu candidații.
  if (actiune === "atentionari") {
    // Cine a asumat versiunea curentă (cheia = insigna membrului).
    const asumati = new Set();
    try {
      const { blobs } = await store.list({ prefix: `cod-etic/${VERSIUNE_COD_ETIC}/` });
      for (const b of blobs) asumati.add(b.key.slice(`cod-etic/${VERSIUNE_COD_ETIC}/`.length));
    } catch (err) { console.error("Atenționări: asumările nu s-au putut citi:", err); }

    // Cine e abonat la buletin (abonările personale poartă insigna în membruId).
    const abonati = new Set();
    try {
      const { blobs } = await store.list({ prefix: "abonat/" });
      for (const b of blobs) {
        const a = await store.get(b.key, { type: "json" }).catch(() => null);
        if (a?.membruId) abonati.add(a.membruId);
      }
    } catch (err) { console.error("Atenționări: abonații nu s-au putut citi:", err); }

    const candidati = [];
    try {
      const { blobs } = await store.list({ prefix: "candidat/" });
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" }).catch(() => null);
        if (!c) continue;
        const id = b.key.slice("candidat/".length);
        candidati.push({ nume: c.nume, asumatCodEtic: asumati.has(id), abonatBuletin: abonati.has(id) });
      }
    } catch (err) { console.error("Atenționări: candidații nu s-au putut citi:", err); }
    candidati.sort((a, b) => (a.nume || "").localeCompare(b.nume || "", "ro"));
    return json({ versiuneCodEtic: VERSIUNE_COD_ETIC, candidati });
  }

  if (actiune === "progres") {
    // Toți candidații, fiecare cu progresul lui (candidat × module), într-un singur apel.
    const cand = {};
    try {
      const { blobs } = await store.list({ prefix: "candidat/" });
      for (const b of blobs) {
        const c = await store.get(b.key, { type: "json" });
        if (c) {
          const id = b.key.slice("candidat/".length);
          cand[id] = { id, nume: c.nume, creat: c.creat, progres: {} };
        }
      }
    } catch (err) {
      console.error("Listare candidați (progres) eșuată:", err);
    }
    try {
      const prefix = "progres/";
      const { blobs } = await store.list({ prefix });
      for (const b of blobs) {
        const rest = b.key.slice(prefix.length); // <id>/<modul>
        const slash = rest.indexOf("/");
        if (slash < 0) continue; // format vechi (progres/<id>) — ignorăm
        const id = rest.slice(0, slash);
        const modul = rest.slice(slash + 1);
        if (!cand[id]) continue;
        const r = await store.get(b.key, { type: "json" });
        if (r) cand[id].progres[modul] = r;
      }
    } catch (err) {
      console.error("Citire progres (toți) eșuată:", err);
    }
    const lista = Object.values(cand).sort((a, b) => (a.nume || "").localeCompare(b.nume || "", "ro"));
    return json(lista);
  }

  if (actiune === "adauga") {
    const nume = (body.nume || "").trim();
    if (nume.length < 3) return json({ eroare: "Scrie numele complet al candidatului." }, 400);

    // Generăm un cod unic (verificăm că nu există deja).
    let cod, id, exista = true, incercari = 0;
    while (exista && incercari < 12) {
      cod = codNou();
      id = sha256(cod);
      exista = !!(await store.get("candidat/" + id, { type: "json" }));
      incercari++;
    }
    if (exista) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);

    const creat = new Date().toISOString();
    // Fișa nu conține codul — cheia e amprenta lui, și atât. Codul pleacă o singură
    // dată, în răspunsul ăsta. Aceeași regulă ca la Registrul genealogic: altfel
    // amprenta n-ar apăra nimic, iar copiile de siguranță ar plimba chei de intrare.
    const candidat = { nume: nume.slice(0, 120), creat };
    await store.setJSON("candidat/" + id, candidat);
    return json({ ok: true, candidat: { ...candidat, cod, id } });
  }

  // ——— Mentorul stagiarului (Reg. Colegiului de Arbitri, Art. 14) ———
  // Fiecare stagiar are un mentor — un arbitru format care îl îndrumă pe parcursul
  // stagiului. Evidența stă aici, la registrul candidaților; candidatul își vede
  // mentorul pe parcursul lui, iar dosarul de certificare îl arată negru pe alb.
  if (actiune === "mentori") {
    const mentori = {};
    try {
      const { blobs } = await store.list({ prefix: "mentor/" });
      for (const b of blobs) {
        const m = await store.get(b.key, { type: "json" }).catch(() => null);
        if (m) mentori[b.key.slice("mentor/".length)] = { nume: String(m.nume || ""), din: String(m.din || "") };
      }
    } catch (err) { console.error("Listare mentori eșuată:", err); }
    return json({ mentori });
  }

  if (actiune === "mentor-salveaza") {
    const id = String(body.candidatId || "");
    if (!id) return json({ eroare: "Lipsește candidatul." }, 400);
    const exista = await store.get("candidat/" + id, { type: "json" }).catch(() => null);
    if (!exista) return json({ eroare: "Candidat inexistent." }, 404);
    const nume = String(body.nume || "").slice(0, 140).trim();
    if (!nume) {
      // Nume gol = scoaterea mentorului (de ex. la schimbarea îndrumătorului).
      try { await store.delete("mentor/" + id); } catch (err) { console.error(err); }
      return json({ ok: true, mentor: null });
    }
    const din = String(body.din || "").slice(0, 10).trim() || new Date().toISOString().slice(0, 10);
    await store.setJSON("mentor/" + id, { nume, din });
    return json({ ok: true, mentor: { nume, din } });
  }

  if (actiune === "sterge") {
    const id = String(body.id || "");
    if (!id) return json({ eroare: "Lipsește candidatul." }, 400);
    try { await store.delete("candidat/" + id); } catch (err) { console.error(err); }
    try { await store.delete("progres/" + id); } catch (err) { console.error(err); } // format vechi (obiect unic)
    try {
      const { blobs } = await store.list({ prefix: "progres/" + id + "/" });
      for (const b of blobs) { try { await store.delete(b.key); } catch (e) {} }
    } catch (err) { console.error(err); }
    // Dosarul lui din store-ul Școlii: examen, autorizare, asistențe, mentor, acte.
    for (const cheie of ["examen/" + id, "autorizare/" + id, "asistente/numire/" + id,
      "asistente/evaluare/" + id, "mentor/" + id, "act-scoala/" + id + "/diploma", "act-scoala/" + id + "/legitimatie"]) {
      try { await store.delete(cheie); } catch (err) { console.error(err); }
    }
    // …și marcajele reamintirilor de termene (chei per modul, sub prefixul candidatului).
    try {
      const { blobs } = await store.list({ prefix: "termen-amintit/" + id + "/" });
      for (const b of blobs) { try { await store.delete(b.key); } catch (e) {} }
    } catch (err) { console.error(err); }
    // …și urmele din CELELALTE module (analiză, anatomie, sesiuni, imagini, interese).
    // Fără asta, un candidat șters continua să apară în exerciții și în spațiile lectorilor.
    const raport = await stergeUrmeleCandidatului(id);
    return json({ ok: true, curatat: { sterse: raport.sterse.length, actualizate: raport.actualizate.length, esuate: raport.esuate.length } });
  }

  if (actiune === "curata-orfane") {
    // Curățare retroactivă: date rămase de la candidați șterși ÎNAINTE ca ștergerea
    // să curețe și celelalte module.
    const r = await curataOrfanii();
    return json({
      ok: true, oprit: r.oprit, candidatiVii: r.candidatiVii,
      orfani: r.orfani.length, sterse: r.sterse.length, actualizate: r.actualizate.length, esuate: r.esuate.length,
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
