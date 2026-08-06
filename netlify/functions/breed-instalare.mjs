// breed-instalare.mjs — coduri de INSTALARE pentru CFCR Breed Standards Explorer.
// Instalarea ca aplicație (PWA) cere DOUĂ chei: un cod generat de administrator (diferit
// de codul de acces în platformă) ȘI aprobarea administratorului, printr-un link primit
// pe e-mail. Codul singur nu mai instalează nimic — chiar dacă ar circula, instalarea nu
// se deblochează până când administratorul nu apasă linkul din e-mailul lui. Store „breed":
//   install-cod/<sha256(cod)>       -> { cod, eticheta, creat }
//   cerere-instalare/<id>           -> { token, codHash, creat, aprobat, expira, agent }
//
// POST { actiune:"cere-instalare", cod }           -> { pending:true, id } | 401   (app-ul)
// POST { actiune:"stare-instalare", id }           -> { aprobat:bool }               (app-ul, polling)
// GET  ?actiune=aproba&id=&token=                  -> pagină HTML (link din e-mail)
// POST { actiune:"verifica", cod }                 -> { ok:true } | 401   (re-verificare la pornire)
// POST { actiune:"lista", cod:ADMIN }              -> [ { cod, eticheta, creat, id } ]
// POST { actiune:"genereaza", cod:ADMIN, eticheta }-> { ok, cod:{ cod, eticheta, creat, id } }
// POST { actiune:"revoca", cod:ADMIN, id }         -> { ok }
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cuLimitareCod } from "./_comun/limitare.mjs";

import { esteAdmin } from "./_comun/roluri.mjs";   // sursă UNICĂ; nu copia amprenta aici
import { dispozitivCunoscut } from "./_comun/al-doilea-factor.mjs";
import { trimite, pagina, escapeHtml, ADRESA_ASOCIATIEI } from "./_comun/posta.mjs";
const ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // fără caractere ambigue

// Aprobarea de instalare pleacă la administrator, pe adresa lui. ALERTE_EMAIL (din mediu)
// are ultimul cuvânt, ca la restul alertelor; altfel, adresa asociației.
const EMAIL_APROBARE = ADRESA_ASOCIATIEI;
const CERERE_VALABILA_MS = 24 * 3600e3;   // o cerere de instalare neaprobată expiră în 24h

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex");
const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const html = (corp, status = 200) =>
  new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
    "<title>Aprobare instalare</title><body style='font-family:system-ui,Segoe UI,Arial;background:#f4f5f3;color:#1e2320;margin:0'>" +
    "<div style='max-width:34rem;margin:10vh auto;padding:2rem;text-align:center'>" + corp + "</div>",
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

function codNou() {
  let c = "BSE-";
  for (let i = 0; i < 5; i++) c += ALFABET[Math.floor(Math.random() * ALFABET.length)];
  return c;
}

export default cuLimitareCod(async (req) => {
  const store = getStore("breed");

  // —— Link de APROBARE din e-mail (GET, clic din inbox) ——
  // Administratorul apasă linkul primit pe e-mail. Fără el, cererea rămâne neaprobată,
  // iar aplicația nu se instalează, oricât de valid ar fi codul de instalare.
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.get("actiune") !== "aproba")
      return html("<p>Cerere necunoscută.</p>", 400);
    const id = taie(u.searchParams.get("id"), 64);
    const token = taie(u.searchParams.get("token"), 64);
    const rec = await store.get("cerere-instalare/" + id, { type: "json" }).catch(() => null);
    if (!rec || rec.token !== token)
      return html("<h2 style='color:#8a1d1d'>Link nevalid</h2><p>Cererea de instalare nu există sau linkul e greșit.</p>", 404);
    if (Date.parse(rec.expira) < Date.now())
      return html("<h2 style='color:#8a1d1d'>Link expirat</h2><p>Cererea a trecut de termen. Cere din nou instalarea din aplicație.</p>", 410);
    if (!rec.aprobat) {
      rec.aprobat = true;
      rec.aprobatLa = new Date().toISOString();
      await store.setJSON("cerere-instalare/" + id, rec);
    }
    return html(
      "<div style='width:56px;height:56px;border-radius:12px;background:#1F4D3A;color:#fff;display:inline-grid;place-items:center;font:700 1.4rem Georgia,serif'>BS</div>" +
      "<h2 style='color:#1F4D3A;margin:1rem 0 .3rem'>Instalare aprobată ✓</h2>" +
      "<p style='color:#444'>Ai aprobat instalarea CFCR Breed Standards Explorer pe dispozitivul care a cerut-o. " +
      "Persoana poate reveni în aplicație — instalarea se deblochează singură.</p>" +
      "<p style='color:#888;font-size:.85rem;margin-top:1.4rem'>Asociația Club Federal Chinologic – Royal · World Dog Federation</p>");
  }

  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 20) || "verifica";

  // —— Cererea de instalare: cod valid + trimite administratorului linkul de aprobare ——
  // Codul singur nu mai deblochează instalarea. Se creează o cerere în așteptare și
  // administratorul primește pe e-mail un link; instalarea se deblochează abia după clic.
  if (actiune === "cere-instalare") {
    const cod = taie(body.cod, 40);
    if (!cod) return json({ eroare: "Cod lipsă." }, 400);
    const codRec = await store.get("install-cod/" + sha256(cod), { type: "json" }).catch(() => null);
    if (!codRec) return json({ eroare: "Cod de instalare incorect." }, 401);

    const id = randomUUID();
    const token = randomBytes(24).toString("hex");
    const acum = new Date();
    const agent = taie(req.headers.get("user-agent"), 200);
    await store.setJSON("cerere-instalare/" + id, {
      token, codHash: sha256(cod), eticheta: codRec.eticheta || "",
      creat: acum.toISOString(), expira: new Date(acum.getTime() + CERERE_VALABILA_MS).toISOString(),
      aprobat: false, agent,
    });

    const origine = process.env.URL || new URL(req.url).origin;
    const link = origine + "/.netlify/functions/breed-instalare?actiune=aproba&id=" +
      encodeURIComponent(id) + "&token=" + encodeURIComponent(token);
    const trimis = await trimite({
      catre: EMAIL_APROBARE,
      subiect: "[CFC-Royal] Aprobă instalarea Breed Standards Explorer",
      html: pagina("Cerere de instalare", "#1F4D3A",
        `<p style="font-size:15px">Cineva a introdus un cod valid de instalare pentru ` +
        `<strong>CFCR Breed Standards Explorer</strong>` +
        (codRec.eticheta ? ` (cod: <strong>${escapeHtml(codRec.eticheta)}</strong>)` : "") + `.</p>` +
        `<p style="font-size:14px;color:#555">Dispozitiv: ${escapeHtml(agent || "necunoscut")}</p>` +
        `<p style="margin:22px 0"><a href="${link}" style="background:#1F4D3A;color:#fff;` +
        `padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">` +
        `Aprobă instalarea →</a></p>` +
        `<p style="font-size:13px;color:#888">Linkul e valabil 24 de ore. Dacă nu recunoști cererea, ` +
        `ignoră acest e-mail — fără aprobarea ta, aplicația nu se instalează.</p>`),
    });
    if (!trimis) return json({ eroare: "Nu am putut trimite e-mailul de aprobare. Reîncearcă." }, 503);
    return json({ pending: true, id });
  }

  // —— Starea unei cereri de instalare (aplicația întreabă până la aprobare) ——
  if (actiune === "stare-instalare") {
    const id = taie(body.id, 64);
    const rec = await store.get("cerere-instalare/" + id, { type: "json" }).catch(() => null);
    if (!rec) return json({ eroare: "Cerere inexistentă." }, 404);
    if (Date.parse(rec.expira) < Date.now()) return json({ expirat: true });
    return json({ aprobat: !!rec.aprobat });
  }

  // —— Re-verificarea codului la pornire (revocarea are efect) ——
  if (actiune === "verifica") {
    const cod = taie(body.cod, 40);
    if (!cod) return json({ eroare: "Cod lipsă." }, 400);
    const rec = await store.get("install-cod/" + sha256(cod), { type: "json" }).catch(() => null);
    if (!rec) return json({ eroare: "Cod de instalare incorect." }, 401);
    return json({ ok: true });
  }

  // —— Restul: doar administrator ——
  if (!esteAdmin(body.cod)) return json({ eroare: "Cod de administrator incorect." }, 401);
  // A doua cheie: codul singur nu mai deschide administrarea Școlii.
  // Jetoanele de dispozitiv stau în magazia PLATFORMEI („cursuri"), nu în magazia
  // acestei funcții. Un jeton născut la intrare într-un loc și căutat în altul nu se
  // găsește niciodată: funcția ar răspunde 403 la fiecare cerere, iar panoul l-ar da
  // pe administrator afară. Exact asta s-a întâmplat.
  if (!(await dispozitivCunoscut(getStore("cursuri"), String(body.dispozitiv || "").trim(), "admin")))
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în platformă, cu codul primit pe e-mail." }, 403);

  if (actiune === "lista") {
    const lista = [];
    try {
      const { blobs } = await store.list({ prefix: "install-cod/" });
      for (const b of blobs) {
        const r = await store.get(b.key, { type: "json" });
        if (r) lista.push({ cod: r.cod, eticheta: r.eticheta || "", creat: r.creat, id: b.key.slice("install-cod/".length) });
      }
    } catch (err) { console.error("Listare coduri instalare eșuată:", err); }
    lista.sort((a, b) => String(b.creat || "").localeCompare(String(a.creat || "")));
    return json(lista);
  }

  if (actiune === "genereaza") {
    let cod, id, exista = true, i = 0;
    while (exista && i < 12) { cod = codNou(); id = sha256(cod); exista = !!(await store.get("install-cod/" + id, { type: "json" })); i++; }
    if (exista) return json({ eroare: "Nu am putut genera un cod unic. Reîncearcă." }, 500);
    const rec = { cod, eticheta: taie(body.eticheta, 120), creat: new Date().toISOString() };
    await store.setJSON("install-cod/" + id, rec);
    return json({ ok: true, cod: { ...rec, id } });
  }

  if (actiune === "revoca") {
    const id = taie(body.id, 80);
    if (!id) return json({ eroare: "Lipsește codul." }, 400);
    try { await store.delete("install-cod/" + id); } catch (err) { console.error(err); }
    return json({ ok: true });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
