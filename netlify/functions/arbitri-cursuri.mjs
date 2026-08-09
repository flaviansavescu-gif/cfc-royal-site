// arbitri-cursuri.mjs — registrul ARBITRILOR care nu sunt lectori.
//
// Arbitrii autorizați primesc acces de STUDIU în platformă: manualul, conținutul
// modulelor (fără teste), biblioteca lectorilor și aplicațiile. Nu sunt candidați
// (nu au progres, teste sau examen), așa că stau în registrul lor, pe alt prefix.
//
// Totul necesită codul de administrator. Fiecare arbitru pe cheia lui:
//   arbitru/<sha256(cod)> -> { nume, cod, creat }
//
// POST { cod, actiune:"lista" }        -> [ { nume, cod, id, creat, prima_logare, ultima_logare } ]
// POST { cod, actiune:"adauga", nume } -> { ok, arbitru:{ nume, cod, id, creat } }
// POST { cod, actiune:"sterge", id }   -> { ok }
import { getStore } from "@netlify/blobs";
import { createHash, randomInt } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
// Alfabet fără caractere ambigue (0/O, 1/I/L) — codurile se dictează ușor la telefon.
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

// „COL-" = Colegiul de Arbitri; prefix diferit de al candidaților („ARB-"), ca să se
// vadă dintr-o privire ce fel de cod ține cineva în mână.
function codNou() {
  let c = "COL-";
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
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403);

  const store = getStore("cursuri");
  const actiune = body.actiune || "lista";

  if (actiune === "lista") {
    const lista = [];
    try {
      const { blobs } = await store.list({ prefix: "arbitru/" });
      for (const b of blobs) {
        const a = await store.get(b.key, { type: "json" });
        // Codul NU se mai întoarce (nu se mai păstrează), dar rămâne tot ce spune CINE
        // a intrat și când.
        if (a) lista.push({
          nume: a.nume, creat: a.creat,
          prima_logare: a.prima_logare || null, ultima_logare: a.ultima_logare || null,
          id: b.key.slice("arbitru/".length),
        });
      }
    } catch (err) {
      console.error("Listare arbitri eșuată:", err);
    }
    lista.sort((a, b) => (a.nume || "").localeCompare(b.nume || "", "ro"));
    return json(lista);
  }

  if (actiune === "adauga") {
    const nume = (body.nume || "").trim();
    if (nume.length < 3) return json({ eroare: "Scrie numele complet al arbitrului." }, 400);

    let cod, id, exista = true, incercari = 0;
    while (exista && incercari < 12) {
      cod = codNou();
      id = sha256(cod);
      exista = !!(await store.get("arbitru/" + id, { type: "json" }));
      incercari++;
    }
    if (exista) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);

    const creat = new Date().toISOString();
    // Fără cod în fișă — aceeași regulă ca la Registrul genealogic.
    const arbitru = { nume: nume.slice(0, 120), creat };
    await store.setJSON("arbitru/" + id, arbitru);
    return json({ ok: true, arbitru: { ...arbitru, cod, id } });
  }

  if (actiune === "sterge") {
    const id = String(body.id || "");
    if (!id) return json({ eroare: "Lipsește arbitrul." }, 400);
    try { await store.delete("arbitru/" + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
