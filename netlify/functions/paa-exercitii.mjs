// paa-exercitii.mjs — exerciții de anatomie (Photo Anatomy Annotator).
// Lectorul (spațiu COMUN) încarcă o fotografie de referință, o alocă unor candidați;
// candidații o adnotează și o trimit; lectorul verifică cu feedback + calificativ.
// Store „paa": exercitiu/<id>, exercitiu-index, ex-participanti/<id>, ex-raspuns/<id>/<cid>,
//              image/<id> (binar), image-meta/<id>.
import { json, taie, acum, idNou, cereLector, candidatDinId, actorDinCod, poateAdministra, store, storeCursuri, audit } from "./_paa/lib.mjs";
import { marcheazaUrma, numeActor } from "./_comun/urma.mjs";

const CALIFICATIVE = ["Excelent", "Foarte bine", "Bine", "Suficient", "Insuficient"];
const STATUS = ["draft", "published", "closed", "archived"];
const TIPURI = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 };
const MAX = 6 * 1024 * 1024;

function parseDataUrl(u) { var m = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(u || "")); return m ? { ct: m[1], buf: Buffer.from(m[2], "base64") } : null; }

async function idx() { try { return (await store().get("exercitiu-index", { type: "json" })) || []; } catch { return []; } }
async function scrieIdx(e) {
  const l = await idx();
  const r = { id: e.id, titlu: e.titlu, rasa: e.rasa || "", status: e.status, lectorSlug: e.lectorSlug || "", lectorNume: e.lectorNume || "", termen: e.termen || "", creat: e.creat, actualizat: e.actualizat || acum(), actualizatDe: e.actualizatDe || "", ultimaActiune: e.ultimaActiune || "" };
  const i = l.findIndex((x) => x.id === e.id); if (i >= 0) l[i] = r; else l.push(r);
  await store().setJSON("exercitiu-index", l);
}
async function participanti(id) { try { return (await store().get("ex-participanti/" + id, { type: "json" })) || { candidateIds: [], toti: false }; } catch { return { candidateIds: [], toti: false }; } }
function esteParticipant(p, cid) { return !!p && (p.toti === true || (Array.isArray(p.candidateIds) && p.candidateIds.indexOf(cid) >= 0)); }

function curata(inp, baza, lector) {
  const e = baza || {};
  return {
    id: e.id, titlu: taie(inp.titlu ?? e.titlu, 160) || "Exercițiu de anatomie",
    descriere: taie(inp.descriere ?? e.descriere, 3000), rasa: taie(inp.rasa ?? e.rasa, 120),
    stdVersiune: taie(inp.stdVersiune ?? e.stdVersiune, 40), termen: taie(inp.termen ?? e.termen, 40),
    imageId: taie(inp.imageId ?? e.imageId, 60), aspect: Number.isFinite(+inp.aspect) ? +inp.aspect : (e.aspect || 1),
    status: e.status || "draft",
    lectorSlug: e.lectorSlug || (lector && lector.slug) || "", lectorNume: e.lectorNume || (lector && lector.nume) || "Administrator",
    creat: e.creat || acum(), actualizat: acum(),
  };
}
function ptCursant(e) { return { id: e.id, titlu: e.titlu, descriere: e.descriere, rasa: e.rasa, stdVersiune: e.stdVersiune, imageId: e.imageId, aspect: e.aspect, termen: e.termen, status: e.status }; }

export default async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body; try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }
  const actiune = taie(body.actiune, 30) || "lista";
  const st = store();

  // ————— CANDIDAT —————
  if (["alocate", "detalii-cursant", "imagine", "raspuns-schita", "raspuns-trimite", "raspuns-al-meu"].indexOf(actiune) >= 0 && body.cid) {
    const cand = await candidatDinId(body.cid);
    if (!cand) return json({ eroare: "Sesiune de candidat invalidă." }, 401);

    if (actiune === "alocate") {
      const out = [];
      for (const r of await idx()) {
        if (["published", "closed"].indexOf(r.status) < 0) continue;
        const p = await participanti(r.id); if (!esteParticipant(p, cand.id)) continue;
        const resp = await st.get("ex-raspuns/" + r.id + "/" + cand.id, { type: "json" }).catch(() => null);
        out.push({ id: r.id, titlu: r.titlu, rasa: r.rasa, termen: r.termen, status: r.status, raspunsStatus: resp ? resp.status : "neinceput", calificativ: resp ? resp.calificativ || null : null });
      }
      out.sort((a, b) => String(b.termen || "").localeCompare(String(a.termen || "")));
      return json({ nume: cand.nume, exercitii: out });
    }

    const id = taie(body.id, 40);
    const e = await st.get("exercitiu/" + id, { type: "json" }).catch(() => null);
    if (!e) return json({ eroare: "Exercițiu inexistent." }, 404);
    const p = await participanti(id);
    if (!esteParticipant(p, cand.id)) return json({ eroare: "Nu ești alocat acestui exercițiu." }, 403);

    if (actiune === "imagine") {
      const meta = await st.get("image-meta/" + e.imageId, { type: "json" }).catch(() => null);
      if (!meta) return json({ eroare: "Imagine inexistentă." }, 404);
      const bytes = await st.get("image/" + e.imageId, { type: "arrayBuffer" }).catch(() => null);
      if (!bytes) return json({ eroare: "Imagine inexistentă." }, 404);
      return new Response(bytes, { status: 200, headers: { "Content-Type": meta.contentType || "application/octet-stream", "Cache-Control": "private, no-store" } });
    }

    const key = "ex-raspuns/" + id + "/" + cand.id;
    if (actiune === "raspuns-al-meu") { const r = await st.get(key, { type: "json" }).catch(() => null); return json({ raspuns: r || null, exercitiu: ptCursant(e) }); }
    if (actiune === "detalii-cursant") { const r = await st.get(key, { type: "json" }).catch(() => null); return json({ exercitiu: ptCursant(e), raspuns: r || null }); }
    if (actiune === "raspuns-schita" || actiune === "raspuns-trimite") {
      if (e.status !== "published") return json({ eroare: "Exercițiul nu mai primește răspunsuri." }, 403);
      const ex = await st.get(key, { type: "json" }).catch(() => null);
      if (ex && ex.status === "submitted" && actiune === "raspuns-schita") return json({ eroare: "Rezolvarea a fost deja trimisă." }, 409);
      const s = ex || { creat: acum() };
      s.annotations = Array.isArray(body.annotations) ? body.annotations.slice(0, 2000) : (s.annotations || []);
      s.measurements = body.measurements && typeof body.measurements === "object" ? body.measurements : (s.measurements || {});
      s.calibrare = body.calibrare && typeof body.calibrare === "object" ? body.calibrare : (s.calibrare || { mod: "relativ" });
      s.status = actiune === "raspuns-trimite" ? "submitted" : "draft";
      if (actiune === "raspuns-trimite") s.trimisLa = acum();
      s.actualizat = acum();
      await st.setJSON(key, s);
      return json({ ok: true, raspuns: s });
    }
    return json({ eroare: "Acțiune necunoscută." }, 400);
  }

  // ————— LECTOR / ADMIN —————
  let actor; try { actor = cereLector(body.cod); } catch (e) { return json({ eroare: e.eroare }, e.status); }

  if (actiune === "lista") { const l = await idx(); l.sort((a, b) => String(b.actualizat || b.creat).localeCompare(String(a.actualizat || a.creat))); return json({ exercitii: l }); }
  if (actiune === "candidati") {
    const out = []; try { const { blobs } = await storeCursuri().list({ prefix: "candidat/" }); for (const b of blobs) { const c = await storeCursuri().get(b.key, { type: "json" }); if (c) out.push({ id: b.key.slice("candidat/".length), nume: c.nume }); } } catch (err) { console.error(err); }
    out.sort((a, b) => (a.nume || "").localeCompare(b.nume || "", "ro")); return json({ candidati: out });
  }
  if (actiune === "creaza") {
    const id = idNou("ex-"); const e = curata(body.exercitiu || body, { id, status: "draft", creat: acum() }, actor);
    marcheazaUrma(e, actor, "creare");
    await st.setJSON("exercitiu/" + id, e); await scrieIdx(e); await audit("exercitiu-creat", actor, id);
    return json({ ok: true, exercitiu: e });
  }

  const id = taie(body.id, 40); if (!id) return json({ eroare: "Lipsește exercițiul." }, 400);
  const e = await st.get("exercitiu/" + id, { type: "json" }).catch(() => null);
  if (!e) return json({ eroare: "Exercițiu inexistent." }, 404);
  if (!poateAdministra(actor)) return json({ eroare: "Fără drept." }, 403);

  if (actiune === "detalii") { const p = await participanti(id); return json({ exercitiu: e, participanti: p }); }
  if (actiune === "salveaza") { const u = curata(body.exercitiu || body, e, actor); marcheazaUrma(u, actor, "modificare"); await st.setJSON("exercitiu/" + id, u); await scrieIdx(u); await audit("exercitiu-salvat", actor, id); return json({ ok: true, exercitiu: u }); }

  if (actiune === "imagine-upload") {
    if (e.status !== "draft") return json({ eroare: "Schimbă imaginea doar cât exercițiul e în lucru (schiță)." }, 409);
    const pu = parseDataUrl(body.dataUrl); if (!pu || !TIPURI[pu.ct]) return json({ eroare: "Format acceptat: JPEG, PNG, WebP." }, 400);
    if (pu.buf.length > MAX) return json({ eroare: "Imaginea depășește 6 MB." }, 413);
    const imgId = idNou("img-");
    await st.set("image/" + imgId, pu.buf, { metadata: { contentType: pu.ct } });
    await st.setJSON("image-meta/" + imgId, { owner: "lector:" + (actor.slug || "admin"), exId: id, contentType: pu.ct, w: parseInt(body.w, 10) || 0, h: parseInt(body.h, 10) || 0, creat: acum() });
    e.imageId = imgId; e.aspect = Number.isFinite(+body.aspect) ? +body.aspect : e.aspect; e.actualizat = acum();
    marcheazaUrma(e, actor, "schimbare fotografie");
    await st.setJSON("exercitiu/" + id, e); await scrieIdx(e); await audit("exercitiu-imagine", actor, id);
    return json({ ok: true, imageId: imgId });
  }
  if (actiune === "imagine") {
    const meta = await st.get("image-meta/" + e.imageId, { type: "json" }).catch(() => null);
    if (!meta) return json({ eroare: "Imagine inexistentă." }, 404);
    const bytes = await st.get("image/" + e.imageId, { type: "arrayBuffer" }).catch(() => null);
    if (!bytes) return json({ eroare: "Imagine inexistentă." }, 404);
    return new Response(bytes, { status: 200, headers: { "Content-Type": meta.contentType || "application/octet-stream", "Cache-Control": "private, no-store" } });
  }
  if (actiune === "participanti") {
    const toti = body.toti === true;
    const ids = Array.isArray(body.candidateIds) ? [...new Set(body.candidateIds.map((x) => taie(x, 80)).filter(Boolean))].slice(0, 500) : [];
    await st.setJSON("ex-participanti/" + id, { candidateIds: ids, toti: toti, actualizat: acum() });
    await audit("exercitiu-participanti", actor, (toti ? "toți" : ids.length + " candidați"));
    return json({ ok: true, participanti: { candidateIds: ids, toti: toti } });
  }
  if (["publica", "inchide", "arhiveaza"].indexOf(actiune) >= 0) {
    const tinta = actiune === "publica" ? "published" : actiune === "inchide" ? "closed" : "archived";
    if (actiune === "publica") {
      if (!e.imageId) return json({ eroare: "Încarcă fotografia de referință înainte de publicare." }, 400);
      const p = await participanti(id); if (!p.toti && !(p.candidateIds || []).length) return json({ eroare: "Alocă cel puțin un candidat (sau „toți”)." }, 400);
    }
    e.status = tinta; e.actualizat = acum(); marcheazaUrma(e, actor, actiune); await st.setJSON("exercitiu/" + id, e); await scrieIdx(e); await audit(actiune + "-exercitiu", actor, tinta);
    return json({ ok: true, status: tinta });
  }
  if (actiune === "raspunsuri") {
    const p = await participanti(id); const nume = {};
    try { for (const cid of p.candidateIds || []) { const c = await storeCursuri().get("candidat/" + cid, { type: "json" }).catch(() => null); if (c) nume[cid] = c.nume; } } catch (err) {}
    const out = [];
    try { const { blobs } = await st.list({ prefix: "ex-raspuns/" + id + "/" }); for (const b of blobs) { const r = await st.get(b.key, { type: "json" }); if (r) { const cidr = b.key.slice(("ex-raspuns/" + id + "/").length); if (!nume[cidr]) { const c = await storeCursuri().get("candidat/" + cidr, { type: "json" }).catch(() => null); if (c) nume[cidr] = c.nume; } out.push({ ...r, candidatId: cidr, candidatNume: nume[cidr] || "—" }); } } } catch (err) { console.error(err); }
    return json({ raspunsuri: out });
  }
  if (actiune === "verifica") {
    const cidr = taie(body.candidatId, 80); const key = "ex-raspuns/" + id + "/" + cidr;
    const r = await st.get(key, { type: "json" }).catch(() => null); if (!r) return json({ eroare: "Răspuns inexistent." }, 404);
    const cal = CALIFICATIVE.indexOf(taie(body.calificativ, 20)) >= 0 ? taie(body.calificativ, 20) : "";
    r.calificativ = cal; r.feedback = taie(body.feedback, 4000); r.verificatLa = acum(); r.verificatDe = numeActor(actor);
    await st.setJSON(key, r); await audit("exercitiu-verificat", actor, id + "/" + cidr);
    return json({ ok: true, raspuns: r });
  }
  return json({ eroare: "Acțiune necunoscută." }, 400);
};
