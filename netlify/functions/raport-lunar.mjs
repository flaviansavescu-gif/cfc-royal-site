// raport-lunar.mjs — raportul lunii, pe e-mail, în dimineața zilei de 1.
//
// DE CE. Controlul adaptiv înseamnă să vezi TENDINȚELE, nu doar avariile: câte
// certificate s-au emis, câte declarații au intrat, câte înscrieri, câte teste promovate,
// câte alerte au fost și cât au ținut. Alarmele spun când ceva se strică; raportul spune
// încotro merge asociația.
//
// SURSELE — toate deja existente, niciuna nouă:
//   • jurnalul de fapte (chei pe luni: jurnal/<AAAA-LL>/…) — activitatea registrului;
//   • coada expozițiilor — înscrierile primite;
//   • rezultatele Școlii (rezultat/<ms>-…) — testele susținute și promovate;
//   • memoria paznicului de intruziune — coduri greșite, vizitatori;
//   • istoricul alertelor monitorului (monitor-alerte/<AAAA-LL>/…, scris la fiecare alertă);
//   • sănătatea poștei.
//
// Cifrele lunii se păstrează și în magazie (raport-lunar/<AAAA-LL>), ca istoricul să
// rămână interogabil, nu doar trimis.
import { getStore } from "@netlify/blobs";
import { trimite, pagina, ADRESA_ASOCIATIEI, escapeHtml } from "./_comun/posta.mjs";
import { bateInima } from "./_comun/inima.mjs";
import { strangeZile } from "./_comun/paznic.mjs";
import { json } from "./_comun/raspuns.mjs";

/** Citește în paralel, în loturi: o lună de jurnal nu trebuie să curgă picătură cu picătură. */
async function citesteLot(store, chei, lot = 25) {
  const out = [];
  for (let i = 0; i < chei.length; i += lot) {
    const felii = await Promise.all(
      chei.slice(i, i + lot).map((k) => store.get(k, { type: "json" }).catch(() => null)),
    );
    out.push(...felii.filter(Boolean));
  }
  return out;
}

const nr = (v) => new Intl.NumberFormat("ro-RO").format(Number(v) || 0);

/** Durata unei avarii, pe înțelesul omului. */
function durata(deIso, laIso) {
  const ms = Date.parse(laIso) - Date.parse(deIso);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 60) return min + " min";
  const ore = Math.floor(min / 60);
  return ore + " h " + (min % 60) + " min";
}

export default async () => {
  await bateInima("raport-lunar");

  // Luna ÎNCHEIATĂ: raportul rulează pe 1 ale lunii, despre luna dinainte.
  const azi = new Date();
  const inceputLunaCurenta = new Date(Date.UTC(azi.getUTCFullYear(), azi.getUTCMonth(), 1));
  const lunaData = new Date(Date.UTC(azi.getUTCFullYear(), azi.getUTCMonth() - 1, 1));
  const luna = lunaData.toISOString().slice(0, 7);
  const numeLuna = lunaData.toLocaleDateString("ro-RO", { month: "long", year: "numeric", timeZone: "UTC" });
  const zileInLuna = Math.round((inceputLunaCurenta - lunaData) / 86400e3);

  const registru = getStore("registru");
  const expozitii = getStore("expozitii");
  const cursuri = getStore("cursuri");
  const acces = getStore("acces");

  // ——— 1. Jurnalul de fapte al lunii: câte, pe fiecare fel de faptă ———
  const fapte = {};
  let fapteTotal = 0;
  try {
    const { blobs } = await registru.list({ prefix: `jurnal/${luna}/` });
    const intrari = await citesteLot(registru, blobs.map((b) => b.key));
    fapteTotal = intrari.length;
    for (const i of intrari) {
      const et = i.eticheta || i.fapta || "necunoscută";
      fapte[et] = (fapte[et] || 0) + 1;
    }
  } catch (err) { console.error("Raport: jurnalul nu s-a putut citi:", err); }

  // ——— 2. Înscrierile la expoziții primite în lună ———
  let inscrieri = 0;
  try {
    const { blobs } = await expozitii.list({ prefix: "coada/" });
    const fise = await citesteLot(expozitii, blobs.map((b) => b.key));
    inscrieri = fise.filter((f) => String(f.creat || "").startsWith(luna)).length;
  } catch (err) { console.error("Raport: coada expozițiilor nu s-a putut citi:", err); }

  // ——— 3. Școala: testele susținute și promovate în lună ———
  // Cheile poartă momentul (rezultat/<ms>-…), deci luna se decupează FĂRĂ să citim tot.
  let testeSustinute = 0, testePromovate = 0;
  try {
    const { blobs } = await cursuri.list({ prefix: "rezultat/" });
    const dinLuna = blobs.filter((b) => {
      const ms = Number(String(b.key.slice("rezultat/".length)).split("-")[0]);
      return ms >= lunaData.getTime() && ms < inceputLunaCurenta.getTime();
    });
    const rezultate = await citesteLot(cursuri, dinLuna.map((b) => b.key));
    testeSustinute = rezultate.length;
    testePromovate = rezultate.filter((r) => r.promovat).length;
  } catch (err) { console.error("Raport: rezultatele Școlii nu s-au putut citi:", err); }

  // ——— 4. Paznicul de intruziune, pe toată luna ———
  let paznic = null;
  try {
    paznic = await strangeZile(acces, zileInLuna, inceputLunaCurenta);
  } catch (err) { console.error("Raport: paznicul nu s-a putut citi:", err); }

  // ——— 5. Alertele monitorului: câte au fost și cât au ținut ———
  let alerte = [];
  try {
    const { blobs } = await registru.list({ prefix: `monitor-alerte/${luna}/` });
    alerte = await citesteLot(registru, blobs.map((b) => b.key));
  } catch (err) { console.error("Raport: istoricul alertelor nu s-a putut citi:", err); }
  const avarii = alerte.filter((a) => a.tip === "cadere").length;
  const reveniri = alerte.filter((a) => a.tip === "revenire");

  const posta = await acces.get("posta-sanatate", { type: "json" }).catch(() => null);

  // ——— Cifrele se păstrează, apoi se povestesc ———
  const cifre = { luna, fapte, fapteTotal, inscrieri, testeSustinute, testePromovate,
    paznic: paznic ? { refuzuri: paznic.refuzuri, urme: paznic.urme?.size ?? null } : null,
    avarii, reveniri: reveniri.length, generat: new Date().toISOString() };
  try { await acces.setJSON("raport-lunar/" + luna, cifre); }
  catch (err) { console.error("Raportul nu s-a putut păstra în magazie:", err); }

  const randuriFapte = Object.entries(fapte).sort((a, b) => b[1] - a[1])
    .map(([et, n]) => `<tr><td style="padding:3px 14px 3px 0;color:#666">${escapeHtml(et)}</td><td><b>${nr(n)}</b></td></tr>`)
    .join("") || `<tr><td style="color:#666">nicio faptă consemnată în această lună</td></tr>`;
  const randuriAlerte = reveniri.length
    ? reveniri.map((r) => `<li>${escapeHtml(r.subiect || "avarie")} — a ținut ${escapeHtml(durata(r.de, r.la) || "puțin")}</li>`).join("")
    : "";

  const corp =
    `<h3 style="margin:18px 0 6px;color:#1F4D3A">Registrul genealogic — faptele lunii (${nr(fapteTotal)})</h3>` +
    `<table style="border-collapse:collapse;font-size:14px">${randuriFapte}</table>` +
    `<h3 style="margin:18px 0 6px;color:#1F4D3A">Expoziții</h3>` +
    `<p style="margin:0">Înscrieri primite online: <b>${nr(inscrieri)}</b></p>` +
    `<h3 style="margin:18px 0 6px;color:#1F4D3A">Școala de Arbitraj</h3>` +
    `<p style="margin:0">Teste susținute: <b>${nr(testeSustinute)}</b> · promovate: <b>${nr(testePromovate)}</b></p>` +
    `<h3 style="margin:18px 0 6px;color:#1F4D3A">Siguranță</h3>` +
    `<p style="margin:0">Paznicul de intruziune: <b>${paznic ? nr(paznic.refuzuri) : "?"}</b> coduri greșite, ` +
    `<b>${paznic?.urme ? nr(paznic.urme.size) : "?"}</b> vizitatori diferiți la uși.<br>` +
    `Avarii semnalate de monitor: <b>${nr(avarii)}</b>` +
    (randuriAlerte ? `</p><ul style="margin:6px 0 0;font-size:14px">${randuriAlerte}</ul><p style="margin:6px 0 0">` : ". ") +
    `Poșta: ${posta ? escapeHtml(posta.detaliu || (posta.ok ? "sănătoasă" : "cu probleme")) : "neverificată"}.</p>` +
    `<hr style="margin:20px 0;border:none;border-top:1px solid #ddd">` +
    `<p style="color:#888;font-size:12px">Trimis automat în dimineața zilei de 1. Cifrele lunii rămân și în ` +
    `magazie (raport-lunar/${luna}); starea la zi: cfc-royal.ro/registru/admin/stare/</p>`;

  const trimis = await trimite({
    catre: ADRESA_ASOCIATIEI,
    subiect: `[CFC-Royal] Raportul lunii ${numeLuna}`,
    html: pagina("Raportul lunii " + numeLuna, "#1F4D3A", corp),
  });

  console.log(`RAPORT ${luna}: ${fapteTotal} fapte, ${inscrieri} înscrieri, ${testePromovate}/${testeSustinute} teste, ${avarii} avarii — e-mail ${trimis ? "trimis" : "NETRIMIS"}.`);
  return json({ ok: true, luna, trimis, cifre });
};

// În dimineața zilei de 1 (05:00 UTC = 7–8 dimineața la București), despre luna încheiată.
export const config = { schedule: "0 5 1 * *" };
