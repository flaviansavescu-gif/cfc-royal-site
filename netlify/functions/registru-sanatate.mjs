// registru-sanatate.mjs — dosarul de sănătate al câinilor de reproducție (Faza 1).
//
// DE CE. Un pedigree serios nu doar CONSEMNEAZĂ o descendență, ci GARANTEAZĂ ceva despre
// câine. Faza 1 adaugă un strat informativ: crescătorul depune rezultate de sănătate (HD,
// ED, ochi, ADN, teste genetice) cu certificatul scanat; registratura le verifică; abia
// ce e verificat ajunge public pe fișa câinelui. FĂRĂ porți la DMF/pedigree (Faza 2) și
// fără comparare de markeri ADN (Faza 3) — deocamdată doar înregistrare + afișare.
//
// Chei (magazia „registru", citire tare):
//   sanatate/<microcip>                 -> { microcip, teste:[...], actualizat }
//   sanatate-fisier/<microcip>/<testId> -> scanul certificatului (binar)
//   sanatate-neverif/<microcip>__<id>   -> index pentru coada registraturii
//
// POST { cod, actiune:"depune", microcip, tip, rezultat, data, emitent, subtip?, continut?, tipFisier? }
//                                                   -> { ok, testId }          (membru)
// POST {      actiune:"dosar", microcip, cod? }     -> { teste, insigne }      (public = doar verificate)
// POST { cod, dispozitiv, actiune:"de-verificat" }  -> { cereri:[...] }        (registratură/admin)
// POST { cod, dispozitiv, actiune:"verifica"|"respinge", microcip, testId, motiv? }
//                                                   -> { ok }                  (registratură/admin)
// POST { cod, dispozitiv, actiune:"vezi-fisier", microcip, testId }
//                                                   -> binar                   (registratură/admin/depunător)
import { getStore } from "@netlify/blobs";
import { actorDinCod } from "./_comun/roluri.mjs";
import { cuLimitareCod } from "./_comun/limitare.mjs";
import { membruDinCod, registratorDinCod } from "./registru-acces.mjs";
import { dispozitivCunoscut, ROLURI_PROTEJATE } from "./_comun/al-doilea-factor.mjs";
import { jurnalizeazaObligatoriu, actorJurnal, ipCerere } from "./_comun/registru-jurnal.mjs";
import { valideaza, tipValid, numeTest, insignaTest, recomandareDin } from "./_comun/teste-sanatate.mjs";

const store = () => getStore({ name: "registru", consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const taie = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const eData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const normCip = (v) => String(v || "").replace(/[\s-]/g, "");
const cipValid = (c) => /^\d{10}$|^\d{15}$/.test(c);
const idNou = () => Date.now() + "-" + Math.random().toString(36).slice(2, 8);

const MAX_FISIER = 6 * 1024 * 1024;   // ~6 MB base64 per certificat (un scan / PDF de 1–2 pagini)
const TIPURI_FISIER = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const cheiaDosar = (cip) => "sanatate/" + cip;
const cheiaFisier = (cip, id) => "sanatate-fisier/" + cip + "/" + id;
const cheiaCoada = (cip, id) => "sanatate-neverif/" + cip + "__" + id;

async function cine(cod) {
  if (actorDinCod(cod)?.rol === "admin") return { rol: "admin" };
  const m = await membruDinCod(cod);
  if (m) return { rol: "membru", membru: m };
  const r = await registratorDinCod(cod);
  if (r) return { rol: "registratura", registrator: r };
  return null;
}

/** Doar testele verificate, cu insigna publică. */
function publiceDin(dosar) {
  const teste = (dosar?.teste || []).filter((t) => t.stare === "verificat");
  return teste.map((t) => ({
    tip: t.tip, nume: numeTest(t.tip), subtip: t.subtip || null, rezultat: t.rezultat,
    data: t.data || null, emitent: t.emitent || null, insigna: insignaTest(t.tip, t.rezultat),
  }));
}

/**
 * Modifică dosarul de sănătate al unui câine în siguranță față de scrieri concurente.
 *
 * Dosarul e un singur blob cu un tablou de teste. Fără grijă, două operații simultane pe
 * același câine (o depunere și o verificare, ori două depuneri) citesc aceeași copie și se
 * suprascriu — una se pierde. Aici scriem CONDIȚIONAT (`onlyIfMatch` pe eticheta citită):
 * dacă altcineva a scris între timp, scrierea nu trece, recitim dosarul proaspăt și reaplicăm.
 * `muta(dosar)` primește dosarul proaspăt și întoarce `{ dosar }` (scrie) sau `{ eroare }`
 * (oprește — ex. „deja hotărât"). La un câine nou, prima scriere folosește `onlyIfNew`.
 */
async function cuDosar(s, cip, muta, incercari = 5) {
  for (let i = 0; i < incercari; i++) {
    const cur = await s.getWithMetadata(cheiaDosar(cip), { type: "json" }).catch(() => null);
    const baza = cur?.data || { microcip: cip, teste: [] };
    const rez = muta(baza);
    if (rez?.eroare) return rez;
    const optiuni = cur?.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true };
    const scris = await s.setJSON(cheiaDosar(cip), rez.dosar, optiuni).catch(() => ({ modified: false }));
    if (scris?.modified !== false) return { ok: true };
  }
  return { eroare: "Prea multe scrieri deodată pe acest dosar. Reîncearcă." };
}

export default cuLimitareCod(async (req) => {
  if (req.method !== "POST") return json({ eroare: "Metodă nepermisă." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ eroare: "Cerere invalidă." }, 400); }

  const actiune = taie(body.actiune, 24);
  const s = store();

  // —— Fișa publică: doar testele verificate ale unui câine (fără cod). ——
  // Se rezolvă rolul din cod (dacă e trimis): membru/registratură/admin văd TOT dosarul;
  // publicul (fără cod valid) vede doar ce e verificat.
  if (actiune === "dosar") {
    const cip = normCip(body.microcip);
    if (!cipValid(cip)) return json({ eroare: "Microcip invalid." }, 400);
    const dosar = await s.get(cheiaDosar(cip), { type: "json" }).catch(() => null);
    // Recomandarea de calitate se calculează DOAR din testele verificate.
    const verificate = (dosar?.teste || []).filter((t) => t.stare === "verificat");
    const recomandare = recomandareDin(verificate);
    const insigne = publiceDin(dosar).map((x) => x.insigna);
    const eu = await cine(taie(body.cod, 60));

    // Forma completă (cu stare/motiv/fișier) — doar pentru cine are dreptul s-o vadă.
    const complet = (t) => ({
      id: t.id, tip: t.tip, nume: numeTest(t.tip), subtip: t.subtip || null, rezultat: t.rezultat,
      data: t.data || null, emitent: t.emitent || null, stare: t.stare, motiv: t.motiv || null,
      areFisier: !!t.areFisier, insigna: insignaTest(t.tip, t.rezultat), depusLa: t.depusLa || null,
    });
    // Forma publică — ce vede oricine: doar rezultatul verificat, fără stare/motiv.
    const pubForma = (t) => ({
      tip: t.tip, nume: numeTest(t.tip), subtip: t.subtip || null, rezultat: t.rezultat,
      data: t.data || null, emitent: t.emitent || null, insigna: insignaTest(t.tip, t.rezultat),
    });

    // Registratura/admin văd tot dosarul.
    if (eu && (eu.rol === "registratura" || eu.rol === "admin")) {
      return json({ microcip: cip, teste: (dosar?.teste || []).map(complet), insigne, recomandare });
    }
    // Un membru vede testele VERIFICATE (publice oricum) + PROPRIILE depuneri, orice stare.
    // NU vede testele în așteptare/respinse ale altcuiva, nici motivul lor de respingere.
    if (eu && eu.rol === "membru") {
      const teste = (dosar?.teste || [])
        .filter((t) => t.stare === "verificat" || t.depusDe === eu.membru.id)
        .map((t) => (t.depusDe === eu.membru.id ? complet(t) : pubForma(t)));
      return json({ microcip: cip, teste, insigne, recomandare });
    }
    // Publicul: doar testele verificate.
    const pub = publiceDin(dosar);
    return json({ microcip: cip, teste: pub, insigne, recomandare });
  }

  // —— Toate celelalte acțiuni cer cod. ——
  const eu = await cine(taie(body.cod, 60));
  if (!eu) return json({ eroare: "Cod incorect." }, 401);

  // A doua cheie pentru rolurile grele (registratură/admin), ca la dosare și canise.
  if (ROLURI_PROTEJATE.includes(eu.rol) &&
      !(await dispozitivCunoscut(s, taie(body.dispozitiv, 80), eu.rol))) {
    return json({ eroare: "Dispozitiv nerecunoscut. Intră din nou în registru, cu codul primit pe e-mail." }, 403);
  }

  // —— Membrul depune un rezultat (cu scanul certificatului, opțional). ——
  if (actiune === "depune") {
    if (eu.rol !== "membru") return json({ eroare: "Doar membrii depun rezultate de sănătate." }, 403);
    const cip = normCip(body.microcip);
    if (!cipValid(cip)) return json({ eroare: "Microcip invalid (10 sau 15 cifre)." }, 400);
    const tip = taie(body.tip, 20);
    if (!tipValid(tip)) return json({ eroare: "Tip de test necunoscut." }, 400);
    const v = valideaza(tip, body.rezultat);
    if (v.eroare) return json({ eroare: v.eroare }, 400);
    const data = taie(body.data, 10);
    if (data && !eData(data)) return json({ eroare: "Data testului e invalidă (AAAA-LL-ZZ)." }, 400);
    const emitent = taie(body.emitent, 160);
    if (emitent.length < 3) return json({ eroare: "Scrie cine a emis rezultatul (medic / laborator)." }, 400);
    const subtip = tip === "genetic" ? taie(body.subtip, 120) : "";
    if (tip === "genetic" && subtip.length < 2) return json({ eroare: "La testul genetic, scrie ce test e (subtip)." }, 400);

    // Certificatul scanat e OBLIGATORIU: registratura verifică DOCUMENTUL, nu doar rezultatul
    // scris de mână. Fără el nu e nimic de verificat, deci rezultatul nu poate ajunge public.
    if (!body.continut)
      return json({ eroare: "Atașează certificatul scanat (JPEG, PNG sau PDF) — registratura verifică documentul înainte de publicare." }, 400);
    const tipFisier = taie(body.tipFisier, 60);
    if (!TIPURI_FISIER.includes(tipFisier)) return json({ eroare: "Acceptăm doar JPEG, PNG, WEBP sau PDF." }, 400);
    if (String(body.continut).length > MAX_FISIER)
      return json({ eroare: "Certificatul e prea mare (max. ~4 MB). Redu dimensiunea sau trimite un JPEG." }, 400);
    let fisier;
    try { fisier = Buffer.from(String(body.continut), "base64"); }
    catch { return json({ eroare: "Certificat ilizibil." }, 400); }
    if (!fisier.length) return json({ eroare: "Certificat gol." }, 400);

    const testId = idNou();
    const acum = new Date().toISOString();

    // Urma înaintea faptei: jurnalul obligatoriu ÎNAINTE de scriere.
    await jurnalizeazaObligatoriu(s, {
      fapta: "sanatate-depus",
      actor: actorJurnal(eu),
      obiect: cip,
      detalii: `${numeTest(tip)}${subtip ? " (" + subtip + ")" : ""}: ${v.rezultat}`,
      ip: ipCerere(req),
    });

    await s.set(cheiaFisier(cip, testId), fisier, { metadata: { contentType: tipFisier } });

    const nou = {
      id: testId, tip, subtip: subtip || undefined, rezultat: v.rezultat, data: data || null,
      emitent, areFisier: true, stare: "in-asteptare",
      depusDe: eu.membru.id, depusDeNume: eu.membru.nume || "", depusLa: acum,
    };
    // Scriere concurent-sigură: dacă altcineva atinge dosarul între timp, recitim și reaplicăm.
    // Idempotentă la reîncercare — nu adăugăm testul de două ori (îl căutăm după id).
    const rezScriere = await cuDosar(s, cip, (dosar) => {
      if (!dosar.teste.some((x) => x.id === testId)) dosar.teste.push(nou);
      dosar.actualizat = acum;
      return { dosar };
    });
    if (rezScriere.eroare) return json({ eroare: rezScriere.eroare }, 409);
    // Index pentru coada registraturii (fără a scana tot).
    await s.setJSON(cheiaCoada(cip, testId), {
      microcip: cip, testId, tip, rezultat: v.rezultat, subtip: subtip || null,
      emitent, depusDeNume: eu.membru.nume || "", depusLa: acum,
    }).catch(() => {});

    return json({ ok: true, testId });
  }

  // —— Registratura: coada rezultatelor de verificat. ——
  if (actiune === "de-verificat") {
    if (eu.rol !== "registratura" && eu.rol !== "admin")
      return json({ eroare: "Doar registratura verifică rezultatele." }, 403);
    const cereri = [];
    try {
      const { blobs } = await s.list({ prefix: "sanatate-neverif/" });
      for (const b of blobs) {
        const x = await s.get(b.key, { type: "json" }).catch(() => null);
        if (x) cereri.push({ ...x, nume: numeTest(x.tip) });
      }
    } catch (err) { console.error("Listare coadă sănătate eșuată:", err); }
    cereri.sort((a, b) => String(a.depusLa || "").localeCompare(String(b.depusLa || "")));
    return json({ cereri });
  }

  // —— Registratura: verifică sau respinge un rezultat. ——
  if (actiune === "verifica" || actiune === "respinge") {
    if (eu.rol !== "registratura" && eu.rol !== "admin")
      return json({ eroare: "Doar registratura hotărăște." }, 403);
    const cip = normCip(body.microcip);
    const testId = taie(body.testId, 40);
    if (!cipValid(cip) || !testId) return json({ eroare: "Lipsește câinele sau testul." }, 400);
    const dosar = await s.get(cheiaDosar(cip), { type: "json" }).catch(() => null);
    const t = dosar?.teste?.find((x) => x.id === testId);
    if (!t) return json({ eroare: "Rezultat inexistent." }, 404);
    if (t.stare !== "in-asteptare") return json({ eroare: "Rezultatul a fost deja hotărât." }, 409);

    const acum = new Date().toISOString();
    let motiv = "";
    if (actiune === "respinge") {
      motiv = taie(body.motiv, 500);
      if (motiv.length < 5) return json({ eroare: "Scrie motivul respingerii." }, 400);
      await jurnalizeazaObligatoriu(s, {
        fapta: "sanatate-respins", actor: actorJurnal(eu), obiect: cip,
        detalii: `${numeTest(t.tip)}: ${t.rezultat} — motiv: ${motiv}`, ip: ipCerere(req),
      });
    } else {
      await jurnalizeazaObligatoriu(s, {
        fapta: "sanatate-verificat", actor: actorJurnal(eu), obiect: cip,
        detalii: `${numeTest(t.tip)}: ${t.rezultat}`, ip: ipCerere(req),
      });
    }
    // Scriere concurent-sigură: recitim dosarul proaspăt, ca o depunere venită între timp
    // pe același câine să nu se piardă. Reaplicăm hotărârea pe testul găsit din nou.
    const rezScriere = await cuDosar(s, cip, (dosar) => {
      const tt = dosar.teste.find((x) => x.id === testId);
      if (!tt) return { eroare: "Rezultat inexistent." };
      if (tt.stare !== "in-asteptare") return { eroare: "Rezultatul a fost deja hotărât." };
      if (actiune === "respinge") { tt.stare = "respins"; tt.motiv = motiv; }
      else { tt.stare = "verificat"; }
      tt.verificatDe = actorJurnal(eu);
      tt.verificatLa = acum;
      dosar.actualizat = acum;
      return { dosar };
    });
    if (rezScriere.eroare) return json({ eroare: rezScriere.eroare }, rezScriere.eroare.includes("inexistent") ? 404 : 409);
    await s.delete(cheiaCoada(cip, testId)).catch(() => {});
    return json({ ok: true });
  }

  // —— Scanul certificatului (registratură/admin, sau membrul care l-a depus). ——
  if (actiune === "vezi-fisier") {
    const cip = normCip(body.microcip);
    const testId = taie(body.testId, 40);
    if (!cipValid(cip) || !testId) return json({ eroare: "Lipsește câinele sau testul." }, 400);
    const dosar = await s.get(cheiaDosar(cip), { type: "json" }).catch(() => null);
    const t = dosar?.teste?.find((x) => x.id === testId);
    if (!t) return json({ eroare: "Rezultat inexistent." }, 404);
    const alMeu = eu.rol === "membru" && eu.membru.id === t.depusDe;
    if (!(eu.rol === "registratura" || eu.rol === "admin" || alMeu))
      return json({ eroare: "Nu ai acces la acest certificat." }, 403);
    const b = await s.getWithMetadata(cheiaFisier(cip, testId), { type: "arrayBuffer" }).catch(() => null);
    if (!b || !b.data) return json({ eroare: "Certificatul nu e la dosar." }, 404);
    return new Response(b.data, {
      headers: {
        "Content-Type": b.metadata?.contentType || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Disposition": "inline",
      },
    });
  }

  return json({ eroare: "Acțiune necunoscută." }, 400);
});
